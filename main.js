const { app, BrowserWindow, ipcMain, screen, desktopCapturer, session, globalShortcut, shell, net: electronNet } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { spawn, execFile } = require('child_process');

const readline = require('readline');
const fs = require('fs');
const net = require('net');

process.on('uncaughtException', (err) => {
    console.error('[Main] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[Main] Unhandled rejection:', reason);
});

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let coreWorker = null;
let rl = null;
let persistentIslandEnabled = true;
let islandHiddenByShortcut = false;
let topmostWatchdog = null;
let currentMedia = {
    title: "Aucune lecture",
    artist: "Système",
    cover: "",
    transientCover: "",
    appId: "",
    isPlaying: false,
    progress: 0,
    duration: 0,
    source: "",
    trackKey: "",
    windowTitle: ""
};
let activeCoreCommand = null;
const coreCommandQueue = [];
let mediaAdvanceGuard = {
    until: 0,
    previousCover: "",
    previousTrackKey: ""
};
let mediaPlaybackGuardUntil = 0;
let mediaPlaybackExpectedIsPlaying = null;
let lastNoMediaDiagnosticAt = 0;
let lastMediaLogSignature = "";
let activeWindowCache = {
    at: 0,
    info: null
};
let updateStatus = {
    state: 'idle',
    currentVersion: app.getVersion(),
    availableVersion: null,
    releaseName: '',
    releaseDate: '',
    progress: 0,
    downloaded: false,
    error: '',
    checkedAt: null
};
let updateCheckInProgress = false;
let updateDownloadInProgress = false;
let isInstallingUpdate = false;

const TRUSTED_PERMISSION_SET = new Set(['media', 'notifications']);
const CORE_TEXT_ARG_MAX_LENGTH = 2048;
const MAX_CORE_COMMAND_QUEUE_LENGTH = 128;

function getPublicUpdateStatus() {
    return {
        ...updateStatus,
        currentVersion: app.getVersion(),
        canCheck: app.isPackaged && !updateCheckInProgress && !updateDownloadInProgress,
        canDownload: app.isPackaged && updateStatus.state === 'available' && !updateDownloadInProgress,
        canInstall: app.isPackaged && updateStatus.state === 'downloaded'
    };
}

function sendToTrustedWindows(channel, payload) {
    [mainWindow, settingsWindow].forEach((targetWindow) => {
        if (targetWindow && !targetWindow.isDestroyed()) {
            targetWindow.webContents.send(channel, payload);
        }
    });
}

function sendUpdateStatus(notifyIsland = false) {
    const publicStatus = getPublicUpdateStatus();
    sendToTrustedWindows('update-status-changed', publicStatus);

    if (notifyIsland && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-notif', {
            title: 'Mise a jour disponible',
            message: `Version ${publicStatus.availableVersion || 'recente'} prete dans les reglages`,
            icon: 'ph-download-simple'
        });
    }
}

function setUpdateStatus(patch, options = {}) {
    updateStatus = {
        ...updateStatus,
        ...patch,
        currentVersion: app.getVersion()
    };
    sendUpdateStatus(Boolean(options.notifyIsland));
    return getPublicUpdateStatus();
}

function getUpdateInfoVersion(info) {
    return info?.version || info?.tag || null;
}

function configureUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => {
        updateCheckInProgress = true;
        setUpdateStatus({
            state: 'checking',
            progress: 0,
            error: '',
            checkedAt: new Date().toISOString()
        });
    });

    autoUpdater.on('update-available', (info) => {
        updateCheckInProgress = false;
        setUpdateStatus({
            state: 'available',
            availableVersion: getUpdateInfoVersion(info),
            releaseName: info?.releaseName || '',
            releaseDate: info?.releaseDate || '',
            progress: 0,
            downloaded: false,
            error: ''
        }, { notifyIsland: true });
    });

    autoUpdater.on('update-not-available', () => {
        updateCheckInProgress = false;
        updateDownloadInProgress = false;
        setUpdateStatus({
            state: 'up-to-date',
            availableVersion: null,
            releaseName: '',
            releaseDate: '',
            progress: 0,
            downloaded: false,
            error: '',
            checkedAt: new Date().toISOString()
        });
    });

    autoUpdater.on('download-progress', (progress) => {
        updateDownloadInProgress = true;
        setUpdateStatus({
            state: 'downloading',
            progress: Math.max(0, Math.min(100, Math.round(progress?.percent || 0))),
            error: ''
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        updateDownloadInProgress = false;
        setUpdateStatus({
            state: 'downloaded',
            availableVersion: getUpdateInfoVersion(info) || updateStatus.availableVersion,
            releaseName: info?.releaseName || updateStatus.releaseName,
            releaseDate: info?.releaseDate || updateStatus.releaseDate,
            progress: 100,
            downloaded: true,
            error: ''
        }, { notifyIsland: true });
    });

    autoUpdater.on('before-quit-for-update', () => {
        isInstallingUpdate = true;
    });

    autoUpdater.on('error', (err) => {
        updateCheckInProgress = false;
        updateDownloadInProgress = false;
        setUpdateStatus({
            state: 'error',
            error: err?.message || String(err || 'Erreur de mise a jour'),
            progress: 0
        });
        console.error('[Updater]', err);
    });
}

async function checkForUpdatesManual() {
    if (!app.isPackaged) {
        return setUpdateStatus({
            state: 'dev',
            error: '',
            checkedAt: new Date().toISOString()
        });
    }

    if (updateCheckInProgress || updateDownloadInProgress) {
        return getPublicUpdateStatus();
    }

    try {
        await autoUpdater.checkForUpdates();
        return getPublicUpdateStatus();
    } catch (err) {
        return setUpdateStatus({
            state: 'error',
            error: err?.message || String(err || 'Verification impossible')
        });
    }
}

async function downloadAvailableUpdate() {
    if (!app.isPackaged || updateDownloadInProgress || updateStatus.state !== 'available') {
        return getPublicUpdateStatus();
    }

    updateDownloadInProgress = true;
    setUpdateStatus({ state: 'downloading', progress: 0, error: '' });

    try {
        await autoUpdater.downloadUpdate();
        return getPublicUpdateStatus();
    } catch (err) {
        updateDownloadInProgress = false;
        return setUpdateStatus({
            state: 'error',
            error: err?.message || String(err || 'Telechargement impossible'),
            progress: 0
        });
    }
}

function getEventUrl(event) {
    return event?.senderFrame?.url || event?.sender?.getURL?.() || "";
}

function isTrustedSender(event) {
    const sender = event?.sender;
    const url = getEventUrl(event);
    return Boolean(isTrustedWebContents(sender) && url.startsWith('file://'));
}

function isTrustedWebContents(webContents) {
    return Boolean(
        (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents === webContents) ||
        (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.webContents === webContents)
    );
}

function ensureTrustedSender(event, fallback = null) {
    if (isTrustedSender(event)) return { trusted: true, value: null };
    logCoreMessage(`[Security] Rejected IPC from untrusted sender: ${getEventUrl(event) || 'unknown'}`);
    return { trusted: false, value: fallback };
}

function hasUnsafeCoreText(value) {
    return typeof value !== 'string' ||
        value.length === 0 ||
        value.length > CORE_TEXT_ARG_MAX_LENGTH ||
        /[\r\n]/.test(value);
}

function clampInteger(value, min, max, fallback = null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeToggleAction(action) {
    const clean = String(action || '').trim().toLowerCase();
    return ['on', 'off', 'status'].includes(clean) ? clean : null;
}

function normalizeMediaCommand(action) {
    const clean = String(action || '').trim().toLowerCase();
    if (['toggle', 'play', 'pause', 'next', 'prev'].includes(clean)) return clean;

    const seekMatch = clean.match(/^seek\s+(\d{1,10})$/);
    if (seekMatch) return `seek ${seekMatch[1]}`;

    return null;
}

let originalWallpaper = "";
let lastWallpaperCover = "";
let isWallpaperSyncEnabled = false;
let wallpaperSyncStyle = "blur";

function isTempWallpaper(wpPath) {
    if (!wpPath) return true;
    const normalizedWp = path.normalize(wpPath).toLowerCase();
    const userDataPath = path.normalize(app.getPath('userData')).toLowerCase();
    
    if (normalizedWp.includes(userDataPath)) return true;
    if (normalizedWp.includes('current_wallpaper.jpg')) return true;
    if (normalizedWp.includes('processed_wallpaper.jpg')) return true;
    if (normalizedWp.includes('liquid-dynamic-island')) return true;
    if (normalizedWp.includes('liquid dynamic island')) return true;
    
    return false;
}

// Store the original wallpaper on startup (after C# core is ready)
async function storeOriginalWallpaper() {
    try {
        const backupPath = path.join(app.getPath('userData'), 'original_wallpaper_path.txt');
        const originalWp = await sendCoreCommand('getwallpaper');
        
        logCoreMessage(`[Wallpaper Sync] Fetched wallpaper from registry: ${originalWp}`);
        
        if (originalWp && fs.existsSync(originalWp) && !isTempWallpaper(originalWp)) {
            originalWallpaper = originalWp;
            fs.writeFileSync(backupPath, originalWp, 'utf8');
            logCoreMessage(`[Wallpaper Sync] Valid original wallpaper stored and backed up: ${originalWallpaper}`);
        } else {
            // It's a temp wallpaper or invalid. Let's try to restore from backup file
            if (fs.existsSync(backupPath)) {
                const backedUp = fs.readFileSync(backupPath, 'utf8').trim();
                if (backedUp && fs.existsSync(backedUp)) {
                    originalWallpaper = backedUp;
                    logCoreMessage(`[Wallpaper Sync] Restored original wallpaper path from backup file: ${originalWallpaper}`);
                } else {
                    logCoreMessage(`[Wallpaper Sync] Backup file path does not exist on disk: ${backedUp}`);
                }
            } else {
                logCoreMessage(`[Wallpaper Sync] No backup file found. Querying Windows wallpaper history...`);
                try {
                    const history = await runPowerShellJson(
                        "Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Wallpapers' | Select-Object -Property BackgroundHistoryPath* | ConvertTo-Json",
                        null
                    );
                    if (history) {
                        let foundHistoryWp = "";
                        for (let i = 0; i < 5; i++) {
                            const val = history[`BackgroundHistoryPath${i}`];
                            if (val && fs.existsSync(val) && !isTempWallpaper(val)) {
                                foundHistoryWp = val;
                                break;
                            }
                        }
                        if (foundHistoryWp) {
                            originalWallpaper = foundHistoryWp;
                            fs.writeFileSync(backupPath, originalWallpaper, 'utf8');
                            logCoreMessage(`[Wallpaper Sync] Recovered original wallpaper from Windows history: ${originalWallpaper}`);
                        } else {
                            logCoreMessage(`[Wallpaper Sync] No real wallpaper found in registry history.`);
                        }
                    } else {
                        logCoreMessage(`[Wallpaper Sync] Failed to query registry history via PowerShell.`);
                    }
                } catch (historyErr) {
                    logCoreMessage(`[Wallpaper Sync] Error querying history: ${historyErr.message}`);
                }
            }
        }
    } catch (e) {
        logCoreMessage(`[Wallpaper Sync] Failed to store/restore original wallpaper: ${e.message}`);
    }
}

async function updateWallpaper(cover) {
    if (!isWallpaperSyncEnabled) return;

    if (!cover) {
        // Restore original wallpaper if empty
        if (lastWallpaperCover) {
            await restoreOriginalWallpaper();
        }
        return;
    }

    if (cover === lastWallpaperCover) return;

    try {
        const tempPath = path.join(app.getPath('userData'), 'current_wallpaper.jpg');
        
        if (cover.startsWith('data:image/')) {
            // Base64 image
            const base64Data = cover.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(tempPath, buffer);
            await applyWallpaper(tempPath);
            lastWallpaperCover = cover;
        } else if (cover.startsWith('http://') || cover.startsWith('https://')) {
            // URL image
            const response = await electronNet.fetch(cover);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                fs.writeFileSync(tempPath, buffer);
                await applyWallpaper(tempPath);
                lastWallpaperCover = cover;
            }
        }
    } catch (e) {
        logCoreMessage(`[Wallpaper Sync] Failed to update wallpaper: ${e.message}`);
    }
}

async function applyWallpaper(imagePath) {
    if (hasUnsafeCoreText(imagePath)) return;

    try {
        if (wallpaperSyncStyle === 'sharp') {
            await sendCoreCommand(`wallpaper "${imagePath}"`);
            logCoreMessage(`[Wallpaper Sync] Applied sharp wallpaper: ${imagePath}`);
        } else {
            await sendCoreCommand(`wallpaperblur "${imagePath}"`);
            logCoreMessage(`[Wallpaper Sync] Applied blurred wallpaper: ${imagePath}`);
        }
    } catch (e) {
        logCoreMessage(`[Wallpaper Sync] Failed to apply wallpaper command: ${e.message}`);
    }
}

async function restoreOriginalWallpaper() {
    if (originalWallpaper && !hasUnsafeCoreText(originalWallpaper) && fs.existsSync(originalWallpaper)) {
        try {
            await sendCoreCommand(`wallpaper "${originalWallpaper}"`);
            lastWallpaperCover = "";
            logCoreMessage('[Wallpaper Sync] Restored original wallpaper');
        } catch (e) {
            logCoreMessage(`[Wallpaper Sync] Failed to restore original wallpaper: ${e.message}`);
        }
    }
}

async function handleWallpaperSyncChange(enabled) {
    const wasEnabled = isWallpaperSyncEnabled;
    isWallpaperSyncEnabled = enabled;
    
    if (wasEnabled && !enabled) {
        // Just disabled: restore the original wallpaper!
        await restoreOriginalWallpaper();
    } else if (!wasEnabled && enabled && currentMedia && currentMedia.cover) {
        // Just enabled: sync immediately!
        await storeOriginalWallpaper();
        await updateWallpaper(currentMedia.cover);
    }
}

function logCoreMessage(message) {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);

    try {
        fs.appendFileSync(path.join(app.getPath('userData'), 'liquid-core.log'), line + '\n', 'utf8');
    } catch (e) {
        // Logging must never break the overlay.
    }
}

function getMediaTrackKey(title, artist) {
    return `${title || ""}::${artist || ""}`.toLowerCase();
}

