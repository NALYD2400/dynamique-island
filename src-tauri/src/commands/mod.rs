//! Commandes appelées depuis l'interface (`invoke`).
//!
//! Chaque commande correspond à un ancien canal IPC Electron ; le pont
//! `src/shared/bridge.js` fait la correspondance côté interface.

pub mod app;
pub mod audio;
pub mod layout;
pub mod media;
pub mod system;
pub mod updates;

/// Exécute un travail bloquant (COM, WinRT, disque) hors des threads asynchrones.
pub(crate) async fn blocking<T: Send + 'static>(job: impl FnOnce() -> T + Send + 'static, fallback: T) -> T {
    tauri::async_runtime::spawn_blocking(job).await.unwrap_or(fallback)
}

/// Valeur entière bornée, tolérante aux chaînes et décimaux (comme `clampInteger`).
pub(crate) fn clamp_int(value: &serde_json::Value, min: i64, max: i64) -> Option<i64> {
    let number = value.as_f64().or_else(|| value.as_str()?.trim().parse().ok())?;
    number.is_finite().then(|| (number.round() as i64).clamp(min, max))
}

/// Texte sûr : non vide, sans saut de ligne, 2048 caractères max.
pub(crate) fn is_safe_text(value: &str) -> bool {
    !value.trim().is_empty() && value.len() <= 2048 && !value.contains(['\r', '\n'])
}
