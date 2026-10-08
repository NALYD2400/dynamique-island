//! Météo réelle du widget du centre de contrôle, via Open-Meteo (gratuit, sans clé).
//!
//! Seul le nom de la ville choisie dans les réglages est envoyé (géocodage), puis
//! ses coordonnées pour la prévision. Le résultat est gardé 15 minutes en mémoire.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

use super::http;

const CACHE_TTL: Duration = Duration::from_secs(15 * 60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Weather {
    pub city: String,
    pub temperature: f64,
    pub min: f64,
    pub max: f64,
    /// Code météo WMO (traduit en texte et en icône par l'interface).
    pub code: i64,
    pub is_day: bool,
}

static CACHE: Mutex<Option<(String, Instant, Weather)>> = Mutex::new(None);

/// Encodage d'URL minimal (RFC 3986, caractères non réservés conservés).
fn encode(value: &str) -> String {
    value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn fetch(city: &str) -> Option<Weather> {
    let geo = http::get_json(&format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=fr&format=json",
        encode(city)
    ))?;
    let place = geo.get("results")?.get(0)?;
    let (lat, lon) = (place.get("latitude")?.as_f64()?, place.get("longitude")?.as_f64()?);
    let name = place.get("name")?.as_str().unwrap_or(city).to_string();

    let forecast = http::get_json(&format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}\
         &current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min\
         &timezone=auto&forecast_days=1"
    ))?;
    let current = forecast.get("current")?;
    let daily = forecast.get("daily")?;
    Some(Weather {
        city: name,
        temperature: current.get("temperature_2m")?.as_f64()?,
        min: daily.get("temperature_2m_min")?.get(0)?.as_f64()?,
        max: daily.get("temperature_2m_max")?.get(0)?.as_f64()?,
        code: current.get("weather_code")?.as_i64()?,
        is_day: current.get("is_day").and_then(|v| v.as_i64()).unwrap_or(1) == 1,
    })
}

/// Météo actuelle de la ville, depuis le cache si elle a moins de 15 minutes.
pub fn current(city: &str) -> Option<Weather> {
    let key = city.trim().to_lowercase();
    if key.is_empty() {
        return None;
    }
    if let Some((cached_city, at, weather)) = CACHE.lock().ok()?.as_ref() {
        if *cached_city == key && at.elapsed() < CACHE_TTL {
            return Some(weather.clone());
        }
    }
    let weather = fetch(city.trim())?;
    if let Ok(mut cache) = CACHE.lock() {
        *cache = Some((key, Instant::now(), weather.clone()));
    }
    Some(weather)
}

#[cfg(test)]
mod tests {
    use super::encode;

    #[test]
    fn encode_keeps_unreserved_and_escapes_the_rest() {
        assert_eq!(encode("Saint-Étienne"), "Saint-%C3%89tienne");
        assert_eq!(encode("New York"), "New%20York");
    }
}
