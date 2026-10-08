//! Reprise des données de l'ancienne version Electron.
//!
//! - fichiers du dossier utilisateur (position de l'Island, fond d'écran d'origine) ;
//! - réglages de l'interface stockés dans le `localStorage` Chromium (LevelDB),
//!   réinjectés dans la nouvelle WebView au premier lancement.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use rusty_leveldb::{LdbIterator, Options, DB};

use crate::logger::log;

const MARKER: &str = "legacy-settings.imported";

fn legacy_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|roaming| PathBuf::from(roaming).join("Liquid Dynamic Island"))
}

pub fn import_legacy_files(data_dir: &Path) {
    let Some(legacy) = legacy_dir() else { return };
    for file in ["liquid-island-layout.json", "original_wallpaper_path.txt"] {
        let (from, to) = (legacy.join(file), data_dir.join(file));
        if from.is_file() && !to.exists() && std::fs::copy(&from, &to).is_ok() {
            log(&format!("[Migration] Imported {file} from the Electron version"));
        }
    }
}

/// Script d'initialisation qui recopie les anciens réglages (une seule fois).
pub fn legacy_settings_script(data_dir: &Path) -> Option<String> {
    let marker = data_dir.join(MARKER);
    if marker.exists() {
        return None;
    }
    let source = legacy_dir()?.join("Local Storage").join("leveldb");
    if !source.is_dir() {
        return None;
    }

    let entries = match read_local_storage(&source, data_dir) {
        Ok(entries) => entries,
        Err(error) => {
            log(&format!("[Migration] Could not read legacy settings: {error}"));
            return None;
        }
    };
    let _ = std::fs::write(&marker, format!("{} réglages importés", entries.len()));
    if entries.is_empty() {
        return None;
    }
    log(&format!("[Migration] Importing {} legacy settings", entries.len()));

    let data = serde_json::to_string(&entries).ok()?;
    // N'écrase jamais une valeur déjà présente dans la nouvelle version.
    Some(format!(
        "(function () {{\
            try {{\
                if (localStorage.getItem('liquid_legacy_imported') === '1') return;\
                var data = {data};\
                for (var key in data) {{ if (localStorage.getItem(key) === null) localStorage.setItem(key, data[key]); }}\
                localStorage.setItem('liquid_legacy_imported', '1');\
            }} catch (e) {{}}\
        }})();"
    ))
}

/// Lit les clés `localStorage` de l'origine `file://` dans une copie de la base.
fn read_local_storage(source: &Path, data_dir: &Path) -> Result<BTreeMap<String, String>, String> {
    // Copie : l'ancienne appli peut tenir le verrou, et LevelDB réécrit ses journaux à l'ouverture.
    let copy = data_dir.join("legacy-leveldb-copy");
    let _ = std::fs::remove_dir_all(&copy);
    std::fs::create_dir_all(&copy).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(source).map_err(|e| e.to_string())?.flatten() {
        if entry.file_name() != "LOCK" && entry.path().is_file() {
            let _ = std::fs::copy(entry.path(), copy.join(entry.file_name()));
        }
    }

    let result = (|| {
        let options = Options { create_if_missing: false, ..Options::default() };
        let mut db = DB::open(&copy, options).map_err(|e| e.to_string())?;
        let mut iter = db.new_iter().map_err(|e| e.to_string())?;
        let mut entries = BTreeMap::new();
        const PREFIX: &[u8] = b"_file://\x00";
        while iter.advance() {
            let Some((key, value)) = iter.current() else { continue };
            let Some(encoded_key) = key.strip_prefix(PREFIX) else { continue };
            if let (Some(k), Some(v)) = (decode(encoded_key), decode(&value)) {
                entries.insert(k, v);
            }
        }
        Ok(entries)
    })();

    let _ = std::fs::remove_dir_all(&copy);
    result
}

/// Chaînes Chromium : octet 0 = UTF-16LE, octet 1 = Latin-1.
fn decode(bytes: &[u8]) -> Option<String> {
    let (&kind, rest) = bytes.split_first()?;
    match kind {
        0 => {
            let units: Vec<u16> = rest.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            Some(String::from_utf16_lossy(&units))
        }
        1 => Some(rest.iter().map(|&b| b as char).collect()),
        _ => None,
    }
}
