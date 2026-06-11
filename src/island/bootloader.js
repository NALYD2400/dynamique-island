import { DynamicIsland } from '../components/DynamicIsland.js';
import { ThemeService } from '../services/ThemeService.js';
import { visualizerService } from '../services/AudioVisualizerService.js';

const { ipcRenderer } = window.electronAPI;
let mediaControlSyncToken = 0;

// 1. BOOTSTRAP LEGACY GLOBAL APIs FOR 100% PARITY
window.wm = {
    open(widget) {
        if (widget === 'settings') {
            if (window.island) {
                window.island.setMode('settings');
            }
        }
    },
    toggle(widget) {
        this.open(widget);
    }
};

window.spotifyControl = async (action) => {
    try {
        const cleanAction = String(action || '').trim().toLowerCase();
        let actionToSend = action;
        const isPlaybackAction = ['toggle', 'play', 'pause'].includes(cleanAction);
        const syncToken = isPlaybackAction ? ++mediaControlSyncToken : mediaControlSyncToken;

        if (window.island && isPlaybackAction) {
            const nextPlaying = cleanAction === 'toggle' ? !window.island.isPlaying : cleanAction === 'play';
            actionToSend = nextPlaying ? 'play' : 'pause';
            if (typeof window.island.applyOptimisticPlaybackState === 'function') {
                window.island.applyOptimisticPlaybackState(nextPlaying);
            }
        }

        ipcRenderer.send('spotify-control', actionToSend);
        // Browser players can lag behind SMTC after pause; resync several times.
        if (window.island && window.island.updateMediaState) {
            [120, 450, 1200, 3200, 6800].forEach((delay) => {
                setTimeout(() => {
                    if (!isPlaybackAction || syncToken === mediaControlSyncToken) {
                        window.island.updateMediaState();
                    }
                }, delay);
            });
        }
    } catch (e) {
        console.error(e);
    }
};