function isBrowserApp(appId) {
    const clean = (appId || "").toLowerCase();
    return /chrome|msedge|edge|firefox|brave|opera|arc/.test(clean);
}

function isLikelyBrowserIconCover(cover) {
    if (!cover) return false;
    const clean = String(cover).toLowerCase();

    if (clean.includes('google-chrome') || clean.includes('microsoft-edge') || clean.includes('firefox')) {
        return true;
    }

    return clean.startsWith('data:image/') && clean.length < 14000;
}

function describeCoverForLog(cover) {
    if (!cover) return "none";
    const clean = String(cover).toLowerCase();
    if (clean.startsWith('data:image/')) return `data:${cover.length}`;
    if (clean.includes('google-chrome')) return "chrome-icon";
    if (clean.includes('microsoft-edge')) return "edge-icon";
    if (clean.includes('firefox')) return "firefox-icon";
    if (clean.startsWith('http')) return clean.slice(0, 90);
    return clean.slice(0, 40);
}

async function getForegroundWindowInfoCached() {
    if (Date.now() - activeWindowCache.at < 1200 && activeWindowCache.info) {
        return activeWindowCache.info;
    }

    const command = `
$sig = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class LiquidForegroundWindow {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@
try { Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue } catch {}
$h = [LiquidForegroundWindow]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 1024
[void][LiquidForegroundWindow]::GetWindowText($h, $sb, $sb.Capacity)
$fgPid = [uint32]0
[void][LiquidForegroundWindow]::GetWindowThreadProcessId($h, [ref]$fgPid)
$procName = ''
try { $p = Get-Process -Id $fgPid -ErrorAction SilentlyContinue; if ($p) { $procName = $p.ProcessName } } catch {}
[pscustomobject]@{ title = $sb.ToString(); pid = $fgPid; processName = $procName } | ConvertTo-Json -Compress
`;

    const info = await runPowerShellJson(command, { title: "", pid: 0, processName: "" });
    activeWindowCache = { at: Date.now(), info };
    return info;
}

function logMediaSnapshot(media, rawCover) {
    const signature = [
        media.title,
        media.artist,
        media.appId,
        media.source,
        describeCoverForLog(media.cover),
        describeCoverForLog(media.transientCover),
        media.windowTitle || ""
    ].join('|');

    if (signature === lastMediaLogSignature) return;
    lastMediaLogSignature = signature;

    logCoreMessage(`[Media] source=${media.source || 'n/a'} app=${media.appId || 'n/a'} title="${media.title}" artist="${media.artist}" cover=${describeCoverForLog(media.cover)} transient=${describeCoverForLog(media.transientCover)} raw=${describeCoverForLog(rawCover)} window="${media.windowTitle || ''}"`);
}

const ISLAND_WINDOW_BASE = {
    width: 620,
    height: 600
};

let currentLayoutConfig = {
    x: null,
    y: 10,
    scale: 1
};
let layoutEditMode = false;
let suppressLayoutMoveSync = false;

function getLayoutConfigPath() {
    return path.join(app.getPath('userData'), 'liquid-island-layout.json');
}

function clampScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(1.1, Math.max(0.65, numeric));
}

function getDefaultLayoutConfig() {
    const display = screen.getPrimaryDisplay();
    const workArea = display.workArea;
    return {
        x: Math.round(workArea.x + ((workArea.width - ISLAND_WINDOW_BASE.width) / 2)),
        y: workArea.y - 30,
        scale: 1
    };
}

function normalizeLayoutConfig(layout = {}) {
    const defaults = getDefaultLayoutConfig();
    return {
        x: Number.isFinite(Number(layout.x)) ? Number(layout.x) : defaults.x,
        y: Number.isFinite(Number(layout.y)) ? Number(layout.y) : defaults.y,
        scale: clampScale(layout.scale)
    };
}

function clampLayoutConfigToDisplay(layout) {
    const display = screen.getPrimaryDisplay();
    const workArea = display.workArea;
    const normalized = normalizeLayoutConfig(layout);
    const maxX = workArea.x + workArea.width - ISLAND_WINDOW_BASE.width;
    const maxY = workArea.y + workArea.height - ISLAND_WINDOW_BASE.height;

    normalized.x = Math.min(Math.max(normalized.x, workArea.x), Math.max(workArea.x, maxX));
    normalized.y = Math.min(Math.max(normalized.y, workArea.y - 40), Math.max(workArea.y - 40, maxY));
    return normalized;
}

function loadLayoutConfig() {
    try {
        const configPath = getLayoutConfigPath();
        if (fs.existsSync(configPath)) {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return clampLayoutConfigToDisplay(parsed);
        }
    } catch (e) {
        console.warn('[Layout] Failed to load saved layout:', e.message);
    }
    return clampLayoutConfigToDisplay(getDefaultLayoutConfig());
}

function saveLayoutConfig() {
    try {
        fs.writeFileSync(getLayoutConfigPath(), JSON.stringify(currentLayoutConfig, null, 2), 'utf8');
    } catch (e) {
        console.warn('[Layout] Failed to save layout:', e.message);
    }
}

function broadcastLayoutConfig() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('layout-config-changed', currentLayoutConfig);
        mainWindow.webContents.send('layout-edit-mode-changed', layoutEditMode);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('layout-config-changed', currentLayoutConfig);
        settingsWindow.webContents.send('layout-edit-mode-changed', layoutEditMode);
    }
}

function applyMainWindowLayout() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    currentLayoutConfig = clampLayoutConfigToDisplay(currentLayoutConfig);
    suppressLayoutMoveSync = true;
    mainWindow.setBounds({
        x: Math.round(currentLayoutConfig.x),
        y: Math.round(currentLayoutConfig.y),
        width: ISLAND_WINDOW_BASE.width,
        height: ISLAND_WINDOW_BASE.height
    }, false);
    setTimeout(() => {
        suppressLayoutMoveSync = false;
    }, 0);
    broadcastLayoutConfig();
}

function isMainWindowAlive() {
    return mainWindow && !mainWindow.isDestroyed();
}

function enforceMainWindowTopmost(reason = 'unknown') {
    if (!isMainWindowAlive() || !persistentIslandEnabled) return;

    try {
        let changed = false;

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
            changed = true;
        }

        if (!mainWindow.isVisible() && !islandHiddenByShortcut) {
            mainWindow.showInactive();
            changed = true;
        }

        // Only call expensive Electron window adjustments if states have actually drifted
        if (!mainWindow.isAlwaysOnTop()) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            changed = true;
        }
        
        // We only move to top if the focus or active window states might have overridden us,
        // or if we forced a change. Constant moveTop() calls can cause focus fights in Win32.
        if (changed || reason === 'startup' || reason === 'show' || reason === 'unexpected-hide') {
            mainWindow.setSkipTaskbar(true);
            mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            mainWindow.moveTop();
        }
    } catch (e) {
        console.warn(`[Topmost] Failed to enforce topmost (${reason}):`, e.message);
    }
}

function startTopmostWatchdog() {
    if (topmostWatchdog) return;

    topmostWatchdog = setInterval(() => {
        if (!persistentIslandEnabled || layoutEditMode || islandHiddenByShortcut) return;
        enforceMainWindowTopmost('watchdog');
    }, 1500);

    if (typeof topmostWatchdog.unref === 'function') {
        topmostWatchdog.unref();
    }
}

