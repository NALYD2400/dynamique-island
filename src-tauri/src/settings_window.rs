//! Fenêtre des réglages : créée à la demande, détruite à la fermeture
//! (aucune mémoire consommée tant qu'elle n'est pas ouverte).

use std::sync::atomic::Ordering;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::state::AppState;

pub const LABEL: &str = "settings";

pub fn open(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let built = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("settings/index.html".into()))
        .title("Réglages — Nolys")
        .inner_size(880.0, 580.0)
        .center()
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .build();

    match built {
        Ok(window) => {
            let handle = app.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Destroyed = event {
                    if handle.state::<AppState>().layout_edit_mode.load(Ordering::SeqCst) {
                        crate::island::set_layout_edit_mode(&handle, false);
                    }
                }
            });
        }
        Err(error) => crate::logger::log(&format!("[Settings] Failed to open window: {error}")),
    }
}

pub fn close(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.close();
    }
}
