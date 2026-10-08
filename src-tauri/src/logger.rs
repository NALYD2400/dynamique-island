//! Journal fichier `liquid-core.log` (rotation à 5 Mo), comme la version Electron.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;

const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub fn init(data_dir: PathBuf) {
    let _ = LOG_PATH.set(data_dir.join("liquid-core.log"));
}

pub fn log(message: &str) {
    let line = format!("[{}] {}", iso_now(), message);
    #[cfg(debug_assertions)]
    println!("{line}");

    let Some(path) = LOG_PATH.get() else { return };
    let _guard = WRITE_LOCK.lock();

    if fs::metadata(path).map(|m| m.len() > MAX_LOG_BYTES).unwrap_or(false) {
        let old = path.with_extension("log.old");
        let _ = fs::remove_file(&old);
        let _ = fs::rename(path, &old);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        // La journalisation ne doit jamais faire tomber l'overlay.
        let _ = writeln!(file, "{line}");
    }
}

/// Horodatage ISO 8601 UTC sans dépendance externe.
pub fn iso_now() -> String {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = now.as_secs() as i64;
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    let (hour, minute, second) = (rem / 3600, (rem % 3600) / 60, rem % 60);

    // Algorithme de Howard Hinnant (jours civils).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);

    format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{:03}Z",
        now.subsec_millis()
    )
}
