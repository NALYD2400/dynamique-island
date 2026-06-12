const { contextBridge, ipcRenderer } = require('electron');

const VALID_SEND_CHANNELS = [
    'spotify-control', 'wallpaper-sync-status', 'ai-agent-monitor-status',
    'set-ignore-mouse', 'config-changed', 'layout-config-changed', 'layout-reset',
    'set-layout-edit-mode', 'apply-profile', 'close-settings', 'trigger-notif',
    'cover-color-changed', 'register-shortcut', 'exit-app', 'open-settings',
    'set-persistent-island', 'set-target-display'
];

const VALID_INVOKE_CHANNELS = [
    'get-layout-state', 'get-audio-meter', 'get-audio-screen-source',
    'get-update-status', 'check-for-updates-manual', 'download-update-manual',
    'install-downloaded-update', 'get-auto-start', 'set-auto-start',
    'get-media-info', 'get-desktop-sources', 'get-file-icon', 'get-hardware-telemetry',
    'set-system-volume', 'get-system-volume', 'get-audio-sessions',
    'set-session-volume', 'set-session-muted', 'get-active-window-info',
    'wifi-control', 'bluetooth-control', 'dnd-control', 'get-audio-devices',
    'get-audio-input-devices', 'set-default-audio-device', 'launch-shortcut',
    'get-displays'
];

const VALID_ON_CHANNELS = [
    'config-changed', 'trigger-notif', 'apply-profile', 'layout-config-changed',
    'layout-edit-mode-changed', 'ai-agent-event', 'ai-agent-timeout', 'update-status-changed',
    'cover-color-changed', 'app-go-background', 'app-go-foreground', 'open-search'
];

contextBridge.exposeInMainWorld('electronAPI', {
    ipcRenderer: {
        send: (channel, ...args) => {
            if (VALID_SEND_CHANNELS.includes(channel)) {
                ipcRenderer.send(channel, ...args);
            } else {
                console.warn(`[Security] IPC send blocked for channel: ${channel}`);
            }
        },
        invoke: (channel, ...args) => {
            if (VALID_INVOKE_CHANNELS.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            } else {
                console.warn(`[Security] IPC invoke blocked for channel: ${channel}`);
                return Promise.reject(new Error(`Unauthorized IPC invoke channel: ${channel}`));
            }
        },
        on: (channel, callback) => {
            if (VALID_ON_CHANNELS.includes(channel)) {
                const subscription = (event, ...args) => callback(event, ...args);
                ipcRenderer.on(channel, subscription);
                return () => {
                    ipcRenderer.removeListener(channel, subscription);
                };
            } else {
                console.warn(`[Security] IPC listener registration blocked for channel: ${channel}`);
            }
        }
    }
});
