//! Client HTTP minimal basé sur `Windows.Web.Http` (aucune dépendance réseau embarquée).

use windows::core::HSTRING;
use windows::Foundation::Uri;
use windows::Storage::Streams::DataReader;
use windows::Web::Http::HttpClient;

use super::com;

fn client() -> windows::core::Result<HttpClient> {
    com::ensure_mta();
    HttpClient::new()
}

pub fn get_text(url: &str) -> Option<String> {
    let uri = Uri::CreateUri(&HSTRING::from(url)).ok()?;
    let text = client().ok()?.GetStringAsync(&uri).ok()?.join().ok()?;
    Some(text.to_string_lossy())
}

pub fn get_bytes(url: &str) -> Option<Vec<u8>> {
    let uri = Uri::CreateUri(&HSTRING::from(url)).ok()?;
    let response = client().ok()?.GetAsync(&uri).ok()?.join().ok()?;
    if !response.IsSuccessStatusCode().ok()? {
        return None;
    }
    let buffer = response.Content().ok()?.ReadAsBufferAsync().ok()?.join().ok()?;
    let reader = DataReader::FromBuffer(&buffer).ok()?;
    let mut bytes = vec![0u8; buffer.Length().ok()? as usize];
    reader.ReadBytes(&mut bytes).ok()?;
    Some(bytes)
}

pub fn get_json(url: &str) -> Option<serde_json::Value> {
    serde_json::from_str(&get_text(url)?).ok()
}
