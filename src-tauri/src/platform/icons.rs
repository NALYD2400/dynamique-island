//! Extraction des icônes Windows d'un exécutable/fichier en PNG base64.

use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use base64::Engine;
use parking_lot::Mutex;
use windows::core::HSTRING;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
};
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

static ICON_CACHE: LazyLock<Mutex<HashMap<String, String>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Icône associée à un fichier, en `data:image/png;base64,…` (mise en cache).
pub fn icon_data_url(path: &str) -> String {
    let key = path.to_lowercase();
    if let Some(cached) = ICON_CACHE.lock().get(&key) {
        return cached.clone();
    }
    let data = extract(path).unwrap_or_default();
    if !data.is_empty() {
        ICON_CACHE.lock().insert(key, data.clone());
    }
    data
}

/// Résout un chemin comme `GetFileIconData` : variables d'environnement, System32, puis PATH.
pub fn resolve_file(raw: &str) -> Option<PathBuf> {
    let expanded = expand_env(raw);
    let direct = PathBuf::from(&expanded);
    if direct.is_file() {
        return Some(direct);
    }
    let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    let in_system32 = Path::new(&system_root).join("System32").join(raw);
    if in_system32.is_file() {
        return Some(in_system32);
    }
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths).map(|dir| dir.join(raw)).find(|candidate| candidate.is_file())
    })
}

fn expand_env(raw: &str) -> String {
    let mut out = String::new();
    let mut rest = raw;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let name = &after[..end];
                match std::env::var(name) {
                    Ok(value) => out.push_str(&value),
                    Err(_) => {
                        out.push('%');
                        out.push_str(name);
                        out.push('%');
                    }
                }
                rest = &after[end + 1..];
            }
            None => {
                out.push_str(&rest[start..]);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

fn extract(path: &str) -> Option<String> {
    let mut info = SHFILEINFOW::default();
    let wide = HSTRING::from(path);
    let ok = unsafe {
        SHGetFileInfoW(
            &wide,
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        )
    };
    if ok == 0 || info.hIcon.is_invalid() {
        return None;
    }
    let png = hicon_to_png(info.hIcon);
    unsafe {
        let _ = DestroyIcon(info.hIcon);
    }
    png.map(|bytes| format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

fn hicon_to_png(icon: HICON) -> Option<Vec<u8>> {
    unsafe {
        let mut icon_info = ICONINFO::default();
        GetIconInfo(icon, &mut icon_info).ok()?;
        let color = icon_info.hbmColor;
        let mask = icon_info.hbmMask;

        let result = (|| {
            if color.is_invalid() {
                return None;
            }
            let mut bitmap = BITMAP::default();
            GetObjectW(HGDIOBJ(color.0), std::mem::size_of::<BITMAP>() as i32, Some(&mut bitmap as *mut _ as *mut _));
            let (width, height) = (bitmap.bmWidth, bitmap.bmHeight);
            if width <= 0 || height <= 0 {
                return None;
            }

            let dc = CreateCompatibleDC(None);
            let mut header = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width,
                    biHeight: -height,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut pixels = vec![0u8; (width * height * 4) as usize];
            let lines = GetDIBits(dc, color, 0, height as u32, Some(pixels.as_mut_ptr() as *mut _), &mut header, DIB_RGB_COLORS);

            // Icônes sans canal alpha : on reconstruit la transparence depuis le masque.
            let has_alpha = pixels.chunks_exact(4).any(|px| px[3] != 0);
            if lines > 0 && !has_alpha && !mask.is_invalid() {
                let mut mask_pixels = vec![0u8; (width * height * 4) as usize];
                GetDIBits(dc, mask, 0, height as u32, Some(mask_pixels.as_mut_ptr() as *mut _), &mut header, DIB_RGB_COLORS);
                for (px, m) in pixels.chunks_exact_mut(4).zip(mask_pixels.chunks_exact(4)) {
                    px[3] = if m[0] == 0 { 255 } else { 0 };
                }
            }
            let _ = DeleteDC(dc);
            if lines == 0 {
                return None;
            }

            for px in pixels.chunks_exact_mut(4) {
                px.swap(0, 2); // BGRA -> RGBA
            }
            let image = image::RgbaImage::from_raw(width as u32, height as u32, pixels)?;
            let mut png = Vec::new();
            image.write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png).ok()?;
            Some(png)
        })();

        if !color.is_invalid() {
            let _ = DeleteObject(HGDIOBJ(color.0));
        }
        if !mask.is_invalid() {
            let _ = DeleteObject(HGDIOBJ(mask.0));
        }
        result
    }
}
