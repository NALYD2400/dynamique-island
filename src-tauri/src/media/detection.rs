//! Reconnaissance des services de streaming et repli WASAPI quand SMTC ne
//! renvoie rien (portage fidèle de `liquid_core.cs`).

use crate::platform::{audio, process, smtc::RawMedia};

pub fn infer_streaming_service(text: &str) -> &'static str {
    let t = text.to_lowercase();
    if t.contains("netflix") {
        "netflix"
    } else if t.contains("youtube") || t.contains("yt music") {
        "youtube"
    } else if t.contains("disney") {
        "disney"
    } else if t.contains("crunchyroll") {
        "crunchyroll"
    } else if t.contains("spotify") {
        "spotify"
    } else if t.contains("deezer") {
        "deezer"
    } else if t.contains("prime video") || t.contains("amazon prime") {
        "primevideo"
    } else {
        ""
    }
}

pub fn service_display_name(service: &str) -> &'static str {
    match service.to_lowercase().as_str() {
        "netflix" => "Netflix",
        "youtube" => "YouTube",
        "disney" => "Disney+",
        "crunchyroll" => "Crunchyroll",
        "spotify" => "Spotify",
        "deezer" => "Deezer",
        "primevideo" => "Prime Video",
        _ => "",
    }
}

fn is_browser_app_id(app_id: &str) -> bool {
    let id = app_id.to_lowercase();
    ["chrome", "msedge", "edge", "firefox"].iter().any(|b| id.contains(b))
}

fn browser_process_name(app_id: &str) -> &'static str {
    let id = app_id.to_lowercase();
    if id.contains("msedge") || id.contains("edge") {
        "msedge"
    } else if id.contains("firefox") {
        "firefox"
    } else if id.contains("chrome") {
        "chrome"
    } else {
        ""
    }
}

/// Déduit le service (Netflix, YouTube…) depuis les métadonnées ou le titre des onglets.
fn infer_streaming_app_id(app_id: &str, title: &str, artist: &str) -> String {
    let direct = infer_streaming_service(&format!("{title} {artist}"));
    if !direct.is_empty() {
        return direct.into();
    }
    if !is_browser_app_id(app_id) {
        return app_id.into();
    }
    let browser = browser_process_name(app_id);
    if browser.is_empty() {
        return app_id.into();
    }
    process::window_titles_for_process_name(browser)
        .iter()
        .map(|window_title| infer_streaming_service(window_title))
        .find(|service| !service.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| app_id.into())
}

/// Enrichit une réponse SMTC (service déduit, artiste par défaut).
pub fn enrich(mut media: RawMedia) -> RawMedia {
    let inferred = infer_streaming_app_id(&media.app_id, &media.title, &media.artist);
    let service = service_display_name(&inferred);
    if !inferred.is_empty() {
        media.app_id = inferred;
    }
    if (media.artist.trim().is_empty() || media.artist == "Artiste inconnu") && !service.is_empty() {
        media.artist = service.into();
    }
    media
}

fn is_own_process(name: &str) -> bool {
    let n = name.to_lowercase();
    n == "nolys" || n == "nolys.exe" || n.contains("liquid dynamic island") || n.contains("liquid-dynamic-island") || n.contains("liquid_core") || n == "electron"
}

fn is_likely_media_process(name: &str, window_title: &str) -> bool {
    const MEDIA_NAMES: [&str; 20] = [
        "spotify", "chrome", "msedge", "firefox", "brave", "opera", "vlc", "wmplayer", "music.ui", "itunes", "deezer",
        "tidal", "foobar2000", "winamp", "aimp", "potplayer", "mpv", "plex", "netflix", "primevideo",
    ];
    let n = name.to_lowercase();
    if is_own_process(&n) {
        return false;
    }
    MEDIA_NAMES.iter().any(|m| n.contains(m)) || !infer_streaming_service(window_title).is_empty()
}

fn display_app_name(process: &str) -> String {
    let name = process.trim();
    if name.is_empty() {
        return "Media".into();
    }
    let lower = name.to_lowercase();
    for (needle, label) in [
        ("chrome", "Chrome"),
        ("msedge", "Microsoft Edge"),
        ("firefox", "Firefox"),
        ("brave", "Brave"),
        ("spotify", "Spotify"),
        ("vlc", "VLC"),
        ("music.ui", "Lecteur multimedia"),
    ] {
        if lower.contains(needle) {
            return label.into();
        }
    }
    let mut chars = name.chars();
    chars.next().map(|first| first.to_uppercase().chain(chars).collect()).unwrap_or_default()
}

fn clean_fallback_title(title: &str, process: &str) -> String {
    const SUFFIXES: [&str; 9] = [
        " - Google Chrome",
        " - Microsoft Edge",
        " - Mozilla Firefox",
        " - Brave",
        " - Opera",
        " - YouTube",
        " - YouTube Music",
        " | Spotify",
        " - Spotify",
    ];
    let mut clean = title.trim().to_string();
    for suffix in SUFFIXES {
        let cut = clean.len().wrapping_sub(suffix.len());
        if clean.len() >= suffix.len() && clean.is_char_boundary(cut) && clean[cut..].eq_ignore_ascii_case(suffix) {
            clean = clean[..cut].trim().to_string();
        }
    }
    if clean.eq_ignore_ascii_case(&display_app_name(process)) {
        return String::new();
    }
    clean
}

/// Repli quand SMTC est muet : on cherche une session audio active d'un lecteur connu.
pub fn wasapi_fallback() -> Option<RawMedia> {
    let candidates: Vec<_> = audio::sessions()
        .into_iter()
        .filter(|s| s.active && !s.muted && s.volume > 0.0 && !is_own_process(&s.name))
        .filter(|s| is_likely_media_process(&s.name, &s.title))
        .collect();

    let picked = candidates.iter().find(|s| !s.title.trim().is_empty()).or(candidates.first())?;

    let mut app_id = infer_streaming_service(&format!("{} {}", picked.name, picked.title)).to_string();
    if app_id.is_empty() {
        app_id = picked.name.clone();
    }
    let service = service_display_name(&app_id);
    let mut title = clean_fallback_title(&picked.title, &picked.name);
    if title.trim().is_empty() {
        title = "Lecture detectee".into();
    }
    let artist = if service.is_empty() { display_app_name(&picked.name) } else { service.into() };

    Some(RawMedia {
        title,
        artist,
        cover: picked.icon.clone(),
        app_id,
        is_playing: true,
        progress: 0,
        duration: 0,
    })
}