// 2. INITIALIZE SERVICES & ISLAND CLASS
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Island Widget] Bootstrapping Dynamic Island...');
    
    // Theme setup
    ThemeService.applyGlobalTheme();
    ThemeService.applyIslandSettings();

    // Create the exact original DynamicIsland class
    const island = new DynamicIsland();
    window.island = island;

    // Send the initial wallpaper sync status to the main process
    const isWallpaperSync = localStorage.getItem('liquid_wallpaper_sync') === 'true';
    const wallpaperSyncStyle = localStorage.getItem('liquid_wallpaper_sync_style') || 'blur';
    ipcRenderer.send('wallpaper-sync-status', isWallpaperSync, wallpaperSyncStyle);

    const isAiAgentMonitor = localStorage.getItem('liquid_ai_agent_monitor') !== 'false';
    ipcRenderer.send('ai-agent-monitor-status', isAiAgentMonitor);

    ipcRenderer.invoke('get-layout-state').then((state) => {
        if (!state || !window.island) return;
        if (state.layout) {
            localStorage.setItem('liquid_layout_config', JSON.stringify(state.layout));
            window.island.applyLayoutConfig(state.layout);
        }
        window.island.setLayoutEditMode(Boolean(state.editMode));
    }).catch((err) => {
        console.warn('[Layout] Failed to load initial state:', err);
    });

    // 3. SECURE CLICK-THROUGH HOVER BOUNDARIES
    const capsule = document.getElementById('dynamic-island');

    capsule.addEventListener('mouseenter', () => {
        // Enforce mouse capture when hovering over the active pill
        ipcRenderer.send('set-ignore-mouse', false);
    });

    capsule.addEventListener('mouseleave', () => {
        // Enforce click-through when leaving the idle pill, unless context menu is active
        if (!island.isExpanded && !island.isContextMenuOpen && !island._layoutEditMode) {
            ipcRenderer.send('set-ignore-mouse', true, { forward: true });
        }
    });

    // Listen to settings configurations IPC changes in real-time
    ipcRenderer.on('config-changed', (event, config) => {
        if (config.aiAgentMonitor !== undefined) {
            localStorage.setItem('liquid_ai_agent_monitor', config.aiAgentMonitor);
        }
        // Save in localStorage so ThemeService and DynamicIsland can fetch them!
        if (config.glow) {
            localStorage.setItem('liquid_island_config', JSON.stringify(config.glow));
            if (window.island) {
                window.island._islandConfig = config.glow;
            }
        }
        if (config.modules) {
            if (config.modules.music !== undefined) localStorage.setItem('liquid_music_enabled', config.modules.music);
            if (config.modules.timer !== undefined) localStorage.setItem('liquid_island_timer_enabled', config.modules.timer);
            if (config.modules.control !== undefined) localStorage.setItem('liquid_island_control_enabled', config.modules.control);
            if (config.modules.gameDetection !== undefined) localStorage.setItem('liquid_game_detection_enabled', config.modules.gameDetection);
        }
        if (config.isPersistent !== undefined) {
            localStorage.setItem('liquid_island_persistent', config.isPersistent);
            if (window.island && typeof window.island.syncPersistentSetting === 'function') {
                window.island.syncPersistentSetting();
            }
        }
        if (config.isCoverSync !== undefined) {
            localStorage.setItem('liquid_cover_color_sync', config.isCoverSync);
        }
        if (config.isIdleCoverBg !== undefined) {
            localStorage.setItem('liquid_island_idle_cover_bg', config.isIdleCoverBg);
        }
        if (config.isWallpaperSync !== undefined) {
            localStorage.setItem('liquid_wallpaper_sync', config.isWallpaperSync);
        }
        if (config.wallpaperSyncStyle !== undefined) {
            localStorage.setItem('liquid_wallpaper_sync_style', config.wallpaperSyncStyle);
        }
        if (config.visualizerMode !== undefined) {
            localStorage.setItem('liquid_visualizer_mode', config.visualizerMode);
            if (visualizerService) {
                visualizerService.setMode(config.visualizerMode).catch(() => {});
            }
        }
        if (config.shortcut !== undefined) {
            localStorage.setItem('liquid_island_shortcut', config.shortcut);
        }
        if (config.widgetType !== undefined) {
            localStorage.setItem('liquid_control_widget_type', config.widgetType);
        }
        if (config.activeProfile !== undefined) {
            localStorage.setItem('liquid_active_profile', config.activeProfile);
        }
        if (config.shortcuts !== undefined) {
            localStorage.setItem('liquid_control_shortcuts', JSON.stringify(config.shortcuts));
        }
        if (config.player !== undefined) {
            if (config.player.showTimes !== undefined) localStorage.setItem('liquid_player_show_times', config.player.showTimes);
            if (config.player.showVisualizer !== undefined) localStorage.setItem('liquid_player_show_visualizer', config.player.showVisualizer);
            if (config.player.showActions !== undefined) localStorage.setItem('liquid_player_show_actions', config.player.showActions);
            if (config.player.wheelAppVolume !== undefined) localStorage.setItem('liquid_player_wheel_app_volume', config.player.wheelAppVolume);
        }
        
        // Re-apply styles
        ThemeService.applyIslandSettings();
        
        // Force refresh DynamicIsland rendering if expanded
        if (window.island) {
            window.island.renderContent();
        }
        
        // Broadcast custom change event
        window.dispatchEvent(new CustomEvent('liquid-island-config-changed', { detail: config.glow }));
    });

    // Listen to custom alert triggers
    ipcRenderer.on('trigger-notif', (event, data) => {
        if (window.island && typeof window.island.showNotification === 'function') {
            window.island.showNotification(data.title, data.message, data.icon);
        }
    });

    ipcRenderer.on('apply-profile', (event, profile) => {
        if (window.island && typeof window.island.applyQuickProfile === 'function') {
            window.island.applyQuickProfile(profile);
        }
    });

    ipcRenderer.on('layout-config-changed', (event, layout) => {
        if (!window.island || !layout) return;
        localStorage.setItem('liquid_layout_config', JSON.stringify(layout));
        window.island.applyLayoutConfig(layout);
    });

    ipcRenderer.on('layout-edit-mode-changed', (event, enabled) => {
        if (!window.island) return;
        window.island.setLayoutEditMode(Boolean(enabled));
    });

    ipcRenderer.on('ai-agent-event', (event, data) => {
        if (window.island && typeof window.island.onAiAgentEvent === 'function') {
            window.island.onAiAgentEvent(data);
        }
    });

    ipcRenderer.on('ai-agent-timeout', (event, data) => {
        if (window.island && typeof window.island.onAiAgentTimeout === 'function') {
            window.island.onAiAgentTimeout(data);
        }
    });
});