function stopTopmostWatchdog() {
    if (!topmostWatchdog) return;
    clearInterval(topmostWatchdog);
    topmostWatchdog = null;
}

function setIslandPersistentMode(enabled, reason = 'setting') {
    persistentIslandEnabled = Boolean(enabled);

    if (!isMainWindowAlive()) return;

    if (persistentIslandEnabled) {
        islandHiddenByShortcut = false;
        startTopmostWatchdog();
        enforceMainWindowTopmost(reason);
        return;
    }

    stopTopmostWatchdog();
    try {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
    } catch (e) {
        console.warn(`[Topmost] Failed to disable persistent mode (${reason}):`, e.message);
    }
}

function setLayoutEditModeState(enabled) {
    layoutEditMode = Boolean(enabled);
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (layoutEditMode) {
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            mainWindow.moveTop();
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            mainWindow.setIgnoreMouseEvents(false);
            mainWindow.focus();
        } else {
            mainWindow.setIgnoreMouseEvents(true, { forward: true });
        }
    }
    broadcastLayoutConfig();
}


// Disable hardware acceleration to prevent transparent flashing issues
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('enable-transparent-visuals');

// 1. SPAWN BACKGROUND AUDIO & MEDIA CORE (C# BINARY)
function startCoreWorker() {
    const coreExePath = app.isPackaged
        ? path.join(process.resourcesPath, 'bin', 'liquid_core.exe')
        : path.join(__dirname, 'bin', 'liquid_core.exe');

    let selectedExePath = coreExePath;

    if (!fs.existsSync(selectedExePath)) {
        // Dev fallback to the build output directory (dotnet publish output)
        const devBuildPath = path.join(__dirname, 'build', 'native-bin', 'liquid_core.exe');
        if (fs.existsSync(devBuildPath)) {
            selectedExePath = devBuildPath;
        } else {
            selectedExePath = null;
        }
    }

    if (selectedExePath) {
        logCoreMessage(`[Core] Launching high performance core: ${selectedExePath}`);
        coreWorker = spawn(selectedExePath, [], { cwd: path.dirname(selectedExePath) });
    } else {
        logCoreMessage('[Core] Background core helper not found. Running in simulation mode.');
        return;
    }

    rl = readline.createInterface({ input: coreWorker.stdout });
    rl.on('line', (line) => {
        if (activeCoreCommand) {
            const command = activeCoreCommand;
            activeCoreCommand = null;
            clearTimeout(command.timeout);
            command.resolve(line);
            pumpCoreCommandQueue();
        }
    });

    coreWorker.stderr.on('data', (chunk) => {
        const text = chunk.toString().trim();
        if (text) logCoreMessage(`[Core stderr] ${text}`);
    });

    coreWorker.on('exit', (code, signal) => {
        logCoreMessage(`[Core] Background helper exited with code ${code}, signal ${signal || 'none'}`);
        cleanupCore();
        setTimeout(startCoreWorker, 3000); // Auto reconnect
    });

    coreWorker.on('error', (err) => {
        logCoreMessage(`[Core] Background process error: ${err.stack || err.message}`);
        cleanupCore();
    });

    setTimeout(() => {
        logCoreDiagnostics('startup');
        storeOriginalWallpaper();
    }, 2500);
}

function cleanupCore() {
    coreWorker = null;
    if (activeCoreCommand) {
        clearTimeout(activeCoreCommand.timeout);
        activeCoreCommand.resolve(null);
        activeCoreCommand = null;
    }
    while (coreCommandQueue.length > 0) {
        const command = coreCommandQueue.shift();
        command.resolve(null);
    }
    if (rl) {
        rl.close();
        rl = null;
    }
}

function pumpCoreCommandQueue() {
    if (activeCoreCommand || coreCommandQueue.length === 0) return;

    const command = coreCommandQueue.shift();
    if (!coreWorker || !coreWorker.stdin || coreWorker.killed) {
        command.resolve(null);
        pumpCoreCommandQueue();
        return;
    }

    activeCoreCommand = command;
    command.timeout = setTimeout(() => {
        if (activeCoreCommand === command) {
            activeCoreCommand = null;
            command.resolve(null);
            pumpCoreCommandQueue();
        }
    }, command.timeoutMs);

    try {
        coreWorker.stdin.write(command.cmd + '\n');
    } catch (e) {
        if (activeCoreCommand === command) {
            clearTimeout(command.timeout);
            activeCoreCommand = null;
            command.resolve(null);
            pumpCoreCommandQueue();
        }
    }
}

async function sendCoreCommand(cmd, timeoutMs = 2000) {
    if (!coreWorker) return null;
    if (hasUnsafeCoreText(String(cmd || ''))) return null;
    if (coreCommandQueue.length >= MAX_CORE_COMMAND_QUEUE_LENGTH) {
        logCoreMessage('[Core] Command queue overflow; dropping command');
        return null;
    }

    return new Promise((resolve) => {
        coreCommandQueue.push({ cmd, resolve, timeout: null, timeoutMs });
        pumpCoreCommandQueue();
    });
}

async function logCoreDiagnostics(reason) {
    if (!coreWorker) return;

    try {
        const result = await sendCoreCommand('diagnostics', 5000);
        if (result) {
            logCoreMessage(`[Core diagnostics:${reason}] ${result}`);
        }
    } catch (e) {
        logCoreMessage(`[Core diagnostics:${reason}] failed: ${e.message}`);
    }
}

// 2. CREATE FLOATING OVERLAY WINDOW (THE ISLAND)
function createMainWindow() {
    currentLayoutConfig = clampLayoutConfigToDisplay(currentLayoutConfig);

    mainWindow = new BrowserWindow({
        width: ISLAND_WINDOW_BASE.width,
        height: ISLAND_WINDOW_BASE.height,
        x: Math.round(currentLayoutConfig.x),
        y: Math.round(currentLayoutConfig.y),
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true, // Hidden from Alt-Tab
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Elevate alwaysOnTop level to absolute maximum for fullscreen-friendly overlays.
    setIslandPersistentMode(true, 'create-window');

    // Point to structured index.html
    mainWindow.loadFile(path.join(__dirname, 'src', 'island', 'index.html'));

    mainWindow.webContents.on('did-finish-load', () => {
        broadcastLayoutConfig();
    });

    // Redirect console messages to node terminal
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Island UI Console] ${message} (${path.basename(sourceId)}:${line})`);
    });

    // Enable default click-through
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    mainWindow.on('show', () => {
        setTimeout(() => enforceMainWindowTopmost('show'), 80);
    });

    mainWindow.on('hide', () => {
        if (persistentIslandEnabled && !islandHiddenByShortcut) {
            setTimeout(() => enforceMainWindowTopmost('unexpected-hide'), 180);
        }
    });

    mainWindow.on('blur', () => {
        setTimeout(() => enforceMainWindowTopmost('blur'), 140);
    });

    mainWindow.on('closed', () => {
        stopTopmostWatchdog();
        mainWindow = null;
    });

    mainWindow.on('move', () => {
        if (!mainWindow || mainWindow.isDestroyed() || suppressLayoutMoveSync) return;
        const [x, y] = mainWindow.getPosition();
        currentLayoutConfig = clampLayoutConfigToDisplay({
            ...currentLayoutConfig,
            x,
            y
        });
        saveLayoutConfig();
        broadcastLayoutConfig();
    });
}

// 3. CREATE STANDALONE GLASS CONFIG WINDOW (SETTINGS)
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 780,
        height: 530,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        resizable: false,
        alwaysOnTop: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Point to structured settings.html
    settingsWindow.loadFile(path.join(__dirname, 'src', 'settings', 'settings.html'));

    // Redirect console messages to node terminal
    settingsWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Settings UI Console] ${message} (${path.basename(sourceId)}:${line})`);
    });

    settingsWindow.on('closed', () => {
        if (layoutEditMode) {
            setLayoutEditModeState(false);
        }
        settingsWindow = null;
    });
}

