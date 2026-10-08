//! Mises à jour automatiques via les releases GitHub (plugin updater de Tauri).
//!
//! Expose le même cycle d'états que l'ancien `electron-updater` pour que la
//! carte « Mises à jour » des réglages fonctionne sans changement.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::events;
use crate::state::AppState;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub state: String,
    pub current_version: String,
    pub available_version: Option<String>,
    pub release_name: String,
    pub release_date: String,
    pub progress: u32,
    pub downloaded: bool,
    pub error: String,
    pub checked_at: Option<String>,
    pub can_check: bool,
    pub can_download: bool,
    pub can_install: bool,
    #[serde(skip)]
    pending: Option<Update>,
    #[serde(skip)]
    bytes: Option<Vec<u8>>,
}

impl Default for UpdateStatus {
    fn default() -> Self {
        Self {
            state: "idle".into(),
            current_version: String::new(),
            available_version: None,
            release_name: String::new(),
            release_date: String::new(),
            progress: 0,
            downloaded: false,
            error: String::new(),
            checked_at: None,
            can_check: false,
            can_download: false,
            can_install: false,
            pending: None,
            bytes: None,
        }
    }
}

const IS_PACKAGED: bool = !cfg!(debug_assertions);

/// État public (avec les drapeaux `can*` recalculés).
pub fn status(app: &AppHandle) -> UpdateStatus {
    let state = app.state::<AppState>();
    let mut status = state.update.lock().clone();
    let busy = matches!(status.state.as_str(), "checking" | "downloading" | "installing");
    status.current_version = app.package_info().version.to_string();
    status.can_check = IS_PACKAGED && !busy;
    status.can_download = IS_PACKAGED && status.state == "available";
    status.can_install = IS_PACKAGED && status.state == "downloaded";
    status
}

fn set(app: &AppHandle, notify_island: bool, patch: impl FnOnce(&mut UpdateStatus)) -> UpdateStatus {
    patch(&mut app.state::<AppState>().update.lock());
    let public = status(app);
    let _ = app.emit(events::UPDATE_STATUS_CHANGED, &public);
    if notify_island {
        let version = public.available_version.clone().unwrap_or_else(|| "recente".into());
        let _ = app.emit_to(
            crate::island::LABEL,
            events::TRIGGER_NOTIF,
            serde_json::json!({
                "title": "Mise a jour disponible",
                "message": format!("Version {version} prete dans les reglages"),
                "icon": "ph-download-simple"
            }),
        );
    }
    public
}

fn fail(app: &AppHandle, message: String) -> UpdateStatus {
    crate::logger::log(&format!("[Updater] {message}"));
    set(app, false, |s| {
        s.state = "error".into();
        s.error = message;
        s.progress = 0;
    })
}

pub async fn check(app: AppHandle) -> UpdateStatus {
    if !IS_PACKAGED {
        return set(&app, false, |s| {
            s.state = "dev".into();
            s.error.clear();
            s.checked_at = Some(crate::logger::iso_now());
        });
    }
    if matches!(status(&app).state.as_str(), "checking" | "downloading" | "installing") {
        return status(&app);
    }

    set(&app, false, |s| {
        s.state = "checking".into();
        s.progress = 0;
        s.error.clear();
        s.checked_at = Some(crate::logger::iso_now());
    });

    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => return fail(&app, error.to_string()),
    };
    match updater.check().await {
        Ok(Some(update)) => set(&app, true, |s| {
            s.state = "available".into();
            s.available_version = Some(update.version.clone());
            s.release_name = format!("Version {}", update.version);
            s.release_date = update.date.map(|d| d.to_string()).unwrap_or_default();
            s.progress = 0;
            s.downloaded = false;
            s.error.clear();
            s.pending = Some(update);
        }),
        Ok(None) => set(&app, false, |s| {
            s.state = "up-to-date".into();
            s.available_version = None;
            s.release_name.clear();
            s.release_date.clear();
            s.progress = 0;
            s.downloaded = false;
            s.error.clear();
            s.checked_at = Some(crate::logger::iso_now());
        }),
        Err(error) => fail(&app, error.to_string()),
    }
}

pub async fn download(app: AppHandle) -> UpdateStatus {
    let pending = {
        let state = app.state::<AppState>();
        let status = state.update.lock();
        if !IS_PACKAGED || status.state != "available" {
            None
        } else {
            status.pending.clone()
        }
    };
    let Some(update) = pending else { return status(&app) };

    set(&app, false, |s| {
        s.state = "downloading".into();
        s.progress = 0;
        s.error.clear();
    });

    let progress_app = app.clone();
    let mut received = 0usize;
    let result = update
        .download(
            move |chunk, total| {
                received += chunk;
                if let Some(total) = total.filter(|t| *t > 0) {
                    let percent = ((received as f64 / total as f64) * 100.0).round().clamp(0.0, 100.0) as u32;
                    if percent != progress_app.state::<AppState>().update.lock().progress {
                        set(&progress_app, false, |s| s.progress = percent);
                    }
                }
            },
            || {},
        )
        .await;

    match result {
        Ok(bytes) => set(&app, true, |s| {
            s.state = "downloaded".into();
            s.progress = 100;
            s.downloaded = true;
            s.error.clear();
            s.bytes = Some(bytes);
        }),
        Err(error) => fail(&app, error.to_string()),
    }
}

pub async fn install(app: AppHandle) -> UpdateStatus {
    let ready = {
        let state = app.state::<AppState>();
        let mut status = state.update.lock();
        if !IS_PACKAGED || status.state != "downloaded" {
            None
        } else {
            status.pending.clone().zip(status.bytes.take())
        }
    };
    let Some((update, bytes)) = ready else { return status(&app) };

    let public = set(&app, false, |s| {
        s.state = "installing".into();
        s.error.clear();
    });

    // Remet le fond d'écran d'origine avant que l'installeur ne ferme l'application.
    let wallpaper = app.state::<AppState>().wallpaper.clone();
    if wallpaper.is_enabled() {
        let _ = tauri::async_runtime::spawn_blocking(move || wallpaper.restore_original()).await;
    }
    if let Err(error) = update.install(bytes) {
        return fail(&app, error.to_string());
    }
    public
}
