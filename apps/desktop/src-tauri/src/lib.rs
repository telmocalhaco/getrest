mod rest;
mod runner;
mod secrets;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            rest::send_rest_request,
            runner::run_collection,
            workspace::choose_workspace_directory,
            workspace::export_workspace_key,
            workspace::import_workspace_key,
            workspace::create_workspace,
            workspace::get_active_workspace,
            workspace::list_workspaces,
            workspace::activate_workspace,
            workspace::rename_workspace,
            workspace::load_workspace_collections,
            workspace::save_workspace_request,
            workspace::rename_workspace_collection,
            workspace::create_workspace_collection,
            workspace::delete_workspace_request,
            workspace::delete_workspace_collection,
            workspace::load_workspace_environments,
            workspace::save_workspace_environment,
            workspace::delete_workspace_environment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