// 3.5 CREATE SYSTEM TRAY
function getTrayIconPath() {
    const candidates = app.isPackaged
        ? [
            path.join(process.resourcesPath, 'tray', 'icon.ico'),
            path.join(process.resourcesPath, 'icon.ico')
        ]
        : [
            path.join(__dirname, 'build', 'icon.ico')
        ];

    return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function createTray() {
    const { Menu, Tray, nativeImage } = require('electron');
    const iconPath = getTrayIconPath();
    
    if (!iconPath) {
        console.warn('[Tray] Icon file not found in packaged resources.');
        return;
    }
    
    const trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
        console.warn('[Tray] Icon file could not be loaded:', iconPath);
        return;
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('Liquid Dynamic Island');
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Afficher / Masquer l\'Island',
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    if (mainWindow.isVisible()) {
                        islandHiddenByShortcut = true;
                        mainWindow.hide();
                    } else {
                        islandHiddenByShortcut = false;
                        mainWindow.showInactive();
                        enforceMainWindowTopmost('tray-show');
                    }
                }
            }
        },
        {
            label: 'Réglages',
            click: () => {
                createSettingsWindow();
            }
        },
        { type: 'separator' },
        {
            label: 'Lancer au démarrage',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: (menuItem) => {
                try {
                    app.setLoginItemSettings({
                        openAtLogin: menuItem.checked,
                        path: app.getPath('exe')
                    });
                    logCoreMessage(`[Tray] Set openAtLogin to ${menuItem.checked}`);
                } catch (e) {
                    console.error('[Tray] Failed to set login settings:', e.message);
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quitter',
            click: () => {
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    // Toggle on double-click
    tray.on('double-click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
                islandHiddenByShortcut = true;
                mainWindow.hide();
            } else {
                islandHiddenByShortcut = false;
                mainWindow.showInactive();
                enforceMainWindowTopmost('tray-doubleclick');
            }
        }
    });
}

// 4. BIND ELECTRON LIFECYCLE EVENTS
app.whenReady().then(() => {
    configureUpdater();
    currentLayoutConfig = loadLayoutConfig();
    startCoreWorker();
    createMainWindow();
    createTray();

    if (app.isPackaged) {
        setTimeout(() => {
            checkForUpdatesManual().catch(err => {
                console.error('[Updater] Error checking for updates:', err);
            });
        }, 2500);
    } else {
        setUpdateStatus({ state: 'dev', checkedAt: new Date().toISOString() });
    }


    // Auto-approve and capture system sound loopback for visualizer reactiveness
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        const requestUrl = request?.frame?.url || request?.webContents?.getURL?.() || "";
        const knownRequester = request?.webContents ? isTrustedWebContents(request.webContents) : true;
        if (!requestUrl.startsWith('file://') || !knownRequester) {
            logCoreMessage(`[Security] Rejected display capture request from ${requestUrl || 'unknown'}`);
            callback({ error: 'Not allowed' });
            return;
        }

        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            if (sources.length > 0) {
                callback({ video: sources[0], audio: sources[0] });
            } else {
                callback({ error: 'No screen sources found' });
            }
        }).catch(err => {
            console.error('Display media request handler error:', err);
            callback({ error: err.message });
        });
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const url = webContents?.getURL?.() || "";
        callback(isTrustedWebContents(webContents) && url.startsWith('file://') && TRUSTED_PERMISSION_SET.has(permission));
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission, origin, details) => {
        const url = webContents?.getURL?.() || origin || "";
        return isTrustedWebContents(webContents) && url.startsWith('file://') && TRUSTED_PERMISSION_SET.has(permission);
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });

    ['display-added', 'display-removed', 'display-metrics-changed'].forEach(eventName => {
        screen.on(eventName, () => {
            if (!isMainWindowAlive()) return;
            currentLayoutConfig = clampLayoutConfigToDisplay(currentLayoutConfig);
            applyMainWindowLayout();
            enforceMainWindowTopmost(`screen-${eventName}`);
        });
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

let isQuitting = false;
app.on('will-quit', (event) => {
    if (isInstallingUpdate) return;
    if (isQuitting) return;
    event.preventDefault();
    isQuitting = true;
    const restorePromise = isWallpaperSyncEnabled ? restoreOriginalWallpaper() : Promise.resolve();
    restorePromise.then(() => {
        setTimeout(() => {
            cleanupCore();
            app.exit(0);
        }, 200);
    });
});

// IPC Pipeline Event listeners
ipcMain.on('set-ignore-mouse', (event, ignore, options) => {
    if (!isTrustedSender(event)) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (layoutEditMode && ignore) {
            return;
        }
        mainWindow.setIgnoreMouseEvents(ignore, options || { forward: true });
    }
});

ipcMain.on('set-persistent-island', (event, enabled) => {
    if (!isTrustedSender(event)) return;
    setIslandPersistentMode(enabled, 'ipc-setting');
});

ipcMain.on('exit-app', (event) => {
    if (!isTrustedSender(event)) return;
    app.quit();
});

ipcMain.on('open-settings', (event) => {
    if (!isTrustedSender(event)) return;
    createSettingsWindow();
});

ipcMain.on('close-settings', (event) => {
    if (!isTrustedSender(event)) return;
    if (settingsWindow) settingsWindow.close();
});

ipcMain.handle('get-update-status', (event) => {
    const trust = ensureTrustedSender(event, getPublicUpdateStatus());
    if (!trust.trusted) return trust.value;
    return getPublicUpdateStatus();
});

ipcMain.handle('check-for-updates-manual', async (event) => {
    const trust = ensureTrustedSender(event, getPublicUpdateStatus());
    if (!trust.trusted) return trust.value;
    return checkForUpdatesManual();
});

ipcMain.handle('download-update-manual', async (event) => {
    const trust = ensureTrustedSender(event, getPublicUpdateStatus());
    if (!trust.trusted) return trust.value;
    return downloadAvailableUpdate();
});

ipcMain.handle('install-downloaded-update', async (event) => {
    const trust = ensureTrustedSender(event, getPublicUpdateStatus());
    if (!trust.trusted) return trust.value;

    if (!app.isPackaged || updateStatus.state !== 'downloaded') {
        return getPublicUpdateStatus();
    }

    isInstallingUpdate = true;
    setUpdateStatus({ state: 'installing', error: '' });

    try {
        if (isWallpaperSyncEnabled) {
            await restoreOriginalWallpaper();
        }
        cleanupCore();
    } catch (err) {
        console.error('[Updater] Cleanup before install failed:', err);
    }

    setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
    });

    return getPublicUpdateStatus();
});

