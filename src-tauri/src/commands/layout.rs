use std::sync::atomic::Ordering;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::island::{self, displays, layout};
use crate::state::AppState;

#[tauri::command]
pub fn get_layout_state(app: AppHandle) -> Value {
    let state = app.state::<AppState>();
    let current = state.layout.lock().clone();
    let area = layout::target_monitor(&app, &current.display_id).map(|m| layout::work_area(&m));
    json!({
        "layout": current,
        "editMode": state.layout_edit_mode.load(Ordering::SeqCst),
        "display": area,
    })
}

#[tauri::command]
pub fn get_displays(app: AppHandle) -> Vec<displays::DisplayInfo> {
    displays::list(&app)
}

#[tauri::command]
pub fn set_layout_config(app: AppHandle, layout: Option<layout::LayoutPatch>) {
    let current = app.state::<AppState>().layout.lock().clone();
    let patch = layout.unwrap_or_default();
    let mut next = layout::merge(&current, &patch);
    // Changer la taille sans position explicite : on garde le centre de l'Island en place
    // (sinon la fenêtre grandit depuis son coin gauche et l'Island glisse vers la droite).
    if patch.x.is_none() && next.scale != current.scale {
        next.x = (current.x + layout::BASE_WIDTH * (current.scale - next.scale) / 2.0).round();
    }
    island::update_layout(&app, next);
}

#[tauri::command]
pub fn reset_layout(app: AppHandle) {
    // « Recentrer » : en haut au centre de l'écran actuel, en gardant la taille choisie.
    let current = app.state::<AppState>().layout.lock().clone();
    island::update_layout(&app, layout::centered_on(&app, &current));
}

#[tauri::command]
pub fn set_layout_edit_mode(app: AppHandle, enabled: bool) {
    island::set_layout_edit_mode(&app, enabled);
}

/// Déplace l'Island sur un autre écran, centrée en haut.
#[tauri::command]
pub fn set_target_display(app: AppHandle, display_id: Value) {
    let id = match display_id {
        Value::String(s) => s,
        Value::Number(n) => n.to_string(),
        _ => return,
    };
    let current = app.state::<AppState>().layout.lock().clone();
    let target = layout::Layout { display_id: id, ..current };
    island::update_layout(&app, layout::centered_on(&app, &target));
}
