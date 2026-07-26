use reqwest::Url;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Output},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

const WORKSPACE_SCHEMA_VERSION: u32 = 1;
const WORKSPACE_MANIFEST: &str = "workspace.json";
const INITIAL_COMMIT_MESSAGE: &str = "chore: initialize GetRest workspace";
const RENAME_COMMIT_MESSAGE: &str = "chore: rename GetRest workspace";
const MAX_COLLECTION_FILE_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceInput {
    directory: String,
    git_author: Option<GitAuthor>,
    #[serde(default)]
    collections: Vec<WorkspaceCollection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitAuthor {
    name: String,
    email: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameWorkspaceInput {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkspaceRequestInput {
    workspace_id: String,
    collection_name: String,
    request: UnsavedWorkspaceRequest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameWorkspaceCollectionInput {
    workspace_id: String,
    current_name: String,
    new_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceCollectionInput {
    workspace_id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsavedWorkspaceRequest {
    id: Option<String>,
    name: String,
    method: String,
    path: String,
    body: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCollection {
    name: String,
    requests: Vec<WorkspaceRequest>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRequest {
    id: String,
    name: String,
    method: String,
    path: String,
    body: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkspaceRequestResult {
    workspace: WorkspaceSummary,
    collections: Vec<WorkspaceCollection>,
    request: WorkspaceRequest,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCollectionsMutationResult {
    workspace: WorkspaceSummary,
    collections: Vec<WorkspaceCollection>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    id: String,
    name: String,
    path: String,
    git_state: WorkspaceGitState,
    has_remote: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum WorkspaceGitState {
    LocalOnly,
    Clean,
    Changes,
    Unavailable,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceManifest {
    schema_version: u32,
    id: String,
    name: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCommandError {
    code: &'static str,
    message: String,
}

impl WorkspaceCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[tauri::command]
pub async fn choose_workspace_directory(
    app: AppHandle,
) -> Result<Option<String>, WorkspaceCommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choose an empty workspace folder")
            .blocking_pick_folder()
            .map(|path| {
                path.into_path()
                    .map_err(|_| {
                        WorkspaceCommandError::new(
                            "unsupported_workspace_path",
                            "The selected folder path is not supported.",
                        )
                    })
                    .and_then(|path| path_to_string(&path))
            })
            .transpose()
    })
    .await
    .map_err(|_| {
        WorkspaceCommandError::new(
            "folder_dialog_failed",
            "The workspace folder dialog stopped unexpectedly.",
        )
    })?
}

#[tauri::command]
pub async fn create_workspace(
    app: AppHandle,
    input: CreateWorkspaceInput,
) -> Result<WorkspaceSummary, WorkspaceCommandError> {
    let app_data_dir = app.path().app_data_dir().map_err(|_| {
        WorkspaceCommandError::new(
            "local_storage_unavailable",
            "GetRest could not access its local application data directory.",
        )
    })?;

    tauri::async_runtime::spawn_blocking(move || {
        let summary = create_workspace_repository(input)?;
        if let Err(error) = remember_workspace(&app_data_dir, &summary) {
            rollback_initialization(Path::new(&summary.path));
            return Err(error);
        }
        Ok(summary)
    })
    .await
    .map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_creation_failed",
            "The workspace operation stopped unexpectedly.",
        )
    })?
}

#[tauri::command]
pub async fn get_active_workspace(
    app: AppHandle,
) -> Result<Option<WorkspaceSummary>, WorkspaceCommandError> {
    let app_data_dir = app.path().app_data_dir().map_err(|_| {
        WorkspaceCommandError::new(
            "local_storage_unavailable",
            "GetRest could not access its local application data directory.",
        )
    })?;

    tauri::async_runtime::spawn_blocking(move || load_active_workspace(&app_data_dir))
        .await
        .map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_load_failed",
                "The saved workspace could not be loaded.",
            )
        })?
}

#[tauri::command]
pub async fn list_workspaces(
    app: AppHandle,
) -> Result<Vec<WorkspaceSummary>, WorkspaceCommandError> {
    let app_data_dir = application_data_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || load_workspaces(&app_data_dir))
        .await
        .map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_load_failed",
                "The saved workspaces could not be loaded.",
            )
        })?
}

#[tauri::command]
pub async fn activate_workspace(
    app: AppHandle,
    id: String,
) -> Result<WorkspaceSummary, WorkspaceCommandError> {
    let app_data_dir = application_data_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let workspace = load_workspace_by_id(&app_data_dir, &id)?;
        remember_workspace(&app_data_dir, &workspace)?;
        Ok(workspace)
    })
    .await
    .map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_load_failed",
            "The workspace could not be activated.",
        )
    })?
}

#[tauri::command]
pub async fn rename_workspace(
    app: AppHandle,
    input: RenameWorkspaceInput,
) -> Result<WorkspaceSummary, WorkspaceCommandError> {
    let app_data_dir = application_data_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || rename_workspace_repository(&app_data_dir, input))
        .await
        .map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_rename_failed",
                "The workspace rename operation stopped unexpectedly.",
            )
        })?
}

#[tauri::command]
pub async fn load_workspace_collections(
    app: AppHandle,
    id: String,
) -> Result<Vec<WorkspaceCollection>, WorkspaceCommandError> {
    let app_data_dir = application_data_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let workspace = load_workspace_by_id(&app_data_dir, &id)?;
        read_workspace_collections(Path::new(&workspace.path))
    })
    .await
    .map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_load_failed",
            "The workspace collections could not be loaded.",
        )
    })?
}