// Config changed: relays parameters from Settings Window to Island Window
ipcMain.on('config-changed', (event, config) => {
    if (!isTrustedSender(event)) return;
    if (config) {
        const oldStyle = wallpaperSyncStyle;
        if (config.wallpaperSyncStyle !== undefined) wallpaperSyncStyle = config.wallpaperSyncStyle;
        
        if (config.isWallpaperSync !== undefined) {
            const enabledChanged = isWallpaperSyncEnabled !== !!config.isWallpaperSync;
            const styleChanged = oldStyle !== wallpaperSyncStyle;
            
            isWallpaperSyncEnabled = !!config.isWallpaperSync;
            
            if (enabledChanged || styleChanged) {
                if (!isWallpaperSyncEnabled) {
                    if (enabledChanged) {
                        restoreOriginalWallpaper();
                    }
                } else if (currentMedia && currentMedia.cover) {
                    if (enabledChanged) {
                        storeOriginalWallpaper().then(() => {
                            lastWallpaperCover = "";
                            updateWallpaper(currentMedia.cover);
                        });
                    } else {
                        // Clear the cache so updateWallpaper forces a background refresh using the new style
                        lastWallpaperCover = "";
                        updateWallpaper(currentMedia.cover);
                    }
                }
            }
        }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('config-changed', config);
    }
});

// Wallpaper sync startup status relay
ipcMain.on('wallpaper-sync-status', (event, enabled, style) => {
    if (!isTrustedSender(event)) return;
    isWallpaperSyncEnabled = enabled;
    if (style) wallpaperSyncStyle = style;
    if (enabled && currentMedia && currentMedia.cover) {
        updateWallpaper(currentMedia.cover);
    }
});

ipcMain.handle('get-layout-state', (event) => {
    const trust = ensureTrustedSender(event, null);
    if (!trust.trusted) return trust.value;

    const workArea = screen.getPrimaryDisplay().workArea;
    return {
        layout: currentLayoutConfig,
        editMode: layoutEditMode,
        display: {
            x: workArea.x,
            y: workArea.y,
            width: workArea.width,
            height: workArea.height
        }
    };
});

ipcMain.on('layout-config-changed', (event, layout) => {
    if (!isTrustedSender(event)) return;
    currentLayoutConfig = clampLayoutConfigToDisplay({
        ...currentLayoutConfig,
        ...(layout || {})
    });
    saveLayoutConfig();
    applyMainWindowLayout();
});

ipcMain.on('layout-reset', (event) => {
    if (!isTrustedSender(event)) return;
    currentLayoutConfig = clampLayoutConfigToDisplay(getDefaultLayoutConfig());
    saveLayoutConfig();
    applyMainWindowLayout();
});

ipcMain.on('set-layout-edit-mode', (event, enabled) => {
    if (!isTrustedSender(event)) return;
    setLayoutEditModeState(enabled);
});

ipcMain.on('apply-profile', (event, profile) => {
    if (!isTrustedSender(event)) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('apply-profile', profile);
    }
});

ipcMain.handle('get-auto-start', (event) => {
    const trust = ensureTrustedSender(event, false);
    if (!trust.trusted) return trust.value;

    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-auto-start', (event, enabled) => {
    const trust = ensureTrustedSender(event, false);
    if (!trust.trusted) return trust.value;

    try {
        app.setLoginItemSettings({
            openAtLogin: Boolean(enabled),
            path: process.execPath
        });
        return app.getLoginItemSettings().openAtLogin;
    } catch (e) {
        console.error('Error setting auto-start:', e);
        return false;
    }
});

// Trigger Notification: relays custom test alerts from Settings Window to Island Window
ipcMain.on('trigger-notif', (event, data) => {
    if (!isTrustedSender(event)) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-notif', data);
    }
});

// Cover Color Changed: relays album art color from Island to Settings Window
ipcMain.on('cover-color-changed', (event, colorData) => {
    if (!isTrustedSender(event)) return;
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('cover-color-changed', colorData);
    }
});

const coverCache = new Map();
let lastSearchedTrack = "";

async function fetchFallbackCover(title, artist) {
    const cacheKey = `${artist} - ${title}`.toLowerCase();
    if (coverCache.has(cacheKey)) {
        return coverCache.get(cacheKey);
    }

    if (lastSearchedTrack === cacheKey) return ""; // Avoid duplicate search
    lastSearchedTrack = cacheKey;

    try {
        const query = encodeURIComponent(`${artist} ${title}`);
        const response = await electronNet.fetch(`https://api.deezer.com/search?q=${query}&limit=1`);
        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                const coverUrl = data.data[0].album.cover_medium || data.data[0].album.cover_big;
                if (coverUrl) {
                    coverCache.set(cacheKey, coverUrl);
                    console.log(`[Cover Fallback] Found cover on Deezer for ${cacheKey}: ${coverUrl}`);
                    return coverUrl;
                }
            }
        }
    } catch (e) {
        console.error('[Cover Fallback] Deezer fetch failed:', e);
    }

    try {
        const query = encodeURIComponent(`${artist} ${title}`);
        const response = await electronNet.fetch(`https://itunes.apple.com/search?term=${query}&limit=1&media=music`);
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const coverUrl = data.results[0].artworkUrl100 || data.results[0].artworkUrl60;
                if (coverUrl) {
                    const highResCover = coverUrl.replace('100x100bb', '500x500bb');
                    coverCache.set(cacheKey, highResCover);
                    console.log(`[Cover Fallback] Found cover on iTunes for ${cacheKey}: ${highResCover}`);
                    return highResCover;
                }
            }
        }
    } catch (e) {
        // Ignore iTunes fail
    }

    coverCache.set(cacheKey, "");
    return "";
}

