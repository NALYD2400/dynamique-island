//! Initialisation COM par thread.
//!
//! Les commandes Tauri tournent sur un pool de threads : chaque thread qui
//! touche à COM/WinRT doit être initialisé une fois (MTA). On mémorise l'état
//! dans un thread-local pour ne payer l'appel qu'une seule fois par thread.

use std::cell::Cell;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

thread_local! {
    static COM_READY: Cell<bool> = const { Cell::new(false) };
}

/// Garantit que COM est initialisé (MTA) sur le thread courant.
pub fn ensure_mta() {
    COM_READY.with(|ready| {
        if !ready.get() {
            // S_FALSE (déjà initialisé) et RPC_E_CHANGED_MODE sont sans danger ici.
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            ready.set(true);
        }
    });
}
