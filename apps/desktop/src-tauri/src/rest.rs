use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE},
    Method, Url,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

const MAX_RESPONSE_BYTES: usize = 10 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES: usize = 10 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestRequest {
    pub(crate) method: String,
    pub(crate) url: String,
    pub(crate) headers: Vec<RestHeader>,
    pub(crate) body: Option<String>,
    #[serde(default)]
    pub(crate) variables: Vec<RestVariable>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct RestVariable {
    pub(crate) name: String,
    pub(crate) value: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestHeader {
    name: String,
    value: String,
}

impl RestHeader {
    pub(crate) fn json_content_type() -> Self {
        Self {
            name: "content-type".to_owned(),
            value: "application/json".to_owned(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestResponse {
    pub(crate) status: u16,
    status_text: String,
    headers: Vec<RestHeader>,
    pub(crate) body: String,
    pub(crate) duration_ms: u64,
    size_bytes: u64,
    content_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CommandError {
    pub(crate) code: &'static str,
    pub(crate) message: String,
}

impl CommandError {
    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: "invalid_request",
            message: message.into(),
        }
    }

    fn request_failed(message: impl Into<String>) -> Self {
        Self {
            code: "request_failed",
            message: message.into(),
        }
    }
}

struct ValidatedRequest {
    method: Method,
    url: Url,
    headers: HeaderMap,
    body: Option<String>,
}

#[tauri::command]
pub async fn send_rest_request(request: RestRequest) -> Result<RestResponse, CommandError> {
    let client = build_http_client()?;

    execute_rest_request(&client, request).await
}

pub(crate) async fn execute_rest_request(
    client: &reqwest::Client,
    request: RestRequest,
) -> Result<RestResponse, CommandError> {
    let request = validate_request(request)?;
    let mut builder = client
        .request(request.method, request.url)
        .headers(request.headers);

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let started_at = Instant::now();
    let mut response = builder.send().await.map_err(map_request_error)?;
    let status = response.status();
    let response_headers = response.headers().clone();
    let content_type = response_headers
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err(response_too_large());
    }

    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(map_request_error)? {
        if body.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err(response_too_large());
        }
        body.extend_from_slice(&chunk);
    }

    let headers = response_headers
        .iter()
        .map(|(name, value)| RestHeader {
            name: name.as_str().to_owned(),
            value: value.to_str().unwrap_or("<binary value>").to_owned(),
        })
        .collect();
    let size_bytes = body.len() as u64;

    Ok(RestResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_owned(),
        headers,
        body: String::from_utf8_lossy(&body).into_owned(),
        duration_ms: started_at.elapsed().as_millis() as u64,
        size_bytes,
        content_type,
    })
}

pub(crate) fn build_http_client() -> Result<reqwest::Client, CommandError> {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::limited(10))
        .user_agent("GetRest/0.1")
        .build()
        .map_err(|_| {
            CommandError::request_failed("The native HTTP client could not be initialized.")
        })
}

fn validate_request(request: RestRequest) -> Result<ValidatedRequest, CommandError> {
    if request
        .body
        .as_ref()
        .is_some_and(|body| body.len() > MAX_REQUEST_BODY_BYTES)
    {
        return Err(CommandError::invalid_request(
            "The request body exceeds the 10 MiB limit.",
        ));
    }

    let variables = validate_variables(request.variables)?;
    let resolved_url = resolve_template(&request.url, &variables)?;
    let resolved_body = request
        .body
        .map(|body| resolve_template(&body, &variables))
        .transpose()?;
    if resolved_body
        .as_ref()
        .is_some_and(|body| body.len() > MAX_REQUEST_BODY_BYTES)
    {
        return Err(CommandError::invalid_request(
            "The resolved request body exceeds the 10 MiB limit.",
        ));
    }

    let method = Method::from_bytes(request.method.as_bytes())
        .map_err(|_| CommandError::invalid_request("The HTTP method is not valid."))?;
    let url = Url::parse(&resolved_url)
        .map_err(|_| CommandError::invalid_request("The request URL is not valid."))?;

    if !matches!(url.scheme(), "http" | "https") {
        return Err(CommandError::invalid_request(
            "Only HTTP and HTTPS request URLs are supported.",
        ));
    }

    let mut headers = HeaderMap::new();
    for header in request.headers {
        let name = HeaderName::from_bytes(header.name.as_bytes())
            .map_err(|_| CommandError::invalid_request("A request header name is not valid."))?;
        let value = HeaderValue::from_str(&header.value)
            .map_err(|_| CommandError::invalid_request("A request header value is not valid."))?;
        headers.append(name, value);
    }

    Ok(ValidatedRequest {
        method,
        url,
        headers,
        body: resolved_body,
    })
}

fn validate_variables(
    variables: Vec<RestVariable>,
) -> Result<HashMap<String, String>, CommandError> {
    if variables.len() > 200 {
        return Err(CommandError::invalid_request(
            "The active environment contains too many variables.",
        ));
    }
    let mut values = HashMap::new();
    let mut names = HashSet::new();
    for variable in variables {
        if !valid_variable_name(&variable.name)
            || variable.value.len() > 64 * 1024
            || variable.value.contains('\0')
            || !names.insert(variable.name.clone())
        {
            return Err(CommandError::invalid_request(
                "The active environment contains an invalid or duplicate variable.",
            ));
        }
        values.insert(variable.name, variable.value);
    }
    Ok(values)
}

fn valid_variable_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 100 {
        return false;
    }
    let mut characters = name.chars();
    let Some(first) = characters.next() else {
        return false;
    };
    (first.is_ascii_alphabetic() || first == '_')
        && characters.all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '.' | '-')
        })
}

