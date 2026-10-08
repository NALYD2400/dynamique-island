//! Déplacement de l'Island en mode placement.
//!
//! Le glisser natif de Windows refuse de remonter une fenêtre sans bordure au-dessus
//! du bord de l'écran. Ici le curseur est suivi côté Rust et la fenêtre est placée
//! directement, avec les mêmes limites que le reste (`layout::clamp`).

use std::sync::atomic::Ordering;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, PhysicalPosition};

use super::layout::{self, Layout};
use super::{broadcast_layout, window};
use crate::platform::window as win;
use crate::state::AppState;

#[derive(Clone, Copy)]
struct Grab {
    /// Curseur et position de la fenêtre (pixels physiques) au début du glisser.
    cursor: (i32, i32),
    window: (i32, i32),
}

static GRAB: Mutex<Option<Grab>> = Mutex::new(None);

pub fn begin(app: &AppHandle) {
    let Some(handle) = window(app) else { return };
    let (Some(cursor), Ok(position)) = (win::cursor_position(), handle.outer_position()) else { return };
    // Pendant le glisser, les événements « fenêtre déplacée » ne réécrivent pas la position.
    app.state::<AppState>().suppress_move_sync.store(true, Ordering::SeqCst);
    if let Ok(mut grab) = GRAB.lock() {
        *grab = Some(Grab { cursor, window: (position.x, position.y) });
    }
}

pub fn update(app: &AppHandle) {
    let Some(grab) = GRAB.lock().ok().and_then(|g| *g) else { return };
    let (Some(handle), Some(cursor)) = (window(app), win::cursor_position()) else { return };
    let state = app.state::<AppState>();
    let current = state.layout.lock().clone();

    // Position physique voulue. L'écran sous le centre de la fenêtre devient l'écran cible :
    // on peut ainsi passer sur un autre écran, avec les limites de celui-ci.
    let (x, y) = (grab.window.0 + cursor.0 - grab.cursor.0, grab.window.1 + cursor.1 - grab.cursor.1);
    let size = handle.outer_size().map(|s| (s.width as i32, s.height as i32)).unwrap_or((0, 0));
    let centre = (x + size.0 / 2, y + size.1 / 2);
    let monitor = handle.available_monitors().ok().and_then(|list| list.into_iter().find(|m| contains(m, centre)));
    let (display_id, scale) = match &monitor {
        Some(m) => (layout::monitor_id(m), m.scale_factor()),
        None => {
            let scale = layout::target_monitor(app, &current.display_id).map(|m| m.scale_factor()).unwrap_or(1.0);
            (current.display_id.clone(), scale)
        }
    };
    let raw = Layout { x: x as f64 / scale, y: y as f64 / scale, display_id, ..current };
    let clamped = layout::clamp(app, &raw);
    let _ = handle.set_position(PhysicalPosition::new(
        (clamped.x * scale).round() as i32,
        (clamped.y * scale).round() as i32,
    ));
    *state.layout.lock() = clamped;
}

/// Le point (pixels physiques) est-il dans cet écran ?
fn contains(monitor: &tauri::Monitor, (x, y): (i32, i32)) -> bool {
    let (origin, size) = (monitor.position(), monitor.size());
    x >= origin.x && x < origin.x + size.width as i32 && y >= origin.y && y < origin.y + size.height as i32
}

pub fn end(app: &AppHandle) {
    let was_dragging = GRAB.lock().map(|mut grab| grab.take().is_some()).unwrap_or(false);
    if !was_dragging {
        return;
    }
    let state = app.state::<AppState>();
    state.suppress_move_sync.store(false, Ordering::SeqCst);
    let layout = state.layout.lock().clone();
    layout::save(&state.data_dir, &layout);
    broadcast_layout(app);
}