#[tauri::command]
pub async fn save_workspace_request(
    app: AppHandle,
    input: SaveWorkspaceRequestInput,
) -> Result<SaveWorkspaceRequestResult, WorkspaceCommandError> {
    let app_data_dir = application_data_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || save_request_to_workspace(&app_data_dir, input))
        .await
        .map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_request_save_failed",
                "The request save operation stopped unexpectedly.",
            )
        })?
}

#[tauri::command]
pub async fn rename_workspace_collection(
    app: AppHandle,
    input: RenameWorkspaceCollectionInput,
) -> Result<WorkspaceCollectionsMutationResult, WorkspaceCommandError> {
    let app_data_dir = application_data_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        rename_collection_in_workspace(&app_data_dir, input)
    })
    .await
    .map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_collection_rename_failed",
            "The collection rename operation stopped unexpectedly.",
        )
    })?
}

#[tauri::command]
pub async fn create_workspace_collection(
    app: AppHandle,
    input: CreateWorkspaceCollectionInput,
) -> Result<WorkspaceCollectionsMutationResult, WorkspaceCommandError> {
    let app_data_dir = application_data_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        create_collection_in_workspace(&app_data_dir, input)
    })
    .await
    .map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_collection_create_failed",
            "The collection creation operation stopped unexpectedly.",
        )
    })?
}

fn create_workspace_repository(
    input: CreateWorkspaceInput,
) -> Result<WorkspaceSummary, WorkspaceCommandError> {
    let directory = validate_target_directory(&input.directory)?;
    ensure_git_is_available()?;
    let git_author = resolve_git_author(&directory, input.git_author)?;
    validate_collections(&input.collections)?;
    let name = workspace_name(&directory)?;
    let id = Uuid::new_v4().to_string();
    let created_at = OffsetDateTime::now_utc().format(&Rfc3339).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_creation_failed",
            "The workspace creation time could not be generated.",
        )
    })?;
    let manifest = WorkspaceManifest {
        schema_version: WORKSPACE_SCHEMA_VERSION,
        id: id.clone(),
        name: name.clone(),
        created_at,
    };

    let result = initialize_repository(
        &directory,
        &manifest,
        &input.collections,
        git_author.as_ref(),
    );
    if let Err(error) = result {
        rollback_initialization(&directory);
        return Err(error);
    }

    Ok(WorkspaceSummary {
        id,
        name,
        path: path_to_string(&directory)?,
        git_state: WorkspaceGitState::LocalOnly,
        has_remote: false,
    })
}

fn validate_target_directory(value: &str) -> Result<PathBuf, WorkspaceCommandError> {
    if value.trim().is_empty() {
        return Err(WorkspaceCommandError::new(
            "invalid_workspace_directory",
            "Choose a folder for the workspace.",
        ));
    }

    let directory = fs::canonicalize(value).map_err(|_| {
        WorkspaceCommandError::new(
            "invalid_workspace_directory",
            "The selected folder could not be accessed.",
        )
    })?;
    let metadata = fs::metadata(&directory).map_err(|_| {
        WorkspaceCommandError::new(
            "invalid_workspace_directory",
            "The selected folder could not be inspected.",
        )
    })?;
    if !metadata.is_dir() {
        return Err(WorkspaceCommandError::new(
            "invalid_workspace_directory",
            "The selected path is not a folder.",
        ));
    }

    let mut entries = fs::read_dir(&directory).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_directory_unavailable",
            "GetRest cannot read the selected folder.",
        )
    })?;
    if entries
        .next()
        .transpose()
        .map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_directory_unavailable",
                "GetRest cannot inspect the selected folder.",
            )
        })?
        .is_some()
    {
        return Err(WorkspaceCommandError::new(
            "workspace_directory_not_empty",
            "Choose an empty folder for the new workspace.",
        ));
    }

    if directory
        .parent()
        .into_iter()
        .flat_map(Path::ancestors)
        .any(|ancestor| ancestor.join(".git").exists())
    {
        return Err(WorkspaceCommandError::new(
            "workspace_inside_repository",
            "The workspace folder cannot be inside another Git repository.",
        ));
    }

    path_to_string(&directory)?;
    Ok(directory)
}

fn ensure_git_is_available() -> Result<(), WorkspaceCommandError> {
    match Command::new("git").arg("--version").output() {
        Ok(output) if output.status.success() => Ok(()),
        _ => Err(WorkspaceCommandError::new(
            "git_not_available",
            "Git is required to create a workspace and was not found.",
        )),
    }
}

fn resolve_git_author(
    directory: &Path,
    author: Option<GitAuthor>,
) -> Result<Option<GitAuthor>, WorkspaceCommandError> {
    if let Some(author) = author {
        validate_git_author(&author)?;
        return Ok(Some(GitAuthor {
            name: author.name.trim().to_owned(),
            email: author.email.trim().to_owned(),
        }));
    }

    let name = read_git_config(directory, "user.name");
    let email = read_git_config(directory, "user.email");
    if name.is_some_and(|value| !value.is_empty()) && email.is_some_and(|value| !value.is_empty()) {
        Ok(None)
    } else {
        Err(WorkspaceCommandError::new(
            "git_identity_required",
            "Enter the Git author name and email for the first workspace commit.",
        ))
    }
}

fn validate_git_author(author: &GitAuthor) -> Result<(), WorkspaceCommandError> {
    let name = author.name.trim();
    let email = author.email.trim();

    if name.is_empty() || name.len() > 100 || name.chars().any(|value| value.is_control()) {
        return Err(WorkspaceCommandError::new(
            "invalid_git_identity",
            "Enter a valid Git author name.",
        ));
    }
    if email.len() > 254
        || email.chars().any(char::is_whitespace)
        || email.starts_with('@')
        || email.ends_with('@')
        || email.matches('@').count() != 1
    {
        return Err(WorkspaceCommandError::new(
            "invalid_git_identity",
            "Enter a valid Git author email.",
        ));
    }

    Ok(())
}