fn resolve_template(
    template: &str,
    variables: &HashMap<String, String>,
) -> Result<String, CommandError> {
    let mut resolved = String::with_capacity(template.len());
    let mut remainder = template;
    while let Some(start) = remainder.find("{{") {
        resolved.push_str(&remainder[..start]);
        let placeholder = &remainder[start + 2..];
        let end = placeholder.find("}}").ok_or_else(|| {
            CommandError::invalid_request("A variable placeholder is not closed with }}.")
        })?;
        let name = placeholder[..end].trim();
        if !valid_variable_name(name) {
            return Err(CommandError::invalid_request(
                "A variable placeholder contains an invalid name.",
            ));
        }
        let value = variables.get(name).ok_or_else(|| {
            CommandError::invalid_request(format!(
                "Define a value for {{{{{name}}}}} in the active environment."
            ))
        })?;
        resolved.push_str(value);
        remainder = &placeholder[end + 2..];
    }
    resolved.push_str(remainder);
    Ok(resolved)
}

fn map_request_error(error: reqwest::Error) -> CommandError {
    if error.is_timeout() {
        CommandError::request_failed("The request timed out after 30 seconds.")
    } else if error.is_connect() {
        CommandError::request_failed("The remote API could not be reached.")
    } else {
        CommandError::request_failed("The request could not be completed.")
    }
}

fn response_too_large() -> CommandError {
    CommandError::request_failed(
        "The response exceeds the 10 MiB limit for this initial implementation.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(url: &str) -> RestRequest {
        RestRequest {
            method: "GET".to_owned(),
            url: url.to_owned(),
            headers: vec![],
            body: None,
            variables: vec![],
        }
    }

    #[test]
    fn accepts_http_and_https_urls() {
        assert!(validate_request(request("https://example.com/todos/1")).is_ok());
        assert!(validate_request(request("http://localhost:3000/health")).is_ok());
    }

    #[test]
    fn rejects_non_http_urls() {
        let result = validate_request(request("file:///tmp/request.json"));

        assert!(matches!(
            result,
            Err(CommandError {
                code: "invalid_request",
                ..
            })
        ));
    }

    #[test]
    fn rejects_invalid_headers() {
        let mut input = request("https://example.com");
        input.headers.push(RestHeader {
            name: "bad header".to_owned(),
            value: "value".to_owned(),
        });

        assert!(validate_request(input).is_err());
    }

    #[test]
    fn rejects_request_bodies_over_the_limit() {
        let mut input = request("https://example.com");
        input.body = Some("a".repeat(MAX_REQUEST_BODY_BYTES + 1));

        assert!(validate_request(input).is_err());
    }

    #[test]
    fn resolves_environment_variables_in_urls_and_bodies() {
        let mut input = request("{{ baseUrl }}/todos/{{todoId}}");
        input.method = "POST".to_owned();
        input.body = Some(r#"{"id":"{{todoId}}","literal":"{ok}"}"#.to_owned());
        input.variables = vec![
            RestVariable {
                name: "baseUrl".to_owned(),
                value: "https://example.com".to_owned(),
            },
            RestVariable {
                name: "todoId".to_owned(),
                value: "42".to_owned(),
            },
        ];

        let resolved = validate_request(input).expect("variables should resolve");

        assert_eq!(resolved.url.as_str(), "https://example.com/todos/42");
        assert_eq!(
            resolved.body.as_deref(),
            Some(r#"{"id":"42","literal":"{ok}"}"#)
        );
    }

    #[test]
    fn rejects_missing_and_malformed_environment_variables() {
        let Err(missing) = validate_request(request("{{baseUrl}}/todos")) else {
            panic!("missing variable should be rejected");
        };
        assert_eq!(missing.code, "invalid_request");
        assert!(missing.message.contains("baseUrl"));

        let Err(malformed) = validate_request(request("{{baseUrl/todos")) else {
            panic!("malformed placeholder should be rejected");
        };
        assert_eq!(malformed.code, "invalid_request");
        assert!(malformed.message.contains("not closed"));
    }

    #[test]
    #[ignore = "requires access to the public test API"]
    fn receives_a_public_json_response() {
        let response = tauri::async_runtime::block_on(send_rest_request(request(
            "https://jsonplaceholder.typicode.com/todos/1",
        )))
        .expect("the public test request should succeed");

        assert_eq!(response.status, 200);
        assert!(response.body.contains("\"id\": 1"));
        assert!(response
            .content_type
            .is_some_and(|value| value.contains("application/json")));
    }
}
