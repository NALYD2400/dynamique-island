const { ipcRenderer } = window.electronAPI;

class SettingsClickSynth {
    constructor() {
        this.ctx = null;
    }
    playClick() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
    }
}
const clicker = new SettingsClickSynth();

function hexToRgbString(hex) {
    if (!hex) return '';
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return '';
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return '';
    return `${r}, ${g}, ${b}`;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

// Shortcuts mapping preset values
const SHORTCUT_PRESETS = {
    explorer: { name: "Explorateur", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
    settings: { name: "Paramètres", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
    taskmgr: { name: "Gestionnaire", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
    calc: { name: "Calculatrice", icon: "ph-fill ph-calculator", cmd: "calc.exe" },
    terminal: { name: "Terminal", icon: "ph-fill ph-terminal", cmd: "cmd.exe" },
    notepad: { name: "Bloc-notes", icon: "ph-fill ph-note-pencil", cmd: "notepad.exe" },
    paint: { name: "Paint", icon: "ph-fill ph-palette", cmd: "mspaint.exe" },
    snipping: { name: "Capture", icon: "ph-fill ph-camera", cmd: "snippingtool.exe" },
    music: { name: "Lecteur", icon: "ph-fill ph-music-notes", cmd: "liquid:music" },
    history: { name: "Historique", icon: "ph-fill ph-clock-counter-clockwise", cmd: "liquid:music-history" },
    musicSearch: { name: "Recherche", icon: "ph-bold ph-magnifying-glass", cmd: "liquid:music-search" },
    widgets: { name: "Widgets", icon: "ph-fill ph-squares-four", cmd: "liquid:menu" },
    mixer: { name: "Mixer", icon: "ph-fill ph-sliders-horizontal", cmd: "liquid:mixer" },
    islandSettings: { name: "Reglages", icon: "ph-fill ph-gear-six", cmd: "liquid:settings" },
    custom: { name: "Perso", icon: "ph-fill ph-sparkles", cmd: "" }
};

// Default shortcuts
const defaultShortcuts = [
    { name: "Explorer", preset: "explorer", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
    { name: "Settings", preset: "settings", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
    { name: "TaskMgr", preset: "taskmgr", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
    { name: "Calc", preset: "calc", icon: "ph-fill ph-calculator", cmd: "calc.exe" }
];

const MOTION_LEVELS = ['sober', 'fluid', 'vivid'];
const MOTION_LABELS = {
    sober: 'Sobre',
    fluid: 'Fluide',
    vivid: 'Vivante'
};

const QUICK_PROFILES = {
    gaming: {
        name: 'Gaming',
        icon: 'ph-game-controller',
        motion: 'sober',
        widgetType: 'mixer',
        persistent: true,
        notifications: false,
        modules: { music: false, timer: false, control: true, gameDetection: true },
        coverSync: false,
        idleCoverBg: false,
        wallpaperSync: false,
        visualizerSensitivity: 2.5,
        focus: false,
        eco: true,
        dnd: true,
        volume: 85,
        glow: {
            opacity: 88,
            blur: 14,
            glowEnabled: false,
            glowDensity: 8,
            glowColorMode: 'fixed',
            glowBlend: 0,
            glowColor: '#00f3ff',
            vizColorMode: 'cyberpunk',
            vizColorSolid: '#00f3ff',
            vizColorGradA: '#00f3ff',
            vizColorGradB: '#bc13fe',
            materialStyle: 'metal',
            grainEffect: 'none'
        }
    },
    work: {
        name: 'Travail',
        icon: 'ph-briefcase',
        motion: 'fluid',
        widgetType: 'launchpad',
        persistent: true,
        notifications: true,
        modules: { music: true, timer: true, control: true, gameDetection: true },
        coverSync: true,
        idleCoverBg: true,
        wallpaperSync: false,
        visualizerSensitivity: 2.5,
        focus: false,
        eco: false,
        dnd: false,
        volume: 55,
        glow: {
            opacity: 92,
            blur: 30,
            glowEnabled: true,
            glowDensity: 20,
            glowColorMode: 'mix',
            glowBlend: 70,
            glowColor: '#00f3ff',
            vizColorMode: 'cover',
            vizColorSolid: '#00f3ff',
            vizColorGradA: '#00f3ff',
            vizColorGradB: '#ff00ff',
            materialStyle: 'glass',
            grainEffect: 'light'
        }
    },
    music: {
        name: 'Musique',
        icon: 'ph-music-notes',
        motion: 'vivid',
        widgetType: 'mixer',
        persistent: true,
        notifications: true,
        modules: { music: true, timer: false, control: true, gameDetection: true },
        coverSync: true,
        idleCoverBg: true,
        wallpaperSync: false,
        visualizerSensitivity: 2.5,
        focus: false,
        eco: false,
        dnd: false,
        volume: 70,
        glow: {
            opacity: 94,
            blur: 30,
            glowEnabled: true,
            glowDensity: 28,
            glowColorMode: 'cover',
            glowBlend: 80,
            glowColor: '#00f3ff',
            vizColorMode: 'cover',
            vizColorSolid: '#00f3ff',
            vizColorGradA: '#00f3ff',
            vizColorGradB: '#ff00ff',
            materialStyle: 'glass',
            grainEffect: 'none'
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    let layoutState = {
        x: 0,
        y: 10,
        scale: 1,
        editMode: false,
        display: null
    };

    // Load cover colors immediately on startup for perfect consistency
    try {
        const savedColors = JSON.parse(localStorage.getItem('liquid_cover_colors') || '{}');
        if (savedColors.primary) {
            document.documentElement.style.setProperty('--neon-primary', savedColors.primary);
            document.documentElement.style.setProperty('--neon-accent', savedColors.primary);
            document.documentElement.style.setProperty('--neon-primary-rgb', savedColors.rgb);
            document.documentElement.style.setProperty('--neon-secondary', savedColors.secondary);
            document.documentElement.style.setProperty('--neon-secondary-rgb', hexToRgbString(savedColors.secondary) || '188, 19, 254');
        }
        const bgLayer = document.querySelector('.settings-bg-layer');
        if (bgLayer) {
            const isSyncEnabled = localStorage.getItem('liquid_cover_color_sync') !== 'false';
            if (savedColors.cover && isSyncEnabled) {
                bgLayer.style.backgroundImage = `url("${savedColors.cover.replace(/\\/g, '/')}")`;
                bgLayer.style.opacity = '0.18';
            } else {
                bgLayer.style.backgroundImage = 'none';
                bgLayer.style.opacity = '0';
            }
        }
    } catch (e) {
        console.error("Failed to load initial cover colors:", e);
    }

    // Elements references
    const rangeOpacity = document.getElementById('range-opacity');
    const valOpacity = document.getElementById('val-opacity');
    const rangeBlur = document.getElementById('range-blur');
    const valBlur = document.getElementById('val-blur');
    const rangeMotion = document.getElementById('range-motion');
    const valMotion = document.getElementById('val-motion');
    const rangeGlowDensity = document.getElementById('range-glow-density');
    const valGlowDensity = document.getElementById('val-glow-density');
    const toggleGlow = document.getElementById('toggle-glow');
    const densityCont = document.getElementById('glow-density-container');
    const colorCont = document.getElementById('glow-color-container');
    const fixedColorCont = document.getElementById('glow-fixed-color-container');
    const glowColorModeSelect = document.getElementById('glow-color-mode');
    const glowBlendCont = document.getElementById('glow-blend-container');
    const rangeGlowBlend = document.getElementById('range-glow-blend');
    const valGlowBlend = document.getElementById('val-glow-blend');
    const selectVizMode = document.getElementById('viz-color-mode');
    const vizSolid = document.getElementById('viz-solid-container');
    const vizGrad = document.getElementById('viz-gradient-container');
    const selectVizAnalysisMode = document.getElementById('viz-analysis-mode');
    const vizSensitivityContainer = document.getElementById('viz-sensitivity-container');
    const rangeVisualizerSensitivity = document.getElementById('range-visualizer-sensitivity');
    const valVisualizerSensitivity = document.getElementById('val-visualizer-sensitivity');
    const toggleWallpaperSync = document.getElementById('toggle-wallpaper-sync');
    const selectWallpaperStyle = document.getElementById('wallpaper-sync-style');
    const wallpaperStyleContainer = document.getElementById('wallpaper-style-container');
    const selectMaterialStyle = document.getElementById('island-material-style');
    const selectGrainEffect = document.getElementById('island-grain-effect');
    const controlWidgetTypeSelect = document.getElementById('control-widget-type');
    const shortcutsConfigContainer = document.getElementById('shortcuts-config-container');
    const shortcutInput = document.getElementById('input-shortcut');
    const autoStartToggle = document.getElementById('toggle-auto-start');
    const notificationsToggle = document.getElementById('toggle-notifications');
    const playerShowTimesToggle = document.getElementById('toggle-player-show-times');
    const playerShowVisualizerToggle = document.getElementById('toggle-player-show-visualizer');
    const playerShowActionsToggle = document.getElementById('toggle-player-show-actions');
    const playerWheelAppVolumeToggle = document.getElementById('toggle-player-wheel-app-volume');
    const profileCards = document.querySelectorAll('.profile-card');
    const profileSelect = document.getElementById('profile-select');
    const profileApplyBtn = document.getElementById('profile-apply');
    const profileDeleteBtn = document.getElementById('profile-delete');
    const profileCreateBtn = document.getElementById('profile-create');
    const profileSaveBtn = document.getElementById('profile-save');
    const profileNameInput = document.getElementById('profile-name');
    const settingsExportBtn = document.getElementById('settings-export');
    const settingsImportBtn = document.getElementById('settings-import');
    const settingsImportFile = document.getElementById('settings-import-file');
    const rangeLayoutScale = document.getElementById('range-layout-scale');
    const valLayoutScale = document.getElementById('val-layout-scale');
    const layoutPosX = document.getElementById('layout-pos-x');
    const layoutPosY = document.getElementById('layout-pos-y');
    const layoutEditState = document.getElementById('layout-edit-state');
    const layoutEditBtn = document.getElementById('btn-layout-edit');
    const layoutLeftBtn = document.getElementById('btn-layout-left');
    const layoutRightBtn = document.getElementById('btn-layout-right');
    const layoutUpBtn = document.getElementById('btn-layout-up');
    const layoutDownBtn = document.getElementById('btn-layout-down');
    const layoutCenterBtn = document.getElementById('btn-layout-center');
    const updateCard = document.getElementById('update-card');
    const updateIcon = document.getElementById('update-icon');
    const updateTitle = document.getElementById('update-title');
    const updateDesc = document.getElementById('update-desc');
    const updateStatusBadge = document.getElementById('update-status-badge');
    const updateCurrentVersion = document.getElementById('update-current-version');
    const updateAvailableVersion = document.getElementById('update-available-version');
    const updateProgressFill = document.getElementById('update-progress-fill');
    const updateCheckBtn = document.getElementById('btn-update-check');
    const updateDownloadBtn = document.getElementById('btn-update-download');
    const updateInstallBtn = document.getElementById('btn-update-install');

    // Close Window
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        clicker.playClick();
        ipcRenderer.send('close-settings');
    });

    // Tab switching logic
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            clicker.playClick();
            
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Hide all tab contents
            tabContents.forEach(tab => tab.classList.add('hidden'));

            // Add active to clicked nav item
            item.classList.add('active');
            // Show corresponding tab content
            const tabId = item.getAttribute('data-tab');
            document.getElementById(tabId).classList.remove('hidden');
        });
    });

    function setUpdateBusy(isBusy) {
        [updateCheckBtn, updateDownloadBtn, updateInstallBtn].forEach((btn) => {
            if (btn) btn.dataset.busy = isBusy ? 'true' : 'false';
        });
    }

    function renderUpdateStatus(status = {}) {
        if (!updateCard) return;

        const state = status.state || 'idle';
        const progress = Math.max(0, Math.min(100, Number(status.progress || 0)));
        const availableVersion = status.availableVersion || '';
        const currentVersion = status.currentVersion || '-';

        const updateCopies = {
            idle: {
                icon: 'ph-shield-check',
                badge: 'Manuel',
                title: 'Mises à jour manuelles',
                desc: 'Liquid Dynamic Island vérifie les versions, mais ne télécharge rien sans ton clic.'
            },
            dev: {
                icon: 'ph-code',
                badge: 'Mode dev',
                title: 'Updater désactivé en développement',
                desc: 'Le contrôle des mises à jour sera actif dans la version installée.'
            },
            checking: {
                icon: 'ph-arrows-clockwise',
                badge: 'Recherche',
                title: 'Vérification en cours',
                desc: 'On regarde si une nouvelle version est disponible.'
            },
            'up-to-date': {
                icon: 'ph-check-circle',
                badge: 'À jour',
                title: 'Tu as la dernière version',
                desc: 'Aucune mise à jour disponible pour le moment.'
            },
            available: {
                icon: 'ph-download-simple',
                badge: 'Disponible',
                title: `Version ${availableVersion || 'récente'} disponible`,
                desc: 'La mise à jour est prête à être téléchargée. Elle ne sera pas installée automatiquement.'
            },
            downloading: {
                icon: 'ph-cloud-arrow-down',
                badge: `${progress}%`,
                title: 'Téléchargement en cours',
                desc: 'La mise à jour se prépare. Tu pourras lancer l’installation ensuite.'
            },
            downloaded: {
                icon: 'ph-rocket-launch',
                badge: 'Prête',
                title: `Version ${availableVersion || 'récente'} prête`,
                desc: 'La mise à jour est téléchargée. Clique sur Installer quand tu veux redémarrer l’application.'
            },
            installing: {
                icon: 'ph-rocket-launch',
                badge: 'Installation',
                title: 'Installation de la mise à jour',
                desc: 'Liquid Dynamic Island va redémarrer pour appliquer la nouvelle version.'
            },
            error: {
                icon: 'ph-warning-circle',
                badge: 'Erreur',
                title: 'Vérification impossible',
                desc: status.error || 'La mise à jour n’a pas pu être vérifiée pour le moment.'
            }
        };
        const copy = updateCopies[state] || updateCopies.idle;

        updateCard.classList.remove('is-active', 'is-available', 'is-downloading', 'is-downloaded', 'is-error');
        if (['checking', 'available', 'downloading', 'downloaded', 'installing'].includes(state)) updateCard.classList.add('is-active');
        if (state === 'available') updateCard.classList.add('is-available');
        if (state === 'downloading') updateCard.classList.add('is-downloading');
        if (state === 'downloaded') updateCard.classList.add('is-downloaded');
        if (state === 'error') updateCard.classList.add('is-error');

        if (updateIcon) updateIcon.className = `ph-fill ${copy.icon}`;
        if (updateTitle) updateTitle.textContent = copy.title;
        if (updateDesc) updateDesc.textContent = copy.desc;
        if (updateStatusBadge) updateStatusBadge.textContent = copy.badge;
        if (updateCurrentVersion) updateCurrentVersion.textContent = currentVersion;
        if (updateAvailableVersion) updateAvailableVersion.textContent = availableVersion || 'Aucune';
        if (updateProgressFill) updateProgressFill.style.width = `${state === 'available' ? 0 : progress}%`;

        if (updateCheckBtn) updateCheckBtn.disabled = !status.canCheck || state === 'checking' || state === 'downloading' || state === 'installing';
        if (updateDownloadBtn) updateDownloadBtn.disabled = !status.canDownload;
        if (updateInstallBtn) updateInstallBtn.disabled = !status.canInstall || state === 'installing';
        setUpdateBusy(state === 'checking' || state === 'downloading' || state === 'installing');
    }

    async function invokeUpdateAction(channel) {
        try {
            setUpdateBusy(true);
            const status = await ipcRenderer.invoke(channel);
            renderUpdateStatus(status);
        } catch (err) {
            renderUpdateStatus({
                state: 'error',
                error: err?.message || 'Action impossible',
                currentVersion: updateCurrentVersion ? updateCurrentVersion.textContent : '-'
            });
        } finally {
            setUpdateBusy(false);
        }
    }

    function emitConfig() {
        const glowColor = document.getElementById('color-glow').value;
        const glowColorMode = glowColorModeSelect.value;
        const glowDensity = rangeGlowDensity.value;
        const glowBlend = rangeGlowBlend.value;
        const glowEnabled = toggleGlow.checked;
        const opacity = rangeOpacity.value;
        const blur = rangeBlur.value;
        const visualizerSensitivity = rangeVisualizerSensitivity ? (rangeVisualizerSensitivity.value / 10) : 2.5;

        const shortcuts = [];
        for (let i = 0; i < 4; i++) {
            const presetVal = document.getElementById(`shortcut-preset-${i}`).value;
            const nameInput = document.getElementById(`shortcut-name-${i}`);
            const cmdInput = document.getElementById(`shortcut-cmd-${i}`);

            let shortcutData;
            if (presetVal === 'custom') {
                shortcutData = {
                    name: nameInput.value || "Perso",
                    preset: "custom",
                    icon: "ph-fill ph-sparkles",
                    cmd: cmdInput.value || ""
                };
            } else {
                const preset = SHORTCUT_PRESETS[presetVal];
                shortcutData = {
                    name: preset.name,
                    preset: presetVal,
                    icon: preset.icon,
                    cmd: preset.cmd
                };
            }
            shortcuts.push(shortcutData);
        }

        const wallpaperSyncStyle = selectWallpaperStyle ? selectWallpaperStyle.value : 'blur';
        const visualizerMode = selectVizAnalysisMode ? selectVizAnalysisMode.value : 'real';

        // Update visibility of conditional settings items
        if (wallpaperStyleContainer && toggleWallpaperSync) {
            wallpaperStyleContainer.classList.toggle('hidden', !toggleWallpaperSync.checked);
        }
        if (vizSensitivityContainer && selectVizAnalysisMode) {
            vizSensitivityContainer.classList.toggle('hidden', selectVizAnalysisMode.value === 'simulation');
        }

        // Custom config mapping matching exact original liquid_island_config keys!
        const config = {
            preset: 'cyberpunk',
            isPersistent: document.getElementById('toggle-persistent').checked,
            motion: getMotionLevel(),
            notifications: notificationsToggle ? notificationsToggle.checked : true,
            isCoverSync: document.getElementById('toggle-cover-sync').checked,
            isIdleCoverBg: document.getElementById('toggle-idle-cover-bg').checked,
            isWallpaperSync: document.getElementById('toggle-wallpaper-sync').checked,
            wallpaperSyncStyle,
            visualizerMode,
            visualizerSensitivity,
            shortcut: shortcutInput.value,
            widgetType: controlWidgetTypeSelect.value,
            activeProfile: localStorage.getItem('liquid_active_profile') || 'custom',
            shortcuts,
            player: {
                showTimes: playerShowTimesToggle ? playerShowTimesToggle.checked : true,
                showVisualizer: playerShowVisualizerToggle ? playerShowVisualizerToggle.checked : true,
                showActions: playerShowActionsToggle ? playerShowActionsToggle.checked : true,
                wheelAppVolume: playerWheelAppVolumeToggle ? playerWheelAppVolumeToggle.checked : true
            },
            modules: {
                music: document.getElementById('toggle-music').checked,
                timer: document.getElementById('toggle-timer').checked,
                control: document.getElementById('toggle-control').checked,
                gameDetection: document.getElementById('toggle-game-detection').checked
            },
            glow: {
                opacity: parseInt(opacity),
                blur: parseInt(blur),
                glowEnabled,
                glowDensity: parseInt(glowDensity),
                glowColorMode,
                glowBlend: parseInt(glowBlend),
                glowColor,
                bgImage: "",
                imgOpacity: 100,
                vizColorMode: selectVizMode.value,
                vizColorSolid: document.getElementById('viz-color-solid').value,
                vizColorGradA: document.getElementById('viz-color-grada').value,
                vizColorGradB: document.getElementById('viz-color-gradb').value,
                materialStyle: selectMaterialStyle ? selectMaterialStyle.value : 'glass',
                grainEffect: selectGrainEffect ? selectGrainEffect.value : 'none'
            }
        };

        // Save in settings window localStorage
        localStorage.setItem('island_standalone_config', JSON.stringify(config));
        
        // Save individual elements so they match exactly
        localStorage.setItem('liquid_island_config', JSON.stringify(config.glow));
        localStorage.setItem('liquid_motion_level', config.motion);
        localStorage.setItem('liquid_notifications_enabled', config.notifications);
        localStorage.setItem('liquid_music_enabled', config.modules.music);
        localStorage.setItem('liquid_island_timer_enabled', config.modules.timer);
        localStorage.setItem('liquid_island_control_enabled', config.modules.control);
        localStorage.setItem('liquid_game_detection_enabled', config.modules.gameDetection);
        localStorage.setItem('liquid_sound_effects_enabled', document.getElementById('toggle-sound-effects').checked);
        localStorage.setItem('liquid_island_persistent', config.isPersistent);
        localStorage.setItem('liquid_cover_color_sync', config.isCoverSync);
        localStorage.setItem('liquid_island_idle_cover_bg', document.getElementById('toggle-idle-cover-bg').checked);
        localStorage.setItem('liquid_wallpaper_sync', config.isWallpaperSync);
        localStorage.setItem('liquid_wallpaper_sync_style', config.wallpaperSyncStyle);
        localStorage.setItem('liquid_visualizer_mode', config.visualizerMode);
        localStorage.setItem('liquid_visualizer_sensitivity', config.visualizerSensitivity);
        localStorage.setItem('liquid_island_shortcut', config.shortcut);
        localStorage.setItem('liquid_control_widget_type', config.widgetType);
        localStorage.setItem('liquid_control_shortcuts', JSON.stringify(shortcuts));
        localStorage.setItem('liquid_active_profile', config.activeProfile);
        localStorage.setItem('liquid_player_show_times', config.player.showTimes);
        localStorage.setItem('liquid_player_show_visualizer', config.player.showVisualizer);
        localStorage.setItem('liquid_player_show_actions', config.player.showActions);
        localStorage.setItem('liquid_player_wheel_app_volume', config.player.wheelAppVolume);

        // Push update to the capsule window
        ipcRenderer.send('config-changed', config);
    }

    function refreshLayoutUI() {
        if (valLayoutScale) valLayoutScale.innerText = `${Math.round((layoutState.scale || 1) * 100)}%`;
        if (rangeLayoutScale) rangeLayoutScale.value = Math.round((layoutState.scale || 1) * 100);
        if (layoutPosX) layoutPosX.innerText = `${Math.round(layoutState.x || 0)} px`;
        if (layoutPosY) layoutPosY.innerText = `${Math.round(layoutState.y || 0)} px`;
        if (layoutEditState) layoutEditState.innerText = layoutState.editMode ? 'Placement' : 'Fixe';
        if (layoutEditBtn) {
            layoutEditBtn.classList.toggle('active', layoutState.editMode);
            layoutEditBtn.innerText = layoutState.editMode ? 'Terminer' : 'Activer';
        }
    }

    function emitLayoutConfig() {
        localStorage.setItem('liquid_layout_config', JSON.stringify({
            x: layoutState.x,
            y: layoutState.y,
            scale: layoutState.scale
        }));
        ipcRenderer.send('layout-config-changed', {
            x: layoutState.x,
            y: layoutState.y,
            scale: layoutState.scale
        });
        refreshLayoutUI();
    }

    function nudgeLayout(dx, dy) {
        layoutState.x += dx;
        layoutState.y += dy;
        emitLayoutConfig();
    }

    function centerLayout() {
        ipcRenderer.send('layout-reset');
    }

    function setActiveProfileUI(profileKey) {
        profileCards.forEach(card => {
            card.classList.toggle('active', card.dataset.profile === profileKey);
        });
    }

    function getMotionLevel() {
        const saved = localStorage.getItem('liquid_motion_level') || 'fluid';
        return MOTION_LEVELS.includes(saved) ? saved : 'fluid';
    }

    function setMotionUI(level) {
        const safeLevel = MOTION_LEVELS.includes(level) ? level : 'fluid';
        if (rangeMotion) rangeMotion.value = MOTION_LEVELS.indexOf(safeLevel);
        if (valMotion) valMotion.innerText = MOTION_LABELS[safeLevel];
        localStorage.setItem('liquid_motion_level', safeLevel);
    }

    function getCustomProfiles() {
        try {
            const parsed = JSON.parse(localStorage.getItem('liquid_custom_profiles') || '[]');
            return Array.isArray(parsed) ? parsed.filter(profile => profile && profile.id && profile.settings) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCustomProfiles(profiles) {
        localStorage.setItem('liquid_custom_profiles', JSON.stringify((profiles || []).filter(profile => !profile.locked)));
    }

    function getAllProfiles() {
        const systemProfiles = Object.entries(QUICK_PROFILES).map(([id, profile]) => ({
            id,
            name: profile.name,
            icon: profile.icon,
            locked: true,
            settings: profileToSettings(profile)
        }));
        const reserved = new Set(systemProfiles.map(profile => profile.id));
        const custom = getCustomProfiles().filter(profile => !reserved.has(profile.id));
        return [...systemProfiles, ...custom];
    }

    function refreshProfileSelect() {
        if (!profileSelect) return;
        const activeId = localStorage.getItem('liquid_active_profile') || 'music';
        profileSelect.innerHTML = getAllProfiles().map(profile => (
            `<option value="${escapeHtml(profile.id)}" ${profile.id === activeId ? 'selected' : ''}>${profile.locked ? '* ' : ''}${escapeHtml(profile.name)}</option>`
        )).join('');
        const selectedProfile = getAllProfiles().find(profile => profile.id === profileSelect.value);
        if (profileDeleteBtn) profileDeleteBtn.disabled = !selectedProfile || selectedProfile.locked;
    }

    function profileToSettings(profile) {
        return {
            motion: profile.motion || 'fluid',
            widgetType: profile.widgetType || 'launchpad',
            persistent: profile.persistent === true,
            notifications: profile.notifications !== false,
            coverSync: profile.coverSync !== false,
            idleCoverBg: profile.idleCoverBg !== false,
            wallpaperSync: profile.wallpaperSync === true,
            visualizerSensitivity: profile.visualizerSensitivity ?? 2.5,
            modules: profile.modules || { music: true, timer: true, control: true, gameDetection: true },
            glow: profile.glow || {},
            shortcut: shortcutInput ? shortcutInput.value : (localStorage.getItem('liquid_island_shortcut') || 'Alt+I'),
            shortcuts: JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts))
        };
    }

    function getCurrentSnapshot() {
        return {
            motion: getMotionLevel(),
            widgetType: controlWidgetTypeSelect.value,
            persistent: document.getElementById('toggle-persistent').checked,
            notifications: localStorage.getItem('liquid_notifications_enabled') !== 'false',
            coverSync: document.getElementById('toggle-cover-sync').checked,
            idleCoverBg: document.getElementById('toggle-idle-cover-bg').checked,
            wallpaperSync: document.getElementById('toggle-wallpaper-sync').checked,
            wallpaperSyncStyle: selectWallpaperStyle ? selectWallpaperStyle.value : 'blur',
            visualizerMode: selectVizAnalysisMode ? selectVizAnalysisMode.value : 'real',
            visualizerSensitivity: rangeVisualizerSensitivity ? (rangeVisualizerSensitivity.value / 10) : 2.5,
            modules: {
                music: document.getElementById('toggle-music').checked,
                timer: document.getElementById('toggle-timer').checked,
                control: document.getElementById('toggle-control').checked,
                gameDetection: document.getElementById('toggle-game-detection').checked
            },
            glow: {
                opacity: parseInt(rangeOpacity.value),
                blur: parseInt(rangeBlur.value),
                glowEnabled: toggleGlow.checked,
                glowDensity: parseInt(rangeGlowDensity.value),
                glowColorMode: glowColorModeSelect.value,
                glowBlend: parseInt(rangeGlowBlend.value),
                glowColor: document.getElementById('color-glow').value,
                bgImage: '',
                imgOpacity: 100,
                vizColorMode: selectVizMode.value,
                vizColorSolid: document.getElementById('viz-color-solid').value,
                vizColorGradA: document.getElementById('viz-color-grada').value,
                vizColorGradB: document.getElementById('viz-color-gradb').value
            },
            shortcut: shortcutInput.value,
            shortcuts: JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts)),
            player: {
                showTimes: playerShowTimesToggle ? playerShowTimesToggle.checked : true,
                showVisualizer: playerShowVisualizerToggle ? playerShowVisualizerToggle.checked : true,
                showActions: playerShowActionsToggle ? playerShowActionsToggle.checked : true,
                wheelAppVolume: playerWheelAppVolumeToggle ? playerWheelAppVolumeToggle.checked : true
            },
            layout: layoutState
        };
    }

    function applySettingsSnapshot(settings = {}, profileId = 'custom') {
        const appConfig = settings.appConfig || null;
        const effectiveSettings = {
            ...settings,
            modules: settings.modules || (appConfig && appConfig.modules) || undefined,
            glow: settings.glow || (appConfig && appConfig.glow) || undefined
        };
        const glow = effectiveSettings.glow || {};
        setMotionUI(effectiveSettings.motion || 'fluid');

        if (effectiveSettings.widgetType) controlWidgetTypeSelect.value = effectiveSettings.widgetType;
        shortcutsConfigContainer.classList.toggle('hidden', controlWidgetTypeSelect.value !== 'launchpad');

        document.getElementById('toggle-persistent').checked = effectiveSettings.persistent === true;
        document.getElementById('toggle-cover-sync').checked = effectiveSettings.coverSync !== false;
        document.getElementById('toggle-idle-cover-bg').checked = effectiveSettings.idleCoverBg !== false;

        // Set visualizer sensitivity from settings or localStorage fallback
        const sensitivity = effectiveSettings.visualizerSensitivity ?? parseFloat(localStorage.getItem('liquid_visualizer_sensitivity') || '2.5');
        if (rangeVisualizerSensitivity) {
            rangeVisualizerSensitivity.value = sensitivity * 10;
        }
        if (valVisualizerSensitivity) {
            valVisualizerSensitivity.innerText = `${sensitivity.toFixed(1)}x`;
        }
        if (selectWallpaperStyle && effectiveSettings.wallpaperSyncStyle) {
            selectWallpaperStyle.value = effectiveSettings.wallpaperSyncStyle;
        }
        if (selectVizAnalysisMode && effectiveSettings.visualizerMode) {
            selectVizAnalysisMode.value = effectiveSettings.visualizerMode;
        }

        document.getElementById('toggle-wallpaper-sync').checked = effectiveSettings.wallpaperSync === true;
        if (notificationsToggle) notificationsToggle.checked = effectiveSettings.notifications !== false;
        localStorage.setItem('liquid_notifications_enabled', effectiveSettings.notifications !== false);

        if (effectiveSettings.modules) {
            document.getElementById('toggle-music').checked = effectiveSettings.modules.music !== false;
            document.getElementById('toggle-timer').checked = effectiveSettings.modules.timer !== false;
            document.getElementById('toggle-control').checked = effectiveSettings.modules.control !== false;
            document.getElementById('toggle-game-detection').checked = effectiveSettings.modules.gameDetection !== false;
        }

        rangeOpacity.value = glow.opacity ?? rangeOpacity.value;
        valOpacity.innerText = `${rangeOpacity.value}%`;
        rangeBlur.value = glow.blur ?? rangeBlur.value;
        valBlur.innerText = `${rangeBlur.value}px`;
        rangeGlowDensity.value = glow.glowDensity ?? rangeGlowDensity.value;
        valGlowDensity.innerText = `${rangeGlowDensity.value}px`;
        toggleGlow.checked = glow.glowEnabled !== false;
        glowColorModeSelect.value = glow.glowColorMode || 'cover';
        rangeGlowBlend.value = glow.glowBlend ?? 65;
        valGlowBlend.innerText = `${rangeGlowBlend.value}%`;
        document.getElementById('color-glow').value = glow.glowColor || '#00f3ff';
        updateGlowModeVisibility();

        selectVizMode.value = glow.vizColorMode || 'cover';
        vizSolid.classList.toggle('hidden', selectVizMode.value !== 'solid');
        vizGrad.classList.toggle('hidden', selectVizMode.value !== 'gradient');
        document.getElementById('viz-color-solid').value = glow.vizColorSolid || '#00f3ff';
        document.getElementById('viz-color-grada').value = glow.vizColorGradA || '#00f3ff';
        document.getElementById('viz-color-gradb').value = glow.vizColorGradB || '#ff00ff';

        if (effectiveSettings.shortcut && shortcutInput) shortcutInput.value = effectiveSettings.shortcut;
        if (Array.isArray(effectiveSettings.shortcuts)) localStorage.setItem('liquid_control_shortcuts', JSON.stringify(effectiveSettings.shortcuts));
        if (effectiveSettings.player) {
            if (playerShowTimesToggle) playerShowTimesToggle.checked = effectiveSettings.player.showTimes !== false;
            if (playerShowVisualizerToggle) playerShowVisualizerToggle.checked = effectiveSettings.player.showVisualizer !== false;
            if (playerShowActionsToggle) playerShowActionsToggle.checked = effectiveSettings.player.showActions !== false;
            if (playerWheelAppVolumeToggle) playerWheelAppVolumeToggle.checked = effectiveSettings.player.wheelAppVolume !== false;
        }
        if (effectiveSettings.layout) {
            layoutState = { ...layoutState, ...effectiveSettings.layout };
            emitLayoutConfig();
        }

        localStorage.setItem('liquid_active_profile', profileId);
        setActiveProfileUI(profileId);
        emitConfig();
        refreshProfileSelect();
    }

    function updateGlowModeVisibility() {
        const enabled = toggleGlow.checked;
        const mode = glowColorModeSelect.value;
        densityCont.classList.toggle('hidden', !enabled);
        colorCont.classList.toggle('hidden', !enabled);
        fixedColorCont.classList.toggle('hidden', !enabled || mode === 'cover');
        glowBlendCont.classList.toggle('hidden', !enabled || mode !== 'mix');
    }

    function applyQuickProfile(profileKey) {
        const profile = QUICK_PROFILES[profileKey];
        if (!profile) return;

        clicker.playClick();
        localStorage.setItem('liquid_active_profile', profileKey);
        localStorage.setItem('liquid_focus_mode', profile.focus);
        localStorage.setItem('liquid_eco_mode', profile.eco);
        localStorage.setItem('liquid_dnd_enabled', profile.dnd);
        localStorage.setItem('liquid_control_widget_type', profile.widgetType);
        setMotionUI(profile.motion || 'fluid');
        if (notificationsToggle) notificationsToggle.checked = profile.notifications !== false;

        rangeOpacity.value = profile.glow.opacity;
        valOpacity.innerText = `${profile.glow.opacity}%`;
        rangeBlur.value = profile.glow.blur;
        valBlur.innerText = `${profile.glow.blur}px`;
        rangeGlowDensity.value = profile.glow.glowDensity;
        valGlowDensity.innerText = `${profile.glow.glowDensity}px`;
        toggleGlow.checked = profile.glow.glowEnabled;
        glowColorModeSelect.value = profile.glow.glowColorMode || 'cover';
        rangeGlowBlend.value = profile.glow.glowBlend ?? 65;
        valGlowBlend.innerText = `${rangeGlowBlend.value}%`;
        updateGlowModeVisibility();
        document.getElementById('color-glow').value = profile.glow.glowColor;

        selectVizMode.value = profile.glow.vizColorMode;
        vizSolid.classList.toggle('hidden', profile.glow.vizColorMode !== 'solid');
        vizGrad.classList.toggle('hidden', profile.glow.vizColorMode !== 'gradient');
        document.getElementById('viz-color-solid').value = profile.glow.vizColorSolid;
        document.getElementById('viz-color-grada').value = profile.glow.vizColorGradA;
        document.getElementById('viz-color-gradb').value = profile.glow.vizColorGradB;
        if (selectMaterialStyle) selectMaterialStyle.value = profile.glow.materialStyle || 'glass';
        if (selectGrainEffect) selectGrainEffect.value = profile.glow.grainEffect || 'none';

        document.getElementById('toggle-persistent').checked = profile.persistent;
        document.getElementById('toggle-cover-sync').checked = profile.coverSync;
        document.getElementById('toggle-idle-cover-bg').checked = profile.idleCoverBg;
        if (selectWallpaperStyle) selectWallpaperStyle.value = profile.wallpaperSyncStyle || 'blur';
        if (selectVizAnalysisMode) selectVizAnalysisMode.value = profile.visualizerMode || 'real';

        document.getElementById('toggle-wallpaper-sync').checked = profile.wallpaperSync === true;
        if (profile.modules) {
            document.getElementById('toggle-music').checked = profile.modules.music !== false;
            document.getElementById('toggle-timer').checked = profile.modules.timer !== false;
            document.getElementById('toggle-control').checked = profile.modules.control !== false;
            document.getElementById('toggle-game-detection').checked = profile.modules.gameDetection !== false;
        }
        controlWidgetTypeSelect.value = profile.widgetType;
        shortcutsConfigContainer.classList.toggle('hidden', profile.widgetType !== 'launchpad');
        setActiveProfileUI(profileKey);

        emitConfig();

        ipcRenderer.send('apply-profile', { key: profileKey, ...profile });
        ipcRenderer.invoke('set-system-volume', profile.volume).catch(() => {});
        ipcRenderer.invoke('dnd-control', profile.dnd ? 'on' : 'off').catch(() => {});
    }

    // Slider range binds
    rangeOpacity.addEventListener('input', (e) => {
        valOpacity.innerText = `${e.target.value}%`;
        emitConfig();
    });

    rangeBlur.addEventListener('input', (e) => {
        valBlur.innerText = `${e.target.value}px`;
        emitConfig();
    });

    rangeGlowDensity.addEventListener('input', (e) => {
        valGlowDensity.innerText = `${e.target.value}px`;
        emitConfig();
    });

    if (rangeVisualizerSensitivity) {
        rangeVisualizerSensitivity.addEventListener('input', (e) => {
            const val = Number(e.target.value) / 10;
            if (valVisualizerSensitivity) {
                valVisualizerSensitivity.innerText = `${val.toFixed(1)}x`;
            }
            emitConfig();
        });
    }

    // Switch binds
    toggleGlow.addEventListener('change', (e) => {
        clicker.playClick();
        updateGlowModeVisibility();
        emitConfig();
    });

    glowColorModeSelect.addEventListener('change', (e) => {
        clicker.playClick();
        updateGlowModeVisibility();
        emitConfig();
    });

    rangeGlowBlend.addEventListener('input', (e) => {
        valGlowBlend.innerText = `${e.target.value}%`;
        emitConfig();
    });

    document.getElementById('color-glow').addEventListener('input', emitConfig);

    if (rangeMotion) {
        rangeMotion.addEventListener('input', (e) => {
            const level = MOTION_LEVELS[Number(e.target.value)] || 'fluid';
            setMotionUI(level);
            emitConfig();
        });
    }

    // Visualizer selection binds
    selectVizMode.addEventListener('change', (e) => {
        clicker.playClick();
        const mode = e.target.value;
        vizSolid.classList.add('hidden');
        vizGrad.classList.add('hidden');

        if (mode === 'solid') vizSolid.classList.remove('hidden');
        if (mode === 'gradient') vizGrad.classList.remove('hidden');

        emitConfig();
    });

    document.getElementById('viz-color-solid').addEventListener('input', emitConfig);
    document.getElementById('viz-color-grada').addEventListener('input', emitConfig);
    document.getElementById('viz-color-gradb').addEventListener('input', emitConfig);

    if (selectVizAnalysisMode) {
        selectVizAnalysisMode.addEventListener('change', () => {
            clicker.playClick();
            if (vizSensitivityContainer) {
                vizSensitivityContainer.classList.toggle('hidden', selectVizAnalysisMode.value === 'simulation');
            }
            emitConfig();
        });
    }

    if (rangeLayoutScale) {
        rangeLayoutScale.addEventListener('input', (e) => {
            layoutState.scale = Number(e.target.value) / 100;
            emitLayoutConfig();
        });
    }

    if (layoutEditBtn) {
        layoutEditBtn.addEventListener('click', () => {
            clicker.playClick();
            ipcRenderer.send('set-layout-edit-mode', !layoutState.editMode);
        });
    }

    if (layoutLeftBtn) layoutLeftBtn.addEventListener('click', () => { clicker.playClick(); nudgeLayout(-20, 0); });
    if (layoutRightBtn) layoutRightBtn.addEventListener('click', () => { clicker.playClick(); nudgeLayout(20, 0); });
    if (layoutUpBtn) layoutUpBtn.addEventListener('click', () => { clicker.playClick(); nudgeLayout(0, -20); });
    if (layoutDownBtn) layoutDownBtn.addEventListener('click', () => { clicker.playClick(); nudgeLayout(0, 20); });
    if (layoutCenterBtn) layoutCenterBtn.addEventListener('click', () => { clicker.playClick(); centerLayout(); });

    // CC Toggles
    controlWidgetTypeSelect.addEventListener('change', (e) => {
        clicker.playClick();
        const type = e.target.value;
        shortcutsConfigContainer.classList.toggle('hidden', type !== 'launchpad');
        emitConfig();
    });

    const toggles = [
        'toggle-music',
        'toggle-timer',
        'toggle-control',
        'toggle-persistent',
        'toggle-notifications',
        'toggle-cover-sync',
        'toggle-idle-cover-bg',
        'toggle-wallpaper-sync',
        'toggle-game-detection',
        'toggle-sound-effects',
        'toggle-player-show-times',
        'toggle-player-show-visualizer',
        'toggle-player-show-actions',
        'toggle-player-wheel-app-volume'
    ];
    toggles.forEach(t => {
        const toggle = document.getElementById(t);
        if (!toggle) return;
        toggle.addEventListener('change', () => {
            clicker.playClick();
            emitConfig();
        });
    });

    if (selectWallpaperStyle) {
        selectWallpaperStyle.addEventListener('change', () => {
            clicker.playClick();
            emitConfig();
        });
    }

    if (selectVizAnalysisMode) {
        selectVizAnalysisMode.addEventListener('change', () => {
            clicker.playClick();
            emitConfig();
        });
    }

    if (selectMaterialStyle) {
        selectMaterialStyle.addEventListener('change', () => {
            clicker.playClick();
            emitConfig();
        });
    }

    if (selectGrainEffect) {
        selectGrainEffect.addEventListener('change', () => {
            clicker.playClick();
            emitConfig();
        });
    }

    profileCards.forEach(card => {
        card.addEventListener('click', () => applyQuickProfile(card.dataset.profile));
    });

    if (profileSelect) {
        profileSelect.addEventListener('change', () => {
            const selectedProfile = getAllProfiles().find(profile => profile.id === profileSelect.value);
            if (profileDeleteBtn) profileDeleteBtn.disabled = !selectedProfile || selectedProfile.locked;
        });
    }

    if (profileApplyBtn) {
        profileApplyBtn.addEventListener('click', () => {
            const profile = getAllProfiles().find(item => item.id === profileSelect.value);
            if (!profile) return;
            clicker.playClick();
            applySettingsSnapshot(profile.settings, profile.id);
        });
    }

    if (profileCreateBtn) {
        profileCreateBtn.addEventListener('click', () => {
            const name = (profileNameInput.value || '').trim().slice(0, 24);
            if (!name) return;
            clicker.playClick();
            const profiles = getCustomProfiles();
            const id = `custom-${Date.now()}`;
            profiles.push({ id, name, icon: 'ph-user-circle', locked: false, settings: getCurrentSnapshot() });
            saveCustomProfiles(profiles);
            localStorage.setItem('liquid_active_profile', id);
            profileNameInput.value = '';
            refreshProfileSelect();
            emitConfig();
        });
    }

    if (profileSaveBtn) {
        profileSaveBtn.addEventListener('click', () => {
            clicker.playClick();
            const selected = getAllProfiles().find(item => item.id === profileSelect.value);
            if (!selected || selected.locked) {
                const name = (profileNameInput.value || '').trim() || 'Profil perso';
                const profiles = getCustomProfiles();
                const id = `custom-${Date.now()}`;
                profiles.push({ id, name: name.slice(0, 24), icon: 'ph-user-circle', locked: false, settings: getCurrentSnapshot() });
                saveCustomProfiles(profiles);
                localStorage.setItem('liquid_active_profile', id);
            } else {
                const profiles = getCustomProfiles().map(profile => profile.id === selected.id ? { ...profile, settings: getCurrentSnapshot() } : profile);
                saveCustomProfiles(profiles);
                localStorage.setItem('liquid_active_profile', selected.id);
            }
            refreshProfileSelect();
            emitConfig();
        });
    }

    if (profileDeleteBtn) {
        profileDeleteBtn.addEventListener('click', () => {
            const selected = getAllProfiles().find(item => item.id === profileSelect.value);
            if (!selected || selected.locked) return;
            clicker.playClick();
            saveCustomProfiles(getCustomProfiles().filter(profile => profile.id !== selected.id));
            localStorage.setItem('liquid_active_profile', 'music');
            refreshProfileSelect();
            setActiveProfileUI('music');
            emitConfig();
        });
    }

    if (settingsExportBtn) {
        settingsExportBtn.addEventListener('click', () => {
            clicker.playClick();
            const payload = {
                type: 'liquid-dynamic-island-settings',
                version: 1,
                exportedAt: new Date().toISOString(),
                activeProfile: localStorage.getItem('liquid_active_profile') || 'music',
                settings: getCurrentSnapshot(),
                profiles: getCustomProfiles(),
                musicHistory: JSON.parse(localStorage.getItem('liquid_music_history') || '[]')
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `liquid-island-settings-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    if (settingsImportBtn && settingsImportFile) {
        settingsImportBtn.addEventListener('click', () => {
            clicker.playClick();
            settingsImportFile.click();
        });
        settingsImportFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const payload = JSON.parse(String(reader.result || '{}'));
                    if (Array.isArray(payload.profiles)) saveCustomProfiles(payload.profiles);
                    if (Array.isArray(payload.musicHistory)) localStorage.setItem('liquid_music_history', JSON.stringify(payload.musicHistory.slice(0, 20)));
                    if (payload.activeProfile) localStorage.setItem('liquid_active_profile', payload.activeProfile);
                    if (payload.settings) applySettingsSnapshot(payload.settings, payload.activeProfile || 'custom');
                    refreshProfileSelect();
                } catch (err) {}
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    if (autoStartToggle) {
        autoStartToggle.addEventListener('change', async (e) => {
            clicker.playClick();
            const enabled = await ipcRenderer.invoke('set-auto-start', e.target.checked);
            autoStartToggle.checked = Boolean(enabled);
            localStorage.setItem('liquid_auto_start_enabled', String(Boolean(enabled)));
        });
    }

    // Shortcuts row bindings
    for (let i = 0; i < 4; i++) {
        const presetSel = document.getElementById(`shortcut-preset-${i}`);
        const customContainer = document.getElementById(`shortcut-custom-container-${i}`);
        const nameInput = document.getElementById(`shortcut-name-${i}`);
        const cmdInput = document.getElementById(`shortcut-cmd-${i}`);

        presetSel.addEventListener('change', (e) => {
            clicker.playClick();
            const isCustom = e.target.value === 'custom';
            customContainer.classList.toggle('hidden', !isCustom);

            if (!isCustom) {
                const preset = SHORTCUT_PRESETS[e.target.value];
                nameInput.value = preset.name;
                cmdInput.value = preset.cmd;
            }
            emitConfig();
        });

        nameInput.addEventListener('input', emitConfig);
        cmdInput.addEventListener('input', emitConfig);
    }

    // Keyboard Shortcut recorder
    if (shortcutInput) {
        shortcutInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.shiftKey) keys.push('Shift');
            if (e.altKey) keys.push('Alt');
            if (e.metaKey) keys.push('Super');

            const key = e.key;
            if (key !== 'Control' && key !== 'Shift' && key !== 'Alt' && key !== 'Meta') {
                let cleanKey = key;
                if (key === ' ') cleanKey = 'Space';
                if (key === 'ArrowUp') cleanKey = 'Up';
                if (key === 'ArrowDown') cleanKey = 'Down';
                if (key === 'ArrowLeft') cleanKey = 'Left';
                if (key === 'ArrowRight') cleanKey = 'Right';
                
                if (cleanKey.length === 1) {
                    cleanKey = cleanKey.toUpperCase();
                } else if (cleanKey.match(/^[a-z]/)) {
                    cleanKey = cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1);
                }

                keys.push(cleanKey);
            }

            if (keys.length > 0 && keys[keys.length - 1] !== 'Ctrl' && keys[keys.length - 1] !== 'Shift' && keys[keys.length - 1] !== 'Alt' && keys[keys.length - 1] !== 'Super') {
                const finalShortcut = keys.join('+');
                shortcutInput.value = finalShortcut;
                
                emitConfig();
                
                ipcRenderer.send('register-shortcut', finalShortcut);
                shortcutInput.blur();
            }
        });

        shortcutInput.addEventListener('focus', () => {
            shortcutInput.style.borderColor = 'var(--neon-primary)';
            shortcutInput.value = 'Press keys...';
        });

        shortcutInput.addEventListener('blur', () => {
            shortcutInput.style.borderColor = '';
            const savedShortcut = localStorage.getItem('liquid_island_shortcut') || 'Alt+I';
            shortcutInput.value = savedShortcut;
        });
    }

    // Load saved settings
    function loadSettings() {
        const savedGlow = JSON.parse(localStorage.getItem('liquid_island_config') || '{}');
        setMotionUI(getMotionLevel());
        
        // Apparence
        const opacity = savedGlow.opacity !== undefined ? savedGlow.opacity : 92;
        rangeOpacity.value = opacity;
        valOpacity.innerText = `${opacity}%`;

        const blur = savedGlow.blur !== undefined ? savedGlow.blur : 30;
        rangeBlur.value = blur;
        valBlur.innerText = `${blur}px`;

        const glowEnabled = savedGlow.glowEnabled !== false;
        toggleGlow.checked = glowEnabled;

        const glowDensity = savedGlow.glowDensity !== undefined ? savedGlow.glowDensity : 20;
        rangeGlowDensity.value = glowDensity;
        valGlowDensity.innerText = `${glowDensity}px`;

        const glowColor = savedGlow.glowColor || '#00f3ff';
        const glowColorMode = savedGlow.glowColorMode || 'mix';
        glowColorModeSelect.value = glowColorMode;
        const glowBlend = savedGlow.glowBlend !== undefined ? savedGlow.glowBlend : 65;
        rangeGlowBlend.value = glowBlend;
        valGlowBlend.innerText = `${glowBlend}%`;
        updateGlowModeVisibility();
        document.getElementById('color-glow').value = glowColor;

        // Visualizer
        const vizAnalysisMode = localStorage.getItem('liquid_visualizer_mode') || 'real';
        if (selectVizAnalysisMode) selectVizAnalysisMode.value = vizAnalysisMode;

        const vizMode = savedGlow.vizColorMode || 'cyberpunk';
        selectVizMode.value = vizMode;
        vizSolid.classList.add('hidden');
        vizGrad.classList.add('hidden');
        if (vizMode === 'solid') vizSolid.classList.remove('hidden');
        if (vizMode === 'gradient') vizGrad.classList.remove('hidden');

        document.getElementById('viz-color-solid').value = savedGlow.vizColorSolid || '#00f3ff';
        document.getElementById('viz-color-grada').value = savedGlow.vizColorGradA || '#00f3ff';
        document.getElementById('viz-color-gradb').value = savedGlow.vizColorGradB || '#ff00ff';
        if (selectMaterialStyle) selectMaterialStyle.value = savedGlow.materialStyle || 'glass';
        if (selectGrainEffect) selectGrainEffect.value = savedGlow.grainEffect || 'none';

        // CC widget type
        const widgetType = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
        controlWidgetTypeSelect.value = widgetType;
        shortcutsConfigContainer.classList.toggle('hidden', widgetType !== 'launchpad');

        // CC shortcuts
        const shortcuts = JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts));
        for (let i = 0; i < 4; i++) {
            const s = shortcuts[i] || defaultShortcuts[i];
            const presetSel = document.getElementById(`shortcut-preset-${i}`);
            const custCont = document.getElementById(`shortcut-custom-container-${i}`);
            const nameIn = document.getElementById(`shortcut-name-${i}`);
            const cmdIn = document.getElementById(`shortcut-cmd-${i}`);

            if (presetSel) presetSel.value = s.preset || 'custom';
            if (custCont) custCont.classList.toggle('hidden', s.preset !== 'custom');
            if (nameIn) nameIn.value = s.name || '';
            if (cmdIn) cmdIn.value = s.cmd || '';
        }

        // Behavior
        document.getElementById('toggle-persistent').checked = localStorage.getItem('liquid_island_persistent') === 'true';
        if (notificationsToggle) notificationsToggle.checked = localStorage.getItem('liquid_notifications_enabled') !== 'false';
        document.getElementById('toggle-cover-sync').checked = localStorage.getItem('liquid_cover_color_sync') !== 'false';
        document.getElementById('toggle-idle-cover-bg').checked = localStorage.getItem('liquid_island_idle_cover_bg') !== 'false';
        document.getElementById('toggle-wallpaper-sync').checked = localStorage.getItem('liquid_wallpaper_sync') === 'true';
        const wpStyle = localStorage.getItem('liquid_wallpaper_sync_style') || 'blur';
        if (selectWallpaperStyle) selectWallpaperStyle.value = wpStyle;
        setActiveProfileUI(localStorage.getItem('liquid_active_profile') || 'custom');
        refreshProfileSelect();
        
        const savedShortcut = localStorage.getItem('liquid_island_shortcut') || 'Alt+I';
        shortcutInput.value = savedShortcut;

        // Modules
        document.getElementById('toggle-music').checked = localStorage.getItem('liquid_music_enabled') !== 'false';
        document.getElementById('toggle-timer').checked = localStorage.getItem('liquid_island_timer_enabled') !== 'false';
        document.getElementById('toggle-control').checked = localStorage.getItem('liquid_island_control_enabled') !== 'false';
        document.getElementById('toggle-game-detection').checked = localStorage.getItem('liquid_game_detection_enabled') !== 'false';
        document.getElementById('toggle-sound-effects').checked = localStorage.getItem('liquid_sound_effects_enabled') !== 'false';
        if (playerShowTimesToggle) playerShowTimesToggle.checked = localStorage.getItem('liquid_player_show_times') !== 'false';
        if (playerShowVisualizerToggle) playerShowVisualizerToggle.checked = localStorage.getItem('liquid_player_show_visualizer') !== 'false';
        if (playerShowActionsToggle) playerShowActionsToggle.checked = localStorage.getItem('liquid_player_show_actions') !== 'false';
        if (playerWheelAppVolumeToggle) playerWheelAppVolumeToggle.checked = localStorage.getItem('liquid_player_wheel_app_volume') !== 'false';

        const savedLayout = JSON.parse(localStorage.getItem('liquid_layout_config') || '{"x":0,"y":10,"scale":1}');
        layoutState.x = Number.isFinite(Number(savedLayout.x)) ? Number(savedLayout.x) : 0;
        layoutState.y = Number.isFinite(Number(savedLayout.y)) ? Number(savedLayout.y) : 10;
        layoutState.scale = Number.isFinite(Number(savedLayout.scale)) ? Number(savedLayout.scale) : 1;
        refreshLayoutUI();
        
        // Sync
        setTimeout(emitConfig, 200);
    }

    // Execute load
    loadSettings();
    renderUpdateStatus({ state: 'idle' });
    ipcRenderer.invoke('get-update-status')
        .then(renderUpdateStatus)
        .catch(() => renderUpdateStatus({ state: 'error', error: 'Statut de mise à jour indisponible' }));

    ipcRenderer.on('update-status-changed', (event, status) => {
        renderUpdateStatus(status);
    });

    if (updateCheckBtn) {
        updateCheckBtn.addEventListener('click', () => {
            clicker.playClick();
            invokeUpdateAction('check-for-updates-manual');
        });
    }

    if (updateDownloadBtn) {
        updateDownloadBtn.addEventListener('click', () => {
            clicker.playClick();
            invokeUpdateAction('download-update-manual');
        });
    }

    if (updateInstallBtn) {
        updateInstallBtn.addEventListener('click', () => {
            clicker.playClick();
            invokeUpdateAction('install-downloaded-update');
        });
    }

    if (autoStartToggle) {
        ipcRenderer.invoke('get-auto-start').then(enabled => {
            autoStartToggle.checked = Boolean(enabled);
            localStorage.setItem('liquid_auto_start_enabled', String(Boolean(enabled)));
        }).catch(() => {
            autoStartToggle.checked = localStorage.getItem('liquid_auto_start_enabled') === 'true';
        });
    }

    ipcRenderer.invoke('get-layout-state').then((state) => {
        if (!state) return;
        if (state.layout) {
            layoutState = {
                ...layoutState,
                ...state.layout
            };
            localStorage.setItem('liquid_layout_config', JSON.stringify(state.layout));
        }
        layoutState.editMode = Boolean(state.editMode);
        layoutState.display = state.display || null;
        refreshLayoutUI();
    }).catch(() => {});

    // Listen for cover color changes from the Island (syncs settings accent and background to album art)
    ipcRenderer.on('cover-color-changed', (event, colorData) => {
        if (colorData) {
            if (colorData.primary) {
                document.documentElement.style.setProperty('--neon-primary', colorData.primary);
                document.documentElement.style.setProperty('--neon-accent', colorData.primary);
                document.documentElement.style.setProperty('--neon-primary-rgb', colorData.rgb);
                document.documentElement.style.setProperty('--neon-secondary', colorData.secondary);
                document.documentElement.style.setProperty('--neon-secondary-rgb', hexToRgbString(colorData.secondary) || '188, 19, 254');
            }
            
            const bgLayer = document.querySelector('.settings-bg-layer');
            if (bgLayer) {
                const isSyncEnabled = localStorage.getItem('liquid_cover_color_sync') !== 'false';
                if (colorData.cover && isSyncEnabled) {
                    bgLayer.style.backgroundImage = `url("${colorData.cover.replace(/\\/g, '/')}")`;
                    bgLayer.style.opacity = '0.18';
                } else {
                    bgLayer.style.backgroundImage = 'none';
                    bgLayer.style.opacity = '0';
                }
            }
        }
    });

    ipcRenderer.on('layout-config-changed', (event, layout) => {
        if (!layout) return;
        layoutState = {
            ...layoutState,
            ...layout
        };
        localStorage.setItem('liquid_layout_config', JSON.stringify({
            x: layoutState.x,
            y: layoutState.y,
            scale: layoutState.scale
        }));
        refreshLayoutUI();
    });

    ipcRenderer.on('layout-edit-mode-changed', (event, enabled) => {
        layoutState.editMode = Boolean(enabled);
        refreshLayoutUI();
    });
});
