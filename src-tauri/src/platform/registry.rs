//! Accès minimal au registre utilisateur (HKCU).

use windows::core::HSTRING;
use windows::Win32::System::Registry::{
    RegGetValueW, RegSetKeyValueW, HKEY_CURRENT_USER, REG_DWORD, RRF_RT_REG_DWORD, RRF_RT_REG_EXPAND_SZ,
    RRF_RT_REG_SZ,
};

pub fn read_string(subkey: &str, value: &str) -> Option<String> {
    let (subkey, value) = (HSTRING::from(subkey), HSTRING::from(value));
    unsafe {
        let mut size = 0u32;
        let flags = RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ;
        RegGetValueW(HKEY_CURRENT_USER, &subkey, &value, flags, None, None, Some(&mut size)).ok().ok()?;
        let mut buffer = vec![0u16; (size as usize / 2) + 1];
        RegGetValueW(
            HKEY_CURRENT_USER,
            &subkey,
            &value,
            flags,
            None,
            Some(buffer.as_mut_ptr() as *mut _),
            Some(&mut size),
        )
        .ok()
        .ok()?;
        let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
        Some(String::from_utf16_lossy(&buffer[..len]))
    }
}

pub fn read_dword(subkey: &str, value: &str) -> Option<u32> {
    let (subkey, value) = (HSTRING::from(subkey), HSTRING::from(value));
    let mut data = 0u32;
    let mut size = std::mem::size_of::<u32>() as u32;
    unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            &subkey,
            &value,
            RRF_RT_REG_DWORD,
            None,
            Some(&mut data as *mut _ as *mut _),
            Some(&mut size),
        )
        .ok()
        .ok()?;
    }
    Some(data)
}

pub fn write_dword(subkey: &str, value: &str, data: u32) -> bool {
    let (subkey, value) = (HSTRING::from(subkey), HSTRING::from(value));
    unsafe {
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            &subkey,
            &value,
            REG_DWORD.0,
            Some(&data as *const _ as *const _),
            std::mem::size_of::<u32>() as u32,
        )
        .is_ok()
    }
}