fn initialize_repository(
    directory: &Path,
    manifest: &WorkspaceManifest,
    collections: &[WorkspaceCollection],
    author: Option<&GitAuthor>,
) -> Result<(), WorkspaceCommandError> {
    run_git(
        directory,
        &["init", "--initial-branch=main"],
        "git_init_failed",
    )?;

    if let Some(author) = author {
        run_git(
            directory,
            &["config", "--local", "user.name", author.name.as_str()],
            "git_identity_failed",
        )?;
        run_git(
            directory,
            &["config", "--local", "user.email", author.email.as_str()],
            "git_identity_failed",
        )?;
    }

    let manifest_text = serde_json::to_string_pretty(manifest).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_creation_failed",
            "The workspace manifest could not be generated.",
        )
    })?;
    write_new_file(
        &directory.join(WORKSPACE_MANIFEST),
        format!("{manifest_text}\n").as_bytes(),
    )?;
    fs::create_dir(directory.join("collections")).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_creation_failed",
            "The collections folder could not be created.",
        )
    })?;
    fs::create_dir(directory.join("environments")).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_creation_failed",
            "The environments folder could not be created.",
        )
    })?;
    write_workspace_collections(directory, collections)?;

    run_git(
        directory,
        &[
            "add",
            "--",
            WORKSPACE_MANIFEST,
            "collections",
            "environments",
        ],
        "git_stage_failed",
    )?;
    run_git(
        directory,
        &["commit", "-m", INITIAL_COMMIT_MESSAGE],
        "git_commit_failed",
    )?;
    Ok(())
}

fn write_workspace_collections(
    directory: &Path,
    collections: &[WorkspaceCollection],
) -> Result<(), WorkspaceCommandError> {
    let collections_directory = directory.join("collections");
    write_collection_files(&collections_directory, collections)?;
    write_new_file(&directory.join("environments").join(".gitkeep"), b"")
}

fn write_collection_files(
    collections_directory: &Path,
    collections: &[WorkspaceCollection],
) -> Result<(), WorkspaceCommandError> {
    if collections.is_empty() {
        write_new_file(&collections_directory.join(".gitkeep"), b"")?;
    } else {
        for (index, collection) in collections.iter().enumerate() {
            let file_name = format!("{index:03}-{}.json", file_slug(&collection.name));
            let content = serde_json::to_string_pretty(collection).map_err(|_| {
                WorkspaceCommandError::new(
                    "workspace_creation_failed",
                    "A collection could not be prepared for the workspace.",
                )
            })?;
            write_new_file(
                &collections_directory.join(file_name),
                format!("{content}\n").as_bytes(),
            )?;
        }
    }
    Ok(())
}

fn file_slug(value: &str) -> String {
    let slug: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "collection".to_owned()
    } else {
        slug.chars().take(60).collect()
    }
}

fn validate_collections(collections: &[WorkspaceCollection]) -> Result<(), WorkspaceCommandError> {
    if collections.len() > 500 {
        return Err(invalid_collections_error());
    }
    let mut collection_names = HashSet::new();
    let mut request_ids = HashSet::new();
    for collection in collections {
        if !valid_text(&collection.name, 100)
            || !collection_names.insert(collection.name.to_lowercase())
            || collection.requests.len() > 10_000
        {
            return Err(invalid_collections_error());
        }
        for request in &collection.requests {
            if !valid_text(&request.id, 100)
                || !request_ids.insert(request.id.clone())
                || !valid_text(&request.name, 200)
                || request.path.trim().is_empty()
                || request.path.len() > 16_384
                || request.body.len() > MAX_COLLECTION_FILE_BYTES as usize
                || !is_http_url(&request.path)
                || !matches!(
                    request.method.as_str(),
                    "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
                )
            {
                return Err(invalid_collections_error());
            }
        }
    }
    Ok(())
}

fn is_http_url(value: &str) -> bool {
    Url::parse(value)
        .map(|url| matches!(url.scheme(), "http" | "https") && url.host().is_some())
        .unwrap_or(false)
}

fn valid_text(value: &str, maximum_length: usize) -> bool {
    let value = value.trim();
    !value.is_empty() && value.len() <= maximum_length && !value.chars().any(char::is_control)
}

fn invalid_collections_error() -> WorkspaceCommandError {
    WorkspaceCommandError::new(
        "invalid_workspace_collections",
        "The current collections contain unsupported or oversized values.",
    )
}

fn write_new_file(path: &Path, content: &[u8]) -> Result<(), WorkspaceCommandError> {
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_creation_failed",
                "The workspace manifest could not be created.",
            )
        })?;
    file.write_all(content).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_creation_failed",
            "The workspace manifest could not be written.",
        )
    })
}

fn run_git(
    directory: &Path,
    arguments: &[&str],
    error_code: &'static str,
) -> Result<Output, WorkspaceCommandError> {
    let output = Command::new("git")
        .args(arguments)
        .current_dir(directory)
        .output()
        .map_err(|_| {
            WorkspaceCommandError::new(error_code, "Git could not complete the operation.")
        })?;
    if output.status.success() {
        Ok(output)
    } else {
        Err(WorkspaceCommandError::new(
            error_code,
            "Git could not complete the workspace operation.",
        ))
    }
}

fn read_git_config(directory: &Path, key: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["config", "--get", key])
        .current_dir(directory)
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn workspace_name(directory: &Path) -> Result<String, WorkspaceCommandError> {
    let name = directory
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty() && value.len() <= 100)
        .ok_or_else(|| {
            WorkspaceCommandError::new(
                "invalid_workspace_name",
                "The selected folder does not provide a valid workspace name.",
            )
        })?;
    Ok(name.to_owned())
}

