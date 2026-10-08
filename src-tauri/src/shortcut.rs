//! Raccourci clavier global pour afficher / masquer l'Island (Alt+I par défaut).

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::state::AppState;

/// Convertit un accélérateur Electron (`CommandOrControl+Shift+K`) au format Tauri.
fn normalize(accelerator: &str) -> String {
    accelerator
        .split('+')
        .map(|part| match part.trim().to_lowercase().as_str() {
            "commandorcontrol" | "cmdorctrl" | "cmdorcontrol" | "commandorctrl" => "CommandOrControl".to_string(),
            "control" | "ctrl" => "Control".to_string(),
            "option" | "altgr" => "Alt".to_string(),
            "super" | "meta" | "win" | "cmd" | "command" => "Super".to_string(),
            _ => part.trim().to_string(),
        })
        .collect::<Vec<_>>()
        .join("+")
}

pub fn register(app: &AppHandle, accelerator: &str) {
    let accelerator = accelerator.trim();
    if accelerator.is_empty() || accelerator.len() > 80 {
        return;
    }
    let state = app.state::<AppState>();
    if state.shortcut.lock().as_deref() == Some(accelerator) {
        return;
    }

    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();

    let parsed = match normalize(accelerator).parse::<Shortcut>() {
        Ok(shortcut) => shortcut,
        Err(error) => {
            crate::logger::log(&format!("[Shortcut] Invalid hotkey {accelerator}: {error}"));
            return;
        }
    };
    let result = shortcuts.on_shortcut(parsed, |app, _, event| {
        if event.state() == ShortcutState::Pressed {
            crate::island::toggle_visibility(app, "shortcut-toggle");
        }
    });
    match result {
        Ok(()) => {
            *state.shortcut.lock() = Some(accelerator.to_string());
            crate::logger::log(&format!("[Shortcut] Registered global hotkey: {accelerator}"));
        }
        Err(error) => crate::logger::log(&format!("[Shortcut] Failed to register hotkey {accelerator}: {error}")),
    }
}
