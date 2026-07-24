use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE},
    Method, Url,
};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

const MAX_RESPONSE_BYTES: usize = 10 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES: usize = 10 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestRequest {
    method: String,
    url: String,
    headers: Vec<RestHeader>,
    body: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestHeader {
    name: String,
    value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestResponse {
    status: u16,
    status_text: String,
    headers: Vec<RestHeader>,
    body: String,
    duration_ms: u64,
    size_bytes: u64,
    content_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CommandError {
    code: &'static str,
    message: String,
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
    let request = validate_request(request)?;
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::limited(10))
        .user_agent("GetRest/0.1")
        .build()
        .map_err(|_| {
            CommandError::request_failed("The native HTTP client could not be initialized.")
        })?;

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

    let method = Method::from_bytes(request.method.as_bytes())
        .map_err(|_| CommandError::invalid_request("The HTTP method is not valid."))?;
    let url = Url::parse(&request.url)
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
        body: request.body,
    })
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
