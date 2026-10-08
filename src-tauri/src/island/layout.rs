//! Position, échelle et écran cible de l'Island (`liquid-island-layout.json`).
//!
//! Les coordonnées sont en pixels logiques de l'écran cible, comme les DIP
//! d'Electron : une configuration existante reste donc valable.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Monitor};

/// Taille de base de la fenêtre transparente (avant mise à l'échelle).
pub const BASE_WIDTH: f64 = 620.0;
pub const BASE_HEIGHT: f64 = 600.0;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Layout {
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    pub display_id: String,
}

/// Configuration partielle reçue de l'UI (tous les champs sont optionnels).
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutPatch {
    pub x: Option<serde_json::Value>,
    pub y: Option<serde_json::Value>,
    pub scale: Option<serde_json::Value>,
    pub display_id: Option<serde_json::Value>,
}

fn number(value: &Option<serde_json::Value>) -> Option<f64> {
    let value = value.as_ref()?;
    value.as_f64().or_else(|| value.as_str()?.trim().parse().ok()).filter(|n: &f64| n.is_finite())
}

fn text(value: &Option<serde_json::Value>) -> Option<String> {
    match value.as_ref()? {
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

pub fn clamp_scale(scale: f64) -> f64 {
    if scale.is_finite() { scale.clamp(0.65, 1.5) } else { 1.0 }
}

/// Zone de travail d'un écran, en pixels logiques.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct WorkArea {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub fn monitor_id(monitor: &Monitor) -> String {
    monitor.name().cloned().unwrap_or_else(|| "primary".into())
}

pub fn work_area(monitor: &Monitor) -> WorkArea {
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    WorkArea {
        x: area.position.x as f64 / scale,
        y: area.position.y as f64 / scale,
        width: area.size.width as f64 / scale,
        height: area.size.height as f64 / scale,
    }
}

/// Écran ciblé par la configuration, sinon l'écran principal.
pub fn target_monitor(app: &AppHandle, display_id: &str) -> Option<Monitor> {
    if display_id != "primary" {
        if let Ok(monitors) = app.available_monitors() {
            if let Some(found) = monitors.into_iter().find(|m| monitor_id(m) == display_id) {
                return Some(found);
            }
        }
    }
    app.primary_monitor().ok().flatten()
}

fn fallback_area() -> WorkArea {
    WorkArea { x: 0.0, y: 0.0, width: 1920.0, height: 1040.0 }
}

/// Centré en haut de l'écran principal.
pub fn default_layout(app: &AppHandle) -> Layout {
    let monitor = app.primary_monitor().ok().flatten();
    let area = monitor.as_ref().map(work_area).unwrap_or_else(fallback_area);
    Layout {
        x: (area.x + (area.width - BASE_WIDTH) / 2.0).round(),
        y: area.y - 30.0,
        scale: 1.0,
        display_id: monitor.as_ref().map(monitor_id).unwrap_or_else(|| "primary".into()),
    }
}

pub fn centered_on(app: &AppHandle, layout: &Layout) -> Layout {
    let area = target_monitor(app, &layout.display_id).as_ref().map(work_area).unwrap_or_else(fallback_area);
    let width = (BASE_WIDTH * layout.scale).round();
    Layout { x: (area.x + (area.width - width) / 2.0).round(), y: area.y - 30.0, ..layout.clone() }
}

/// Fusionne un patch dans une configuration existante.
pub fn merge(base: &Layout, patch: &LayoutPatch) -> Layout {
    Layout {
        x: number(&patch.x).unwrap_or(base.x),
        y: number(&patch.y).unwrap_or(base.y),
        scale: number(&patch.scale).map(clamp_scale).unwrap_or(base.scale),
        display_id: text(&patch.display_id).unwrap_or_else(|| base.display_id.clone()),
    }
}

/// Garde la fenêtre dans la zone de travail de son écran (40 px de marge en haut).
pub fn clamp(app: &AppHandle, layout: &Layout) -> Layout {
    let monitor = target_monitor(app, &layout.display_id);
    let area = monitor.as_ref().map(work_area).unwrap_or_else(fallback_area);
    let scale = clamp_scale(layout.scale);
    let (w, h) = ((BASE_WIDTH * scale).round(), (BASE_HEIGHT * scale).round());
    let max_x = (area.x + area.width - w).max(area.x);
    let max_y = (area.y + area.height - h).max(area.y - 40.0);
    Layout {
        x: layout.x.clamp(area.x, max_x),
        y: layout.y.clamp(area.y - 40.0, max_y),
        scale,
        // Un identifiant inconnu (écran débranché, ancienne config) retombe sur l'écran réel.
        display_id: monitor.as_ref().map(monitor_id).unwrap_or_else(|| layout.display_id.clone()),
    }
}

pub fn config_path(data_dir: &Path) -> PathBuf {
    data_dir.join("liquid-island-layout.json")
}

pub fn load(app: &AppHandle, data_dir: &Path) -> Layout {
    let saved = std::fs::read_to_string(config_path(data_dir))
        .ok()
        .and_then(|raw| serde_json::from_str::<LayoutPatch>(&raw).ok())
        .map(|patch| merge(&default_layout(app), &patch));
    clamp(app, &saved.unwrap_or_else(|| default_layout(app)))
}

pub fn save(data_dir: &Path, layout: &Layout) {
    if let Ok(json) = serde_json::to_string_pretty(layout) {
        if let Err(error) = std::fs::write(config_path(data_dir), json) {
            crate::logger::log(&format!("[Layout] Failed to save layout: {error}"));
        }
    }
}
