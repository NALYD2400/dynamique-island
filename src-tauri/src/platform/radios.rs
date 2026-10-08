//! Wi-Fi et Bluetooth via `Windows.Devices.Radios`.
//! Les réponses textuelles (`on`, `off`, `ok`, `denied`…) sont celles attendues par l'UI.

use windows::Devices::Radios::{Radio, RadioAccessStatus, RadioKind, RadioState};

use super::com;

fn find_radio(kind: RadioKind) -> Result<Option<Radio>, &'static str> {
    com::ensure_mta();
    let access = Radio::RequestAccessAsync().and_then(|op| op.join()).map_err(|_| "unknown")?;
    if access != RadioAccessStatus::Allowed {
        return Err("denied");
    }
    let radios = Radio::GetRadiosAsync().and_then(|op| op.join()).map_err(|_| "unknown")?;
    Ok(radios.into_iter().find(|radio| radio.Kind().map(|k| k == kind).unwrap_or(false)))
}

pub fn status(kind: RadioKind) -> String {
    match find_radio(kind) {
        Ok(Some(radio)) => match radio.State() {
            Ok(RadioState::On) => "on".into(),
            Ok(_) => "off".into(),
            Err(_) => "unknown".into(),
        },
        Ok(None) => "not_found".into(),
        // Comme l'original : un refus d'accès en lecture se traduit par « unknown ».
        Err(_) => "unknown".into(),
    }
}

pub fn set_enabled(kind: RadioKind, enabled: bool) -> String {
    match find_radio(kind) {
        Ok(Some(radio)) => {
            let target = if enabled { RadioState::On } else { RadioState::Off };
            match radio.SetStateAsync(target).and_then(|op| op.join()) {
                Ok(RadioAccessStatus::Allowed) => "ok".into(),
                Ok(_) => "failed".into(),
                Err(error) => format!("error: {}", error.message()),
            }
        }
        Ok(None) => "not_found".into(),
        Err(reason) => reason.into(),
    }
}

/// Exécute une action `on` / `off` / `status` sur la radio demandée.
pub fn control(kind: RadioKind, action: &str) -> String {
    match action {
        "status" => status(kind),
        "on" => set_enabled(kind, true),
        "off" => set_enabled(kind, false),
        _ => "error".into(),
    }
}

pub use windows::Devices::Radios::RadioKind as Kind;