// Media state synchronization IPC handler
ipcMain.handle('get-media-info', async (event) => {
    const trust = ensureTrustedSender(event, null);
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return null;

    try {
        const line = await sendCoreCommand('poll');
        if (!line) return currentMedia;

        const data = JSON.parse(line);
        if (data.status === 'no_media') {
            const hasPreviousMedia = currentMedia &&
                currentMedia.trackKey &&
                currentMedia.title !== "Aucune lecture";

            if (hasPreviousMedia && (mediaAdvanceGuard.until > Date.now() || mediaPlaybackGuardUntil > Date.now())) {
                return {
                    ...currentMedia,
                    transientCover: currentMedia.transientCover || currentMedia.cover || "",
                    source: currentMedia.source || data.source || ""
                };
            }

            if (Date.now() - lastNoMediaDiagnosticAt > 20000) {
                lastNoMediaDiagnosticAt = Date.now();
                logCoreDiagnostics('no_media');
            }

            const noMediaState = {
                title: "Aucune lecture",
                artist: "Système",
                cover: "",
                transientCover: "",
                appId: "",
                isPlaying: false,
                progress: 0,
                duration: 0,
                source: data.source || "",
                trackKey: "",
                windowTitle: ""
            };
            currentMedia = noMediaState;
            updateWallpaper("");
            return noMediaState;
        }

        if (data.status === 'success') {
            const title = data.title || "Sans titre";
            const artist = data.artist || "Artiste inconnu";
            const trackKey = getMediaTrackKey(title, artist);
            let cover = data.cover || "";
            let transientCover = "";
            let windowTitle = "";
            const browserMedia = isBrowserApp(data.appId);
            const browserIconCover = browserMedia && isLikelyBrowserIconCover(cover);
            const incomingDuration = Number(data.duration) || 0;
            const incomingProgress = Number(data.progress) || 0;
            const isWeakWasapiFallback = data.source === 'wasapi' && incomingDuration <= 0;
            const hasRealCurrentMedia = currentMedia &&
                currentMedia.trackKey &&
                currentMedia.duration > 0 &&
                currentMedia.title !== "Aucune lecture";

            if (isWeakWasapiFallback && hasRealCurrentMedia && mediaPlaybackGuardUntil > Date.now()) {
                return {
                    ...currentMedia,
                    isPlaying: mediaPlaybackExpectedIsPlaying ?? currentMedia.isPlaying,
                    source: currentMedia.source || 'smtc'
                };
            }

            if (hasRealCurrentMedia && mediaPlaybackGuardUntil > Date.now() && incomingDuration <= 0) {
                data.duration = currentMedia.duration;
                data.progress = currentMedia.progress;
            }

            if (browserMedia && (!cover || browserIconCover)) {
                const activeWindow = await getForegroundWindowInfoCached();
                const activeProcess = (activeWindow.processName || "").toLowerCase();
                if (!activeProcess || isBrowserApp(activeProcess)) {
                    windowTitle = activeWindow.title || "";
                }
            }

            // Prevent process icon flashing during SMTC to WASAPI state transitions (e.g. play/pause)
            if (data.source === 'wasapi' && currentMedia && currentMedia.cover) {
                const cleanNewApp = (data.appId || '').toLowerCase().replace('.exe', '');
                const cleanOldApp = (currentMedia.appId || '').toLowerCase().replace('.exe', '');
                const isSpotifySync = cleanNewApp.includes('spotify') && cleanOldApp.includes('spotify');
                const isSameApp = isSpotifySync || cleanNewApp === cleanOldApp || cleanNewApp.includes(cleanOldApp) || cleanOldApp.includes(cleanNewApp);
                const isSameTitle = title.toLowerCase().includes(currentMedia.title.toLowerCase()) || 
                                    currentMedia.title.toLowerCase().includes(title.toLowerCase());
                
                if (isSameApp || isSameTitle) {
                    cover = currentMedia.cover;
                }
            }

            if (browserIconCover) {
                if (currentMedia && (currentMedia.cover || currentMedia.transientCover)) {
                    transientCover = currentMedia.cover || currentMedia.transientCover;
                }
                cover = "";
            }

            if (
                mediaAdvanceGuard.until > Date.now() &&
                trackKey !== mediaAdvanceGuard.previousTrackKey &&
                mediaAdvanceGuard.previousCover &&
                (!cover || cover === mediaAdvanceGuard.previousCover)
            ) {
                transientCover = mediaAdvanceGuard.previousCover;
                cover = "";
            }

            // Fallback for missing SMTC cover art
            if (!cover && title !== "Sans titre" && artist !== "Artiste inconnu") {
                const cacheKey = `${artist} - ${title}`.toLowerCase();
                if (coverCache.has(cacheKey)) {
                    cover = coverCache.get(cacheKey);
                    if (cover) transientCover = "";
                } else {
                    const requestedTrackKey = trackKey;
                    fetchFallbackCover(title, artist).then(foundCover => {
                        const activeTrackKey = getMediaTrackKey(currentMedia.title, currentMedia.artist);
                        if (foundCover && activeTrackKey === requestedTrackKey) {
                            currentMedia.cover = foundCover;
                            currentMedia.transientCover = "";
                            updateWallpaper(foundCover);
                        }
                    });
                }
            }

            currentMedia = {
                title: title,
                artist: artist,
                cover: cover,
                transientCover: cover ? "" : transientCover,
                appId: data.appId || "",
                isPlaying: data.isPlaying || false,
                progress: Number(data.progress) || incomingProgress || 0,
                duration: Number(data.duration) || incomingDuration || 0,
                source: data.source || "",
                trackKey: trackKey,
                windowTitle: windowTitle
            };
            updateWallpaper(cover || transientCover);
            logMediaSnapshot(currentMedia, data.cover || "");
        }
        return currentMedia;
    } catch(err) {
        return currentMedia;
    }
});

// Media Command player controls
ipcMain.on('spotify-control', (event, action) => {
    if (!isTrustedSender(event)) return;

    const safeAction = normalizeMediaCommand(action);
    if (!safeAction) return;

    if (safeAction === 'next' || safeAction === 'prev') {
        mediaAdvanceGuard = {
            until: Date.now() + 2500,
            previousCover: currentMedia.cover || currentMedia.transientCover || "",
            previousTrackKey: getMediaTrackKey(currentMedia.title, currentMedia.artist)
        };
    } else if (safeAction === 'play' || safeAction === 'pause' || safeAction === 'toggle') {
        mediaPlaybackGuardUntil = Date.now() + 6500;
        if (safeAction === 'play') {
            mediaPlaybackExpectedIsPlaying = true;
        } else if (safeAction === 'pause') {
            mediaPlaybackExpectedIsPlaying = false;
        } else {
            mediaPlaybackExpectedIsPlaying = currentMedia ? !currentMedia.isPlaying : null;
        }
    }

    if (coreWorker) {
        coreWorker.stdin.write(safeAction + '\n');
    }
});

// IPC handler for loopback system audio capture (restricts to screen sources to allow audio)
ipcMain.handle('get-audio-screen-source', async (event) => {
    const trust = ensureTrustedSender(event, null);
    if (!trust.trusted) return trust.value;

    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        return sources.length > 0 ? sources[0].id : null;
    } catch (e) {
        console.error('Error fetching screen source for audio:', e);
        return null;
    }
});

// IPC handler for screen mirroring/screencasting targets
ipcMain.handle('get-desktop-sources', async (event) => {
    const trust = ensureTrustedSender(event, []);
    if (!trust.trusted) return trust.value;

    try {
        const sources = await desktopCapturer.getSources({
            types: ['window', 'screen'],
            thumbnailSize: { width: 150, height: 150 },
            fetchWindowIcons: true
        });
        return sources.map(source => ({
            id: source.id,
            name: source.name || '',
            thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : ''
        }));
    } catch (e) {
        console.error('Error fetching desktop sources:', e);
        return [];
    }
});

// IPC handler to retrieve the native high-fidelity Windows icon of a file or executable
ipcMain.handle('get-file-icon', async (event, filePath) => {
    const trust = ensureTrustedSender(event, "");
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return "";
    if (hasUnsafeCoreText(filePath)) return "";

    try {
        const res = await sendCoreCommand(`geticon ${filePath}`);
        return res || "";
    } catch (e) {
        return "";
    }
});