fn path_to_string(path: &Path) -> Result<String, WorkspaceCommandError> {
    path.to_str().map(str::to_owned).ok_or_else(|| {
        WorkspaceCommandError::new(
            "unsupported_workspace_path",
            "The selected folder path contains unsupported characters.",
        )
    })
}

fn rollback_initialization(directory: &Path) {
    let _ = fs::remove_file(directory.join(WORKSPACE_MANIFEST));
    let _ = fs::remove_dir_all(directory.join("collections"));
    let _ = fs::remove_dir_all(directory.join("environments"));
    let _ = fs::remove_dir_all(directory.join(".git"));
}

fn application_data_directory(app: &AppHandle) -> Result<PathBuf, WorkspaceCommandError> {
    app.path().app_data_dir().map_err(|_| {
        WorkspaceCommandError::new(
            "local_storage_unavailable",
            "GetRest could not access its local application data directory.",
        )
    })
}

fn save_request_to_workspace(
    app_data_dir: &Path,
    input: SaveWorkspaceRequestInput,
) -> Result<SaveWorkspaceRequestResult, WorkspaceCommandError> {
    let workspace = load_workspace_by_id(app_data_dir, input.workspace_id.trim())?;
    let directory = Path::new(&workspace.path);
    verify_workspace_identity(directory, &workspace.id)?;

    let collection_name = input.collection_name.trim();
    let request = WorkspaceRequest {
        id: input
            .request
            .id
            .as_deref()
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| Uuid::new_v4().to_string()),
        name: input.request.name.trim().to_owned(),
        method: input.request.method,
        path: input.request.path.trim().to_owned(),
        body: input.request.body,
    };

    let mut collections = read_workspace_collections(directory)?;
    for collection in &mut collections {
        collection
            .requests
            .retain(|existing| existing.id != request.id);
    }
    if let Some(collection) = collections
        .iter_mut()
        .find(|collection| collection.name.eq_ignore_ascii_case(collection_name))
    {
        collection.requests.push(request.clone());
    } else {
        collections.push(WorkspaceCollection {
            name: collection_name.to_owned(),
            requests: vec![request.clone()],
        });
    }
    validate_collections(&collections)?;
    replace_workspace_collections(directory, &collections)?;

    let updated_workspace = inspect_stored_workspace(workspace.id, workspace.name, workspace.path);
    remember_workspace(app_data_dir, &updated_workspace)?;
    Ok(SaveWorkspaceRequestResult {
        workspace: updated_workspace,
        collections,
        request,
    })
}

fn rename_collection_in_workspace(
    app_data_dir: &Path,
    input: RenameWorkspaceCollectionInput,
) -> Result<WorkspaceCollectionsMutationResult, WorkspaceCommandError> {
    let workspace = load_workspace_by_id(app_data_dir, input.workspace_id.trim())?;
    let directory = Path::new(&workspace.path);
    verify_workspace_identity(directory, &workspace.id)?;

    let current_name = input.current_name.trim();
    let new_name = input.new_name.trim();
    if !valid_text(current_name, 100) || !valid_text(new_name, 100) {
        return Err(WorkspaceCommandError::new(
            "invalid_collection_name",
            "Enter a valid collection name with at most 100 characters.",
        ));
    }

    let mut collections = read_workspace_collections(directory)?;
    let current_index = collections
        .iter()
        .position(|collection| collection.name == current_name)
        .ok_or_else(|| {
            WorkspaceCommandError::new(
                "collection_not_found",
                "The selected collection no longer exists.",
            )
        })?;
    if collections.iter().enumerate().any(|(index, collection)| {
        index != current_index && collection.name.eq_ignore_ascii_case(new_name)
    }) {
        return Err(WorkspaceCommandError::new(
            "collection_name_conflict",
            "Another collection already uses this name.",
        ));
    }
    if collections[current_index].name == new_name {
        return Ok(WorkspaceCollectionsMutationResult {
            workspace,
            collections,
        });
    }

    collections[current_index].name = new_name.to_owned();
    validate_collections(&collections)?;
    replace_workspace_collections(directory, &collections)?;
    let updated_workspace = inspect_stored_workspace(workspace.id, workspace.name, workspace.path);
    remember_workspace(app_data_dir, &updated_workspace)?;
    Ok(WorkspaceCollectionsMutationResult {
        workspace: updated_workspace,
        collections,
    })
}

fn create_collection_in_workspace(
    app_data_dir: &Path,
    input: CreateWorkspaceCollectionInput,
) -> Result<WorkspaceCollectionsMutationResult, WorkspaceCommandError> {
    let workspace = load_workspace_by_id(app_data_dir, input.workspace_id.trim())?;
    let directory = Path::new(&workspace.path);
    verify_workspace_identity(directory, &workspace.id)?;

    let name = input.name.trim();
    if !valid_text(name, 100) {
        return Err(WorkspaceCommandError::new(
            "invalid_collection_name",
            "Enter a valid collection name with at most 100 characters.",
        ));
    }
    let mut collections = read_workspace_collections(directory)?;
    if collections
        .iter()
        .any(|collection| collection.name.eq_ignore_ascii_case(name))
    {
        return Err(WorkspaceCommandError::new(
            "collection_name_conflict",
            "Another collection already uses this name.",
        ));
    }
    collections.push(WorkspaceCollection {
        name: name.to_owned(),
        requests: Vec::new(),
    });
    validate_collections(&collections)?;
    replace_workspace_collections(directory, &collections)?;
    let updated_workspace = inspect_stored_workspace(workspace.id, workspace.name, workspace.path);
    remember_workspace(app_data_dir, &updated_workspace)?;
    Ok(WorkspaceCollectionsMutationResult {
        workspace: updated_workspace,
        collections,
    })
}

