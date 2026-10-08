//! Liste des écrans pour les réglages, avec leur vrai nom (« DELL U2720Q »…).

use std::collections::HashMap;

use serde::Serialize;
use tauri::AppHandle;
use windows::Win32::Devices::Display::{
    DisplayConfigGetDeviceInfo, GetDisplayConfigBufferSizes, QueryDisplayConfig, DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
    DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME, DISPLAYCONFIG_MODE_INFO, DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SOURCE_DEVICE_NAME,
    DISPLAYCONFIG_TARGET_DEVICE_NAME, QDC_ONLY_ACTIVE_PATHS,
};

use super::layout::{monitor_id, work_area};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub id: String,
    pub label: String,
    pub bounds: Bounds,
    pub work_area: Bounds,
    pub scale_factor: f64,
}

/// Associe `\\.\DISPLAYn` au nom commercial de l'écran.
fn friendly_names() -> HashMap<String, String> {
    let mut names = HashMap::new();
    unsafe {
        let (mut path_count, mut mode_count) = (0u32, 0u32);
        if GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count).is_err() {
            return names;
        }
        let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
        let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];
        if QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, &mut path_count, paths.as_mut_ptr(), &mut mode_count, modes.as_mut_ptr(), None)
            .is_err()
        {
            return names;
        }

        for path in paths.iter().take(path_count as usize) {
            let mut source = DISPLAYCONFIG_SOURCE_DEVICE_NAME::default();
            source.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME;
            source.header.size = std::mem::size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32;
            source.header.adapterId = path.sourceInfo.adapterId;
            source.header.id = path.sourceInfo.id;

            let mut target = DISPLAYCONFIG_TARGET_DEVICE_NAME::default();
            target.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME;
            target.header.size = std::mem::size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32;
            target.header.adapterId = path.targetInfo.adapterId;
            target.header.id = path.targetInfo.id;

            if DisplayConfigGetDeviceInfo(&mut source.header) == 0 && DisplayConfigGetDeviceInfo(&mut target.header) == 0 {
                let gdi = wide_to_string(&source.viewGdiDeviceName);
                let friendly = wide_to_string(&target.monitorFriendlyDeviceName);
                if !friendly.is_empty() {
                    names.insert(gdi, friendly);
                }
            }
        }
    }
    names
}

fn wide_to_string(buffer: &[u16]) -> String {
    let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..len])
}

pub fn list(app: &AppHandle) -> Vec<DisplayInfo> {
    let names = friendly_names();
    let monitors = app.available_monitors().unwrap_or_default();
    monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let scale = monitor.scale_factor();
            let id = monitor_id(monitor);
            let (width, height) = (monitor.size().width as f64 / scale, monitor.size().height as f64 / scale);
            let name = names.get(&id).cloned().unwrap_or_else(|| format!("Moniteur {}", index + 1));
            let area = work_area(monitor);
            DisplayInfo {
                label: format!("{name} ({}x{})", width.round(), height.round()),
                bounds: Bounds { x: monitor.position().x as f64 / scale, y: monitor.position().y as f64 / scale, width, height },
                work_area: Bounds { x: area.x, y: area.y, width: area.width, height: area.height },
                scale_factor: scale,
                id,
            }
        })
        .collect()
}

/// Empreinte de la configuration d'écrans, pour détecter les changements.
pub fn signature(app: &AppHandle) -> String {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let area = m.work_area();
            format!("{}:{}x{}@{}:{},{},{},{}", monitor_id(m), m.size().width, m.size().height, m.scale_factor(),
                area.position.x, area.position.y, area.size.width, area.size.height)
        })
        .collect::<Vec<_>>()
        .join("|")
}