// IPC handler to retrieve advanced native hardware telemetry
ipcMain.handle('get-hardware-telemetry', async (event) => {
    const trust = ensureTrustedSender(event, { cpuTemp: 42.0, gpuTemp: 45.0, netDown: 0.0, netUp: 0.0, diskRead: 0.0, diskWrite: 0.0 });
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return { cpuTemp: 42.0, gpuTemp: 45.0, netDown: 0.0, netUp: 0.0, diskRead: 0.0, diskWrite: 0.0 };
    try {
        const res = await sendCoreCommand('telemetry');
        if (!res) return { cpuTemp: 42.0, gpuTemp: 45.0, netDown: 0.0, netUp: 0.0, diskRead: 0.0, diskWrite: 0.0 };
        return JSON.parse(res);
    } catch (e) {
        return { cpuTemp: 42.0, gpuTemp: 45.0, netDown: 0.0, netUp: 0.0, diskRead: 0.0, diskWrite: 0.0 };
    }
});

// C# Core volume control relays
ipcMain.handle('set-system-volume', async (event, volume) => {
    const trust = ensureTrustedSender(event, false);
    if (!trust.trusted) return trust.value;

    const safeVolume = clampInteger(volume, 0, 100, null);
    if (safeVolume === null) return false;

    try {
        await sendCoreCommand(`master ${safeVolume}`);
        return true;
    } catch (e) {
        console.error('Error setting master volume via core:', e);
        return false;
    }
});

ipcMain.handle('get-system-volume', async (event) => {
    const trust = ensureTrustedSender(event, 70);
    if (!trust.trusted) return trust.value;

    try {
        const result = await sendCoreCommand('getmaster');
        if (result === null) return 70;
        return parseFloat(result);
    } catch (e) {
        console.error('Error getting master volume via core:', e);
        return 70;
    }
});

// C# Core per-app session volume controls
ipcMain.handle('get-audio-sessions', async (event) => {
    const trust = ensureTrustedSender(event, []);
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return [];
    try {
        const line = await sendCoreCommand('list');
        if (!line) return [];
        return JSON.parse(line);
    } catch (e) {
        console.error('Error getting audio sessions via core:', e);
        return [];
    }
});

ipcMain.handle('get-audio-meter', async (event) => {
    const trust = ensureTrustedSender(event, { peak: 0, left: 0, right: 0, channels: 0 });
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return { peak: 0, left: 0, right: 0, channels: 0 };
    try {
        const line = await sendCoreCommand('meter');
        if (!line) return { peak: 0, left: 0, right: 0, channels: 0 };
        return JSON.parse(line);
    } catch (e) {
        console.error('Error getting audio meter via core:', e);
        return { peak: 0, left: 0, right: 0, channels: 0 };
    }
});

ipcMain.handle('set-session-volume', async (event, payload = {}) => {
    const trust = ensureTrustedSender(event, false);
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return false;
    const { pid, volume } = payload || {};
    const safePid = clampInteger(pid, 1, 2147483647, null);
    const safeVolume = clampInteger(volume, 0, 100, null);
    if (safePid === null || safeVolume === null) return false;

    try {
        const result = await sendCoreCommand(`set ${safePid} ${safeVolume}`);
        return result && result.trim() === 'ok';
    } catch (e) {
        console.error('Error setting session volume via core:', e);
        return false;
    }
});

ipcMain.handle('set-session-muted', async (event, payload = {}) => {
    const trust = ensureTrustedSender(event, false);
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return false;
    const { pid, muted } = payload || {};
    const safePid = clampInteger(pid, 1, 2147483647, null);
    if (safePid === null) return false;

    try {
        const result = await sendCoreCommand(`mute ${safePid} ${Boolean(muted)}`);
        return result && result.trim() === 'ok';
    } catch (e) {
        console.error('Error muting session via core:', e);
        return false;
    }
});

ipcMain.handle('get-active-window-info', async (event) => {
    const trust = ensureTrustedSender(event, { isFullscreen: false });
    if (!trust.trusted) return trust.value;

    if (!coreWorker) return { isFullscreen: false };
    try {
        const result = await sendCoreCommand('activewindow');
        if (!result) return { isFullscreen: false };
        return JSON.parse(result);
    } catch (e) {
        console.error('Error getting active window info via core:', e);
        return { isFullscreen: false };
    }
});

function runPowerShellJson(command, fallback) {
    return new Promise((resolve) => {
        execFile('powershell.exe', ['-NoProfile', '-Command', command], { timeout: 1800, windowsHide: true }, (error, stdout) => {
            if (error || !stdout || !stdout.trim()) {
                resolve(fallback);
                return;
            }

            try {
                resolve(JSON.parse(stdout.trim()));
            } catch {
                resolve(fallback);
            }
        });
    });
}



// System brightness controls (Removed: brightness control is disabled)

// Native OS Toggles System Controls
ipcMain.handle('wifi-control', async (event, action) => {
    const trust = ensureTrustedSender(event, 'error');
    if (!trust.trusted) return trust.value;

    const safeAction = normalizeToggleAction(action);
    if (!safeAction) return 'error';

    try {
        const result = await sendCoreCommand(`wifi ${safeAction}`);
        return result ? result.trim() : 'error';
    } catch (e) {
        console.error('Error in wifi-control IPC:', e);
        return 'error';
    }
});

ipcMain.handle('bluetooth-control', async (event, action) => {
    const trust = ensureTrustedSender(event, 'error');
    if (!trust.trusted) return trust.value;

    const safeAction = normalizeToggleAction(action);
    if (!safeAction) return 'error';

    try {
        const result = await sendCoreCommand(`bluetooth ${safeAction}`);
        return result ? result.trim() : 'error';
    } catch (e) {
        console.error('Error in bluetooth-control IPC:', e);
        return 'error';
    }
});

ipcMain.handle('dnd-control', async (event, action) => {
    const trust = ensureTrustedSender(event, 'error');
    if (!trust.trusted) return trust.value;

    const safeAction = normalizeToggleAction(action);
    if (!safeAction) return 'error';

    try {
        const result = await sendCoreCommand(`dnd ${safeAction}`);
        return result ? result.trim() : 'error';
    } catch (e) {
        console.error('Error in dnd-control IPC:', e);
        return 'error';
    }
});

// Dynamic Keyboard Shortcut Global Handler
let currentShortcut = 'Alt+I';

function registerGlobalHotkey(shortcut) {
    try {
        globalShortcut.unregisterAll();
        
        // Show/hide main toggle shortcut
        const registered = globalShortcut.register(shortcut, () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    islandHiddenByShortcut = true;
                    mainWindow.hide();
                } else {
                    islandHiddenByShortcut = false;
                    mainWindow.showInactive();
                    enforceMainWindowTopmost('shortcut-toggle');
                }
            }
        });
        
        if (registered) {
            console.log(`[Shortcut] Registered global hotkey: ${shortcut}`);
        } else {
            console.warn(`[Shortcut] Failed to register hotkey: ${shortcut}`);
        }
    } catch (e) {
        console.error('[Shortcut] Error registering hotkey:', e);
    }
}

ipcMain.on('register-shortcut', (event, shortcut) => {
    if (!isTrustedSender(event)) return;
    if (hasUnsafeCoreText(String(shortcut || '')) || String(shortcut).length > 80) return;

    currentShortcut = shortcut;
    registerGlobalHotkey(shortcut);
});

// Clean up shortcuts on quit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