fn verify_workspace_identity(
    directory: &Path,
    expected_id: &str,
) -> Result<WorkspaceManifest, WorkspaceCommandError> {
    let manifest_path = directory.join(WORKSPACE_MANIFEST);
    let metadata = fs::symlink_metadata(&manifest_path).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_unavailable",
            "The workspace manifest could not be inspected.",
        )
    })?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(WorkspaceCommandError::new(
            "workspace_unavailable",
            "The workspace manifest is not a regular file.",
        ));
    }
    let manifest =
        serde_json::from_slice::<WorkspaceManifest>(&fs::read(&manifest_path).map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_unavailable",
                "The workspace manifest could not be read.",
            )
        })?)
        .map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_unavailable",
                "The workspace manifest is not valid.",
            )
        })?;
    if manifest.id != expected_id {
        return Err(WorkspaceCommandError::new(
            "workspace_identity_mismatch",
            "The selected folder belongs to a different workspace.",
        ));
    }
    Ok(manifest)
}

fn replace_workspace_collections(
    directory: &Path,
    collections: &[WorkspaceCollection],
) -> Result<(), WorkspaceCommandError> {
    let collections_directory = directory.join("collections");
    validate_collection_directory_entries(&collections_directory)?;

    let operation_id = Uuid::new_v4().to_string();
    let staging = directory.join(format!(".getrest-collections-{operation_id}"));
    let backup = directory.join(format!(".getrest-collections-backup-{operation_id}"));
    fs::create_dir(&staging).map_err(|_| request_save_error())?;
    if let Err(error) = write_collection_files(&staging, collections) {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    if fs::rename(&collections_directory, &backup).is_err() {
        let _ = fs::remove_dir_all(&staging);
        return Err(request_save_error());
    }
    if fs::rename(&staging, &collections_directory).is_err() {
        let _ = fs::rename(&backup, &collections_directory);
        let _ = fs::remove_dir_all(&staging);
        return Err(request_save_error());
    }
    fs::remove_dir_all(&backup).map_err(|_| request_save_error())
}

fn validate_collection_directory_entries(
    collections_directory: &Path,
) -> Result<(), WorkspaceCommandError> {
    let metadata = fs::symlink_metadata(collections_directory).map_err(|_| request_save_error())?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(request_save_error());
    }
    for entry in fs::read_dir(collections_directory).map_err(|_| request_save_error())? {
        let entry = entry.map_err(|_| request_save_error())?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(|_| request_save_error())?;
        let is_supported_file = metadata.is_file()
            && !metadata.file_type().is_symlink()
            && (path.file_name().is_some_and(|name| name == ".gitkeep")
                || path
                    .extension()
                    .is_some_and(|extension| extension == "json"));
        if !is_supported_file {
            return Err(WorkspaceCommandError::new(
                "workspace_collections_unsupported",
                "The collections folder contains files GetRest cannot safely replace.",
            ));
        }
    }
    Ok(())
}

fn request_save_error() -> WorkspaceCommandError {
    WorkspaceCommandError::new(
        "workspace_request_save_failed",
        "The request could not be written safely to the workspace.",
    )
}

fn rename_workspace_repository(
    app_data_dir: &Path,
    input: RenameWorkspaceInput,
) -> Result<WorkspaceSummary, WorkspaceCommandError> {
    let name = input.name.trim();
    if !valid_text(name, 100) {
        return Err(WorkspaceCommandError::new(
            "invalid_workspace_name",
            "Enter a valid workspace name with at most 100 characters.",
        ));
    }

    let stored = load_workspace_by_id(app_data_dir, &input.id)?;
    let directory = Path::new(&stored.path);
    let manifest_path = directory.join(WORKSPACE_MANIFEST);
    let manifest_metadata = fs::symlink_metadata(&manifest_path).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_rename_failed",
            "The workspace manifest could not be inspected.",
        )
    })?;
    if !manifest_metadata.is_file() || manifest_metadata.file_type().is_symlink() {
        return Err(WorkspaceCommandError::new(
            "workspace_rename_failed",
            "The workspace manifest is not a regular file.",
        ));
    }
    let manifest_bytes = fs::read(&manifest_path).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_rename_failed",
            "The workspace manifest could not be read.",
        )
    })?;
    let mut manifest: WorkspaceManifest =
        serde_json::from_slice(&manifest_bytes).map_err(|_| {
            WorkspaceCommandError::new(
                "workspace_rename_failed",
                "The workspace manifest is not valid.",
            )
        })?;
    if manifest.id != input.id {
        return Err(WorkspaceCommandError::new(
            "workspace_identity_mismatch",
            "The selected folder belongs to a different workspace.",
        ));
    }
    if manifest.name == name {
        return Ok(stored);
    }

    manifest.name = name.to_owned();
    let content = serde_json::to_string_pretty(&manifest).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_rename_failed",
            "The updated workspace manifest could not be generated.",
        )
    })?;
    fs::write(&manifest_path, format!("{content}\n")).map_err(|_| {
        WorkspaceCommandError::new(
            "workspace_rename_failed",
            "The workspace manifest could not be updated.",
        )
    })?;
    run_git(
        directory,
        &["add", "--", WORKSPACE_MANIFEST],
        "git_stage_failed",
    )?;
    run_git(
        directory,
        &["commit", "-m", RENAME_COMMIT_MESSAGE],
        "git_commit_failed",
    )?;

    let renamed = inspect_stored_workspace(input.id, name.to_owned(), stored.path);
    remember_workspace(app_data_dir, &renamed)?;
    Ok(renamed)
}

