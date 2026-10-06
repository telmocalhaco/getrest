use crate::rest::{build_http_client, execute_rest_request, RestHeader, RestRequest, RestVariable};
use crate::variable_names::valid_variable_name;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, time::Instant};
use tokio::time::{sleep, Duration};

const MAX_VIRTUAL_USERS: u32 = 50;
const MAX_ITERATIONS: u32 = 1_000;
const MAX_STEPS: usize = 100;
const MAX_TOTAL_REQUESTS: u64 = 10_000;
const MAX_THINK_TIME_MS: u64 = 60_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCollectionInput {
    steps: Vec<RunnerStep>,
    #[serde(default)]
    variables: Vec<RestVariable>,
    virtual_users: u32,
    iterations: u32,
    think_time_ms: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunnerStep {
    request_id: String,
    name: String,
    method: String,
    url: String,
    body: String,
    #[serde(default)]
    extractors: Vec<ResponseExtractor>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResponseExtractor {
    variable_name: String,
    json_path: String,
    #[serde(default = "default_required")]
    required: bool,
}

fn default_required() -> bool {
    true
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRunResult {
    total_requests: u64,
    passed_requests: u64,
    failed_requests: u64,
    duration_ms: u64,
    requests_per_second: f64,
    average_duration_ms: u64,
    p95_duration_ms: u64,
    steps: Vec<RunnerStepResult>,
    errors: Vec<RunnerErrorSample>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunnerStepResult {
    request_id: String,
    name: String,
    executions: u64,
    passed: u64,
    failed: u64,
    average_duration_ms: u64,
    p95_duration_ms: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunnerErrorSample {
    virtual_user: u32,
    iteration: u32,
    step_name: String,
    message: String,
}

#[derive(Debug, Serialize)]
pub struct RunnerCommandError {
    code: &'static str,
    message: String,
}

impl RunnerCommandError {
    fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: "invalid_collection_run",
            message: message.into(),
        }
    }
}

#[derive(Default)]
struct UserRunResult {
    samples: Vec<StepSample>,
    errors: Vec<RunnerErrorSample>,
}

struct StepSample {
    step_index: usize,
    duration_ms: u64,
    passed: bool,
}

#[tauri::command]
pub async fn run_collection(
    input: RunCollectionInput,
) -> Result<CollectionRunResult, RunnerCommandError> {
    validate_input(&input)?;
    let client = build_http_client().map_err(|error| RunnerCommandError::invalid(error.message))?;
    let started_at = Instant::now();
    let mut tasks = Vec::with_capacity(input.virtual_users as usize);

    for user_index in 0..input.virtual_users {
        let user_input = input.clone();
        let user_client = client.clone();
        tasks.push(tauri::async_runtime::spawn(async move {
            run_virtual_user(user_index + 1, user_input, user_client).await
        }));
    }

    let mut user_results = Vec::with_capacity(tasks.len());
    for task in tasks {
        user_results
            .push(task.await.map_err(|_| {
                RunnerCommandError::invalid("A virtual user stopped unexpectedly.")
            })?);
    }

    Ok(summarize(
        &input.steps,
        user_results,
        started_at.elapsed().as_millis() as u64,
    ))
}

fn validate_input(input: &RunCollectionInput) -> Result<(), RunnerCommandError> {
    if input.steps.is_empty() || input.steps.len() > MAX_STEPS {
        return Err(RunnerCommandError::invalid(
            "Choose between 1 and 100 flow steps.",
        ));
    }
    if input.virtual_users == 0 || input.virtual_users > MAX_VIRTUAL_USERS {
        return Err(RunnerCommandError::invalid(
            "Virtual users must be between 1 and 50.",
        ));
    }
    if input.iterations == 0 || input.iterations > MAX_ITERATIONS {
        return Err(RunnerCommandError::invalid(
            "Iterations must be between 1 and 1000.",
        ));
    }
    let total = input.steps.len() as u64 * input.virtual_users as u64 * input.iterations as u64;
    if total > MAX_TOTAL_REQUESTS {
        return Err(RunnerCommandError::invalid(
            "This run exceeds the 10,000 request safety limit.",
        ));
    }
    if input.think_time_ms > MAX_THINK_TIME_MS {
        return Err(RunnerCommandError::invalid(
            "Think time cannot exceed 60 seconds.",
        ));
    }
    if input
        .variables
        .iter()
        .any(|variable| !valid_variable_name(&variable.name))
    {
        return Err(RunnerCommandError::invalid(
            "Environment variable names must be valid and cannot use the reserved names __proto__, constructor, or prototype.",
        ));
    }
    for step in &input.steps {
        if step.request_id.trim().is_empty() || step.name.trim().is_empty() {
            return Err(RunnerCommandError::invalid(
                "Every flow step must reference a named request.",
            ));
        }
        for extractor in &step.extractors {
            if !valid_variable_name(&extractor.variable_name)
                || extractor.json_path.trim().is_empty()
            {
                return Err(RunnerCommandError::invalid(
                    "Every extractor needs a valid, non-reserved variable name and JSON path.",
                ));
            }
        }
    }
    Ok(())
}

async fn run_virtual_user(
    user: u32,
    input: RunCollectionInput,
    client: reqwest::Client,
) -> UserRunResult {
    let base_variables: HashMap<String, String> = input
        .variables
        .into_iter()
        .map(|item| (item.name, item.value))
        .collect();
    let mut result = UserRunResult::default();
    for iteration in 1..=input.iterations {
        let mut variables = base_variables.clone();
        for (step_index, step) in input.steps.iter().enumerate() {
            let request = RestRequest {
                method: step.method.clone(),
                url: step.url.clone(),
                headers: if step.body.trim().is_empty() {
                    vec![]
                } else {
                    vec![RestHeader::json_content_type()]
                },
                body: if step.body.trim().is_empty() {
                    None
                } else {
                    Some(step.body.clone())
                },
                variables: variables
                    .iter()
                    .map(|(name, value)| RestVariable {
                        name: name.clone(),
                        value: value.clone(),
                    })
                    .collect(),
            };
            let outcome = execute_rest_request(&client, request).await;
            let (duration_ms, passed, error) = match outcome {
                Ok(response) => {
                    match apply_extractors(&step.extractors, &response.body, &mut variables) {
                        Ok(()) if response.status < 400 => (response.duration_ms, true, None),
                        Ok(()) => (
                            response.duration_ms,
                            false,
                            Some(format!("Unexpected HTTP status {}.", response.status)),
                        ),
                        Err(message) => (response.duration_ms, false, Some(message)),
                    }
                }
                Err(error) => (0, false, Some(error.message)),
            };
            result.samples.push(StepSample {
                step_index,
                duration_ms,
                passed,
            });
            if let Some(message) = error {
                if result.errors.len() < 20 {
                    result.errors.push(RunnerErrorSample {
                        virtual_user: user,
                        iteration,
                        step_name: step.name.clone(),
                        message,
                    });
                }
                break;
            }
            if input.think_time_ms > 0 && step_index + 1 < input.steps.len() {
                sleep(Duration::from_millis(input.think_time_ms)).await;
            }
        }
    }
    result
}

fn apply_extractors(
    extractors: &[ResponseExtractor],
    body: &str,
    variables: &mut HashMap<String, String>,
) -> Result<(), String> {
    if extractors.is_empty() {
        return Ok(());
    }
    let json: Value = serde_json::from_str(body).map_err(|_| {
        "The response is not valid JSON, so values could not be extracted.".to_owned()
    })?;
    for extractor in extractors {
        match json_path_value(&json, extractor.json_path.trim()) {
            Some(value) => {
                variables.insert(extractor.variable_name.clone(), json_value_to_string(value));
            }
            None if extractor.required => {
                return Err(format!(
                    "JSON path '{}' was not found.",
                    extractor.json_path
                ))
            }
            None => {}
        }
    }
    Ok(())
}

fn json_path_value<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = root;
    for part in path.trim_start_matches("$.").split('.') {
        if part.is_empty() {
            continue;
        }
        current = if let Ok(index) = part.parse::<usize>() {
            current.as_array()?.get(index)?
        } else {
            current.as_object()?.get(part)?
        };
    }
    Some(current)
}

fn json_value_to_string(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        _ => value.to_string(),
    }
}

fn percentile(values: &mut [u64], percentile: f64) -> u64 {
    if values.is_empty() {
        return 0;
    }
    values.sort_unstable();
    values[((values.len() as f64 * percentile).ceil() as usize)
        .saturating_sub(1)
        .min(values.len() - 1)]
}

fn summarize(
    steps: &[RunnerStep],
    users: Vec<UserRunResult>,
    duration_ms: u64,
) -> CollectionRunResult {
    let samples: Vec<StepSample> = users
        .iter()
        .flat_map(|result| result.samples.iter())
        .map(|sample| StepSample {
            step_index: sample.step_index,
            duration_ms: sample.duration_ms,
            passed: sample.passed,
        })
        .collect();
    let total_requests = samples.len() as u64;
    let passed_requests = samples.iter().filter(|sample| sample.passed).count() as u64;
    let mut durations: Vec<u64> = samples.iter().map(|sample| sample.duration_ms).collect();
    let average_duration_ms = if durations.is_empty() {
        0
    } else {
        durations.iter().sum::<u64>() / durations.len() as u64
    };
    let p95_duration_ms = percentile(&mut durations, 0.95);
    let step_results = steps
        .iter()
        .enumerate()
        .map(|(index, step)| {
            let step_samples: Vec<&StepSample> = samples
                .iter()
                .filter(|sample| sample.step_index == index)
                .collect();
            let mut step_durations: Vec<u64> = step_samples
                .iter()
                .map(|sample| sample.duration_ms)
                .collect();
            RunnerStepResult {
                request_id: step.request_id.clone(),
                name: step.name.clone(),
                executions: step_samples.len() as u64,
                passed: step_samples.iter().filter(|sample| sample.passed).count() as u64,
                failed: step_samples.iter().filter(|sample| !sample.passed).count() as u64,
                average_duration_ms: if step_durations.is_empty() {
                    0
                } else {
                    step_durations.iter().sum::<u64>() / step_durations.len() as u64
                },
                p95_duration_ms: percentile(&mut step_durations, 0.95),
            }
        })
        .collect();
    CollectionRunResult {
        total_requests,
        passed_requests,
        failed_requests: total_requests - passed_requests,
        duration_ms,
        requests_per_second: if duration_ms == 0 {
            0.0
        } else {
            total_requests as f64 / (duration_ms as f64 / 1000.0)
        },
        average_duration_ms,
        p95_duration_ms,
        steps: step_results,
        errors: users
            .into_iter()
            .flat_map(|result| result.errors)
            .take(20)
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_nested_json_values_and_array_indexes() {
        let value: Value = serde_json::from_str(r#"{"data":{"users":[{"id":42}]}}"#).unwrap();
        assert_eq!(
            json_path_value(&value, "data.users.0.id"),
            Some(&Value::from(42))
        );
    }

    #[test]
    fn rejects_runs_above_the_request_limit() {
        let input = RunCollectionInput {
            steps: (0..100)
                .map(|index| RunnerStep {
                    request_id: index.to_string(),
                    name: "step".into(),
                    method: "GET".into(),
                    url: "https://example.com".into(),
                    body: String::new(),
                    extractors: vec![],
                })
                .collect(),
            variables: vec![],
            virtual_users: 50,
            iterations: 3,
            think_time_ms: 0,
        };
        assert!(validate_input(&input).is_err());
    }

    #[test]
    fn rejects_reserved_names_in_environments_and_extractors() {
        let mut input = RunCollectionInput {
            steps: vec![RunnerStep {
                request_id: "request-1".into(),
                name: "Test request".into(),
                method: "GET".into(),
                url: "https://example.com".into(),
                body: String::new(),
                extractors: vec![],
            }],
            variables: vec![RestVariable {
                name: "prototype".into(),
                value: "test-value".into(),
            }],
            virtual_users: 1,
            iterations: 1,
            think_time_ms: 0,
        };
        assert!(validate_input(&input).is_err());
        input.variables.clear();
        input.steps[0].extractors.push(ResponseExtractor {
            variable_name: "constructor".into(),
            json_path: "data.id".into(),
            required: true,
        });
        assert!(validate_input(&input).is_err());
        input.steps[0].extractors[0].variable_name = "X-Auth-Hash".into();
        assert!(validate_input(&input).is_ok());
    }
}
