use tauri::AppHandle;

use crate::updater::{self, UpdateStatus};

#[tauri::command]
pub fn get_update_status(app: AppHandle) -> UpdateStatus {
    updater::status(&app)
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> UpdateStatus {
    updater::check(app).await
}

#[tauri::command]
pub async fn download_update(app: AppHandle) -> UpdateStatus {
    updater::download(app).await
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> UpdateStatus {
    updater::install(app).await
}