fn read_workspace_collections(
    directory: &Path,
) -> Result<Vec<WorkspaceCollection>, WorkspaceCommandError> {
    let collections_directory = directory.join("collections");
    if !collections_directory.is_dir() {
        return Ok(Vec::new());
    }

    let mut paths = fs::read_dir(collections_directory)
        .map_err(|_| workspace_collections_read_error())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
        })
        .collect::<Vec<_>>();
    paths.sort();

    let mut collections = Vec::with_capacity(paths.len());
    for path in paths {
        let metadata =
            fs::symlink_metadata(&path).map_err(|_| workspace_collections_read_error())?;
        if !metadata.is_file()
            || metadata.file_type().is_symlink()
            || metadata.len() > MAX_COLLECTION_FILE_BYTES
        {
            return Err(workspace_collections_read_error());
        }
        let content = fs::read(&path).map_err(|_| workspace_collections_read_error())?;
        let collection = serde_json::from_slice::<WorkspaceCollection>(&content)
            .map_err(|_| workspace_collections_read_error())?;
        collections.push(collection);
    }
    validate_collections(&collections)?;
    Ok(collections)
}

fn workspace_collections_read_error() -> WorkspaceCommandError {
    WorkspaceCommandError::new(
        "workspace_collections_invalid",
        "One or more collection files are invalid or too large.",
    )
}

fn remember_workspace(
    app_data_dir: &Path,
    workspace: &WorkspaceSummary,
) -> Result<(), WorkspaceCommandError> {
    let connection = open_database(app_data_dir)?;
    connection
        .execute(
            "INSERT INTO workspaces (id, name, path, last_opened_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               path = excluded.path,
               last_opened_at = excluded.last_opened_at",
            params![
                workspace.id,
                workspace.name,
                workspace.path,
                unix_timestamp()
            ],
        )
        .map_err(database_error)?;
    Ok(())
}

fn load_active_workspace(
    app_data_dir: &Path,
) -> Result<Option<WorkspaceSummary>, WorkspaceCommandError> {
    let connection = open_database(app_data_dir)?;
    let stored = connection
        .query_row(
            "SELECT id, name, path
             FROM workspaces
             ORDER BY last_opened_at DESC
             LIMIT 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()
        .map_err(database_error)?;

    Ok(stored.map(|(id, name, path)| inspect_stored_workspace(id, name, path)))
}

fn load_workspaces(app_data_dir: &Path) -> Result<Vec<WorkspaceSummary>, WorkspaceCommandError> {
    let connection = open_database(app_data_dir)?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, path
             FROM workspaces
             ORDER BY last_opened_at DESC, name COLLATE NOCASE",
        )
        .map_err(database_error)?;
    let stored = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(database_error)?;
    stored
        .map(|row| {
            row.map(|(id, name, path)| inspect_stored_workspace(id, name, path))
                .map_err(database_error)
        })
        .collect()
}

fn load_workspace_by_id(
    app_data_dir: &Path,
    id: &str,
) -> Result<WorkspaceSummary, WorkspaceCommandError> {
    if id.trim().is_empty() || id.len() > 100 {
        return Err(workspace_not_found_error());
    }
    let connection = open_database(app_data_dir)?;
    let stored = connection
        .query_row(
            "SELECT id, name, path FROM workspaces WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()
        .map_err(database_error)?
        .ok_or_else(workspace_not_found_error)?;
    Ok(inspect_stored_workspace(stored.0, stored.1, stored.2))
}

fn workspace_not_found_error() -> WorkspaceCommandError {
    WorkspaceCommandError::new(
        "workspace_not_found",
        "The selected workspace is no longer registered on this machine.",
    )
}

fn inspect_stored_workspace(id: String, name: String, path: String) -> WorkspaceSummary {
    let directory = Path::new(&path);
    if !directory.is_dir() || !directory.join(WORKSPACE_MANIFEST).is_file() {
        return WorkspaceSummary {
            id,
            name,
            path,
            git_state: WorkspaceGitState::Unavailable,
            has_remote: false,
        };
    }

    let has_changes = run_git(directory, &["status", "--porcelain"], "git_status_failed")
        .map(|output| !output.stdout.is_empty());
    let has_remote = run_git(
        directory,
        &["remote", "get-url", "origin"],
        "git_remote_unavailable",
    )
    .is_ok();
    let git_state = match has_changes {
        Ok(true) => WorkspaceGitState::Changes,
        Ok(false) if has_remote => WorkspaceGitState::Clean,
        Ok(false) => WorkspaceGitState::LocalOnly,
        Err(_) => WorkspaceGitState::Unavailable,
    };

    WorkspaceSummary {
        id,
        name,
        path,
        git_state,
        has_remote,
    }
}

fn open_database(app_data_dir: &Path) -> Result<Connection, WorkspaceCommandError> {
    fs::create_dir_all(app_data_dir).map_err(database_error)?;
    let connection =
        Connection::open(app_data_dir.join("getrest.sqlite3")).map_err(database_error)?;
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS workspaces (
               id TEXT PRIMARY KEY,
               name TEXT NOT NULL,
               path TEXT NOT NULL UNIQUE,
               last_opened_at INTEGER NOT NULL
             );",
        )
        .map_err(database_error)?;
    Ok(connection)
}

fn database_error(_: impl std::fmt::Debug) -> WorkspaceCommandError {
    WorkspaceCommandError::new(
        "local_storage_failed",
        "GetRest could not update its local workspace database.",
    )
}

fn unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn author() -> GitAuthor {
        GitAuthor {
            name: "GetRest Test".to_owned(),
            email: "getrest-test@example.invalid".to_owned(),
        }
    }

    #[test]
    fn creates_a_clean_committed_workspace_repository() {
        let directory = tempdir().expect("temporary directory");
        let summary = create_workspace_repository(CreateWorkspaceInput {
            directory: directory.path().to_string_lossy().into_owned(),
            git_author: Some(author()),
            collections: vec![WorkspaceCollection {
                name: "Public API".to_owned(),
                requests: vec![WorkspaceRequest {
                    id: "todo".to_owned(),
                    name: "Todo".to_owned(),
                    method: "GET".to_owned(),
                    path: "https://example.com/todos/1".to_owned(),
                    body: String::new(),
                }],
            }],
        })
        .expect("workspace should be created");

        assert_eq!(
            summary.name,
            directory.path().file_name().unwrap().to_string_lossy()
        );
        assert!(directory.path().join(".git").is_dir());
        assert!(directory.path().join(WORKSPACE_MANIFEST).is_file());
        assert!(directory.path().join("collections").is_dir());
        assert!(directory
            .path()
            .join("collections/000-public-api.json")
            .is_file());
        assert!(directory.path().join("environments").is_dir());

        let log = run_git(
            directory.path(),
            &["log", "-1", "--pretty=%s"],
            "git_log_failed",
        )
        .expect("initial commit");
        assert_eq!(
            String::from_utf8_lossy(&log.stdout).trim(),
            INITIAL_COMMIT_MESSAGE
        );
    }

    #[test]
    fn rejects_non_empty_directories() {
        let directory = tempdir().expect("temporary directory");
        fs::write(directory.path().join("existing.txt"), "existing").unwrap();

        let error = validate_target_directory(directory.path().to_str().unwrap()).unwrap_err();

        assert_eq!(error.code, "workspace_directory_not_empty");
    }

    #[test]
    fn rejects_directories_nested_inside_another_repository() {
        let parent = tempdir().expect("temporary directory");
        fs::create_dir(parent.path().join(".git")).unwrap();
        let directory = parent.path().join("workspace");
        fs::create_dir(&directory).unwrap();

        let error = validate_target_directory(directory.to_str().unwrap()).unwrap_err();

        assert_eq!(error.code, "workspace_inside_repository");
    }

    #[test]
    fn requires_a_valid_git_identity() {
        assert!(validate_git_author(&author()).is_ok());
        assert_eq!(
            validate_git_author(&GitAuthor {
                name: "".to_owned(),
                email: "invalid".to_owned(),
            })
            .unwrap_err()
            .code,
            "invalid_git_identity"
        );
    }

    #[test]
    fn creates_an_empty_workspace_with_tracked_directories() {
        let directory = tempdir().expect("temporary directory");
        create_workspace_repository(CreateWorkspaceInput {
            directory: directory.path().to_string_lossy().into_owned(),
            git_author: Some(author()),
            collections: Vec::new(),
        })
        .expect("workspace should be created");

        assert!(directory.path().join("collections/.gitkeep").is_file());
        assert!(directory.path().join("environments/.gitkeep").is_file());
    }

    #[test]
    fn reads_collection_files_in_stable_order() {
        let directory = tempdir().expect("temporary directory");
        fs::create_dir(directory.path().join("collections")).unwrap();
        fs::write(
            directory.path().join("collections/001-second.json"),
            r#"{"name":"Second","requests":[]}"#,
        )
        .unwrap();
        fs::write(
            directory.path().join("collections/000-first.json"),
            r#"{"name":"First","requests":[]}"#,
        )
        .unwrap();

        let collections = read_workspace_collections(directory.path()).expect("valid collections");
        assert_eq!(collections[0].name, "First");
        assert_eq!(collections[1].name, "Second");
    }

    #[test]
    fn renames_a_workspace_in_the_manifest_registry_and_git_history() {
        let directory = tempdir().expect("workspace directory");
        let app_data = tempdir().expect("application data directory");
        let created = create_workspace_repository(CreateWorkspaceInput {
            directory: directory.path().to_string_lossy().into_owned(),
            git_author: Some(author()),
            collections: Vec::new(),
        })
        .expect("workspace should be created");
        remember_workspace(app_data.path(), &created).expect("workspace should be registered");

        let renamed = rename_workspace_repository(
            app_data.path(),
            RenameWorkspaceInput {
                id: created.id.clone(),
                name: "Renamed workspace".to_owned(),
            },
        )
        .expect("workspace should be renamed");

        assert_eq!(renamed.name, "Renamed workspace");
        let manifest: WorkspaceManifest =
            serde_json::from_slice(&fs::read(directory.path().join(WORKSPACE_MANIFEST)).unwrap())
                .unwrap();
        assert_eq!(manifest.name, "Renamed workspace");
        assert_eq!(
            load_active_workspace(app_data.path())
                .unwrap()
                .unwrap()
                .name,
            "Renamed workspace"
        );
        let log = run_git(
            directory.path(),
            &["log", "-1", "--pretty=%s"],
            "git_log_failed",
        )
        .expect("rename commit");
        assert_eq!(
            String::from_utf8_lossy(&log.stdout).trim(),
            RENAME_COMMIT_MESSAGE
        );
    }

    #[test]
    fn creates_and_updates_a_saved_request_without_committing_it() {
        let directory = tempdir().expect("workspace directory");
        let app_data = tempdir().expect("application data directory");
        let created = create_workspace_repository(CreateWorkspaceInput {
            directory: directory.path().to_string_lossy().into_owned(),
            git_author: Some(author()),
            collections: Vec::new(),
        })
        .expect("workspace should be created");
        remember_workspace(app_data.path(), &created).expect("workspace should be registered");

        let saved = save_request_to_workspace(
            app_data.path(),
            SaveWorkspaceRequestInput {
                workspace_id: created.id.clone(),
                collection_name: "Public API".to_owned(),
                request: UnsavedWorkspaceRequest {
                    id: None,
                    name: "Todo details".to_owned(),
                    method: "GET".to_owned(),
                    path: "https://example.com/todos/1".to_owned(),
                    body: String::new(),
                },
            },
        )
        .expect("request should be saved");

        assert_eq!(saved.collections.len(), 1);
        assert_eq!(saved.collections[0].requests.len(), 1);
        assert!(matches!(
            saved.workspace.git_state,
            WorkspaceGitState::Changes
        ));
        let updated = save_request_to_workspace(
            app_data.path(),
            SaveWorkspaceRequestInput {
                workspace_id: created.id,
                collection_name: "Other API".to_owned(),
                request: UnsavedWorkspaceRequest {
                    id: Some(saved.request.id.clone()),
                    name: "Updated todo".to_owned(),
                    method: "GET".to_owned(),
                    path: "https://example.com/todos/2".to_owned(),
                    body: String::new(),
                },
            },
        )
        .expect("request should be updated");

        assert_eq!(
            updated
                .collections
                .iter()
                .flat_map(|collection| &collection.requests)
                .filter(|request| request.id == saved.request.id)
                .count(),
            1
        );
        assert_eq!(updated.request.name, "Updated todo");
        assert_eq!(
            run_git(directory.path(), &["log", "--pretty=%s"], "git_log_failed")
                .unwrap()
                .stdout
                .split(|byte| *byte == b'\n')
                .filter(|line| !line.is_empty())
                .count(),
            1
        );
    }

    #[test]
    fn refuses_to_replace_unmanaged_collection_files() {
        let directory = tempdir().expect("workspace directory");
        let app_data = tempdir().expect("application data directory");
        let created = create_workspace_repository(CreateWorkspaceInput {
            directory: directory.path().to_string_lossy().into_owned(),
            git_author: Some(author()),
            collections: Vec::new(),
        })
        .expect("workspace should be created");
        remember_workspace(app_data.path(), &created).expect("workspace should be registered");
        let unmanaged = directory.path().join("collections/notes.txt");
        fs::write(&unmanaged, "keep me").unwrap();

        let error = save_request_to_workspace(
            app_data.path(),
            SaveWorkspaceRequestInput {
                workspace_id: created.id,
                collection_name: "Public API".to_owned(),
                request: UnsavedWorkspaceRequest {
                    id: None,
                    name: "Todo details".to_owned(),
                    method: "GET".to_owned(),
                    path: "https://example.com/todos/1".to_owned(),
                    body: String::new(),
                },
            },
        )
        .unwrap_err();

        assert_eq!(error.code, "workspace_collections_unsupported");
        assert_eq!(fs::read_to_string(unmanaged).unwrap(), "keep me");
    }

    #[test]
    fn renames_a_collection_and_preserves_its_requests() {
        let directory = tempdir().expect("workspace directory");
        let app_data = tempdir().expect("application data directory");
        let created = create_workspace_repository(CreateWorkspaceInput {
            directory: directory.path().to_string_lossy().into_owned(),
            git_author: Some(author()),
            collections: vec![WorkspaceCollection {
                name: "Public API".to_owned(),
                requests: vec![WorkspaceRequest {
                    id: "todo".to_owned(),
                    name: "Todo details".to_owned(),
                    method: "GET".to_owned(),
                    path: "https://example.com/todos/1".to_owned(),
                    body: String::new(),
                }],
            }],
        })
        .expect("workspace should be created");
        remember_workspace(app_data.path(), &created).expect("workspace should be registered");

        let renamed = rename_collection_in_workspace(
            app_data.path(),
            RenameWorkspaceCollectionInput {
                workspace_id: created.id,
                current_name: "Public API".to_owned(),
                new_name: "Internal API".to_owned(),
            },
        )
        .expect("collection should be renamed");

        assert_eq!(renamed.collections[0].name, "Internal API");
        assert_eq!(renamed.collections[0].requests[0].id, "todo");
        assert!(matches!(
            renamed.workspace.git_state,
            WorkspaceGitState::Changes
        ));
        let stored = read_workspace_collections(directory.path()).unwrap();
        assert_eq!(stored[0].name, "Internal API");
    }

    #[test]
    fn creates_and_persists_an_empty_collection() {
        let directory = tempdir().expect("workspace directory");
        let app_data = tempdir().expect("application data directory");
        let created = create_workspace_repository(CreateWorkspaceInput {
            directory: directory.path().to_string_lossy().into_owned(),
            git_author: Some(author()),
            collections: Vec::new(),
        })
        .expect("workspace should be created");
        remember_workspace(app_data.path(), &created).expect("workspace should be registered");

        let result = create_collection_in_workspace(
            app_data.path(),
            CreateWorkspaceCollectionInput {
                workspace_id: created.id.clone(),
                name: "Empty API".to_owned(),
            },
        )
        .expect("collection should be created");

        assert_eq!(result.collections.len(), 1);
        assert_eq!(result.collections[0].name, "Empty API");
        assert!(result.collections[0].requests.is_empty());
        assert!(matches!(
            result.workspace.git_state,
            WorkspaceGitState::Changes
        ));
        let stored = read_workspace_collections(directory.path()).unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].name, "Empty API");
        assert!(stored[0].requests.is_empty());

        let error = create_collection_in_workspace(
            app_data.path(),
            CreateWorkspaceCollectionInput {
                workspace_id: created.id,
                name: "empty api".to_owned(),
            },
        )
        .expect_err("collection names should be unique");
        assert_eq!(error.code, "collection_name_conflict");
    }
}
