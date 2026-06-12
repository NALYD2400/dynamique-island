import { SystemService } from '../services/SystemService.js';
import { SoundService } from '../services/SoundService.js';
import { visualizerService } from '../services/AudioVisualizerService.js';
import { ThemeService } from '../services/ThemeService.js';

const ipcRenderer = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI.ipcRenderer : null;

const APP_LOGO_ART = '../assets/app-logo.png';

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 243, b: 255 };
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function blendHexColors(baseHex, coverHex, coverWeight = 65) {
    const base = hexToRgb(baseHex);
    const cover = hexToRgb(coverHex);
    const weight = Math.max(0, Math.min(100, coverWeight)) / 100;
    const r = Math.round(base.r * (1 - weight) + cover.r * weight);
    const g = Math.round(base.g * (1 - weight) + cover.g * weight);
    const b = Math.round(base.b * (1 - weight) + cover.b * weight);
    return rgbToHex(r, g, b);
}


// Fonction utilitaire pour convertir les millisecondes en 'MM:SS'
function formatTime(ms) {
    if (ms === undefined || ms === null || isNaN(ms)) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

function getMusicSearchProvider(data = {}) {
    const appId = (data.appId || '').toLowerCase();
    const title = (data.title || '').toLowerCase();
    const artist = (data.artist || '').toLowerCase();
    const windowTitle = (data.windowTitle || '').toLowerCase();
    const haystack = `${appId} ${title} ${artist} ${windowTitle}`;
    const isBrowser = /chrome|msedge|edge|firefox|brave|opera|arc/.test(appId);

    if (haystack.includes('tiktok') || haystack.includes('tik tok')) return { key: 'tiktok', label: 'TikTok', icon: 'ph-video' };
    if (haystack.includes('instagram')) return { key: 'instagram', label: 'Instagram', icon: 'ph-instagram-logo' };
    if (haystack.includes('twitch')) return { key: 'twitch', label: 'Twitch', icon: 'ph-twitch-logo' };
    if (haystack.includes('spotify')) {
        return isBrowser
            ? { key: 'spotify-web', label: 'Spotify Web', icon: 'ph-spotify-logo' }
            : { key: 'spotify', label: 'Spotify', icon: 'ph-spotify-logo' };
    }
    if (haystack.includes('youtube music') || haystack.includes('yt music')) return { key: 'youtube-music', label: 'YouTube Music', icon: 'ph-youtube-logo' };
    if (haystack.includes('youtube')) return { key: 'youtube-music', label: 'YouTube Music', icon: 'ph-youtube-logo' };
    if (haystack.includes('deezer')) return { key: 'deezer', label: 'Deezer', icon: 'ph-music-notes' };
    if (haystack.includes('apple music') || haystack.includes('itunes')) return { key: 'apple-music', label: 'Apple Music', icon: 'ph-music-notes' };
    if (haystack.includes('soundcloud')) return { key: 'soundcloud', label: 'SoundCloud', icon: 'ph-cloud' };
    if (haystack.includes('tidal')) return { key: 'tidal', label: 'Tidal', icon: 'ph-waveform' };
    if (haystack.includes('amazon music')) return { key: 'amazon-music', label: 'Amazon Music', icon: 'ph-music-notes' };
    if (isBrowser) return { key: 'web-music', label: 'Web musique', icon: 'ph-globe' };

    return { key: 'web-music', label: 'Web musique', icon: 'ph-magnifying-glass' };
}

function getMusicSearchTarget(query, provider) {
    const encoded = encodeURIComponent(query.trim());

    switch (provider.key) {
        case 'spotify':
            return `spotify:search:${encoded}`;
        case 'spotify-web':
            return `https://open.spotify.com/search/${encoded}`;
        case 'youtube-music':
            return `https://music.youtube.com/search?q=${encoded}`;
        case 'deezer':
            return `https://www.deezer.com/search/${encoded}`;
        case 'apple-music':
            return `https://music.apple.com/search?term=${encoded}`;
        case 'soundcloud':
            return `https://soundcloud.com/search?q=${encoded}`;
        case 'tidal':
            return `https://listen.tidal.com/search?q=${encoded}`;
        case 'amazon-music':
            return `https://music.amazon.com/search/${encoded}`;
        case 'tiktok':
            return `https://www.tiktok.com/search?q=${encoded}`;
        case 'instagram':
            return `https://www.instagram.com/explore/search/keyword/?q=${encoded}`;
        case 'twitch':
            return `https://www.twitch.tv/search?term=${encoded}`;
        default:
            return `https://www.google.com/search?q=${encoded}%20music`;
    }
}

function getCurrentTrackSearchQuery(data = {}) {
    const title = (data.title || '').trim();
    const artist = (data.artist || '').trim();
    const ignoredTitles = ['Aucune lecture', 'Sans titre'];
    const ignoredArtists = ['Systeme', 'Système', 'Artiste inconnu', 'Lecteur media', 'Lecteur mÃ©dia'];
    const parts = [];

    if (artist && !ignoredArtists.includes(artist)) parts.push(artist);
    if (title && !ignoredTitles.includes(title)) parts.push(title);

    return parts.join(' ').trim();
}

function getMusicHistoryKey(data = {}) {
    return `${data.title || ''}::${data.artist || ''}::${data.appId || ''}`.toLowerCase();
}

function isHistoryTrack(data = {}) {
    const title = (data.title || '').trim();
    const artist = (data.artist || '').trim();

    if (!title || title === 'Aucune lecture' || title === 'Sans titre') return false;
    if (artist === 'Système' || artist === 'SystÃ¨me') return false;

    return getCurrentTrackSearchQuery(data).length > 0;
}

function formatHistoryTime(timestamp) {
    if (!timestamp) return '';

    const elapsed = Math.max(0, Date.now() - timestamp);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (elapsed < minute) return 'maintenant';
    if (elapsed < hour) return `${Math.floor(elapsed / minute)} min`;
    if (elapsed < day) return `${Math.floor(elapsed / hour)} h`;
    return `${Math.floor(elapsed / day)} j`;
}

const APP_ICONS = {
    spotify: 'https://api.iconify.design/logos:spotify-icon.svg',
    netflix: 'https://api.iconify.design/logos:netflix-icon.svg',
    youtube: 'https://api.iconify.design/logos:youtube-icon.svg',
    disney: 'https://api.iconify.design/logos:disney-plus.svg',
    crunchyroll: 'https://api.iconify.design/simple-icons:crunchyroll.svg?color=%23F47521',
    tiktok: 'https://api.iconify.design/simple-icons:tiktok.svg?color=%23FFFFFF',
    instagram: 'https://api.iconify.design/simple-icons:instagram.svg?color=%23E4405F',
    twitch: 'https://api.iconify.design/simple-icons:twitch.svg?color=%239146FF',
    facebook: 'https://api.iconify.design/simple-icons:facebook.svg?color=%231877F2',
    x: 'https://api.iconify.design/simple-icons:x.svg?color=%23FFFFFF',
    reddit: 'https://api.iconify.design/simple-icons:reddit.svg?color=%23FF4500',
    snapchat: 'https://api.iconify.design/simple-icons:snapchat.svg?color=%23FFFC00',
    pinterest: 'https://api.iconify.design/simple-icons:pinterest.svg?color=%23BD081C',
    linkedin: 'https://api.iconify.design/simple-icons:linkedin.svg?color=%230A66C2',
    threads: 'https://api.iconify.design/simple-icons:threads.svg?color=%23FFFFFF',
    bluesky: 'https://api.iconify.design/simple-icons:bluesky.svg?color=%231185FE',
    soundcloud: 'https://api.iconify.design/simple-icons:soundcloud.svg?color=%23FF5500',
    deezer: 'https://api.iconify.design/simple-icons:deezer.svg?color=%23A238FF',
    chrome: 'https://api.iconify.design/logos:google-chrome.svg',
    edge: 'https://api.iconify.design/logos:microsoft-edge.svg',
    firefox: 'https://api.iconify.design/logos:firefox.svg',
    vlc: 'https://api.iconify.design/logos:vlc.svg'
};

function getFallbackIcon(appId, title, artist = '', windowTitle = '') {
    const id = appId ? appId.toLowerCase().replace('.exe', '') : '';
    const t = `${title || ''} ${artist || ''} ${windowTitle || ''}`.toLowerCase();

    // Priority 1: Detect streaming services from the title (works even in browsers)
    if (t.includes('netflix')) return APP_ICONS.netflix;
    if (t.includes('disney')) return APP_ICONS.disney;
    if (t.includes('crunchyroll')) return APP_ICONS.crunchyroll;
    if (t.includes('youtube') || t.includes('yt music')) return APP_ICONS.youtube;
    if (t.includes('spotify')) return APP_ICONS.spotify;
    if (t.includes('tiktok') || t.includes('tik tok')) return APP_ICONS.tiktok;
    if (t.includes('instagram')) return APP_ICONS.instagram;
    if (t.includes('twitch')) return APP_ICONS.twitch;
    if (t.includes('facebook')) return APP_ICONS.facebook;
    if (t.includes('twitter') || t.includes('x.com')) return APP_ICONS.x;
    if (t.includes('reddit')) return APP_ICONS.reddit;
    if (t.includes('snapchat')) return APP_ICONS.snapchat;
    if (t.includes('pinterest')) return APP_ICONS.pinterest;
    if (t.includes('linkedin')) return APP_ICONS.linkedin;
    if (t.includes('threads')) return APP_ICONS.threads;
    if (t.includes('bluesky') || t.includes('bsky')) return APP_ICONS.bluesky;
    if (t.includes('soundcloud')) return APP_ICONS.soundcloud;
    if (t.includes('deezer')) return APP_ICONS.deezer;

    // Priority 2: Detect from appId
    if (id.includes('spotify')) return APP_ICONS.spotify;
    if (id.includes('netflix')) return APP_ICONS.netflix;
    if (id.includes('tiktok')) return APP_ICONS.tiktok;
    if (id.includes('instagram')) return APP_ICONS.instagram;
    if (id.includes('twitch')) return APP_ICONS.twitch;
    if (id.includes('facebook')) return APP_ICONS.facebook;
    if (id.includes('twitter') || id.includes('x.com')) return APP_ICONS.x;
    if (id.includes('reddit')) return APP_ICONS.reddit;
    if (id.includes('snapchat')) return APP_ICONS.snapchat;
    if (id.includes('pinterest')) return APP_ICONS.pinterest;
    if (id.includes('linkedin')) return APP_ICONS.linkedin;
    if (id.includes('threads')) return APP_ICONS.threads;
    if (id.includes('bluesky') || id.includes('bsky')) return APP_ICONS.bluesky;
    if (id.includes('soundcloud')) return APP_ICONS.soundcloud;
    if (id.includes('deezer')) return APP_ICONS.deezer;
    if (id.includes('vlc')) return APP_ICONS.vlc;
    return null;
}

function shouldPreferServiceIcon(appId, title, artist) {
    const id = (appId || '').toLowerCase().replace('.exe', '');
    const t = (title || '').trim().toLowerCase();
    const a = (artist || '').trim().toLowerCase();

    if (!id) return false;

    const streamingServices = ['netflix', 'youtube', 'disney', 'crunchyroll', 'primevideo', 'deezer'];
    if (!streamingServices.some(service => id.includes(service))) {
        return false;
    }

    // Browser SMTC often returns a tiny favicon/browser icon instead of real artwork.
    // If the metadata is basically just the service name, prefer the service icon.
    return !t || !a || t === a || t === id || a === id;
}

function isSocialFallbackIcon(iconUrl) {
    return [
        APP_ICONS.tiktok,
        APP_ICONS.instagram,
        APP_ICONS.twitch,
        APP_ICONS.facebook,
        APP_ICONS.x,
        APP_ICONS.reddit,
        APP_ICONS.snapchat,
        APP_ICONS.pinterest,
        APP_ICONS.linkedin,
        APP_ICONS.threads,
        APP_ICONS.bluesky
    ].includes(iconUrl);
}

function getServiceArtStyle(size = 'large') {
    if (size === 'small') {
        return "box-sizing: border-box; object-fit: contain; background: #050505; padding: 8px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);";
    }

    return "box-sizing: border-box; object-fit: contain; background: #050505; padding: 16px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 5px 15px rgba(0,0,0,0.3);";
}

function getEffectiveMediaArt(data) {
    if (!data) return "";

    const appIcon = getFallbackIcon(data.appId, data.title, data.artist, data.windowTitle);
    const preferServiceIcon = shouldPreferServiceIcon(data.appId, data.title, data.artist);
    if (appIcon && (preferServiceIcon || isSocialFallbackIcon(appIcon))) {
        return appIcon;
    }

    return data.cover || "";
}

function getRawDisplayMediaArt(data) {
    if (!data) return "";
    return getEffectiveMediaArt(data) || data.transientCover || getFallbackIcon(data.appId, data.title, data.artist, data.windowTitle) || "";
}

function getDisplayMediaArt(data) {
    if (!data) return "";
    return data.displayCover || getRawDisplayMediaArt(data);
}

const MIXER_ICONS = {
    spotify: APP_ICONS.spotify,
    discord: 'https://api.iconify.design/logos:discord-icon.svg',
    chrome: APP_ICONS.chrome,
    edge: APP_ICONS.edge,
    firefox: APP_ICONS.firefox,
    vlc: APP_ICONS.vlc,
    steam: 'https://api.iconify.design/logos:steam-icon.svg',
    youtube: APP_ICONS.youtube,
    netflix: APP_ICONS.netflix,
    deezer: APP_ICONS.deezer,
    tiktok: APP_ICONS.tiktok,
    instagram: APP_ICONS.instagram,
    twitch: APP_ICONS.twitch,
    facebook: APP_ICONS.facebook,
    x: APP_ICONS.x,
    reddit: APP_ICONS.reddit,
    snapchat: APP_ICONS.snapchat,
    pinterest: APP_ICONS.pinterest,
    linkedin: APP_ICONS.linkedin,
    threads: APP_ICONS.threads,
    bluesky: APP_ICONS.bluesky,
    soundcloud: APP_ICONS.soundcloud
};

function getMixerIcon(name, title) {
    const n = (name || '').toLowerCase();
    const t = (title || '').toLowerCase();

    // In the mixer, show the app icon first. A Chrome tab can play YouTube,
    // but the session volume still belongs to Chrome.
    if (n.includes('spotify')) return MIXER_ICONS.spotify;
    if (n.includes('discord')) return MIXER_ICONS.discord;
    if (n.includes('tiktok')) return MIXER_ICONS.tiktok;
    if (n.includes('instagram')) return MIXER_ICONS.instagram;
    if (n.includes('twitch')) return MIXER_ICONS.twitch;
    if (n.includes('facebook')) return MIXER_ICONS.facebook;
    if (n.includes('twitter') || n.includes('x.com')) return MIXER_ICONS.x;
    if (n.includes('reddit')) return MIXER_ICONS.reddit;
    if (n.includes('snapchat')) return MIXER_ICONS.snapchat;
    if (n.includes('pinterest')) return MIXER_ICONS.pinterest;
    if (n.includes('linkedin')) return MIXER_ICONS.linkedin;
    if (n.includes('threads')) return MIXER_ICONS.threads;
    if (n.includes('bluesky') || n.includes('bsky')) return MIXER_ICONS.bluesky;
    if (n.includes('soundcloud')) return MIXER_ICONS.soundcloud;
    if (n.includes('chrome')) return MIXER_ICONS.chrome;
    if (n.includes('msedge') || n.includes('edge')) return MIXER_ICONS.edge;
    if (n.includes('firefox')) return MIXER_ICONS.firefox;
    if (n.includes('vlc')) return MIXER_ICONS.vlc;
    if (n.includes('steam')) return MIXER_ICONS.steam;

    if (t.includes('youtube')) return MIXER_ICONS.youtube;
    if (t.includes('spotify')) return MIXER_ICONS.spotify;
    if (t.includes('discord')) return MIXER_ICONS.discord;
    if (t.includes('netflix')) return MIXER_ICONS.netflix;
    if (t.includes('deezer')) return MIXER_ICONS.deezer;
    if (t.includes('tiktok') || t.includes('tik tok')) return MIXER_ICONS.tiktok;
    if (t.includes('instagram')) return MIXER_ICONS.instagram;
    if (t.includes('twitch')) return MIXER_ICONS.twitch;
    if (t.includes('facebook')) return MIXER_ICONS.facebook;
    if (t.includes('twitter') || t.includes('x.com')) return MIXER_ICONS.x;
    if (t.includes('reddit')) return MIXER_ICONS.reddit;
    if (t.includes('snapchat')) return MIXER_ICONS.snapchat;
    if (t.includes('pinterest')) return MIXER_ICONS.pinterest;
    if (t.includes('linkedin')) return MIXER_ICONS.linkedin;
    if (t.includes('threads')) return MIXER_ICONS.threads;
    if (t.includes('bluesky') || t.includes('bsky')) return MIXER_ICONS.bluesky;
    if (t.includes('soundcloud')) return MIXER_ICONS.soundcloud;
    
    return null;
}

const MOTION_LEVELS = ['sober', 'fluid', 'vivid'];
const MOTION_LABELS = {
    sober: 'Sobre',
    fluid: 'Fluide',
    vivid: 'Vivante'
};

const DEFAULT_CONTROL_SHORTCUTS = [
    { name: "Explorer", preset: "explorer", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
    { name: "Settings", preset: "settings", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
    { name: "TaskMgr", preset: "taskmgr", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
    { name: "Calc", preset: "calc", icon: "ph-fill ph-calculator", cmd: "calc.exe" }
];



export class DynamicIsland {
    constructor() {
        window.island = this; // Bind globally for absolute safety!
        this.el = document.getElementById('dynamic-island');
        this.dragSurface = document.getElementById('layout-drag-surface');
        this.content = this.el.querySelector('.island-content');
        this.isExpanded = false;
        this.isPlaying = false;
        this.mode = 'music';
        this.timerValue = 0;
        this.isTimerRunning = false;
        this.fps = 60;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.isBackgroundMode = false;
        this.lastMediaUpdate = Date.now();

        // Audio visualizer state
        this._vizBands = [0, 0, 0, 0, 0];
        this._vizUnsub = null;
        this._vizCanvas = null;
        this._vizRaf = null;
        this._mediaPollTimer = null;
        this._smoothTimer = null;
        this._mediaPollingActive = false;
        this._smoothLoopActive = false;

        // Album art color sync state
        this._coverColors = null;
        this._lastCoverUrl = null;
        this._preloadedMediaArt = new Set();
        this._pendingMediaArt = new Set();
        this._lastStableDisplayArt = "";
        this._islandConfig = JSON.parse(localStorage.getItem('liquid_island_config') || '{}');
        this._lastRenderedTrack = null;
        this._lastTrackId = null;
        this._isNewTrackSignal = false;
        this._pendingCoverAnimationTrackKey = "";
        this._layoutConfig = JSON.parse(localStorage.getItem('liquid_layout_config') || '{"scale":1}');
        this._layoutEditMode = false;
        this._layoutEditArmTimeout = null;
        this.musicHistory = this.loadMusicHistory();

        // Audio sessions mixer state
        this.audioSessions = [];
        this.isScrubbingMixer = false;
        this.scrubbingPid = null;
        this.audioDevices = [];
        this.isAudioDeviceDropdownOpen = false;
        this.audioInputDevices = [];
        this.isMicDeviceDropdownOpen = false;
        this._transitionInProgress = false;
        this._transitionToken = 0;
        this._controlSliderCleanup = null;
        this._mediaControlPendingUntil = 0;
        this._mediaControlExpectedIsPlaying = null;
        this._mediaControlPendingTrackKey = "";
        this._mediaStateRequestInFlight = false;
        this._lastMixerRowCount = null;
        this._isTransitioning = false; // Flag to prevent layout reflow lag during size transitions

        this.renderIdle();
        this.applyLayoutConfig(this._layoutConfig);
        this.initEvents();
        this.startMainLoop();
        this.startProgressSmoothLoop();
        this.syncPersistentSetting();
        this.syncMotionPreference();

        // Register global keyboard shortcut listener on Electron main process at boot
        const startupShortcut = localStorage.getItem('liquid_island_shortcut') || 'Alt+I';
        if (ipcRenderer) {
            try {
                
                ipcRenderer.send('register-shortcut', startupShortcut);
            } catch (err) {}
        }

        // Apply persistent modes on load
        if (localStorage.getItem('liquid_focus_mode') === 'true') {
            document.body.classList.add('focus-mode-active');
        }

        // Start visualizer service (simulation until audio is playing)
        this._startVisualizer();
    }

    _startVisualizer() {
        // Start the service (it will use simulation mode by default)
        visualizerService.start().catch(() => {});

        // Subscribe to data
        this._vizUnsub = visualizerService.subscribe((data) => {
            // Smooth the bands with exponential moving average
            const alpha = 0.35;
            for (let i = 0; i < 5; i++) {
                this._vizBands[i] = this._vizBands[i] * (1 - alpha) + (data.bands[i] || 0) * alpha;
            }
            this._updateVizCanvas();
        });

        this.syncVisualizerActivity();
    }

    syncVisualizerActivity() {
        const canvas = this._vizCanvas;
        const hasVisibleCanvas = Boolean(canvas && canvas.isConnected && canvas.width > 0 && canvas.height > 0);
        visualizerService.setActive(hasVisibleCanvas);

        if (hasVisibleCanvas) {
            this._updateVizCanvas();
        }
    }

    applyLayoutConfig(layout) {
        this._layoutConfig = {
            ...this._layoutConfig,
            ...(layout || {})
        };

        const container = document.getElementById('dynamic-island-container');
        if (!container) return;

        const scale = Number(this._layoutConfig.scale);
        const safeScale = Number.isFinite(scale) ? Math.min(1.5, Math.max(0.65, scale)) : 1;
        container.style.setProperty('--island-layout-scale', safeScale.toString());
    }

    getMotionLevel() {
        const saved = localStorage.getItem('liquid_motion_level') || 'fluid';
        return MOTION_LEVELS.includes(saved) ? saved : 'fluid';
    }

    syncMotionPreference() {
        const level = this.getMotionLevel();
        document.body.classList.remove('motion-sober', 'motion-fluid', 'motion-vivid');
        document.body.classList.add(`motion-${level}`);
        return level;
    }

    getDefaultProfiles() {
        return [
            {
                id: 'gaming',
                name: 'Gaming',
                icon: 'ph-game-controller',
                locked: true,
                settings: {
                    motion: 'sober',
                    persistent: true,
                    notifications: false,
                    coverSync: false,
                    controlEnabled: false,
                    widgetType: 'stats',
                    layout: { scale: 0.72 },
                    appConfig: {
                        preset: 'cyberpunk',
                        modules: { music: false, timer: false, search: false, network: false },
                        glow: { opacity: 78, blur: 10, glowEnabled: false, glowDensity: 8, glowColor: '#00f3ff', bgImage: '', imgOpacity: 100, vizColorMode: 'cyberpunk', vizColorSolid: '#00f3ff', vizColorGradA: '#00f3ff', vizColorGradB: '#ff00ff' }
                    }
                }
            },
            {
                id: 'work',
                name: 'Travail',
                icon: 'ph-briefcase',
                locked: true,
                settings: {
                    motion: 'fluid',
                    persistent: true,
                    notifications: true,
                    coverSync: false,
                    controlEnabled: true,
                    widgetType: 'launchpad',
                    layout: { scale: 1 },
                    appConfig: {
                        preset: 'cyberpunk',
                        modules: { music: true, timer: true, search: false, network: false },
                        glow: { opacity: 90, blur: 22, glowEnabled: true, glowDensity: 14, glowColor: '#00f3ff', bgImage: '', imgOpacity: 100, vizColorMode: 'solid', vizColorSolid: '#00f3ff', vizColorGradA: '#00f3ff', vizColorGradB: '#ff00ff' }
                    }
                }
            },
            {
                id: 'music',
                name: 'Musique',
                icon: 'ph-music-notes',
                locked: true,
                settings: {
                    motion: 'vivid',
                    persistent: true,
                    notifications: true,
                    coverSync: true,
                    controlEnabled: true,
                    widgetType: 'mixer',
                    layout: { scale: 1 },
                    appConfig: {
                        preset: 'cyberpunk',
                        modules: { music: true, timer: false, search: false, network: false },
                        glow: { opacity: 94, blur: 30, glowEnabled: true, glowDensity: 28, glowColor: '#00f3ff', bgImage: '', imgOpacity: 100, vizColorMode: 'cover', vizColorSolid: '#00f3ff', vizColorGradA: '#00f3ff', vizColorGradB: '#ff00ff' }
                    }
                }
            }
        ];
    }

    loadCustomProfiles() {
        try {
            const profiles = JSON.parse(localStorage.getItem('liquid_custom_profiles') || '[]');
            return Array.isArray(profiles) ? profiles.filter(profile => profile && profile.id && profile.settings) : [];
        } catch (e) {
            return [];
        }
    }

    saveCustomProfiles(profiles) {
        localStorage.setItem('liquid_custom_profiles', JSON.stringify((profiles || []).filter(profile => !profile.locked)));
    }

    loadProfiles() {
        const reservedIds = new Set(this.getDefaultProfiles().map(profile => profile.id));
        const custom = this.loadCustomProfiles().filter(profile => !reservedIds.has(profile.id));
        return [...this.getDefaultProfiles(), ...custom];
    }

    getActiveProfileId() {
        return localStorage.getItem('liquid_active_profile') || 'music';
    }

    getSavedAppConfig() {
        const fallbackGlow = { opacity: 92, blur: 30, glowEnabled: true, glowDensity: 20, glowColor: '#00f3ff', bgImage: '', imgOpacity: 100, vizColorMode: 'cover', vizColorSolid: '#00f3ff', vizColorGradA: '#00f3ff', vizColorGradB: '#ff00ff' };
        const fallbackModules = {
            music: localStorage.getItem('liquid_music_enabled') !== 'false',
            timer: localStorage.getItem('liquid_island_timer_enabled') !== 'false',
            search: false,
            network: false
        };

        let standalone = {};
        let glowOnly = {};
        try { standalone = JSON.parse(localStorage.getItem('island_standalone_config') || '{}'); } catch (e) {}
        try { glowOnly = JSON.parse(localStorage.getItem('liquid_island_config') || '{}'); } catch (e) {}

        return {
            preset: standalone.preset || 'cyberpunk',
            modules: { ...fallbackModules, ...(standalone.modules || {}) },
            glow: { ...fallbackGlow, ...(standalone.glow || glowOnly || {}) }
        };
    }

    getCurrentSettingsSnapshot() {
        return {
            appConfig: this.getSavedAppConfig(),
            persistent: localStorage.getItem('liquid_island_persistent') === 'true',
            notifications: localStorage.getItem('liquid_notifications_enabled') !== 'false',
            coverSync: localStorage.getItem('liquid_cover_color_sync') !== 'false',
            controlEnabled: localStorage.getItem('liquid_island_control_enabled') !== 'false',
            widgetType: localStorage.getItem('liquid_control_widget_type') || 'launchpad',
            shortcuts: JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(DEFAULT_CONTROL_SHORTCUTS)),
            shortcut: localStorage.getItem('liquid_island_shortcut') || 'Alt+I',
            motion: this.getMotionLevel(),
            layout: this._layoutConfig || { scale: 1 }
        };
    }

    applySettingsSnapshot(snapshot = {}) {
        const appConfig = snapshot.appConfig || { preset: 'cyberpunk', modules: snapshot.modules || {}, glow: snapshot.glow || {} };
        const glow = { ...this.getSavedAppConfig().glow, ...(appConfig.glow || {}) };
        const modules = { ...this.getSavedAppConfig().modules, ...(appConfig.modules || {}) };
        const normalizedConfig = { preset: appConfig.preset || 'cyberpunk', modules, glow };

        localStorage.setItem('island_standalone_config', JSON.stringify(normalizedConfig));
        localStorage.setItem('liquid_island_config', JSON.stringify(glow));
        localStorage.setItem('liquid_music_enabled', modules.music !== false);
        localStorage.setItem('liquid_island_timer_enabled', modules.timer !== false);
        localStorage.setItem('liquid_island_control_enabled', snapshot.controlEnabled !== false);
        localStorage.setItem('liquid_island_persistent', snapshot.persistent === true);
        localStorage.setItem('liquid_notifications_enabled', snapshot.notifications !== false);
        localStorage.setItem('liquid_cover_color_sync', snapshot.coverSync !== false);
        localStorage.setItem('liquid_control_widget_type', snapshot.widgetType || 'launchpad');
        localStorage.setItem('liquid_control_shortcuts', JSON.stringify(snapshot.shortcuts || DEFAULT_CONTROL_SHORTCUTS));
        localStorage.setItem('liquid_island_shortcut', snapshot.shortcut || localStorage.getItem('liquid_island_shortcut') || 'Alt+I');
        localStorage.setItem('liquid_motion_level', MOTION_LEVELS.includes(snapshot.motion) ? snapshot.motion : 'fluid');

        this._islandConfig = glow;
        this.applyLayoutConfig(snapshot.layout || { scale: 1 });
        this.syncMotionPreference();
        this.syncPersistentSetting();
        ThemeService.applyIslandSettings();
        window.dispatchEvent(new CustomEvent('liquid-island-config-changed', { detail: glow }));

        
        if (ipcRenderer) {
            ipcRenderer.send('config-changed', normalizedConfig);
            try { ipcRenderer.send('register-shortcut', snapshot.shortcut || 'Alt+I'); } catch (e) {}
        }
    }

    applyProfile(profileId) {
        const profile = this.loadProfiles().find(item => item.id === profileId);
        if (!profile) return;
        localStorage.setItem('liquid_active_profile', profile.id);
        this.applySettingsSnapshot(profile.settings);
        SoundService.play('success');
        this.showIslandFeedback(`Profil ${profile.name} applique`, 'ph-user-switch');
        this.renderSettings();
    }

    createProfileFromCurrent(name) {
        const cleanName = String(name || '').trim().slice(0, 24);
        if (!cleanName) {
            this.showIslandFeedback('Nom de profil manquant', 'ph-warning-circle');
            return;
        }

        const profiles = this.loadCustomProfiles();
        const id = `custom-${Date.now()}`;
        profiles.push({
            id,
            name: cleanName,
            icon: 'ph-user-circle',
            locked: false,
            settings: this.getCurrentSettingsSnapshot()
        });
        this.saveCustomProfiles(profiles);
        localStorage.setItem('liquid_active_profile', id);
        SoundService.play('success');
        this.showIslandFeedback('Profil cree', 'ph-floppy-disk');
        this.renderSettings();
    }

    deleteProfile(profileId) {
        const profile = this.loadProfiles().find(item => item.id === profileId);
        if (!profile || profile.locked) {
            this.showIslandFeedback('Profil systeme protege', 'ph-lock');
            return;
        }

        const profiles = this.loadCustomProfiles().filter(item => item.id !== profileId);
        this.saveCustomProfiles(profiles);
        if (this.getActiveProfileId() === profileId) {
            localStorage.setItem('liquid_active_profile', 'music');
        }
        SoundService.play('close');
        this.showIslandFeedback('Profil supprime', 'ph-trash');
        this.renderSettings();
    }

    exportAppSettings() {
        const payload = {
            type: 'liquid-dynamic-island-settings',
            version: 1,
            exportedAt: new Date().toISOString(),
            activeProfile: this.getActiveProfileId(),
            settings: this.getCurrentSettingsSnapshot(),
            profiles: this.loadCustomProfiles(),
            musicHistory: this.loadMusicHistory()
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `liquid-island-settings-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        navigator.clipboard?.writeText(json).catch(() => {});
        this.showIslandFeedback('Reglages exportes', 'ph-download-simple');
    }

    importAppSettingsFromFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const payload = JSON.parse(String(reader.result || '{}'));
                if (payload.type !== 'liquid-dynamic-island-settings' && !payload.settings) {
                    throw new Error('Unsupported settings file');
                }

                if (Array.isArray(payload.profiles)) {
                    this.saveCustomProfiles(payload.profiles.filter(profile => profile && profile.id && profile.settings));
                }
                if (Array.isArray(payload.musicHistory)) {
                    localStorage.setItem('liquid_music_history', JSON.stringify(payload.musicHistory.slice(0, 20)));
                    this.musicHistory = this.loadMusicHistory();
                }
                if (payload.activeProfile) {
                    localStorage.setItem('liquid_active_profile', payload.activeProfile);
                }
                if (payload.settings) {
                    this.applySettingsSnapshot(payload.settings);
                }

                SoundService.play('success');
                this.showIslandFeedback('Import termine', 'ph-upload-simple');
                this.renderSettings();
            } catch (e) {
                this.showIslandFeedback('Import impossible', 'ph-warning-circle');
            }
        };
        reader.readAsText(file);
    }

    setLayoutEditMode(enabled) {
        this._layoutEditMode = Boolean(enabled);
        document.body.classList.toggle('layout-edit-mode', this._layoutEditMode);

        if (this._layoutEditMode) {
            this.closeContextMenu();
            this.isExpanded = false;
            this.renderIdle();
            if (ipcRenderer) {
                try {
                    ipcRenderer.send('set-ignore-mouse', false);
                } catch (e) {}
            }
            document.body.classList.remove('layout-edit-armed');
            void document.body.offsetWidth;
            document.body.classList.add('layout-edit-armed');
            clearTimeout(this._layoutEditArmTimeout);
            this._layoutEditArmTimeout = setTimeout(() => {
                document.body.classList.remove('layout-edit-armed');
            }, 1600);
        } else {
            document.body.classList.remove('layout-edit-dragging');
            document.body.classList.remove('layout-edit-armed');
            clearTimeout(this._layoutEditArmTimeout);
        }
    }

    preloadMediaArt(artUrl, onReady) {
        if (!artUrl || this._preloadedMediaArt.has(artUrl)) {
            if (onReady) onReady();
            return;
        }

        if (this._pendingMediaArt.has(artUrl)) return;
        this._pendingMediaArt.add(artUrl);

        const img = new Image();
        if (artUrl.startsWith('http') || artUrl.startsWith('https')) {
            img.crossOrigin = "Anonymous";
        }

        const finish = (loaded) => {
            this._pendingMediaArt.delete(artUrl);
            if (loaded) this._preloadedMediaArt.add(artUrl);
            if (loaded && onReady) onReady();
        };

        img.onload = async () => {
            try {
                if (img.decode) await img.decode();
            } catch (e) {}
            finish(true);
        };
        img.onerror = () => finish(false);
        img.src = artUrl;
    }

    getStableDisplayArt(data) {
        const nextArt = getRawDisplayMediaArt(data);
        if (!nextArt) {
            this._lastStableDisplayArt = "";
            return "";
        }

        if (isSocialFallbackIcon(nextArt) || nextArt.startsWith('data:') || this._preloadedMediaArt.has(nextArt) || !this._lastStableDisplayArt) {
            this._lastStableDisplayArt = nextArt;
            this.preloadMediaArt(nextArt);
            return nextArt;
        }

        const preloadTrackKey = data.trackKey || getMusicHistoryKey(data);
        this.preloadMediaArt(nextArt, () => {
            const activeArt = getRawDisplayMediaArt(this.musicData);
            if (activeArt !== nextArt) return;
            const activeTrackKey = this.musicData ? (this.musicData.trackKey || getMusicHistoryKey(this.musicData)) : "";
            if (preloadTrackKey && activeTrackKey && preloadTrackKey !== activeTrackKey) return;

            this._lastStableDisplayArt = nextArt;
            this.musicData = {
                ...this.musicData,
                displayCover: nextArt,
                previousDisplayCover: "",
                animateCover: false
            };
            this._isNewTrackSignal = false;
            if (this._pendingCoverAnimationTrackKey === activeTrackKey) {
                this._pendingCoverAnimationTrackKey = "";
            }
            if (this._lastRenderedTrack) {
                this._lastRenderedTrack.cover = nextArt;
            }

            if (this.isExpanded && this.mode === 'music') {
                this.renderMusic();
            } else if (this.isExpanded && this.mode === 'control') {
                this.updateControlCenterCover(nextArt);
            } else if (!this.isExpanded) {
                this.renderIdle();
            }

            this.syncGlobalCoverAesthetics();
        });

        return this._lastStableDisplayArt;
    }

    updateControlCenterCover(artUrl) {
        const npCover = document.getElementById('ic-np-cover-img');
        if (!npCover || !artUrl) return;

        if (npCover.tagName === 'IMG') {
            npCover.src = artUrl;
            return;
        }

        const parent = npCover.parentNode;
        if (!parent) return;

        const img = document.createElement('img');
        img.id = 'ic-np-cover-img';
        img.className = 'ic-np-cover';
        img.src = artUrl;
        parent.replaceChild(img, npCover);
    }

    _extractColorsFromCover(coverUrl) {
        if (!coverUrl) {
            this._coverColors = null;
            return;
        }

        const img = new Image();
        if (coverUrl.startsWith('http') || coverUrl.startsWith('https')) {
            img.crossOrigin = "Anonymous";
        }
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 10;
                canvas.height = 10;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 10, 10);
                const imgData = ctx.getImageData(0, 0, 10, 10).data;

                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                let maxVibrancy = -1;
                let vibrantColor = null;

                for (let i = 0; i < imgData.length; i += 4) {
                    const r = imgData[i];
                    const g = imgData[i+1];
                    const b = imgData[i+2];
                    const a = imgData[i+3];

                    if (a < 200) continue; // skip transparent

                    rSum += r;
                    gSum += g;
                    bSum += b;
                    count++;

                    const maxVal = Math.max(r, g, b);
                    const minVal = Math.min(r, g, b);
                    const vibrancy = maxVal - minVal;
                    if (vibrancy > maxVibrancy) {
                        maxVibrancy = vibrancy;
                        vibrantColor = { r, g, b };
                    }
                }

                if (count > 0) {
                    const avgColor = {
                        r: Math.round(rSum / count),
                        g: Math.round(gSum / count),
                        b: Math.round(bSum / count)
                    };

                    const primary = vibrantColor && maxVibrancy > 30 ? vibrantColor : avgColor;
                    
                    let secondary = avgColor;
                    if (primary === avgColor && vibrantColor && maxVibrancy > 20) {
                        secondary = vibrantColor;
                    } else if (primary.r === secondary.r && primary.g === secondary.g && primary.b === secondary.b) {
                        secondary = {
                            r: Math.min(255, primary.r + 50),
                            g: Math.min(255, primary.g + 30),
                            b: Math.max(0, primary.b - 50)
                        };
                    }

                    this._coverColors = { primary, secondary };
                    this.applyCoverTheme();
                } else {
                    this._coverColors = null;
                    this.restorePresetTheme();
                }
            } catch (e) {
                console.error("Failed to extract colors from cover:", e);
                this._coverColors = null;
                this.restorePresetTheme();
            }
        };
        img.onerror = () => {
            this._coverColors = null;
            this.restorePresetTheme();
        };
        img.src = coverUrl;
    }

    _updateVizCanvas() {
        const canvas = this._vizCanvas;
        if (!canvas || !canvas.isConnected) {
            this.syncVisualizerActivity();
            return;
        }

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width;
        const h = canvas.height;
        const bands = this._vizBands;
        const numBars = bands.length;

        ctx.clearRect(0, 0, w, h);

        // Use more bars by interpolating between our 5 band values
        const totalBars = Math.max(numBars, Math.floor(w / 6));
        const barW = Math.max(2, Math.floor((w - (totalBars - 1) * 1) / totalBars));
        const gap = 1;

        const vizColorMode = this._islandConfig.vizColorMode || 'cyberpunk';

        // Optimize: pre-parse colors outside the loop to avoid regex parsing 60 times per frame!
        let solidRgb = null;
        let gradARgb = null;
        let gradBRgb = null;
        
        if (vizColorMode === 'solid') {
            const hex = this._islandConfig.vizColorSolid || '#00f3ff';
            solidRgb = hexToRgb(hex);
        } else if (vizColorMode === 'gradient') {
            const hexA = this._islandConfig.vizColorGradA || '#00f3ff';
            const hexB = this._islandConfig.vizColorGradB || '#ff00ff';
            gradARgb = hexToRgb(hexA);
            gradBRgb = hexToRgb(hexB);
        }

        for (let i = 0; i < totalBars; i++) {
            // Interpolate band value
            const t = i / (totalBars - 1);
            const bandIdx = t * (numBars - 1);
            const b0 = Math.floor(bandIdx);
            const b1 = Math.min(numBars - 1, b0 + 1);
            const frac = bandIdx - b0;
            const bandVal = bands[b0] * (1 - frac) + bands[b1] * frac;

            const barH = Math.max(2, bandVal * h);
            const x = i * (barW + gap);
            const y = h - barH;

            let r, g, b;
            if (vizColorMode === 'cover') {
                if (this._coverColors) {
                    const c1 = this._coverColors.primary;
                    const c2 = this._coverColors.secondary;
                    r = Math.round(c1.r * (1 - t) + c2.r * t);
                    g = Math.round(c1.g * (1 - t) + c2.g * t);
                    b = Math.round(c1.b * (1 - t) + c2.b * t);
                } else {
                    r = Math.round(t < 0.5 ? (t * 2 * 255) : 255);
                    g = Math.round(t < 0.5 ? 243 : (1 - (t - 0.5) * 2) * 200);
                    b = 255;
                }
            } else if (vizColorMode === 'solid') {
                if (solidRgb) {
                    r = solidRgb.r;
                    g = solidRgb.g;
                    b = solidRgb.b;
                } else {
                    r = 0; g = 243; b = 255;
                }
            } else if (vizColorMode === 'gradient') {
                if (gradARgb && gradBRgb) {
                    r = Math.round(gradARgb.r * (1 - t) + gradBRgb.r * t);
                    g = Math.round(gradARgb.g * (1 - t) + gradBRgb.g * t);
                    b = Math.round(gradARgb.b * (1 - t) + gradBRgb.b * t);
                } else {
                    r = 0; g = 243; b = 255;
                }
            } else {
                // Default: cyberpunk
                r = Math.round(t < 0.5 ? (t * 2 * 255) : 255);
                g = Math.round(t < 0.5 ? 243 : (1 - (t - 0.5) * 2) * 200);
                b = 255;
            }

            const alpha = 0.65 + bandVal * 0.35;

            const grad = ctx.createLinearGradient(0, y, 0, h);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`);

            ctx.fillStyle = grad;

            // Draw rounded bar (compatible with all Chromium versions)
            const radius = Math.min(barW / 2, 2);
            ctx.beginPath();
            if (barH <= radius * 2) {
                ctx.arc(x + barW / 2, y + barH / 2, Math.max(1, barH / 2), 0, Math.PI * 2);
            } else {
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + barW - radius, y);
                ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
                ctx.lineTo(x + barW, y + barH);
                ctx.lineTo(x, y + barH);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Dynamic glow sync with cover color if vizColorMode is 'cover'
        if (vizColorMode === 'cover' && this._coverColors && this._islandConfig.glowEnabled !== false) {
            const primaryHex = rgbToHex(this._coverColors.primary.r, this._coverColors.primary.g, this._coverColors.primary.b);
            const primaryRgbStr = `${this._coverColors.primary.r}, ${this._coverColors.primary.g}, ${this._coverColors.primary.b}`;
            const size = this._islandConfig.glowDensity || 20;
            const island = document.getElementById('dynamic-island');
            if (island) {
                island.style.setProperty('--island-glow-color', primaryHex);
                island.style.setProperty('--island-glow-rgb', primaryRgbStr);
                if (this.musicData && this.musicData.isPlaying) {
                    island.style.boxShadow = '';
                } else {
                    island.style.boxShadow = ThemeService.buildIslandShadow(size, primaryRgbStr, true);
                }
            }
        }
    }

    initEvents() {
        // Right-click context menu listener
        this.el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Allow mouse capture
            if (ipcRenderer) {
                ipcRenderer.send('set-ignore-mouse', false);
            }
            
            this.showContextMenu(e.clientX, e.clientY);
        });


        this.el.addEventListener('click', (e) => {
            if (this._layoutEditMode) return;
            if (this.isExpanded && (this.mode === 'search' || this.mode === 'music-search' || this.mode === 'music-history' || this.mode === 'control' || this.mode === 'mixer')) return; // Don't toggle expansion on interactive screens

            if (this.mode === 'ai-thinking' || this.mode === 'ai-action') {
                window.dispatchEvent(new CustomEvent('liquid-open-widget', { detail: 'ai' }));
                return;
            }

            if (this.mode === 'notification') {
                this.mode = this.previousMode || 'music';
            }
            this.toggleExpand();
        });

        const dragPointerTarget = this.dragSurface || this.el;
        dragPointerTarget.addEventListener('mousedown', (e) => {
            if (!this._layoutEditMode || e.button !== 0) return;
            document.body.classList.add('layout-edit-dragging');
        });

        document.addEventListener('mouseup', () => {
            document.body.classList.remove('layout-edit-dragging');
        });

        window.addEventListener('blur', () => {
            document.body.classList.remove('layout-edit-dragging');
        });

        // Permanent delegated mousedown listener for progress bar scrubbing (persists across re-renders)
        this.content.addEventListener('mousedown', (e) => {
            const progBar = e.target.closest('.progress-bar');
            if (progBar) {
                e.stopPropagation();
                e.preventDefault(); // Prevent text selection during drag
                
                this.isScrubbing = true;
                this.scrubbingBar = progBar;
                progBar.classList.add('active');
                
                // Instant visual seek feedback on mouse down
                this.updateScrubPosition(e);
            }
        });

        // Permanent delegated mousedown listener for session volume scrubbing in the mixer mode
        this.content.addEventListener('mousedown', (e) => {
            const slider = e.target.closest('.mixer-volume-slider, .ic-mixer-slider');
            if (slider) {
                e.stopPropagation();
                e.preventDefault();

                const pid = parseInt(slider.getAttribute('data-pid'));
                this.isScrubbingMixer = true;
                this.scrubbingPid = pid;
                this.activeMixerSlider = slider;
                
                // Track volume change
                this.updateMixerScrub(e);
            }
        });

        // Global mousemove listener for dragging progress bar or mixer volume
        document.addEventListener('mousemove', (e) => {
            if (this.isScrubbing && this.scrubbingBar) {
                e.stopPropagation();
                e.preventDefault();
                this.updateScrubPosition(e);
            } else if (this.isScrubbingMixer && this.activeMixerSlider) {
                e.stopPropagation();
                e.preventDefault();
                this.updateMixerScrub(e);
            }
        });

        // Global mouseup listener to commit progress bar seek or mixer volume drag
        document.addEventListener('mouseup', (e) => {
            if (this.isScrubbing && this.scrubbingBar) {
                e.stopPropagation();
                e.preventDefault();
                
                this.isScrubbing = false;
                this.scrubbingBar.classList.remove('active');
                
                const data = this.musicData;
                if (data && data.duration) {
                    const pct = parseFloat(this.scrubbingBar.style.getPropertyValue('--progress-pct')) / 100;
                    const targetMs = Math.round(pct * data.duration);
                    
                    console.log('[Scrubber Drag] Seek completed! pct:', pct, 'targetMs:', targetMs);
                    
                    // Force local progress updates to persist seek position immediately
                    this.musicData.progress = targetMs;
                    this.lastMediaUpdate = Date.now();
                    
                    // Suppress incoming system state updates for 1500ms to allow player core buffer sync
                    this.suppressProgressUpdatesUntil = Date.now() + 1500;
                    
                    // Execute seek via C# core bridge
                    window.spotifyControl('seek ' + targetMs);
                }
                this.scrubbingBar = null;
            } else if (this.isScrubbingMixer) {
                e.stopPropagation();
                e.preventDefault();
                
                this.isScrubbingMixer = false;
                this.scrubbingPid = null;
                this.activeMixerSlider = null;
            }
        });

        // Prevent click events on specific child elements from bubbling and collapsing the island
        this.content.addEventListener('click', (e) => {
            if (e.target.closest('.progress-bar, .music-search-panel, .music-history-panel, .mixer-volume-slider, .ic-mixer-slider, .mixer-mute-btn, .ic-mixer-mute')) {
                e.stopPropagation();
                e.preventDefault();
            }

            // Click listener for session mute toggles
            const muteBtn = e.target.closest('.mixer-mute-btn, .ic-mixer-mute');
            if (muteBtn) {
                const pid = parseInt(muteBtn.getAttribute('data-pid'));
                const isMuted = muteBtn.classList.contains('muted');
                this.toggleSessionMute(pid, !isMuted);
            }
        });

        // Permanent delegated mousemove listener for progress bar hover (elastic remaining time tooltip)
        this.content.addEventListener('mousemove', (e) => {
            const progBar = e.target.closest('.progress-bar');
            if (progBar && this.musicData && this.musicData.duration) {
                const rect = progBar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const pct = Math.max(0, Math.min(100, (clickX / width) * 100));
                
                progBar.style.setProperty('--tooltip-pct', `${pct}%`);
                
                const tooltip = progBar.querySelector('#music-progress-tooltip');
                if (tooltip) {
                    const targetMs = Math.round((pct / 100) * this.musicData.duration);
                    tooltip.innerText = formatTime(targetMs);
                }
            }
        });

        // Close on click outside (Desktop)
        document.addEventListener('click', (e) => {
            if (this.isContextMenuOpen) {
                const menu = document.getElementById('island-context-menu');
                if (!menu || !menu.contains(e.target)) {
                    this.closeContextMenu();
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }
            }
            if (this.isExpanded && !this.el.contains(e.target)) {
                this.collapseIsland();
            }
        });

        // Close when the window loses focus (clicking on taskbar, desktop, or other apps)
        window.addEventListener('blur', () => {
            this.closeContextMenu();
            this.collapseIsland();
        });

        window.addEventListener('liquid-ai-status', (e) => {
            if (e.detail === 'search') {
                this.setMode('search');
                // Force expand for search
                if (!this.isExpanded) {
                    this.isExpanded = true;
                    this.el.classList.remove('island-idle');
                    this.el.classList.add('island-expanded');
                }
                this.renderContent();
                // Focus search input after expansion animation
                setTimeout(() => {
                    const input = this.el.querySelector('#island-search-input');
                    if (input) input.focus();
                }, 400);
            } else if (e.detail === 'idle' && this.mode === 'search') {
                this.setMode('music');
                if (this.isExpanded) this.toggleExpand();
            }
        });

        window.addEventListener('liquid-search-hide', () => {
            if (this.mode === 'search') {
                this.setMode('music');
                if (this.isExpanded) this.toggleExpand();
            }
        });

        // Listen for keyboard specifically for search when expanded
        window.addEventListener('keydown', (e) => {
            if (this.mode !== 'search' || !this.isExpanded) return;

            if (e.key === 'Escape') {
                window.dispatchEvent(new CustomEvent('liquid-search-close'));
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('liquid-search-navigate', { detail: 1 }));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('liquid-search-navigate', { detail: -1 }));
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('liquid-search-execute'));
            }
        });

        window.addEventListener('liquid-window-opened', () => {
            if (this.isExpanded) {
                this.mode = 'music';
                this.isExpanded = false;
                this.renderContent();
            }
        });

        window.addEventListener('liquid-island-config-changed', (e) => {
            this._islandConfig = e.detail;
            this._updateVizCanvas();
        });
        // --- Persistent Mode Logic ---
        if (ipcRenderer) {
            

            ipcRenderer.on('app-go-background', () => {
                this.isBackgroundMode = true;
                document.body.classList.add('liquid-background-mode');
                // Ensure island is active if it's supposed to be
                this.renderContent();
            });

            ipcRenderer.on('app-go-foreground', () => {
                this.isBackgroundMode = false;
                document.body.classList.remove('liquid-background-mode');
                this.renderContent();
            });

            ipcRenderer.on('open-search', () => {
                this.openSpotlightSearch();
            });

            // Hit testing for click-through
            this.el.addEventListener('mouseenter', () => {
                if (this.isBackgroundMode && (ipcRenderer)) {
                    ipcRenderer.send('set-ignore-mouse', false);
                }
            });

            this.el.addEventListener('mouseleave', () => {
                if (this.isBackgroundMode && (ipcRenderer)) {
                    ipcRenderer.send('set-ignore-mouse', true, { forward: true });
                }
            });

            window.addEventListener('liquid-island-persistent-changed', () => {
                this.syncPersistentSetting();
            });

            // --- Volume Scroll Support ---
            this.el.addEventListener('wheel', (e) => {
                // Allow scroll in idle or music mode
                if (this.isExpanded && this.mode !== 'music') return;

                e.preventDefault();
                const delta = e.deltaY < 0 ? 5 : -5;
                if (localStorage.getItem('liquid_player_wheel_app_volume') !== 'false') {
                    this.adjustCurrentMediaVolume(delta);
                } else {
                    this.adjustVolume(delta);
                }
            }, { passive: false });
        }
    }

    showContextMenu(x, y) {
        this.isContextMenuOpen = true;

        // Remove existing context menu if any
        const existing = document.getElementById('island-context-menu');
        if (existing) existing.remove();
        if (this._contextMenuCloseHandler) {
            document.removeEventListener('click', this._contextMenuCloseHandler, true);
            this._contextMenuCloseHandler = null;
        }

        // Boundary checking to prevent context menu clipping at Electron window edges (620x600)
        const menuWidth = 175;
        const menuHeight = 225;
        let adjustedX = x + menuWidth > 610 ? x - menuWidth : x;
        let adjustedY = y + menuHeight > 590 ? y - menuHeight : y;

        adjustedX = Math.max(10, adjustedX);
        adjustedY = Math.max(10, adjustedY);

        const menu = document.createElement('div');
        menu.id = 'island-context-menu';
        menu.className = 'context-menu';
        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;

        menu.innerHTML = `
            <div class="context-menu-item" data-action="music">
                <i class="ph-fill ph-music-notes"></i>
                <span>Mode Lecteur</span>
            </div>
            <div class="context-menu-item" data-action="control">
                <i class="ph-fill ph-sliders"></i>
                <span>Centre de Contrôle</span>
            </div>
            <div class="context-menu-item" data-action="mixer">
                <i class="ph-fill ph-sliders-horizontal"></i>
                <span>Mélangeur Audio</span>
            </div>
            <div class="context-menu-item" data-action="settings">
                <i class="ph-fill ph-gear"></i>
                <span>Réglages</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="play">
                <i class="ph-fill ph-play-pause"></i>
                <span>Lecture / Pause</span>
            </div>
            <div class="context-menu-item" data-action="next">
                <i class="ph-fill ph-skip-forward"></i>
                <span>Suivant</span>
            </div>
            <div class="context-menu-item" data-action="prev">
                <i class="ph-fill ph-skip-back"></i>
                <span>Précédent</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item danger" data-action="exit">
                <i class="ph-fill ph-power"></i>
                <span>Quitter l'Island</span>
            </div>
        `;

        // Prepend context-menu-bg dynamically so it stays behind items
        const bgLayer = document.createElement('div');
        bgLayer.className = 'context-menu-bg';
        const effectiveMenuArt = getDisplayMediaArt(this.musicData);
        if (effectiveMenuArt && effectiveMenuArt.length > 0) {
            bgLayer.style.backgroundImage = `url(${effectiveMenuArt})`;
            bgLayer.style.opacity = '0.35';
        }
        menu.insertBefore(bgLayer, menu.firstChild);

        document.body.appendChild(menu);

        // Bind clicks on context menu items
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                
                this.closeContextMenu();

                if (action === 'music') {
                    this.openExpandedMode('music');
                } else if (action === 'control') {
                    this.openExpandedMode('control');
                } else if (action === 'mixer') {
                    this.openExpandedMode('mixer');
                } else if (action === 'settings') {
                    this.setMode('settings');
                } else if (action === 'play') {
                    window.spotifyControl('toggle');
                } else if (action === 'next') {
                    window.spotifyControl('next');
                } else if (action === 'prev') {
                    window.spotifyControl('prev');
                } else if (action === 'exit') {
                    if (ipcRenderer) {
                        ipcRenderer.send('exit-app');
                    }
                }
            }
        });

        // Close only the context menu on outside click; don't collapse/toggle the island.
        this._contextMenuCloseHandler = (event) => {
            const activeMenu = document.getElementById('island-context-menu');
            if (activeMenu && activeMenu.contains(event.target)) return;

            event.stopPropagation();
            event.preventDefault();
            this.closeContextMenu();
        };
        // Delay attaching click listener to prevent immediate closing
        setTimeout(() => {
            if (this._contextMenuCloseHandler) {
                document.addEventListener('click', this._contextMenuCloseHandler, true);
            }
        }, 50);
    }

    updateScrubPosition(e) {
        if (!this.scrubbingBar) return;
        const rect = this.scrubbingBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const clickPct = Math.max(0, Math.min(1, clickX / width));
        
        const data = this.musicData;
        if (data && data.duration) {
            const targetMs = Math.round(clickPct * data.duration);
            
            // Butter-smooth real-time visual feedback
            const currentFill = this.content.querySelector('#music-progress-fill');
            const currentTimeSpan = this.content.querySelector('#music-current-time');
            if (currentFill) currentFill.style.width = (clickPct * 100) + '%';
            if (currentTimeSpan) currentTimeSpan.innerText = formatTime(targetMs);
            this.scrubbingBar.style.setProperty('--progress-pct', (clickPct * 100) + '%');
            
            // Update elastic tooltip position and text during dragging
            this.scrubbingBar.style.setProperty('--tooltip-pct', (clickPct * 100) + '%');
            const tooltip = this.scrubbingBar.querySelector('#music-progress-tooltip');
            if (tooltip) tooltip.innerText = formatTime(targetMs);
        }
    }

    syncPersistentSetting() {
        if (ipcRenderer) {
            const enabled = localStorage.getItem('liquid_island_persistent') === 'true';
            ipcRenderer.send('set-persistent-island', enabled);
        }
    }

    /**
     * Apply album cover colors as the active theme.
     * Overrides CSS custom properties on :root so every UI element
     * (sliders, badges, glow, progress bars, etc.) instantly syncs
     * to the dominant palette of the current album artwork.
     */
    applyCoverTheme() {
        if (!this._coverColors) return;
        // Check if cover color sync is enabled in settings
        if (localStorage.getItem('liquid_cover_color_sync') === 'false') return;

        const { primary, secondary } = this._coverColors;
        const priHex = rgbToHex(primary.r, primary.g, primary.b);
        const secHex = rgbToHex(secondary.r, secondary.g, secondary.b);
        const priRgbStr = `${primary.r}, ${primary.g}, ${primary.b}`;

        const effectiveArt = getDisplayMediaArt(this.musicData);

        localStorage.setItem('liquid_cover_colors', JSON.stringify({ 
            primary: priHex, 
            secondary: secHex, 
            rgb: priRgbStr,
            cover: effectiveArt
        }));

        const root = document.documentElement;
        root.style.setProperty('--neon-primary', priHex);
        root.style.setProperty('--neon-accent', priHex);
        root.style.setProperty('--neon-primary-rgb', priRgbStr);
        root.style.setProperty('--neon-secondary', secHex);

        // Also sync the glow color on the island element for live feedback
        const island = document.getElementById('dynamic-island');
        if (island && this._islandConfig.glowEnabled !== false) {
            const size = this._islandConfig.glowDensity || 20;
            const glowMode = this._islandConfig.glowColorMode || 'mix';
            const fixedColor = this._islandConfig.glowColor || '#00f3ff';
            const canUseCover = localStorage.getItem('liquid_cover_color_sync') !== 'false';

            let color = fixedColor;
            if (canUseCover && glowMode === 'cover') {
                color = priHex;
            } else if (canUseCover && glowMode === 'mix') {
                color = blendHexColors(fixedColor, priHex, this._islandConfig.glowBlend ?? 65);
            }

            const rgb = hexToRgb(color);
            const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

            island.style.setProperty('--island-glow-color', color);
            island.style.setProperty('--island-glow-rgb', rgbStr);
            island.style.boxShadow = ThemeService.buildIslandShadow(size, rgbStr, true);
        }

        // Update blurred background layer for instant feedback in any mode
        const bgLayer = document.querySelector('.island-bg-layer');
        if (this.isExpanded && bgLayer) {
            const coverUrl = effectiveArt ? effectiveArt.replace(/\\/g, '/') : "";
            if (coverUrl && coverUrl.length > 0) {
                bgLayer.style.backgroundImage = `url("${coverUrl}")`;
                bgLayer.style.opacity = '0.45';
                bgLayer.style.filter = 'blur(24px) saturate(180%)';
            } else {
                bgLayer.style.backgroundImage = 'none';
                bgLayer.style.opacity = '0';
            }
        }

        // Broadcast cover color to the standalone settings window via IPC
        if (ipcRenderer) {
            try {
                
                ipcRenderer.send('cover-color-changed', { 
                    primary: priHex, 
                    secondary: secHex, 
                    rgb: priRgbStr,
                    cover: effectiveArt
                });
            } catch (e) {}
        }
    }

    /**
     * Restore the user's chosen preset theme colors.
     * Called when playback stops, pauses, or when no album art is available.
     */
    restorePresetTheme() {
        const PRESET_COLORS = {
            cyberpunk: { primary: '#00f3ff', secondary: '#bc13fe' },
            sleek:     { primary: '#ffffff', secondary: '#888888' },
            emerald:   { primary: '#10b981', secondary: '#059669' },
            sunset:    { primary: '#ec4899', secondary: '#f97316' },
            glass:     { primary: '#8b5cf6', secondary: '#6366f1' }
        };

        const savedConfig = JSON.parse(localStorage.getItem('island_standalone_config') || '{}');
        const preset = savedConfig.preset || 'cyberpunk';
        const colors = PRESET_COLORS[preset] || PRESET_COLORS.cyberpunk;

        const rgb = hexToRgb(colors.primary);
        const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

        localStorage.setItem('liquid_cover_colors', JSON.stringify({ primary: colors.primary, secondary: colors.secondary, rgb: rgbStr }));

        const root = document.documentElement;
        root.style.setProperty('--neon-primary', colors.primary);
        root.style.setProperty('--neon-accent', colors.primary);
        root.style.setProperty('--neon-primary-rgb', rgbStr);
        root.style.setProperty('--neon-secondary', colors.secondary);

        // Restore glow to preset color
        const island = document.getElementById('dynamic-island');
        if (island) {
            const glowColor = this._islandConfig.glowColor || colors.primary;
            const size = this._islandConfig.glowDensity || 20;
            const rgb = hexToRgb(glowColor);
            const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

            island.style.setProperty('--island-glow-color', glowColor);
            island.style.setProperty('--island-glow-rgb', rgbStr);

            if (this._islandConfig.glowEnabled !== false) {
                if (this.musicData && this.musicData.isPlaying) {
                    island.style.boxShadow = '';
                } else {
                    island.style.boxShadow = ThemeService.buildIslandShadow(size, rgbStr, true);
                }
            } else {
                island.style.setProperty('--island-glow-opacity', '0');
                island.style.boxShadow = ThemeService.buildIslandShadow(0, '0, 243, 255', false);
            }
        }

        // Restore background layer
        const bgLayer = document.querySelector('.island-bg-layer');
        if (bgLayer) {
            const islandConfig = JSON.parse(localStorage.getItem('liquid_island_config') || '{}');
            if (islandConfig.bgImage) {
                bgLayer.style.backgroundImage = `url('${islandConfig.bgImage.replace(/\\/g, '/')}')`;
                bgLayer.style.opacity = (islandConfig.imgOpacity || 100) / 100;
                bgLayer.style.filter = `blur(${islandConfig.blur || 30}px)`;
            } else {
                bgLayer.style.backgroundImage = 'none';
                bgLayer.style.opacity = '0';
            }
        }

        // Broadcast restoration to standalone settings window
        if (ipcRenderer) {
            try {
                
                ipcRenderer.send('cover-color-changed', { primary: colors.primary, secondary: colors.secondary, rgb: rgbStr });
            } catch (e) {}
        }
    }

    syncGlobalCoverAesthetics() {
        const data = this.musicData;
        const bgLayer = this.el.querySelector('.island-bg-layer');
        const effectiveArt = getDisplayMediaArt(data);
        if (data && effectiveArt && effectiveArt.length > 0) {
            // Apply cover theme colors to root CSS globally
            this.applyCoverTheme();
            
            // Set blurred background cover on the island if expanded
            if (this.isExpanded && bgLayer) {
                const cleanCover = effectiveArt.replace(/\\/g, '/');
                bgLayer.style.backgroundImage = `url("${cleanCover}")`;
                bgLayer.style.opacity = '0.45';
                bgLayer.style.filter = 'blur(24px) saturate(180%)';
            }
        } else {
            // No active media, restore standard theme and default background
            this.restorePresetTheme();
            if (bgLayer) {
                const islandConfig = JSON.parse(localStorage.getItem('liquid_island_config') || '{}');
                if (islandConfig.bgImage) {
                    bgLayer.style.backgroundImage = `url('${islandConfig.bgImage.replace(/\\/g, '/')}')`;
                    bgLayer.style.opacity = (islandConfig.imgOpacity || 100) / 100;
                    bgLayer.style.filter = `blur(${islandConfig.blur || 30}px)`;
                } else {
                    bgLayer.style.backgroundImage = 'none';
                    bgLayer.style.opacity = '0';
                }
            }
        }
    }

    startMainLoop() {
        // Use setInterval instead of requestAnimationFrame loop
        // Much more efficient - only runs once per second instead of 60fps
        this._mainInterval = setInterval(() => {
            this.onSecondTick();
        }, 1000);

        // Métadonnées média plus réactives pour réduire la latence ressentie
        // sur la pochette, donc aussi sur la synchro du fond d'écran.
        this._mediaPollingActive = true;
        const pollMedia = async () => {
            if (!this._mediaPollingActive) return;
            await this.updateMediaState();
            if (!this._mediaPollingActive) return;
            this._mediaPollTimer = setTimeout(pollMedia, this.getMediaPollDelay());
        };
        pollMedia();

        // Premier sync immédiat au démarrage, sans attendre la première seconde.
        // For FPS tracking (only when needed for stats display)
        this._fpsInterval = null;
    }

    getMediaPollDelay() {
        const controlPending = this._mediaControlPendingUntil && this._mediaControlPendingUntil > Date.now();
        if (this.isExpanded || this.isPlaying || controlPending) return 400;
        return 1100;
    }

    startProgressSmoothLoop() {
        this._smoothLoopActive = true;
        const tick = () => {
            if (!this._smoothLoopActive) return;
            if (this.isExpanded && this.mode === 'music' && this.isPlaying && this.musicData) {
                if (this.isScrubbing) {
                    this._smoothTimer = setTimeout(tick, this.getProgressSmoothDelay());
                    return;
                }
                const data = this.musicData;
                const elapsed = Date.now() - (this.lastMediaUpdate || Date.now());
                const currentProgress = Math.min(data.duration, (data.progress || 0) + elapsed);
                
                const pct = data.duration ? (currentProgress / data.duration) * 100 : 0;
                
                const fill = this.el.querySelector('#music-progress-fill');
                const timeEl = this.el.querySelector('#music-current-time');
                
                if (fill) {
                    fill.style.width = `${pct}%`;
                    const bar = fill.closest('.progress-bar');
                    if (bar) bar.style.setProperty('--progress-pct', `${pct}%`);
                }
                if (timeEl) timeEl.innerText = formatTime(currentProgress);
            } else if (!this.isExpanded && this.isPlaying && this.musicData && localStorage.getItem('liquid_idle_compact_mode') === 'progress') {
                const chipTime = this.el.querySelector('.idle-metric-chip span');
                if (chipTime) {
                    const data = this.musicData;
                    const elapsed = Date.now() - (this.lastMediaUpdate || Date.now());
                    const baseProgress = data.progress || 0;
                    const currentProgress = data.duration ? Math.min(data.duration, baseProgress + elapsed) : baseProgress;
                    chipTime.innerText = formatTime(currentProgress);
                }
            }
            if (this._smoothLoopActive) {
                this._smoothTimer = setTimeout(tick, this.getProgressSmoothDelay());
            }
        };
        tick();
    }

    getProgressSmoothDelay() {
        const progressVisible =
            (this.isExpanded && this.mode === 'music' && this.isPlaying && this.musicData) ||
            (!this.isExpanded && this.isPlaying && this.musicData && localStorage.getItem('liquid_idle_compact_mode') === 'progress');
        return progressVisible ? 100 : 500;
    }

    stopMainLoop() {
        this._mediaPollingActive = false;
        this._smoothLoopActive = false;
        if (this._mainInterval) {
            clearInterval(this._mainInterval);
            this._mainInterval = null;
        }
        if (this._mediaPollTimer) {
            clearTimeout(this._mediaPollTimer);
            this._mediaPollTimer = null;
        }
        if (this._fpsInterval) {
            clearInterval(this._fpsInterval);
            this._fpsInterval = null;
        }
        if (this._smoothTimer) {
            clearTimeout(this._smoothTimer);
            this._smoothTimer = null;
        }
    }

    onSecondTick() {
        if (this.isTimerRunning) {
            this.timerValue++;
            if (this.isExpanded && this.mode === 'timer') {
                this.renderTimer();
            } else if (!this.isExpanded) {
                this.renderIdle();
            }
        }

        if (this.isExpanded) {
            if (this.mode === 'network') {
                this.renderNetwork();
            }
            if (this.mode === 'mixer') {
                this.updateAudioSessions();
            } else if (this.mode === 'music') {
                this.refreshCurrentMediaVolumeSession();
            } else if (this.mode === 'control') {
                const widgetType = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
                if (widgetType === 'mixer') {
                    this.updateAudioSessions();
                }
                
                // Periodically refresh the master volume in real-time if the user is not actively dragging it
                const volSlider = document.getElementById('ic-volume-slider');
                if (volSlider && !volSlider.classList.contains('active') && ipcRenderer) {
                    try {
                        
                        ipcRenderer.invoke('get-system-volume').then(currentVol => {
                            if (currentVol !== undefined && currentVol !== null) {
                                volSlider.style.setProperty('--slider-val-pct', `${Math.round(currentVol)}%`);
                            }
                        }).catch(() => {});
                    } catch(e){}
                }
            }
        }
    }

    async updateMediaState() {
        try {
            if (this._mediaStateRequestInFlight) return;
            if (!ipcRenderer) return;
            this._mediaStateRequestInFlight = true;

            const mediaInfo = await ipcRenderer.invoke('get-media-info');
            if (mediaInfo) {
                this.updateMusic({
                    title: mediaInfo.title || "Aucune lecture",
                    artist: mediaInfo.artist || "Système",
                    cover: mediaInfo.cover || "",
                    transientCover: mediaInfo.transientCover || "",
                    appId: mediaInfo.appId || "",
                    isPlaying: mediaInfo.isPlaying || false,
                    progress: mediaInfo.progress || 0,
                    duration: mediaInfo.duration || 0,
                    source: mediaInfo.source || "",
                    trackKey: mediaInfo.trackKey || "",
                    windowTitle: mediaInfo.windowTitle || ""
                });
            }
        } catch (e) { }
        finally {
            this._mediaStateRequestInFlight = false;
        }
    }


    // ... (rest of methods)



    async transitionState(updateFn) {
        if (this._transitionInProgress) return;

        this._transitionInProgress = true;
        const transitionToken = ++this._transitionToken;
        this.el.classList.add('animating');

        try {
            // 1. Wait for the content to fully fade out (opacity 0)
            await new Promise(r => setTimeout(r, 90));

            if (transitionToken !== this._transitionToken) return;

            // 2. Set transition flag to prevent heavy HTML injection during scaling
            this._isTransitioning = true;

            // 3. Perform size change (updates parent size classes, starting the CSS width/height morph)
            updateFn();

            // 4. Wait for the morphing animation to be 70% complete (200ms is the sweet spot!)
            await new Promise(r => setTimeout(r, 200));

            if (transitionToken !== this._transitionToken) return;

            // 5. Clear transition flag and render the complete, heavy HTML content
            this._isTransitioning = false;
            this.renderContent();

            // 6. Wait a tiny bit for the DOM tree to settle and paint
            await new Promise(r => setTimeout(r, 40));
        } finally {
            if (transitionToken === this._transitionToken) {
                this._isTransitioning = false;
                this._transitionInProgress = false;
                this.el.classList.remove('animating');
            }
        }
    }

    toggleExpand() {
        this.transitionState(() => {
            this.isExpanded = !this.isExpanded;
            this.renderContent();
        });
    }

    collapseIsland() {
        if (!this.isExpanded) return;

        try { window.speechSynthesis.cancel(); } catch (e) {}

        if (this.mode === 'search') {
            window.dispatchEvent(new CustomEvent('liquid-search-close'));
        }

        this.transitionState(() => {
            this.mode = 'music';
            this.isExpanded = false;
            this.renderContent();
        });
    }

    returnToMusicIdle() {
        if (this.notifTimeout) {
            clearTimeout(this.notifTimeout);
            this.notifTimeout = null;
        }

        this.previousMode = 'music';
        this.mode = 'music';
        this.isExpanded = false;
        this.el.classList.remove(...this.getIslandSizeClasses());
        this.el.classList.remove('animating');
        this.renderContent();
    }

    closeContextMenu() {
        this.isContextMenuOpen = false;
        if (this._contextMenuCloseHandler) {
            document.removeEventListener('click', this._contextMenuCloseHandler, true);
            this._contextMenuCloseHandler = null;
        }
        const menu = document.getElementById('island-context-menu');
        if (menu) {
            menu.remove();
        }
        if (!this.isExpanded && !this._layoutEditMode && ipcRenderer) {
            try {
                ipcRenderer.send('set-ignore-mouse', true, { forward: true });
            } catch (e) {}
        }
    }

    openExpandedMode(mode) {
        this.transitionState(() => {
            this.mode = mode;
            this.isExpanded = true;
            this.renderContent();
        });
    }

    async launchShortcut(command) {
        if (!command) return;
        try {
            const rawCommand = String(command).trim();
            if (rawCommand.startsWith('liquid:')) {
                this.runInternalShortcut(rawCommand);
                return;
            }

            if (ipcRenderer) {
                await ipcRenderer.invoke('launch-shortcut', rawCommand);
            }
        } catch (e) {
            console.error("Failed to launch shortcut:", command, e);
        }
    }

    runInternalShortcut(command) {
        const action = String(command || '').replace('liquid:', '').trim();
        this.isExpanded = true;

        if (action === 'music-search') {
            this.openMusicSearchPanel();
            return;
        }
        if (action === 'music-history') {
            this.mode = 'music-history';
            this.renderContent();
            return;
        }
        if (action === 'menu' || action === 'widgets') {
            this.mode = 'menu';
            this.renderContent();
            return;
        }
        if (action === 'mixer') {
            this.mode = 'mixer';
            this.renderContent();
            return;
        }
        if (action === 'control') {
            this.mode = 'control';
            this.renderContent();
            return;
        }
        if (action === 'settings') {
            this.setMode('settings');
            return;
        }

        this.mode = 'music';
        this.renderContent();
    }

    setMode(mode) {
        this.isAudioDeviceDropdownOpen = false;
        this.isMicDeviceDropdownOpen = false;
        if (mode === 'settings') {
            try {
                
                ipcRenderer.send('open-settings');
            } catch(e) {
                console.error("Failed to open settings via IPC:", e);
            }
            this.collapseIsland();
            return;
        }

        if (mode === 'menu') {
            this.transitionState(() => {
                this.mode = mode;
                this.renderContent();
            });
            return;
        }

        // Feature flags check
        if (mode === 'timer' && localStorage.getItem('liquid_island_timer_enabled') === 'false') return;
        if (mode === 'stats' && localStorage.getItem('liquid_island_stats_enabled') === 'false') return;
        if (mode === 'network' && localStorage.getItem('liquid_island_network_enabled') === 'false') return;

        this.transitionState(() => {
            this.mode = mode;
            this.renderContent();
        });
    }

    showNotification(title, message, icon = 'ph-bell') {
        if (localStorage.getItem('liquid_notifications_enabled') === 'false') return;

        this.notificationData = { title, message, icon };
        // Don't overwrite previousMode if we are already in notification mode (e.g. rapid notifications)
        if (this.mode !== 'notification') {
            this.previousMode = this.mode;
        }

        this.transitionState(() => {
            this.mode = 'notification';
            SoundService.play('notification');
            // Utilise la classe notifying plus compacte et temporaire
            this.el.classList.remove(...this.getIslandSizeClasses(), 'island-active-music');
            this.el.classList.add('island-notifying');
            this.renderNotification();
        });

        // Clear any existing timeout if we are spamming notifications?
        if (this.notifTimeout) clearTimeout(this.notifTimeout);

        this.notifTimeout = setTimeout(() => {
            if (this.mode === 'notification') {
                this.transitionState(() => {
                    this.el.classList.remove('island-notifying');
                    this.mode = this.previousMode || 'music';

                    // Restore idle state base
                    this.el.classList.add('island-idle');

                    // Si l'île était active en musique, elle y retourne via renderIdle check
                    if (this.mode === 'music' && this.musicData && this.musicData.isPlaying) {
                        this.renderIdle(); // renderIdle adds island-active-music
                    } else {
                        this.renderIdle();
                    }
                });
            }
            this.notifTimeout = null;
        }, 4000);
    }

    getIslandSizeClasses() {
        return [
            'island-idle',
            'island-expanded',
            'island-large',
            'island-settings-mode',
            'island-notifying',
            'island-mode-music',
            'island-mode-notification',
            'island-mode-timer',
            'island-mode-network',
            'island-mode-menu',
            'island-mode-search',
            'island-mode-music-search',
            'island-mode-music-history',
            'island-mode-control',
            'island-mode-mixer',
            'island-mode-settings'
        ];
    }

    getModeSizeClass() {
        const sizeByMode = {
            music: 'island-mode-music',
            notification: 'island-mode-notification',
            timer: 'island-mode-timer',
            network: 'island-mode-network',
            menu: 'island-mode-menu',
            search: 'island-mode-search',
            'music-search': 'island-mode-music-search',
            'music-history': 'island-mode-music-history',
            control: 'island-mode-control',
            mixer: 'island-mode-mixer',
            settings: 'island-mode-settings'
        };

        return sizeByMode[this.mode] || 'island-mode-music';
    }

    renderContent() {
        try { window.speechSynthesis.cancel(); } catch (e) {}

        // Reset any inline sizing from dynamic modes (e.g. mixer/history autosize)
        try {
            if (this.isExpanded && this.mode === 'mixer') {
                const grouped = this.getGroupedSessions ? this.getGroupedSessions(this.audioSessions || []) : [];
                const count = grouped.length;
                const visible = Math.max(1, Math.min(count || 1, 5));
                const bodyTarget = count === 0 ? 120 : visible * 62;
                let target = 15 + 20 + 26 + 12 + bodyTarget + 6; // padTop + padBottom + headerH + headerMb + bodyTarget + security
                target = Math.max(260, Math.min(520, target));
                this.el.style.height = `${Math.round(target)}px`;
                this.el.style.width = '';
            } else if (this.isExpanded && this.mode === 'music-history') {
                this.musicHistory = this.loadMusicHistory ? this.loadMusicHistory() : (this.musicHistory || []);
                const query = (this.musicHistoryQuery || '').trim().toLowerCase();
                const historyFilter = this.getMusicHistoryFilter ? this.getMusicHistoryFilter() : 'all';
                const matchesQuery = (item) => {
                    if (!query) return true;
                    return `${item.title || ''} ${item.artist || ''} ${item.providerLabel || ''} ${item.appId || ''}`.toLowerCase().includes(query);
                };
                const favorites = (this.musicHistory || []).filter(item => historyFilter !== 'recent' && item.favorite && matchesQuery(item));
                const recent = (this.musicHistory || []).filter(item => historyFilter !== 'favorites' && !item.favorite && matchesQuery(item));

                let listTarget = 120;
                const totalCount = favorites.length + recent.length;
                if (totalCount > 0) {
                    const visibleRows = Math.min(totalCount, 5);
                    const titleCount = (favorites.length > 0 ? 1 : 0) + (recent.length > 0 ? 1 : 0);
                    listTarget = (visibleRows * 64) + (titleCount * 18) + 24;
                }
                let target = 14 + 16 + 32 + 30 + (12 * 2) + listTarget; // padTop + padBottom + headerH + searchFilterRowH + (gap * 2) + listTarget
                target = Math.max(180, Math.min(520, target));
                this.el.style.height = `${Math.round(target)}px`;
                this.el.style.width = '';
            } else {
                this.el.style.height = '';
                this.el.style.width = '';
            }
        } catch (e) {
            console.error('Error estimating dynamic mode height:', e);
            this.el.style.height = '';
            this.el.style.width = '';
        }

        // Clear any active real-time system stats update interval
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        if (this._controlSliderCleanup) {
            this._controlSliderCleanup();
            this._controlSliderCleanup = null;
        }

        this._lastRenderedTrack = null; // Force updateMusic to re-sync state on next poll

        // Essential: Clear ALL possible size/state classes before applying the new one
        this.el.classList.remove(...this.getIslandSizeClasses());

        if (this.isExpanded) {
            const modeSizeClass = this.getModeSizeClass();

            // Keep legacy classes for compatibility, then refine the shape per mode.
            if (this.mode === 'settings') {
                this.el.classList.add('island-settings-mode', modeSizeClass);
            } else if (this.mode === 'control' || this.mode === 'mixer') {
                this.el.classList.add('island-large', modeSizeClass);
            } else {
                this.el.classList.add('island-expanded', modeSizeClass);
            }

            if (this._isTransitioning) {
                this.content.innerHTML = '';
                this._vizCanvas = null;
                this.syncVisualizerActivity();
                return;
            }

            // Render specific module
            if (this.mode === 'music') this.renderMusic();
            else if (this.mode === 'notification') this.renderNotification();
            else if (this.mode === 'timer') this.renderTimer();
            else if (this.mode === 'network') this.renderNetwork();
            else if (this.mode === 'menu') this.renderMenu();
            else if (this.mode === 'search') this.renderSearch();
            else if (this.mode === 'music-search') this.renderMusicSearch();
            else if (this.mode === 'music-history') this.renderMusicHistory();
            else if (this.mode === 'control') this.renderControl();
            else if (this.mode === 'mixer') this.renderMixer();
            else if (this.mode === 'settings') this.renderSettings();
        } else {
            // Collapsed state
            this.el.classList.add('island-idle');

            if (this._isTransitioning) {
                this.content.innerHTML = '';
                this._vizCanvas = null;
                this.syncVisualizerActivity();
                return;
            }

            this.renderIdle();
        }

        // Ensure initial audio sessions are loaded when entering mixer or control modes
        if (this.isExpanded && (this.mode === 'mixer' || (this.mode === 'control' && localStorage.getItem('liquid_control_widget_type') === 'mixer'))) {
            this.updateAudioSessions();
        }

        // Enforce active album artwork cover & colors across all screens!
        this.syncGlobalCoverAesthetics();

        this.syncVisualizerActivity();

        // Ensure the visualizer responds to state changes
        this.updateMediaState();
    }
    openSpotlightSearch() {
        this.mode = 'search';
        this.isExpanded = true;
        this.el.classList.remove('island-idle');
        this.el.classList.add('island-expanded');
        this.renderContent();
        setTimeout(() => {
            const input = this.el.querySelector('#island-search-input');
            if (input) input.focus();
        }, 120);
    }

    renderSearch() {
        this.content.innerHTML = `
            <div class="island-search-container">
                <div class="search-bar-integrated">
                    <i class="ph-bold ph-magnifying-glass search-icon-integrated"></i>
                    <input type="text" id="island-search-input" placeholder="Rechercher..." autofocus>
                    <button class="island-close-search" onclick="window.dispatchEvent(new CustomEvent('liquid-search-close'))">
                        <i class="ph-bold ph-x"></i>
                    </button>
                </div>
                <div id="island-search-results" class="island-search-results">
                    <!-- Results injected here from SearchManager events -->
                    <div class="search-empty-state">Tapez pour commencer...</div>
                </div>
            </div>
        `;

        const input = this.content.querySelector('#island-search-input');
        input.oninput = (e) => {
            window.dispatchEvent(new CustomEvent('liquid-search-input', { detail: e.target.value }));
        };

        // Prevent island expansion toggle when clicking input
        input.onclick = (e) => e.stopPropagation();
    }

    renderControl() {
        let wifiEnabled = localStorage.getItem('liquid_wifi_enabled') !== 'false';
        let btEnabled = localStorage.getItem('liquid_bluetooth_enabled') !== 'false';
        let dndEnabled = localStorage.getItem('liquid_dnd_enabled') === 'true';
        const isEcoMode = localStorage.getItem('liquid_eco_mode') === 'true';
        const isFocusMode = localStorage.getItem('liquid_focus_mode') === 'true';

        // 1. Synchronously render UI with cached/default states immediately
        let sysVol = 70; // Will be updated asynchronously
        
        // Helper to retrieve active system memory/cpu (can be done synchronously!)
        const getSystemStats = () => {
            let cpuPercent = 12;
            let ramPercent = 45;
            
            if (typeof process !== 'undefined' && process.getSystemMemoryInfo) {
                try {
                    const mem = process.getSystemMemoryInfo();
                    ramPercent = Math.round(((mem.total - mem.free) / mem.total) * 100) || 45;
                } catch(e){}
            }
            if (typeof process !== 'undefined' && process.getCPUUsage) {
                try {
                    cpuPercent = Math.round(process.getCPUUsage().percentCPUUsage) || 15;
                    cpuPercent = Math.min(100, Math.max(0, cpuPercent));
                } catch(e){}
            }
            return { cpu: cpuPercent, ram: ramPercent };
        };

        const stats = getSystemStats();

        // Default battery status
        let batteryLevel = 100;
        let batteryCharging = true;
        
        // Default disk space status (C: drive)
        let diskFreeGb = 150;
        let diskPercent = 70;

        // Music info fallback
        const musicData = this.musicData || { title: "Aucune lecture", artist: "Système", cover: "", isPlaying: false };
        const effectiveNpArt = getDisplayMediaArt(musicData);
        const hasCover = effectiveNpArt && effectiveNpArt.length > 0;
        const controlTrackKey = musicData.trackKey || getMusicHistoryKey(musicData);
        const flipClass = this._pendingCoverAnimationTrackKey && this._pendingCoverAnimationTrackKey === controlTrackKey ? 'flip-active' : '';
        const npCoverHtml = hasCover
            ? `<img id="ic-np-cover-img" src="${effectiveNpArt}" class="ic-np-cover ${flipClass}">`
            : `<img id="ic-np-cover-img" src="${APP_LOGO_ART}" class="ic-np-cover app-logo-art ${flipClass}" alt="Liquid Dynamic Island">`;

        // Render customizable third card based on user preference
        const widgetType = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
        let thirdCardHtml = '';
        
        if (widgetType === 'launchpad') {
            const defaultShortcuts = [
                { name: "Explorer", preset: "explorer", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
                { name: "Settings", preset: "settings", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
                { name: "TaskMgr", preset: "taskmgr", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
                { name: "Calc", preset: "calc", icon: "ph-fill ph-calculator", cmd: "calc.exe" }
            ];
            const shortcuts = JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts));
            
            thirdCardHtml = `
                <div class="ic-launchpad-card">
                    ${shortcuts.map((s, idx) => `
                        <button class="ic-launchpad-btn" id="ic-lp-btn-${idx}" title="${s.name} (${s.cmd})">
                            <i class="${s.icon}"></i>
                        </button>
                    `).join('')}
                </div>
            `;
        } else if (widgetType === 'stats') {
            thirdCardHtml = `
                <div class="ic-stats-card">
                    <div class="ic-stats-half">
                        <div class="ic-stats-info">
                            <span class="ic-stats-label"><i class="ph-fill ph-cpu"></i> CPU</span>
                            <span id="ic-stat-val-cpu" class="ic-stats-val">${stats.cpu}%</span>
                        </div>
                        <div class="ic-stats-bar">
                            <div id="ic-stat-fill-cpu" class="ic-stats-fill" style="width: ${stats.cpu}%; background: var(--neon-primary);"></div>
                        </div>
                    </div>
                    <div class="ic-stats-half" style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
                        <div class="ic-stats-info">
                            <span class="ic-stats-label"><i class="ph-fill ph-database"></i> RAM</span>
                            <span id="ic-stat-val-ram" class="ic-stats-val">${stats.ram}%</span>
                        </div>
                        <div class="ic-stats-bar">
                            <div id="ic-stat-fill-ram" class="ic-stats-fill" style="width: ${stats.ram}%; background: var(--neon-secondary);"></div>
                        </div>
                    </div>
                </div>
            `;
        } else if (widgetType === 'weather') {
            const hour = new Date().getHours();
            let temp = '21°';
            let desc = 'Ensoleillé';
            let minMax = 'Min. 14° / Max. 25°';
            let icon = 'ph-sun';
            let iconColor = '#ff9f0a';

            if (hour >= 6 && hour < 18) {
                temp = '21°';
                desc = 'Ensoleillé';
                minMax = 'Min. 14° / Max. 25°';
                icon = 'ph-sun';
                iconColor = '#ff9f0a';
            } else if (hour >= 18 && hour < 22) {
                temp = '16°';
                desc = 'Partiellement nuageux';
                minMax = 'Min. 11° / Max. 19°';
                icon = 'ph-cloud-moon';
                iconColor = '#5856d6';
            } else {
                temp = '12°';
                desc = 'Nuit Claire';
                minMax = 'Min. 9° / Max. 14°';
                icon = 'ph-moon-stars';
                iconColor = '#64d2ff';
            }

            thirdCardHtml = `
                <div class="ic-weather-card">
                    <div class="ic-weather-info">
                        <span class="ic-weather-label"><i class="ph-fill ph-cloud-sun"></i> Météo</span>
                        <span class="ic-weather-val">${temp}</span>
                    </div>
                    <div class="ic-weather-condition">
                        <span class="ic-weather-desc">${desc}</span>
                        <span class="ic-weather-hl">${minMax}</span>
                    </div>
                    <div class="ic-weather-icon-wrapper">
                        <i class="ph-fill ${icon} ic-weather-icon" style="color: dots; color: ${iconColor}; filter: drop-shadow(0 0 8px ${iconColor}4d);"></i>
                    </div>
                </div>
            `;
        } else if (widgetType === 'mixer') {
            thirdCardHtml = `
                <div class="ic-mixer-card" id="ic-cc-mixer-card">
                    <div style="grid-column: 1/-1; opacity: 0.5; font-size: 11px; text-align: center; padding: 15px 0;">
                        Chargement des flux audio...
                    </div>
                </div>
            `;
        } else {
            // Machine widget default
            const battIcon = batteryCharging ? 'ph-battery-charging' : 'ph-battery-high';
            const battLabelText = batteryCharging ? 'Secteur' : 'Batterie';
            
            thirdCardHtml = `
                <div class="ic-machine-card">
                    <div class="ic-machine-half">
                        <div class="ic-machine-info">
                            <span class="ic-machine-label" id="ic-mach-lbl-batt"><i class="ph-fill ${battIcon}" style="${batteryCharging ? 'color: #34c759;' : ''}"></i> ${battLabelText}</span>
                            <span id="ic-mach-val-batt" class="ic-machine-val">${batteryLevel}%</span>
                        </div>
                        <div class="ic-machine-bar">
                            <div id="ic-mach-fill-batt" class="ic-machine-fill" style="width: ${batteryLevel}%; background: #34c759;"></div>
                        </div>
                    </div>
                    <div class="ic-machine-half" style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
                        <div class="ic-machine-info">
                            <span class="ic-machine-label"><i class="ph-fill ph-hard-drive"></i> Disque C:</span>
                            <span class="ic-machine-val" id="ic-mach-val-disk">${diskFreeGb} Go libres</span>
                        </div>
                        <div class="ic-machine-bar">
                            <div class="ic-machine-fill" id="ic-mach-fill-disk" style="width: ${diskPercent}%; background: var(--neon-primary);"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        this.content.innerHTML = `
            <div class="island-control-container">
                <div class="island-control-header">
                    <div class="ic-header-copy">
                        <span class="ic-title">Centre de Contrôle</span>
                        <span class="ic-time"><i class="ph-fill ph-clock"></i>${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="ic-header-actions">
                        <button class="ic-action-btn" onclick="event.stopPropagation(); window.island.setMode('settings')" title="Réglages"><i class="ph ph-gear"></i></button>
                        <button class="ic-action-btn power" id="ic-shutdown" title="Éteindre"><i class="ph ph-power"></i></button>
                        <button class="ic-close" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Retour au menu"><i class="ph ph-x"></i></button>
                    </div>
                </div>
                
                <div class="ic-main-layout">
                    <!-- Left Column: Frosted Toggles + Now Playing + customizable third widget -->
                    <div class="ic-control-stack">
                        <div class="ic-toggles-grid">
                            <div class="ic-tile ${wifiEnabled ? 'active' : ''}" id="ic-wifi">
                                <i class="ph-fill ph-wifi"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Wi-Fi</span>
                                    <span class="ic-tile-status">${wifiEnabled ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${btEnabled ? 'active' : ''}" id="ic-bluetooth">
                                <i class="ph-fill ph-bluetooth"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Bluetooth</span>
                                    <span class="ic-tile-status">${btEnabled ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${dndEnabled ? 'active' : ''}" id="ic-dnd">
                                <i class="ph-fill ph-moon"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">DND</span>
                                    <span class="ic-tile-status">${dndEnabled ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${isFocusMode ? 'active' : ''}" id="ic-focus">
                                <i class="ph-fill ph-target"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Focus</span>
                                    <span class="ic-tile-status">${isFocusMode ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${isEcoMode ? 'active' : ''}" id="ic-eco">
                                <i class="ph-fill ph-leaf"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Éco</span>
                                    <span class="ic-tile-status">${isEcoMode ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile" id="ic-sett-tile" title="Ouvrir les Réglages">
                                <i class="ph-fill ph-gear"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Réglages</span>
                                    <span class="ic-tile-status">Configurer</span>
                                </div>
                            </div>
                        </div>

                        <!-- Real-time Now Playing Widget -->
                        <div class="ic-now-playing-card">
                            ${npCoverHtml}
                            <div class="ic-np-details">
                                <span class="ic-np-title" id="ic-np-title-val">${escapeHtml(musicData.title)}</span>
                                <span class="ic-np-artist" id="ic-np-artist-val">${escapeHtml(musicData.artist)}</span>
                            </div>
                            <div class="ic-np-controls">
                                <button class="ic-np-btn" onclick="event.stopPropagation(); window.spotifyControl('prev')"><i class="ph-fill ph-skip-back"></i></button>
                                <button class="ic-np-btn play" id="ic-np-play-btn-val" onclick="event.stopPropagation(); window.spotifyControl('toggle')"><i class="ph-fill ph-${musicData.isPlaying ? 'pause' : 'play'}"></i></button>
                                <button class="ic-np-btn" onclick="event.stopPropagation(); window.spotifyControl('next')"><i class="ph-fill ph-skip-forward"></i></button>
                            </div>
                        </div>

                        <!-- Dynamically loaded widget -->
                        ${thirdCardHtml}
                    </div>
                    
                    <!-- Right Column: Stretched Volume Vertical Slider -->
                    <div class="ic-sliders-layout" style="width: 60px;">
                        <div class="ic-vertical-slider" id="ic-volume-slider" style="--slider-val-pct: ${Math.round(sysVol)}%" title="Volume Système">
                            <div class="ic-slider-fill"></div>
                            <div class="ic-slider-icon"><i class="ph-fill ph-speaker-high"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind Container Stop Propagation
        const container = this.content.querySelector('.island-control-container');
        container.onclick = (e) => e.stopPropagation();

        // Bind Launchpad buttons click handlers
        if (widgetType === 'launchpad') {
            const defaultShortcuts = [
                { name: "Explorer", preset: "explorer", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
                { name: "Settings", preset: "settings", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
                { name: "TaskMgr", preset: "taskmgr", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
                { name: "Calc", preset: "calc", icon: "ph-fill ph-calculator", cmd: "calc.exe" }
            ];
            const shortcuts = JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts));
            
            shortcuts.forEach((s, idx) => {
                const btn = container.querySelector(`#ic-lp-btn-${idx}`);
                if (btn) {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        SoundService.play('click');
                        this.launchShortcut(s.cmd);
                    };
                }
            });
        }

        // Helper to bind vertical sliders dragging with mouse support
        const bindVerticalSlider = (sliderEl, onChange) => {
            if (!sliderEl) return () => {};

            let isDragging = false;

            const updateFromEvent = (e) => {
                const rect = sliderEl.getBoundingClientRect();
                const pct = Math.max(0, Math.min(100, Math.round(((rect.bottom - e.clientY) / rect.height) * 100)));
                sliderEl.style.setProperty('--slider-val-pct', `${pct}%`);
                onChange(pct);
            };

            const onMouseDown = (e) => {
                e.stopPropagation();
                e.preventDefault();
                isDragging = true;
                sliderEl.classList.add('active');
                updateFromEvent(e);
            };

            const onMouseMove = (e) => {
                if (isDragging) {
                    e.stopPropagation();
                    e.preventDefault();
                    updateFromEvent(e);
                }
            };

            const onMouseUp = (e) => {
                if (isDragging) {
                    e.stopPropagation();
                    e.preventDefault();
                    isDragging = false;
                    sliderEl.classList.remove('active');
                }
            };

            sliderEl.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            return () => {
                isDragging = false;
                sliderEl.classList.remove('active');
                sliderEl.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
        };

        // Bind Volume Vertical Slider
        const volSlider = container.querySelector('#ic-volume-slider');
        this._controlSliderCleanup = bindVerticalSlider(volSlider, (val) => {
            if (ipcRenderer) {
                ipcRenderer.invoke('set-system-volume', val);
            }
        });

        // Bind Quick Tiles Toggle Handlers
        const tiles = [
            { 
                id: '#ic-wifi', 
                key: 'liquid_wifi_enabled', 
                isDefaultTrue: true, 
                onToggle: async (state) => {
                    if (ipcRenderer) {
                        await ipcRenderer.invoke('wifi-control', state ? 'on' : 'off');
                    }
                } 
            },
            { 
                id: '#ic-bluetooth', 
                key: 'liquid_bluetooth_enabled', 
                isDefaultTrue: true, 
                onToggle: async (state) => {
                    if (ipcRenderer) {
                        await ipcRenderer.invoke('bluetooth-control', state ? 'on' : 'off');
                    }
                } 
            },
            { 
                id: '#ic-dnd', 
                key: 'liquid_dnd_enabled', 
                isDefaultTrue: false, 
                onToggle: async (state) => {
                    if (ipcRenderer) {
                        await ipcRenderer.invoke('dnd-control', state ? 'on' : 'off');
                    }
                } 
            },
            { 
                id: '#ic-focus', 
                key: 'liquid_focus_mode', 
                isDefaultTrue: false, 
                onToggle: (state) => {
                    document.body.classList.toggle('focus-mode-active', state);
                    window.dispatchEvent(new CustomEvent('liquid-focus-mode', { detail: state }));
                }
            },
            { 
                id: '#ic-eco', 
                key: 'liquid_eco_mode', 
                isDefaultTrue: false, 
                onToggle: (state) => {
                    window.dispatchEvent(new CustomEvent('liquid-eco-mode-changed', { detail: state }));
                }
            }
        ];

        tiles.forEach(tile => {
            const el = container.querySelector(tile.id);
            if (el) {
                el.onclick = async () => {
                    const currentVal = tile.isDefaultTrue 
                        ? localStorage.getItem(tile.key) !== 'false' 
                        : localStorage.getItem(tile.key) === 'true';
                    const newVal = !currentVal;
                    localStorage.setItem(tile.key, newVal);
                    el.classList.toggle('active', newVal);
                    
                    const statusText = el.querySelector('.ic-tile-status');
                    if (statusText) {
                        statusText.innerText = newVal ? 'Activé' : 'Désactivé';
                    }
                    
                    await tile.onToggle(newVal);
                };
            }
        });

        // Setup stats real-time update interval (2s)
        this.statsInterval = setInterval(async () => {
            const currentWidget = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
            
            if (currentWidget === 'stats') {
                const currentStats = getSystemStats();
                const cpuVal = document.getElementById('ic-stat-val-cpu');
                const cpuFill = document.getElementById('ic-stat-fill-cpu');
                const ramVal = document.getElementById('ic-stat-val-ram');
                const ramFill = document.getElementById('ic-stat-fill-ram');
                
                if (cpuVal) cpuVal.innerText = `${currentStats.cpu}%`;
                if (cpuFill) cpuFill.style.width = `${currentStats.cpu}%`;
                if (ramVal) ramVal.innerText = `${currentStats.ram}%`;
                if (ramFill) ramFill.style.width = `${currentStats.ram}%`;
            } else if (currentWidget === 'machine') {
                if (navigator.getBattery) {
                    try {
                        const batt = await navigator.getBattery();
                        const bLevel = Math.round(batt.level * 100);
                        const bCharging = batt.charging;
                        
                        const battVal = document.getElementById('ic-mach-val-batt');
                        const battFill = document.getElementById('ic-mach-fill-batt');
                        const battLabel = document.getElementById('ic-mach-lbl-batt');
                        
                        if (battVal) battVal.innerText = `${bLevel}%`;
                        if (battFill) battFill.style.width = `${bLevel}%`;
                        if (battLabel) {
                            const bIcon = bCharging ? 'ph-battery-charging' : 'ph-battery-high';
                            const bText = bCharging ? 'Secteur' : 'Batterie';
                            battLabel.innerHTML = `<i class="ph-fill ${bIcon}" style="${bCharging ? 'color: #34c759;' : ''}"></i> ${bText}`;
                        }
                    } catch(e){}
                }
            }
        }, 2000);

        // Bind Settings quick tile
        const settTile = container.querySelector('#ic-sett-tile');
        if (settTile) {
            settTile.onclick = () => {
                this.setMode('settings');
                this.renderContent();
            };
        }

        // Shutdown Event Trigger
        const shutdownBtn = container.querySelector('#ic-shutdown');
        if (shutdownBtn) {
            shutdownBtn.onclick = () => {
                const existing = container.querySelector('.ic-confirm-overlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.className = 'ic-confirm-overlay';
                overlay.innerHTML = `
                    <div class="ic-confirm-box">
                        <i class="ph-fill ph-power ic-confirm-icon"></i>
                        <span class="ic-confirm-title">Quitter l'Island ?</span>
                        <span class="ic-confirm-desc">Voulez-vous fermer l'application Dynamic Island ?</span>
                        <div class="ic-confirm-buttons">
                            <button class="ic-confirm-btn cancel" id="confirm-cancel">Annuler</button>
                            <button class="ic-confirm-btn confirm" id="confirm-ok">Quitter</button>
                        </div>
                    </div>
                `;

                container.appendChild(overlay);

                // Bind Cancel button
                overlay.querySelector('#confirm-cancel').onclick = (e) => {
                    e.stopPropagation();
                    overlay.remove();
                };

                // Bind Confirm button
                overlay.querySelector('#confirm-ok').onclick = (e) => {
                    e.stopPropagation();
                    this.mode = 'music';
                    this.isExpanded = false;
                    this.renderContent();

                    if (ipcRenderer) {
                        ipcRenderer.send('exit-app'); // Clean shutdown via exit-app
                    }
                };
                
                // Stop click propagation on overlay to avoid closing the island
                overlay.onclick = (e) => e.stopPropagation();
            };
        }

        // 3. ASYNCHRONOUS UPDATE OF DYNAMIC SYSTEM VALUES
        const updateAsyncSystemData = async () => {
            if (!ipcRenderer) return;
            

            // System Volume
            try {
                const fetchedVol = await ipcRenderer.invoke('get-system-volume');
                if (fetchedVol !== undefined && fetchedVol !== null) {
                    sysVol = fetchedVol;
                    if (volSlider) {
                        volSlider.style.setProperty('--slider-val-pct', `${Math.round(sysVol)}%`);
                    }
                }
            } catch (e) { }

            // Wi-Fi Status
            try {
                const realWifi = await ipcRenderer.invoke('wifi-control', 'status');
                if (realWifi === 'on' || realWifi === 'off') {
                    const active = realWifi === 'on';
                    localStorage.setItem('liquid_wifi_enabled', active);
                    const tileEl = container.querySelector('#ic-wifi');
                    if (tileEl) {
                        tileEl.classList.toggle('active', active);
                        const statusText = tileEl.querySelector('.ic-tile-status');
                        if (statusText) statusText.innerText = active ? 'Activé' : 'Désactivé';
                    }
                }
            } catch (e) { }

            // Bluetooth Status
            try {
                const realBt = await ipcRenderer.invoke('bluetooth-control', 'status');
                if (realBt === 'on' || realBt === 'off') {
                    const active = realBt === 'on';
                    localStorage.setItem('liquid_bluetooth_enabled', active);
                    const tileEl = container.querySelector('#ic-bluetooth');
                    if (tileEl) {
                        tileEl.classList.toggle('active', active);
                        const statusText = tileEl.querySelector('.ic-tile-status');
                        if (statusText) statusText.innerText = active ? 'Activé' : 'Désactivé';
                    }
                }
            } catch (e) { }

            // DND Status
            try {
                const realDnd = await ipcRenderer.invoke('dnd-control', 'status');
                if (realDnd === 'on' || realDnd === 'off') {
                    const active = realDnd === 'on';
                    localStorage.setItem('liquid_dnd_enabled', active);
                    const tileEl = container.querySelector('#ic-dnd');
                    if (tileEl) {
                        tileEl.classList.toggle('active', active);
                        const statusText = tileEl.querySelector('.ic-tile-status');
                        if (statusText) statusText.innerText = active ? 'Activé' : 'Désactivé';
                    }
                }
            } catch (e) { }

            // Battery Status
            if (widgetType === 'machine' && navigator.getBattery) {
                try {
                    const batt = await navigator.getBattery();
                    batteryLevel = Math.round(batt.level * 100);
                    batteryCharging = batt.charging;
                    
                    const battVal = document.getElementById('ic-mach-val-batt');
                    const battFill = document.getElementById('ic-mach-fill-batt');
                    const battLabel = document.getElementById('ic-mach-lbl-batt');
                    
                    if (battVal) battVal.innerText = `${batteryLevel}%`;
                    if (battFill) battFill.style.width = `${batteryLevel}%`;
                    if (battLabel) {
                        const battIcon = batteryCharging ? 'ph-battery-charging' : 'ph-battery-high';
                        const battLabelText = batteryCharging ? 'Secteur' : 'Batterie';
                        battLabel.innerHTML = `<i class="ph-fill ${battIcon}" style="dots; color: ${batteryCharging ? '#34c759' : ''}"></i> ${battLabelText}`;
                    }
                } catch(e){}
            }

            // Disk Space Status (PowerShell Command)
            if (widgetType === 'machine') {
                try {
                    const { exec } = require('child_process');
                    const cmd = `powershell -Command "Get-CimInstance Win32_LogicalDisk -Filter \\"DeviceID='C:'\\" | Select-Object FreeSpace, Size | ConvertTo-Json"`;
                    const diskData = await new Promise(resolve => {
                        exec(cmd, (err, stdout) => {
                            if (!err && stdout) {
                                try {
                                    const parsed = JSON.parse(stdout.trim());
                                    if (parsed && parsed.FreeSpace !== undefined) {
                                        resolve(parsed);
                                        return;
                                    }
                                } catch(e){}
                            }
                            resolve(null);
                        });
                    });
                    
                    if (diskData) {
                        const freeBytes = diskData.FreeSpace;
                        const totalBytes = diskData.Size;
                        diskFreeGb = Math.round(freeBytes / (1024 * 1024 * 1024));
                        diskPercent = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
                        
                        const diskVal = document.getElementById('ic-mach-val-disk');
                        const diskFill = document.getElementById('ic-mach-fill-disk');
                        
                        if (diskVal) diskVal.innerText = `${diskFreeGb} Go libres`;
                        if (diskFill) diskFill.style.width = `${diskPercent}%`;
                    }
                } catch(e){}
            }

            // Grouped Audio sessions for Mixer Widget
            if (widgetType === 'mixer') {
                try {
                    const mixerCard = document.getElementById('ic-cc-mixer-card');
                    if (mixerCard) {
                        const sessions = await ipcRenderer.invoke('get-audio-sessions');
                        if (sessions) {
                            this.audioSessions = sessions;
                            const grouped = this.getGroupedSessions(sessions);
                            let mixerRowsHtml = '';
                            
                            if (grouped.length === 0) {
                                mixerRowsHtml = `
                                    <div style="grid-column: 1/-1; opacity: 0.5; font-size: 11px; text-align: center; padding: 15px 0;">
                                        Aucun flux audio détecté
                                    </div>
                                `;
                            } else {
                                mixerRowsHtml = grouped.slice(0, 3).map(s => {
                                    const icon = s.icon || getMixerIcon(s.name, s.title);
                                    const isMuted = s.volume === 0 || s.muted;
                                    const activeVol = isMuted ? 0 : Math.round(s.volume);
                                    
                                    let iconHtml = '';
                                    if (icon) {
                                        iconHtml = `
                                            <img src="${icon}" style="width: 14px; height: 14px; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                                            <i class="ph-fill ph-music-note" style="display: none; font-size: 12px;"></i>
                                        `;
                                    } else {
                                        iconHtml = `<i class="ph-fill ph-music-note"></i>`;
                                    }
                                    
                                    const muteIcon = isMuted ? 'ph-speaker-slash' : (activeVol < 50 ? 'ph-speaker-low' : 'ph-speaker-high');
                                    
                                    let cleanName = s.name.replace('.exe', '');
                                    if (cleanName.toLowerCase() === 'audiodg') cleanName = 'System Sounds';
                                    
                                    return `
                                        <div class="ic-mixer-row">
                                            <div class="ic-mixer-app-icon" title="${cleanName}">
                                                ${iconHtml}
                                            </div>
                                            <div class="ic-mixer-slider-wrapper">
                                                <input type="range" class="ic-mixer-slider" data-pid="${s.pid}" min="0" max="100" value="${activeVol}">
                                            </div>
                                            <span class="ic-mixer-vol">${activeVol}%</span>
                                            <div class="ic-mixer-mute ${isMuted ? 'muted' : ''}" data-pid="${s.pid}">
                                                <i class="ph-fill ${muteIcon}"></i>
                                            </div>
                                        </div>
                                    `;
                                }).join('');
                            }
                            mixerCard.innerHTML = mixerRowsHtml;
                        }
                    }
                } catch(e){}
            }
        };

        // Fire async updates immediately without blocking the synchronous render thread!
        updateAsyncSystemData();
    }

    renderMenu() {
        const statsEnabled = localStorage.getItem('liquid_island_stats_enabled') !== 'false';
        const timerEnabled = localStorage.getItem('liquid_island_timer_enabled') !== 'false';
        const networkEnabled = localStorage.getItem('liquid_island_network_enabled') !== 'false';
        const musicEnabled = localStorage.getItem('liquid_music_enabled') !== 'false';
        const controlEnabled = localStorage.getItem('liquid_island_control_enabled') !== 'false';
        const searchEnabled = localStorage.getItem('liquid_search_island_sync') !== 'false';

        let itemsHtml = '';

        if (controlEnabled) {
            itemsHtml += `
            <div class="island-menu-item" onclick="event.stopPropagation(); window.island.setMode('control')">
                <div class="menu-icon"><i class="ph-fill ph-sliders"></i></div>
                <span>Contrôle</span>
            </div>`;
        }

        if (musicEnabled) {
            itemsHtml += `
            <div class="island-menu-item" onclick="event.stopPropagation(); window.island.setMode('music')">
                <div class="menu-icon"><i class="ph-fill ph-music-notes"></i></div>
                <span>Musique</span>
            </div>`;

            itemsHtml += `
            <div class="island-menu-item" onclick="event.stopPropagation(); window.island.setMode('music-history')">
                <div class="menu-icon"><i class="ph-fill ph-clock-counter-clockwise"></i></div>
                <span>Historique</span>
            </div>`;
        }

        if (timerEnabled) {
            itemsHtml += `
            <div class="island-menu-item" onclick="event.stopPropagation(); window.island.setMode('timer')">
                <div class="menu-icon"><i class="ph-fill ph-timer"></i></div>
                <span>Chrono</span>
            </div>`;
        }

        // Mixer integration
        itemsHtml += `
        <div class="island-menu-item" onclick="event.stopPropagation(); window.island.setMode('mixer')">
            <div class="menu-icon"><i class="ph-fill ph-sliders-horizontal"></i></div>
            <span>Mélangeur</span>
        </div>`;

        // Réglages integration
        itemsHtml += `
        <div class="island-menu-item" onclick="event.stopPropagation(); window.island.setMode('settings')">
            <div class="menu-icon"><i class="ph-fill ph-gear"></i></div>
            <span>Réglages</span>
        </div>`;

        if (itemsHtml === '') {
            itemsHtml = '<div style="grid-column: 1/-1; opacity: 0.5; font-size: 13px;">Aucun module actif</div>';
        }

        this.content.innerHTML = `
            <div class="island-menu-grid">
                ${itemsHtml}
            </div>
        `;
    }

    renderIdle() {
        if (this.isExpanded) return;

        // Apply a gorgeous blurred cover art background to the small pill if playing music!
        const bgLayer = this.el.querySelector('.island-bg-layer');
        const musicEnabled = localStorage.getItem('liquid_music_enabled') !== 'false';
        const idleCoverBgEnabled = localStorage.getItem('liquid_island_idle_cover_bg') !== 'false';
        const effectiveIdleArt = getDisplayMediaArt(this.musicData);
        const showMusicCoverBg = musicEnabled && idleCoverBgEnabled && this.musicData && this.musicData.isPlaying && effectiveIdleArt && effectiveIdleArt.length > 0;

        if (bgLayer) {
            if (showMusicCoverBg && localStorage.getItem('liquid_cover_color_sync') !== 'false') {
                const cleanCover = effectiveIdleArt.replace(/\\/g, '/');
                bgLayer.style.backgroundImage = `url("${cleanCover}")`;
                bgLayer.style.opacity = '0.55'; // Vibrant visibility for tiny capsule
                bgLayer.style.filter = 'blur(16px) saturate(200%)';
            } else {
                const islandConfig = JSON.parse(localStorage.getItem('liquid_island_config') || '{}');
                if (islandConfig.bgImage && (!this.musicData || !this.musicData.isPlaying)) {
                    bgLayer.style.backgroundImage = `url('${islandConfig.bgImage.replace(/\\/g, '/')}')`;
                    bgLayer.style.opacity = (islandConfig.imgOpacity || 100) / 100;
                    bgLayer.style.filter = `blur(${islandConfig.blur || 30}px)`;
                } else {
                    bgLayer.style.backgroundImage = 'none';
                    bgLayer.style.opacity = '0';
                }
            }
        }

        if (this.mode === 'ai-thinking') {
            this.el.classList.add('island-active-music');
            this.content.innerHTML = `
                <div class="island-idle-content" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 100%; padding: 0 16px; color: var(--neon-primary); font-weight: 600; font-size: 13px;">
                    <i class="ph-fill ph-robot" style="font-size: 16px; animation: pulseGlow 1.5s infinite;"></i>
                    <span style="font-family: inherit; font-size: 12px; letter-spacing: 0.5px;">Liquid AI réfléchit...</span>
                </div>
            `;
            this._vizCanvas = null;
            this.syncVisualizerActivity();
            return;
        }

        if (this.mode === 'ai-action') {
            this.el.classList.add('island-active-music');
            const label = this.aiActionLabel || 'Action';
            this.content.innerHTML = `
                <div class="island-idle-content" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 100%; padding: 0 16px; color: var(--neon-secondary); font-weight: 600; font-size: 13px;">
                    <i class="ph-fill ph-sparkles" style="font-size: 16px; animation: pulseGlow 1.5s infinite;"></i>
                    <span style="font-family: inherit; font-size: 12px; letter-spacing: 0.5px;">Exécute : ${label}...</span>
                </div>
            `;
            this._vizCanvas = null;
            this.syncVisualizerActivity();
            return;
        }

        if (this.isTimerRunning) {
            this.el.classList.add('island-active-music');
            const mins = Math.floor(this.timerValue / 60).toString().padStart(2, '0');
            const secs = (this.timerValue % 60).toString().padStart(2, '0');

            const isMusicPlaying = this.musicData && this.musicData.isPlaying;
            const timerColor = isMusicPlaying ? 'var(--neon-primary)' : '#ffffff';
            const iconGlow = isMusicPlaying ? 'drop-shadow(0 0 4px var(--neon-primary))' : 'none';

            this.content.innerHTML = `
        <div class="island-idle-content" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 100%;">
          <i class="ph-fill ph-timer" style="color: ${timerColor}; font-size: 16px; filter: ${iconGlow};"></i>
          <span style="color: ${timerColor}; font-family: var(--font-mono); font-weight: 700; font-size: 15px; letter-spacing: 0.5px;">
            ${mins}:${secs}
          </span>
        </div>
      `;
            this._vizCanvas = null;
            this.syncVisualizerActivity();
            return;
        }

        // Mini Network Indicator if in network mode but idle? 
        // Or if user prefers network monitoring in idle. 
        // For now, let's keep idle standard unless playing music or explicitly notifying.
        // However, if we want the "Pulse" to be useful for background monitoring, we could add a tiny dot or indicator.
        // Let's stick to music logic for now as per usual OS behavior.

        if (musicEnabled && this.musicData && this.musicData.isPlaying) {
            this.el.classList.add('island-active-music');
            this.el.classList.remove('island-active-network'); // Ensure unique state
            const compactMode = localStorage.getItem('liquid_idle_compact_mode') || 'cover';

            let coverHtml;
            const appIcon = getFallbackIcon(this.musicData.appId, this.musicData.title, this.musicData.artist, this.musicData.windowTitle);
            const preferServiceIcon = shouldPreferServiceIcon(this.musicData.appId, this.musicData.title, this.musicData.artist);
            const displayArt = getDisplayMediaArt(this.musicData);
            if (preferServiceIcon && appIcon) {
                coverHtml = `<img src="${appIcon}" style="width: 28px; height: 28px; border-radius: 6px; ${getServiceArtStyle('small')} margin-left: 2px;" onerror="this.outerHTML='<div style=\\'width: 28px; height: 28px; border-radius: 6px; background: linear-gradient(135deg, var(--neon-primary), var(--neon-secondary)); display: flex; align-items: center; justify-content: center; margin-left: 2px;\\'><i class=\\'ph-fill ph-music-note\\' style=\\'font-size: 14px; color: #fff;\\'></i></div>';">`;
            } else if (displayArt && displayArt.length > 0) {
                coverHtml = `<img src="${displayArt}" style="width: 28px; height: 28px; border-radius: 6px; object-fit: cover; margin-left: 2px;" onerror="this.outerHTML='<div style=\\'width: 28px; height: 28px; border-radius: 6px; background: linear-gradient(135deg, var(--neon-primary), var(--neon-secondary)); display: flex; align-items: center; justify-content: center; margin-left: 2px;\\'><i class=\\'ph-fill ph-music-note\\' style=\\'font-size: 14px; color: #fff;\\'></i></div>';">`;
            } else {
                if (appIcon) {
                    coverHtml = `<img src="${appIcon}" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain; background: #000; padding: 2px; margin-left: 2px;" onerror="this.outerHTML='<div style=\\'width: 28px; height: 28px; border-radius: 6px; background: linear-gradient(135deg, var(--neon-primary), var(--neon-secondary)); display: flex; align-items: center; justify-content: center; margin-left: 2px;\\'><i class=\\'ph-fill ph-music-note\\' style=\\'font-size: 14px; color: #fff;\\'></i></div>';">`;
                } else {
                    coverHtml = `<img src="${APP_LOGO_ART}" class="idle-cover-art app-logo-art" alt="Liquid Dynamic Island">`;
                }
            }

            let idleInnerHtml = `
          ${coverHtml}
          <canvas class="live-viz-canvas" width="50" height="20" style="display:block; image-rendering: pixelated;"></canvas>
            `;

            if (compactMode === 'title') {
                idleInnerHtml = `
          ${coverHtml}
          <div class="idle-track-chip">
            <span>${escapeHtml(this.musicData.title || 'Lecture')}</span>
            <small>${escapeHtml(this.musicData.artist || '')}</small>
          </div>
                `;
            } else if (compactMode === 'volume') {
                const group = this.currentMediaVolumeGroup;
                const activeVol = group ? (group.muted || group.volume === 0 ? 0 : Math.round(group.volume || 0)) : null;
                const icon = activeVol === 0 ? 'ph-speaker-slash' : (activeVol !== null && activeVol < 50 ? 'ph-speaker-low' : 'ph-speaker-high');
                idleInnerHtml = `
          <div class="idle-metric-chip">
            <i class="ph-fill ${icon}"></i>
            <span>${activeVol === null ? '--' : `${activeVol}%`}</span>
          </div>
                `;
                if (!group && (!this._idleVolumeRefreshAt || Date.now() - this._idleVolumeRefreshAt > 2000)) {
                    this._idleVolumeRefreshAt = Date.now();
                    this.refreshCurrentMediaVolumeSession().then(() => {
                        if (!this.isExpanded && localStorage.getItem('liquid_idle_compact_mode') === 'volume') this.renderIdle();
                    });
                }
            } else if (compactMode === 'progress') {
                idleInnerHtml = `
          <div class="idle-metric-chip">
            <i class="ph-fill ph-waveform"></i>
            <span>${formatTime(this.musicData.progress || 0)}</span>
          </div>
                `;
            }

            this.content.innerHTML = `
        <div class="island-idle-content" style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 18px 0 8px;">
          ${idleInnerHtml}
        </div>
            `;
            // Wire canvas to visualizer
            this._vizCanvas = this.content.querySelector('.live-viz-canvas');
            this.syncVisualizerActivity();
        } else {
            this.el.classList.remove('island-active-music');
            this.el.classList.remove('island-active-network');
            this.el.style.animation = 'none'; // Ensure no rouge animation
            this.el.style.boxShadow = ''; // Reset to CSS default
            this.content.innerHTML = '';
            this._vizCanvas = null;
            this.syncVisualizerActivity();
            // Restore default settings glow
            ThemeService.applyIslandSettings();
        }
    }

    renderNotification() {
        const { title, message, icon } = this.notificationData || { title: 'Notification', message: '...', icon: 'ph-bell' };
        const safeTitle = escapeHtml(title);
        const safeMessage = escapeHtml(message);
        const safeIcon = String(icon || 'ph-bell').replace(/[^a-z0-9-\s]/gi, '').trim() || 'ph-bell';

        // Vérifie si l'île est en mode d'expansion complète ou notification compacte
        const isExpanded = this.el.classList.contains('island-expanded');

        this.content.innerHTML = `
      <div class="island-notification ${isExpanded ? 'expanded' : 'compact'}">
        <div class="notif-icon-wrapper">
          <i class="ph-fill ${safeIcon} notif-icon"></i>
        </div>
        <div class="notif-content">
          <div class="notif-title">${isExpanded ? safeTitle : `<strong>${safeTitle} :</strong> ${safeMessage}`}</div>
          ${isExpanded ? `<div class="notif-message">${safeMessage}</div>` : ''}
        </div>
      </div>
    `;
    }

    renderMusic() {
        const data = this.musicData || {
            title: "Aucune lecture",
            artist: "Lecteur média",
            cover: "",
            isPlaying: false,
            progress: 0,
            duration: 0
        };

        const pct = (data.progress && data.duration) ? (data.progress / data.duration) * 100 : 0;
        const currentTime = formatTime(data.progress || 0);
        const totalTime = formatTime(data.duration || 0);
        const showTimes = localStorage.getItem('liquid_player_show_times') !== 'false';
        const showVisualizer = localStorage.getItem('liquid_player_show_visualizer') !== 'false';
        const showActions = localStorage.getItem('liquid_player_show_actions') !== 'false';
        const displayArt = getDisplayMediaArt(data);
        const rawDisplayArt = getRawDisplayMediaArt(data);
        const showMediaDebug = localStorage.getItem('liquid_media_debug') === 'true';
        const debugCoverState = displayArt && rawDisplayArt && displayArt !== rawDisplayArt ? 'preload' : data.cover ? 'real' : data.transientCover ? 'temp' : rawDisplayArt ? 'logo' : 'none';
        const debugTrackKey = data.trackKey || getMusicHistoryKey(data);
        const mediaDebugHtml = showMediaDebug ? `
        <div class="media-debug-row" title="${escapeHtml(debugTrackKey)}">
          <span>SRC ${escapeHtml(data.source || 'n/a')}</span>
          <span>COVER ${escapeHtml(debugCoverState)}</span>
          <span>KEY ${escapeHtml(debugTrackKey.slice(0, 34))}</span>
        </div>` : '';
        const isFavorite = this.isCurrentMusicFavorite();

        const currentRenderTrackKey = data.trackKey || getMusicHistoryKey(data);
        const shouldAnimateCover = Boolean(this._pendingCoverAnimationTrackKey && this._pendingCoverAnimationTrackKey === currentRenderTrackKey);
        const flipClass = shouldAnimateCover ? 'flip-active' : '';
        let coverHtml;
        const appIcon = getFallbackIcon(data.appId, data.title, data.artist, data.windowTitle);
        const preferServiceIcon = shouldPreferServiceIcon(data.appId, data.title, data.artist);
        const isDisplayServiceArt = appIcon && displayArt === appIcon;
        const displayArtStyle = isDisplayServiceArt ? getServiceArtStyle('large') : '';
        const previousDisplayArt = shouldAnimateCover && data.previousDisplayCover && data.previousDisplayCover !== displayArt ? data.previousDisplayCover : '';

        if (displayArt && displayArt.length > 0) {
            const currentImg = `<img src="${escapeHtml(displayArt)}" class="album-art-img album-art-current" style="${displayArtStyle}" alt="Album">`;
            coverHtml = previousDisplayArt
                ? `<div class="album-art album-art-stack ${isDisplayServiceArt ? 'is-service-art' : ''}">
                    <img src="${escapeHtml(previousDisplayArt)}" class="album-art-img album-art-previous" alt="">
                    ${currentImg}
                  </div>`
                : `<img src="${escapeHtml(displayArt)}" class="album-art ${flipClass}" style="${displayArtStyle}" alt="Album">`;
        } else {
            if (appIcon) {
                coverHtml = `<img src="${appIcon}" class="album-art ${flipClass}" style="object-fit: contain; background: #000; padding: 5px;" alt="App Icon">`;
            } else {
                coverHtml = `<img src="${APP_LOGO_ART}" class="album-art app-logo-art ${flipClass}" alt="Liquid Dynamic Island">`;
            }
        }

        const menuBtn = `
          <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
            <i class="ph-fill ph-squares-four"></i>
          </button>`;

        const favoriteBtn = `
          <button class="island-action-btn music-favorite-btn ${isFavorite ? 'is-favorite' : ''}" onclick="event.stopPropagation(); window.island.toggleCurrentMusicFavorite()" title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            <i class="ph-fill ph-star"></i>
          </button>`;

        const historyBtn = `
          <button class="island-action-btn music-history-btn" onclick="event.stopPropagation(); window.island.setMode('music-history')" title="Historique musique">
            <i class="ph-fill ph-clock-counter-clockwise"></i>
          </button>`;

        this.content.innerHTML = `
      <div class="music-player">
        <div class="music-info">
          ${coverHtml}
          <div class="track-details">
            <div class="track-title">${escapeHtml(data.title)}</div>
            <div class="track-artist">${escapeHtml(data.artist)}</div>
          </div>
          ${showActions ? `
            <div class="music-action-cluster">
              ${historyBtn}
              ${favoriteBtn}
              ${menuBtn}
            </div>
          ` : ''}
        </div>
        <div class="music-controls">
          <button class="control-btn-music" onclick="event.stopPropagation(); window.spotifyControl('prev')"><i class="ph-fill ph-skip-back"></i></button>
          <button class="control-btn-music play-btn" onclick="event.stopPropagation(); window.spotifyControl('toggle')">
            <i class="ph-fill ${data.isPlaying ? 'ph-pause' : 'ph-play'}"></i>
          </button>
          <button class="control-btn-music" onclick="event.stopPropagation(); window.spotifyControl('next')"><i class="ph-fill ph-skip-forward"></i></button>
        </div>
        <div class="progress-bar" style="--progress-pct: ${pct}%">
          <div class="progress-fill" id="music-progress-fill" style="width: ${pct}%"></div>
          <div class="progress-tooltip" id="music-progress-tooltip">${currentTime}</div>
        </div>
        ${showTimes ? `<div class="music-time-row">
            <span id="music-current-time">${currentTime}</span>
            <span>${totalTime}</span>
        </div>` : ''}
        ${mediaDebugHtml}
        ${showVisualizer ? '<canvas class="music-viz-canvas" width="380" height="24" style="display:block; width:100%;"></canvas>' : ''}
      </div>
    `;

        // Wire expanded canvas visualizer
        this._vizCanvas = showVisualizer ? this.content.querySelector('.music-viz-canvas') : null;
        this.syncVisualizerActivity();
        this.refreshCurrentMediaVolumeSession();



        // Update BG
        const bgLayer = this.el.querySelector('.island-bg-layer');
        if (bgLayer) {
            const effectiveBgArt = getDisplayMediaArt(data);
            if (effectiveBgArt && effectiveBgArt.length > 0) {
                bgLayer.style.backgroundImage = `url(${effectiveBgArt.replace(/\\/g, '/')})`;
                bgLayer.style.opacity = '0.5';
                bgLayer.style.filter = 'blur(24px) saturate(180%)';
            } else {
                const islandConfig = JSON.parse(localStorage.getItem('liquid_island_config') || '{}');
                if (islandConfig.bgImage) {
                    bgLayer.style.backgroundImage = `url('${islandConfig.bgImage.replace(/\\/g, '/')}')`;
                    bgLayer.style.opacity = (islandConfig.imgOpacity || 100) / 100;
                    bgLayer.style.filter = `blur(${islandConfig.blur || 30}px)`;
                } else {
                    bgLayer.style.backgroundImage = 'none';
                }
            }
        }

        if (shouldAnimateCover && this._pendingCoverAnimationTrackKey === currentRenderTrackKey) {
            this._pendingCoverAnimationTrackKey = "";
        }
        if (this.musicData) {
            this.musicData.animateCover = false;
            this.musicData.previousDisplayCover = "";
        }
        this._isNewTrackSignal = false;
    }

    renderMusicSearch() {
        const data = this.musicData || {};
        const provider = this.musicSearchProviderOverride || getMusicSearchProvider(data);
        const currentQuery = getCurrentTrackSearchQuery(data);
        const draft = this.musicSearchDraft || '';
        const hasCurrentTrack = currentQuery.length > 0;

        this.content.innerHTML = `
      <div class="music-search-panel">
        <div class="music-search-header">
          <button class="island-action-btn music-search-back" id="music-search-back" title="Retour lecteur">
            <i class="ph-bold ph-arrow-left"></i>
          </button>
          <div class="music-search-heading">
            <span>Recherche musique</span>
            <small><i class="ph-fill ${provider.icon}"></i> ${escapeHtml(provider.label)} detecte</small>
          </div>
        </div>

        <div class="music-search-field">
          <i class="ph-bold ph-magnifying-glass"></i>
          <input id="music-search-input" type="text" value="${escapeHtml(draft)}" placeholder="Titre, artiste, album...">
          <button id="music-search-submit" title="Lancer la recherche">
            <i class="ph-bold ph-arrow-square-out"></i>
          </button>
        </div>

        <div class="music-search-actions">
          ${hasCurrentTrack ? `
            <button class="music-search-chip" id="music-search-current" title="Rechercher le morceau en cours">
              <i class="ph-fill ph-music-note"></i>
              <span>${escapeHtml(currentQuery)}</span>
            </button>
          ` : `
            <div class="music-search-empty">Aucun morceau en cours a reprendre.</div>
          `}
        </div>

        <div class="music-search-hint" id="music-search-hint">
          Ouvre directement la recherche dans ${escapeHtml(provider.label)} quand c'est possible.
        </div>
      </div>
    `;

        this._vizCanvas = null;

        const input = this.content.querySelector('#music-search-input');
        const submitBtn = this.content.querySelector('#music-search-submit');
        const backBtn = this.content.querySelector('#music-search-back');
        const currentBtn = this.content.querySelector('#music-search-current');

        const submit = (value) => {
            this.openMusicSearch(value || input.value);
        };

        input.addEventListener('input', () => {
            this.musicSearchDraft = input.value;
        });
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                submit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.musicSearchProviderOverride = null;
                this.setMode('music');
            }
        });
        input.addEventListener('click', (e) => e.stopPropagation());

        submitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            submit();
        });
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.musicSearchProviderOverride = null;
            this.setMode('music');
        });
        if (currentBtn) {
            currentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                submit(currentQuery);
            });
        }

        setTimeout(() => {
            input.focus();
            input.select();
        }, 120);
    }

    openMusicSearchPanel(query = '', providerOverride = null) {
        this.musicSearchDraft = query || '';
        this.musicSearchProviderOverride = providerOverride;
        this.setMode('music-search');
    }

    openMusicSearch(query, providerOverride = null) {
        const cleanQuery = String(query || '').trim();
        const hint = this.content.querySelector('#music-search-hint');
        const input = this.content.querySelector('#music-search-input');

        if (!cleanQuery) {
            if (hint) {
                hint.textContent = 'Tape un titre ou clique sur le morceau en cours.';
                hint.classList.add('is-warning');
            }
            if (input) input.focus();
            return;
        }

        this.musicSearchDraft = cleanQuery;
        const provider = providerOverride || this.musicSearchProviderOverride || getMusicSearchProvider(this.musicData);
        const target = getMusicSearchTarget(cleanQuery, provider);

        SoundService.play('success');
        this.launchShortcut(target);

        this.musicSearchProviderOverride = null;
        this.mode = 'music';
        this.isExpanded = false;
        this.renderContent();
    }

    loadMusicHistory() {
        try {
            const parsed = JSON.parse(localStorage.getItem('liquid_music_history') || '[]');
            if (Array.isArray(parsed)) {
                // Self-correcting migration: clear massive legacy base64 covers (>5KB) to instantly restore performance!
                let changed = false;
                const migrated = parsed.map(item => {
                    if (item.cover && item.cover.startsWith('data:') && item.cover.length > 5000) {
                        item.cover = ''; // Clear massive base64 cover; will use dynamic fallback
                        changed = true;
                    }
                    return item;
                });
                if (changed) {
                    localStorage.setItem('liquid_music_history', JSON.stringify(migrated));
                }
                return migrated.slice(0, 20);
            }
            return [];
        } catch (e) {
            return [];
        }
    }

    saveMusicHistory() {
        localStorage.setItem('liquid_music_history', JSON.stringify(this.musicHistory.slice(0, 20)));
    }

    compressHistoryCover(coverUrl) {
        return new Promise((resolve) => {
            if (!coverUrl || !coverUrl.startsWith('data:')) {
                resolve(coverUrl);
                return;
            }

            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 48;
                    canvas.height = 48;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 48, 48);
                    const compressed = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(compressed);
                } catch (e) {
                    resolve(coverUrl); // fallback to original on error
                }
            };
            img.onerror = () => {
                resolve(coverUrl);
            };
            img.src = coverUrl;
        });
    }

    async addMusicHistoryItem(data) {
        if (!isHistoryTrack(data)) return;

        const effectiveArt = getEffectiveMediaArt(data);
        const compressedArt = await this.compressHistoryCover(effectiveArt || data.cover || '');
        const provider = getMusicSearchProvider(data);
        const key = getMusicHistoryKey(data);
        const previous = this.musicHistory.find(track => track.key === key);
        const isAlreadyTop = this.musicHistory[0] && this.musicHistory[0].key === key;
        const item = {
            key,
            title: data.title || 'Sans titre',
            artist: data.artist || 'Artiste inconnu',
            cover: compressedArt,
            appId: data.appId || '',
            providerKey: provider.key,
            providerLabel: provider.label,
            providerIcon: provider.icon,
            timestamp: Date.now(),
            lastPlayedAt: Date.now(),
            firstPlayedAt: previous ? (previous.firstPlayedAt || previous.timestamp || Date.now()) : Date.now(),
            playCount: isAlreadyTop ? (previous ? (previous.playCount || 1) : 1) : (previous ? (previous.playCount || 1) + 1 : 1),
            duration: data.duration || 0,
            favorite: previous ? previous.favorite === true : false
        };

        if (isAlreadyTop) {
            this.musicHistory[0] = {
                ...this.musicHistory[0],
                ...item,
                timestamp: this.musicHistory[0].timestamp || item.timestamp
            };
            this.saveMusicHistory();
            return;
        }

        const existing = this.musicHistory.filter(track => track.key !== key);
        this.musicHistory = [item, ...existing].slice(0, 20);
        this.saveMusicHistory();
    }

    getProviderFromHistoryItem(item = {}) {
        if (item.providerKey) {
            return {
                key: item.providerKey,
                label: item.providerLabel || 'Web musique',
                icon: item.providerIcon || 'ph-magnifying-glass'
            };
        }

        return getMusicSearchProvider(item);
    }

    getHistoryQuery(item = {}) {
        return getCurrentTrackSearchQuery(item) || `${item.artist || ''} ${item.title || ''}`.trim();
    }

    isCurrentHistoryItem(item = {}) {
        if (!this.musicData) return false;
        const itemTitle = (item.title || '').trim().toLowerCase();
        const itemArtist = (item.artist || '').trim().toLowerCase();
        const currentTitle = (this.musicData.title || '').trim().toLowerCase();
        const currentArtist = (this.musicData.artist || '').trim().toLowerCase();

        return itemTitle && itemArtist && itemTitle === currentTitle && itemArtist === currentArtist;
    }

    openHistoryTrack(item, mode = 'search') {
        const query = this.getHistoryQuery(item);
        const provider = this.getProviderFromHistoryItem(item);

        if (mode === 'replay' && this.isCurrentHistoryItem(item)) {
            SoundService.play('success');
            window.spotifyControl('seek 0');
            window.spotifyControl('play');
            this.returnToMusicIdle();
            this.showIslandFeedback('Relance depuis le debut', 'ph-repeat');
            return;
        }

        if (mode === 'search') {
            this.openMusicSearchPanel(query, provider);
            return;
        }

        this.openMusicSearch(query, provider);
    }

    clearMusicHistory() {
        this.musicHistory = this.loadMusicHistory().filter(item => item.favorite);
        this.saveMusicHistory();
        SoundService.play('close');
        this.renderMusicHistory();
    }

    toggleMusicFavorite(index) {
        this.musicHistory = this.loadMusicHistory();
        const item = this.musicHistory[index];
        if (!item) return;
        item.favorite = !item.favorite;
        this.saveMusicHistory();
        SoundService.play(item.favorite ? 'success' : 'close');
        this.renderMusicHistory();
    }

    isCurrentMusicFavorite() {
        const data = this.musicData || {};
        if (!isHistoryTrack(data)) return false;

        const key = getMusicHistoryKey(data);
        return this.loadMusicHistory().some(item => item.key === key && item.favorite === true);
    }

    async toggleCurrentMusicFavorite() {
        const data = this.musicData || {};
        if (!isHistoryTrack(data)) {
            this.showIslandFeedback('Aucun morceau a favoriser', 'ph-star');
            return;
        }

        const key = getMusicHistoryKey(data);
        this.musicHistory = this.loadMusicHistory();

        if (!this.musicHistory.some(item => item.key === key)) {
            await this.addMusicHistoryItem(data);
            this.musicHistory = this.loadMusicHistory();
        }

        const item = this.musicHistory.find(track => track.key === key);
        if (!item) return;

        item.favorite = !item.favorite;
        this.saveMusicHistory();
        SoundService.play(item.favorite ? 'success' : 'close');
        this.showIslandFeedback(item.favorite ? 'Ajoute aux favoris' : 'Retire des favoris', 'ph-star');

        if (this.isExpanded && this.mode === 'music') {
            this.renderMusic();
        } else if (this.isExpanded && this.mode === 'music-history') {
            this.renderMusicHistory();
        }
    }

    deleteMusicHistoryItem(index) {
        this.musicHistory = this.loadMusicHistory();
        const item = this.musicHistory[index];
        if (!item) return;

        this.musicHistory.splice(index, 1);
        this.saveMusicHistory();
        SoundService.play('close');
        this.showIslandFeedback('Morceau retire', 'ph-trash');
        this.renderMusicHistory();
    }

    setMusicHistorySearch(value) {
        this.musicHistoryQuery = String(value || '').slice(0, 80);
        this.renderMusicHistory();
        requestAnimationFrame(() => {
            const input = this.content.querySelector('#music-history-search-input');
            if (!input) return;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });
    }

    getMusicHistoryFilter() {
        const filter = localStorage.getItem('liquid_music_history_filter') || 'all';
        return ['all', 'favorites', 'recent'].includes(filter) ? filter : 'all';
    }

    setMusicHistoryFilter(filter) {
        const nextFilter = ['all', 'favorites', 'recent'].includes(filter) ? filter : 'all';
        localStorage.setItem('liquid_music_history_filter', nextFilter);
        SoundService.play('close');
        this.renderMusicHistory();
    }

    autoSizeMusicHistory() {
        if (!this.isExpanded || this.mode !== 'music-history') return;

        const panel = this.content?.querySelector?.('.music-history-panel');
        const list = this.content?.querySelector?.('.music-history-list');
        const header = this.content?.querySelector?.('.music-history-header');
        const searchFilterRow = this.content?.querySelector?.('.music-history-search-filter-row');
        if (!panel || !list || !header || !searchFilterRow) return;

        const rows = Array.from(list.querySelectorAll('.music-history-row'));
        const empty = list.querySelector('.music-history-empty');
        const titles = Array.from(list.querySelectorAll('.music-history-section-title'));
        const px = (v) => {
            const n = parseFloat(v || '0');
            return Number.isFinite(n) ? n : 0;
        };

        const panelStyle = getComputedStyle(panel);
        const panelPadTop = px(panelStyle.paddingTop);
        const panelPadBottom = px(panelStyle.paddingBottom);
        const panelGap = px(panelStyle.gap);

        const headerH = header.getBoundingClientRect().height || 0;
        const searchFilterRowH = searchFilterRow.getBoundingClientRect().height || 0;

        let listTarget = 120;
        if (empty) {
            listTarget = Math.min(140, empty.getBoundingClientRect().height || 120);
        } else if (rows.length > 0) {
            const fullScrollHeight = list.scrollHeight || 0;
            const rowH = rows[0].getBoundingClientRect().height || 64;
            const titleH = titles[0]?.getBoundingClientRect?.().height || 18;
            const maxVisibleRows = 5;
            const visibleRows = Math.min(rows.length, maxVisibleRows);
            const maxVisibleTitles = Math.min(titles.length, 2);
            const estimatedMax = (visibleRows * rowH) + (maxVisibleTitles * titleH) + 24;
            listTarget = Math.min(fullScrollHeight, estimatedMax);
        }

        let target = panelPadTop + panelPadBottom + headerH + searchFilterRowH + (panelGap * 2) + listTarget;
        target = Math.max(180, Math.min(520, target));
        this.el.style.height = `${Math.round(target)}px`;
    }

    renderMusicHistory() {
        this.musicHistory = this.loadMusicHistory();
        const query = (this.musicHistoryQuery || '').trim().toLowerCase();
        const historyFilter = this.getMusicHistoryFilter();
        const matchesQuery = (item) => {
            if (!query) return true;
            return `${item.title || ''} ${item.artist || ''} ${item.providerLabel || ''} ${item.appId || ''}`.toLowerCase().includes(query);
        };

        const allFavoriteCount = this.musicHistory.filter(item => item.favorite).length;
        const allRecentCount = this.musicHistory.length - allFavoriteCount;
        const favorites = this.musicHistory
            .map((item, index) => ({ item, index }))
            .filter(entry => historyFilter !== 'recent' && entry.item.favorite && matchesQuery(entry.item));
        const recent = this.musicHistory
            .map((item, index) => ({ item, index }))
            .filter(entry => historyFilter !== 'favorites' && !entry.item.favorite && matchesQuery(entry.item));

        const renderRows = (entries) => entries.map(({ item, index }) => {
            const provider = this.getProviderFromHistoryItem(item);
            const isCurrent = this.isCurrentHistoryItem(item);
            const cover = item.cover
                ? `<img src="${escapeHtml(item.cover)}" class="music-history-cover" alt="">`
                : `<img src="${APP_LOGO_ART}" class="music-history-cover music-history-cover-fallback app-logo-art" alt="Liquid Dynamic Island">`;

            return `
            <div class="music-history-row ${item.favorite ? 'is-favorite' : ''}" data-index="${index}">
                ${cover}
                <div class="music-history-meta">
                    <div class="music-history-title">${escapeHtml(item.title)}</div>
                    <div class="music-history-sub">
                        <span>${escapeHtml(item.artist)}</span>
                        <span class="music-history-dot"></span>
                        <span><i class="ph-fill ${escapeHtml(provider.icon)}"></i> ${escapeHtml(provider.label)}</span>
                        ${(item.playCount || 1) > 1 ? `<span class="music-history-dot"></span><span>${item.playCount} ecoutes</span>` : ''}
                        <span class="music-history-dot"></span>
                        <span>${escapeHtml(formatHistoryTime(item.timestamp))}</span>
                    </div>
                </div>
                <div class="music-history-actions">
                    <button class="music-history-action ${item.favorite ? 'is-favorite' : ''}" data-action="favorite" title="${item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"><i class="ph-fill ph-star"></i></button>
                    <button class="music-history-action" data-action="search" title="Rechercher"><i class="ph-bold ph-magnifying-glass"></i></button>
                    <button class="music-history-action ${isCurrent ? '' : 'is-disabled'}" data-action="replay" title="${isCurrent ? 'Rejouer depuis le debut' : 'Rejouer marche seulement pour le morceau en cours'}" ${isCurrent ? '' : 'disabled'}><i class="ph-fill ph-repeat"></i></button>
                    <button class="music-history-action" data-action="open" title="Ouvrir"><i class="ph-bold ph-arrow-square-out"></i></button>
                    <button class="music-history-action danger" data-action="delete" title="Supprimer"><i class="ph-bold ph-x"></i></button>
                </div>
            </div>`;
        }).join('');

        const favoriteRows = renderRows(favorites);
        const recentRows = renderRows(recent);
        const totalCount = this.musicHistory.length;
        const favoriteCount = allFavoriteCount;
        const totalPlays = this.musicHistory.reduce((sum, item) => sum + (item.playCount || 1), 0);
        const topTrack = this.musicHistory
            .slice()
            .sort((a, b) => (b.playCount || 1) - (a.playCount || 1))[0];
        const topText = topTrack && (topTrack.playCount || 1) > 1
            ? `Top: ${escapeHtml(topTrack.title)} (${topTrack.playCount}x)`
            : `${totalPlays} lecture${totalPlays > 1 ? 's' : ''}`;
        const emptyText = query
            ? 'Aucun morceau trouve.'
            : historyFilter === 'favorites'
                ? 'Aucun favori pour le moment.'
                : historyFilter === 'recent'
                    ? 'Aucun morceau recent pour le moment.'
            : 'Les prochains morceaux detectes apparaitront ici.';
        const historyFilterOptions = [
            { key: 'all', label: 'Tous', count: totalCount },
            { key: 'favorites', label: 'Favoris', count: allFavoriteCount },
            { key: 'recent', label: 'Recents', count: allRecentCount }
        ];

        this.content.innerHTML = `
      <div class="music-history-panel">
        <div class="music-history-header">
          <button class="island-action-btn music-history-back" id="music-history-back" title="Retour lecteur">
            <i class="ph-bold ph-arrow-left"></i>
          </button>
          <div class="music-history-heading">
            <span>Recently played</span>
          </div>
          <button class="island-action-btn music-history-clear" id="music-history-clear" title="Vider">
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>

        <div class="music-history-search-filter-row">
          <div class="music-history-search">
            <i class="ph-bold ph-magnifying-glass"></i>
            <input id="music-history-search-input" type="text" value="${escapeHtml(this.musicHistoryQuery || '')}" placeholder="Rechercher...">
            ${(this.musicHistoryQuery || '').trim() ? '<button id="music-history-search-clear" title="Effacer"><i class="ph-bold ph-x"></i></button>' : ''}
          </div>

          <div class="music-history-filter">
            ${historyFilterOptions.map(option => `
              <button class="${historyFilter === option.key ? 'is-active' : ''}" data-filter="${option.key}">
                <span>${option.label}</span>
                <small>${option.count}</small>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="music-history-list">
          ${favoriteRows ? `
            <div class="music-history-section-title"><i class="ph-fill ph-star"></i> Favoris</div>
            ${favoriteRows}
          ` : ''}
          ${recentRows ? `
            <div class="music-history-section-title"><i class="ph-fill ph-clock-counter-clockwise"></i> Recents</div>
            ${recentRows}
          ` : ''}
          ${favoriteRows || recentRows ? '' : `
            <div class="music-history-empty">
              <i class="ph-fill ph-clock-counter-clockwise"></i>
              <span>${emptyText}</span>
            </div>
          `}
        </div>
      </div>
    `;

        this._vizCanvas = null;

        const backBtn = this.content.querySelector('#music-history-back');
        const clearBtn = this.content.querySelector('#music-history-clear');
        const searchInput = this.content.querySelector('#music-history-search-input');
        const searchClear = this.content.querySelector('#music-history-search-clear');
        const filterBtns = this.content.querySelectorAll('.music-history-filter button');
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setMode('music');
        });
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearMusicHistory();
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('input', (e) => {
            e.stopPropagation();
            this.setMusicHistorySearch(e.target.value);
        });
        if (searchClear) {
            searchClear.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setMusicHistorySearch('');
            });
        }
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setMusicHistoryFilter(btn.dataset.filter);
            });
        });

        this.content.querySelectorAll('.music-history-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = btn.closest('.music-history-row');
                const index = Number(row && row.dataset.index);
                const item = this.musicHistory[index];
                if (!item) return;
                if (btn.dataset.action === 'favorite') {
                    this.toggleMusicFavorite(index);
                    return;
                }
                if (btn.dataset.action === 'delete') {
                    this.deleteMusicHistoryItem(index);
                    return;
                }
                this.openHistoryTrack(item, btn.dataset.action);
            });
        });

        setTimeout(() => this.autoSizeMusicHistory(), 0);
    }

    async adjustVolume(delta) {
        if (ipcRenderer) {
            try {
                let current = await ipcRenderer.invoke('get-system-volume') || 50;
                let next = Math.min(100, Math.max(0, current + delta));
                await ipcRenderer.invoke('set-system-volume', next);
                this.showVolumeIndicator(next);
            } catch (e) { }
        }
    }

    showVolumeIndicator(vol) {
        if (this._volTimeout) clearTimeout(this._volTimeout);

        const existing = this.el.querySelector('.volume-indicator-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'volume-indicator-toast';
        const icon = vol === 0 ? 'ph-speaker-slash' : (vol < 50 ? 'ph-speaker-low' : 'ph-speaker-high');
        toast.innerHTML = `<i class="ph-fill ${icon}"></i> <span>${vol}%</span>`;

        this.el.appendChild(toast);

        this._volTimeout = setTimeout(() => {
            toast.style.transition = 'opacity 0.3s, transform 0.3s';
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -50%) scale(0.9)';
            setTimeout(() => toast.remove(), 300);
            this._volTimeout = null;
        }, 1200);
    }

    showIslandFeedback(message, icon = 'ph-check') {
        if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout);

        const existing = this.el.querySelector('.island-feedback-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'island-feedback-toast';
        toast.innerHTML = `<i class="ph-fill ${icon}"></i><span>${escapeHtml(message)}</span>`;
        this.el.appendChild(toast);

        this._feedbackTimeout = setTimeout(() => {
            toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -50%) scale(0.94)';
            setTimeout(() => toast.remove(), 260);
            this._feedbackTimeout = null;
        }, 1100);
    }

    getGroupedSessions(sessions) {
        const groups = {};
        for (const s of sessions) {
            let cleanName = s.name.replace('.exe', '');
            if (cleanName.toLowerCase() === 'audiodg') cleanName = 'System Sounds';
            if (cleanName.toLowerCase() === 'msedge') cleanName = 'Microsoft Edge';
            
            const key = cleanName.toLowerCase();
            if (!groups[key]) {
                groups[key] = {
                    pid: s.pid,
                    name: s.name,
                    cleanName: cleanName,
                    pids: [s.pid],
                    volume: s.volume,
                    muted: s.muted,
                    title: s.title,
                    icon: s.icon || ''
                };
            } else {
                groups[key].pids.push(s.pid);
                groups[key].volume = Math.max(groups[key].volume, s.volume);
                groups[key].muted = groups[key].muted && s.muted;
                if (s.title && s.title.trim().length > 0 && (!groups[key].title || groups[key].title.trim().length === 0)) {
                    groups[key].title = s.title;
                }
                if (s.icon && !groups[key].icon) {
                    groups[key].icon = s.icon;
                }
            }
        }
        return Object.values(groups);
    }

    normalizeAudioMatchText(value) {
        return String(value || '')
            .toLowerCase()
            .replace('.exe', '')
            .replace('microsoft.', '')
            .replace(/[^a-z0-9]+/g, '');
    }

    isBrowserAudioToken(token) {
        const normalized = this.normalizeAudioMatchText(token);
        return ['chrome', 'googlechrome', 'msedge', 'microsoftedge', 'edge', 'firefox', 'brave', 'opera', 'operagx', 'arc'].some(browser => normalized.includes(browser));
    }

    isWebMediaServiceToken(token) {
        const normalized = this.normalizeAudioMatchText(token);
        return [
            'youtube',
            'youtubemusic',
            'netflix',
            'spotify',
            'deezer',
            'soundcloud',
            'disney',
            'disneyplus',
            'crunchyroll',
            'primevideo',
            'amazonprime',
            'amazonmusic',
            'tidal'
        ].some(service => normalized.includes(service));
    }

    getCurrentMediaSessionGroup(grouped = this.getGroupedSessions(this.audioSessions || [])) {
        const data = this.musicData || {};
        const appToken = this.normalizeAudioMatchText(data.appId);
        const titleText = String(data.title || '').trim().toLowerCase();
        const artistText = String(data.artist || '').trim().toLowerCase();
        const titleToken = this.normalizeAudioMatchText(data.title);
        const artistToken = this.normalizeAudioMatchText(data.artist);
        const provider = getMusicSearchProvider(data);
        const providerToken = this.normalizeAudioMatchText(provider.label);
        const shouldFallbackToBrowser = this.isBrowserAudioToken(appToken) || this.isWebMediaServiceToken(appToken) || this.isWebMediaServiceToken(providerToken);

        if (!appToken && !titleText && !artistText) return null;

        let best = null;
        let bestScore = 0;

        for (const group of grouped) {
            const groupName = this.normalizeAudioMatchText(group.name || group.cleanName);
            const groupTitle = String(group.title || '').trim().toLowerCase();
            const groupTitleToken = this.normalizeAudioMatchText(group.title);
            const isSystem = groupName.includes('audiodg') || groupName.includes('systemsounds');
            if (isSystem) continue;

            let score = 0;

            if (appToken) {
                if (groupName === appToken || groupName.includes(appToken) || appToken.includes(groupName)) score += 90;
                if (appToken.includes('msedge') && groupName.includes('microsoftedge')) score += 90;
                if (appToken.includes('chrome') && groupName.includes('chrome')) score += 90;
                if (appToken.includes('firefox') && groupName.includes('firefox')) score += 90;
                if (appToken.includes('spotify') && groupName.includes('spotify')) score += 90;
            }

            if (shouldFallbackToBrowser && this.isBrowserAudioToken(groupName)) {
                score += this.isBrowserAudioToken(appToken) ? 90 : 65;
                if (groupTitleToken.includes('youtube') || groupTitleToken.includes('netflix') || groupTitleToken.includes('spotify')) score += 15;
            }

            if (providerToken && providerToken !== 'webmusique') {
                if (groupName.includes(providerToken) || groupTitle.includes(provider.label.toLowerCase()) || groupTitleToken.includes(providerToken)) score += 35;
            }

            if (titleText.length > 3 && groupTitle.includes(titleText.slice(0, 24))) score += 25;
            if (artistText.length > 3 && groupTitle.includes(artistText.slice(0, 24))) score += 15;
            if (titleToken.length > 3 && groupTitleToken.includes(titleToken.slice(0, 24))) score += 25;
            if (artistToken.length > 3 && groupTitleToken.includes(artistToken.slice(0, 24))) score += 15;

            if (score > bestScore) {
                bestScore = score;
                best = group;
            }
        }

        if (!best && grouped.length === 1 && isHistoryTrack(data)) {
            const onlyGroup = grouped[0];
            const onlyName = this.normalizeAudioMatchText(onlyGroup.name || onlyGroup.cleanName);
            if (!onlyName.includes('audiodg') && !onlyName.includes('systemsounds')) {
                best = onlyGroup;
            }
        }

        return bestScore >= 20 || best ? best : null;
    }

    bindCurrentMediaVolumeControls() {
        const card = this.content.querySelector('#current-app-volume-card');
        const slider = this.content.querySelector('#current-app-volume-slider');
        if (!card || !slider) return;

        const stop = (e) => e.stopPropagation();
        card.addEventListener('mousedown', stop);
        card.addEventListener('click', stop);
        slider.addEventListener('input', (e) => {
            e.stopPropagation();
            const volume = Math.max(0, Math.min(100, Number(e.target.value)));
            this.setCurrentMediaVolume(volume);
        });
    }

    updateCurrentMediaVolumeUI(grouped = this.getGroupedSessions(this.audioSessions || [])) {
        const card = this.content.querySelector('#current-app-volume-card');
        const slider = this.content.querySelector('#current-app-volume-slider');
        const valueEl = this.content.querySelector('#current-app-volume-value');
        const nameEl = this.content.querySelector('#current-app-volume-name');
        const iconEl = this.content.querySelector('#current-app-volume-icon');
        if (!card || !slider || !valueEl || !nameEl || !iconEl) return;

        const group = this.getCurrentMediaSessionGroup(grouped);
        this.currentMediaVolumeGroup = group;

        if (!group) {
            card.classList.add('is-disabled');
            card.classList.remove('is-loading');
            slider.disabled = true;
            slider.value = 0;
            slider.style.setProperty('--volume-pct', '0%');
            valueEl.innerText = '--';
            nameEl.innerText = 'App introuvable';
            iconEl.className = 'ph-fill ph-speaker-none';
            return;
        }

        const isMuted = group.volume === 0 || group.muted;
        const activeVol = isMuted ? 0 : Math.round(group.volume);
        const cleanName = group.cleanName || String(group.name || '').replace('.exe', '') || 'App';
        const icon = activeVol === 0 ? 'ph-speaker-slash' : (activeVol < 50 ? 'ph-speaker-low' : 'ph-speaker-high');

        card.classList.remove('is-disabled', 'is-loading');
        slider.disabled = false;
        slider.value = activeVol;
        slider.style.setProperty('--volume-pct', `${activeVol}%`);
        valueEl.innerText = `${activeVol}%`;
        nameEl.innerText = cleanName;
        iconEl.className = `ph-fill ${icon}`;
    }

    async setCurrentMediaVolume(volume) {
        const group = this.currentMediaVolumeGroup || this.getCurrentMediaSessionGroup();
        if (!group) return;

        const targetVolume = Math.max(0, Math.min(100, Math.round(volume)));
        const pids = Array.isArray(group.pids) && group.pids.length > 0 ? group.pids : [group.pid];

        group.volume = targetVolume;
        group.muted = targetVolume === 0;
        for (const session of this.audioSessions) {
            if (pids.includes(session.pid)) {
                session.volume = targetVolume;
                session.muted = targetVolume === 0;
            }
        }

        this.updateCurrentMediaVolumeUI(this.getGroupedSessions(this.audioSessions || []));

        
        if (!ipcRenderer) return;

        for (const pid of pids) {
            ipcRenderer.invoke('set-session-volume', { pid, volume: targetVolume }).catch(() => {});
        }
    }

    async updateAudioSessions() {
        try {
            
            if (!ipcRenderer) return;

            const sessions = await ipcRenderer.invoke('get-audio-sessions');
            if (sessions) {
                this.audioSessions = sessions;
                const grouped = this.getGroupedSessions(sessions);
                
                if (this.isExpanded && this.mode === 'mixer') {
                    this.updateMixerUI(grouped);
                } else if (this.isExpanded && this.mode === 'music') {
                    this.currentMediaVolumeGroup = this.getCurrentMediaSessionGroup(grouped);
                } else if (this.isExpanded && this.mode === 'control') {
                    const widgetType = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
                    if (widgetType === 'mixer') {
                        this.updateCompactMixerUI(grouped);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching sessions:', e);
        }
    }

    async refreshCurrentMediaVolumeSession() {
        
        if (!ipcRenderer) return null;

        try {
            const sessions = await ipcRenderer.invoke('get-audio-sessions');
            this.audioSessions = Array.isArray(sessions) ? sessions : [];
            const grouped = this.getGroupedSessions(this.audioSessions);
            this.currentMediaVolumeGroup = this.getCurrentMediaSessionGroup(grouped);
            return this.currentMediaVolumeGroup;
        } catch (e) {
            return null;
        }
    }

    async adjustCurrentMediaVolume(delta) {
        let group = this.getCurrentMediaSessionGroup();
        if (!group) {
            group = await this.refreshCurrentMediaVolumeSession();
        }

        if (!group) {
            this.showIslandFeedback('Volume app introuvable', 'ph-speaker-none');
            return;
        }

        this.currentMediaVolumeGroup = group;
        const currentVolume = group.muted || group.volume === 0 ? 0 : Math.round(group.volume || 0);
        const nextVolume = Math.max(0, Math.min(100, currentVolume + delta));
        await this.setCurrentMediaVolume(nextVolume);
        this.showAppVolumeIndicator(group.cleanName || String(group.name || 'App').replace('.exe', ''), nextVolume);
    }

    showAppVolumeIndicator(appName, volume) {
        if (this._appVolTimeout) clearTimeout(this._appVolTimeout);

        const existing = this.el.querySelector('.app-volume-toast');
        if (existing) existing.remove();

        const icon = volume === 0 ? 'ph-speaker-slash' : (volume < 50 ? 'ph-speaker-low' : 'ph-speaker-high');
        const toast = document.createElement('div');
        toast.className = 'app-volume-toast';
        toast.innerHTML = `
            <i class="ph-fill ${icon}"></i>
            <span>${escapeHtml(appName)}</span>
            <strong>${Math.round(volume)}%</strong>
        `;

        this.el.appendChild(toast);

        this._appVolTimeout = setTimeout(() => {
            toast.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -50%) scale(0.95)';
            setTimeout(() => toast.remove(), 240);
            this._appVolTimeout = null;
        }, 850);
    }

    getEstimatedMediaProgress() {
        if (!this.musicData) return 0;

        const duration = Number(this.musicData.duration) || 0;
        const baseProgress = Number(this.musicData.progress) || 0;
        if (!this.isPlaying) {
            return duration ? Math.min(duration, Math.max(0, baseProgress)) : Math.max(0, baseProgress);
        }

        const elapsed = Math.max(0, Date.now() - (this.lastMediaUpdate || Date.now()));
        const estimated = baseProgress + elapsed;
        return duration ? Math.min(duration, Math.max(0, estimated)) : Math.max(0, estimated);
    }

    updateProgressVisual(progress, duration = this.musicData?.duration || 0) {
        const safeDuration = Number(duration) || 0;
        const safeProgress = Math.max(0, Number(progress) || 0);
        const pct = safeDuration ? Math.min(100, (safeProgress / safeDuration) * 100) : 0;

        const fill = this.el.querySelector('#music-progress-fill');
        const timeEl = this.el.querySelector('#music-current-time');
        if (fill) {
            fill.style.width = `${pct}%`;
            const bar = fill.closest('.progress-bar');
            if (bar) bar.style.setProperty('--progress-pct', `${pct}%`);
        }
        if (timeEl) {
            timeEl.innerText = formatTime(safeProgress);
        }

        if (!this.isExpanded && localStorage.getItem('liquid_idle_compact_mode') === 'progress') {
            const chipTime = this.el.querySelector('.idle-metric-chip span');
            if (chipTime) chipTime.innerText = formatTime(safeProgress);
        }
    }

    applyOptimisticPlaybackState(nextPlaying, holdMs = 6500) {
        const expected = Boolean(nextPlaying);
        const stableProgress = this.getEstimatedMediaProgress();

        this._mediaControlPendingUntil = Date.now() + holdMs;
        this._mediaControlExpectedIsPlaying = expected;
        this._mediaControlPendingTrackKey = this.musicData ? (this.musicData.trackKey || getMusicHistoryKey(this.musicData)) : "";

        this.isPlaying = expected;
        if (this.musicData) {
            this.musicData.progress = stableProgress;
            this.musicData.isPlaying = expected;
        }
        this.lastMediaUpdate = Date.now();
        this.updateProgressVisual(stableProgress);
        this.updatePlaybackVisualState(expected);
    }

    updatePlaybackVisualState(isPlaying) {
        const active = Boolean(isPlaying);
        if (this.el) {
            this.el.classList.toggle('playing-music-glow', active);
        }
        document.querySelectorAll('.play-btn i, #ic-np-play-btn-val i').forEach((icon) => {
            icon.className = `ph-fill ph-${active ? 'pause' : 'play'}`;
        });
    }

    clearOptimisticPlaybackState() {
        this._mediaControlPendingUntil = 0;
        this._mediaControlExpectedIsPlaying = null;
        this._mediaControlPendingTrackKey = "";
    }

    updateMixerScrub(e) {
        if (!this.activeMixerSlider || !this.isScrubbingMixer) return;
        
        const rect = this.activeMixerSlider.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const clickPct = Math.max(0, Math.min(100, Math.round((clickX / width) * 100)));
        
        const pid = this.scrubbingPid;
        
        // Update slider visually in real-time
        this.activeMixerSlider.value = clickPct;
        
        // Find row to update percentage badge in real-time
        const row = this.activeMixerSlider.closest('.mixer-session-row, .ic-mixer-row');
        if (row) {
            const badge = row.querySelector('.mixer-app-vol-badge, .ic-mixer-vol');
            if (badge) badge.innerText = `${clickPct}%`;
            
            const muteBtn = row.querySelector('.mixer-mute-btn, .ic-mixer-mute');
            if (muteBtn) {
                if (clickPct === 0) {
                    muteBtn.classList.add('muted');
                    muteBtn.innerHTML = '<i class="ph-fill ph-speaker-slash"></i>';
                    row.classList.add('muted');
                } else {
                    muteBtn.classList.remove('muted');
                    muteBtn.innerHTML = `<i class="ph-fill ${clickPct < 50 ? 'ph-speaker-low' : 'ph-speaker-high'}"></i>`;
                    row.classList.remove('muted');
                }
            }
        }
        
        // Update local session state immediately so next tick doesn't snap it back
        const session = this.audioSessions.find(s => s.pid === pid);
        if (session) {
            session.volume = clickPct;
            session.muted = (clickPct === 0);
        }
        
        
        if (ipcRenderer) {
            ipcRenderer.invoke('set-session-volume', { pid, volume: clickPct });
        }
    }

    async toggleSessionMute(pid, mustMute) {
        const grouped = this.getGroupedSessions(this.audioSessions || []);
        const group = grouped.find(item => item.pid === pid || (Array.isArray(item.pids) && item.pids.includes(pid)));
        const pids = group && Array.isArray(group.pids) && group.pids.length > 0 ? group.pids : [pid];
        const sessions = this.audioSessions.filter(s => pids.includes(s.pid));
        if (sessions.length === 0) return;
        
        if (!this._previousSessionVolumes) {
            this._previousSessionVolumes = {};
        }
        
        let targetVolume = Math.round(group?.volume || sessions[0]?.volume || 70);
        if (mustMute) {
            for (const session of sessions) {
                this._previousSessionVolumes[session.pid] = session.volume > 0 ? session.volume : targetVolume || 70;
            }
        } else {
            targetVolume = this._previousSessionVolumes[pid] || targetVolume || 70;
        }
        
        for (const session of sessions) {
            session.muted = mustMute;
            if (!mustMute && session.volume <= 0) {
                session.volume = this._previousSessionVolumes[session.pid] || targetVolume;
            }
        }
        
        const row = this.content.querySelector(`[data-pid="${pid}"]`)?.closest('.mixer-session-row, .ic-mixer-row');
        if (row) {
            const slider = row.querySelector('.mixer-volume-slider, .ic-mixer-slider');
            const badge = row.querySelector('.mixer-app-vol-badge, .ic-mixer-vol');
            const muteBtn = row.querySelector('.mixer-mute-btn, .ic-mixer-mute');
            const visibleVolume = mustMute ? 0 : targetVolume;
            
            if (slider) slider.value = visibleVolume;
            if (badge) badge.innerText = `${visibleVolume}%`;
            if (muteBtn) {
                if (mustMute) {
                    muteBtn.classList.add('muted');
                    muteBtn.innerHTML = '<i class="ph-fill ph-speaker-slash"></i>';
                    row.classList.add('muted');
                } else {
                    muteBtn.classList.remove('muted');
                    muteBtn.innerHTML = `<i class="ph-fill ${visibleVolume < 50 ? 'ph-speaker-low' : 'ph-speaker-high'}"></i>`;
                    row.classList.remove('muted');
                }
            }
        }

        
        if (!ipcRenderer) return;

        try {
            await Promise.all(pids.map(targetPid => ipcRenderer.invoke('set-session-muted', { pid: targetPid, muted: mustMute })));
            if (!mustMute && targetVolume > 0) {
                await Promise.all(pids.map(targetPid => ipcRenderer.invoke('set-session-volume', { pid: targetPid, volume: targetVolume })));
            }
        } catch (e) {
            console.error('Error toggling session mute:', e);
            this.updateAudioSessions();
        }
    }

    async toggleAudioDeviceDropdown() {
        this.isAudioDeviceDropdownOpen = !this.isAudioDeviceDropdownOpen;
        const dropdown = this.content.querySelector('#audio-device-dropdown');
        if (this.isAudioDeviceDropdownOpen) {
            this.isMicDeviceDropdownOpen = false;
            const micDropdown = this.content.querySelector('#mic-device-dropdown');
            if (micDropdown) micDropdown.classList.remove('show');
            const micBtn = this.content.querySelector('.mic-select-btn');
            if (micBtn) micBtn.classList.remove('active');

            await this.loadAudioDevices();
            if (dropdown) dropdown.classList.add('show');
            const outBtn = this.content.querySelector('.device-select-btn');
            if (outBtn) outBtn.classList.add('active');
            this.autoSizeMixer();
        } else {
            if (dropdown) dropdown.classList.remove('show');
            const outBtn = this.content.querySelector('.device-select-btn');
            if (outBtn) outBtn.classList.remove('active');
            this.autoSizeMixer();
        }
    }

    async toggleMicDeviceDropdown() {
        this.isMicDeviceDropdownOpen = !this.isMicDeviceDropdownOpen;
        const dropdown = this.content.querySelector('#mic-device-dropdown');
        if (this.isMicDeviceDropdownOpen) {
            this.isAudioDeviceDropdownOpen = false;
            const audioDropdown = this.content.querySelector('#audio-device-dropdown');
            if (audioDropdown) audioDropdown.classList.remove('show');
            const outBtn = this.content.querySelector('.device-select-btn');
            if (outBtn) outBtn.classList.remove('active');

            await this.loadAudioInputDevices();
            if (dropdown) dropdown.classList.add('show');
            const micBtn = this.content.querySelector('.mic-select-btn');
            if (micBtn) micBtn.classList.add('active');
            this.autoSizeMixer();
        } else {
            if (dropdown) dropdown.classList.remove('show');
            const micBtn = this.content.querySelector('.mic-select-btn');
            if (micBtn) micBtn.classList.remove('active');
            this.autoSizeMixer();
        }
    }

    async loadAudioDevices(force = false) {
        if (!ipcRenderer) return;
        try {
            if (!force && this.audioDevices && this.audioDevices.length > 0) {
                this.renderAudioDevicesInDropdown();
                return;
            }
            const devices = await ipcRenderer.invoke('get-audio-devices');
            if (devices) {
                this.audioDevices = devices;
                this.renderAudioDevicesInDropdown();
            }
        } catch (e) {
            console.error('Error loading audio devices:', e);
        }
    }

    async loadAudioInputDevices(force = false) {
        if (!ipcRenderer) return;
        try {
            if (!force && this.audioInputDevices && this.audioInputDevices.length > 0) {
                this.renderMicDevicesInDropdown();
                return;
            }
            const devices = await ipcRenderer.invoke('get-audio-input-devices');
            if (devices) {
                this.audioInputDevices = devices;
                this.renderMicDevicesInDropdown();
            }
        } catch (e) {
            console.error('Error loading audio input devices:', e);
        }
    }

    renderAudioDevicesInDropdown() {
        const devices = this.audioDevices || [];
        const activeDevice = devices.find(d => d.isDefault);
        
        // Update header icon
        const btnIcon = this.content.querySelector('.device-select-btn i');
        if (btnIcon) {
            let headerIcon = 'ph-speaker-high';
            if (activeDevice) {
                const lowerName = activeDevice.name.toLowerCase();
                if (lowerName.includes('casque') || lowerName.includes('headphones') || lowerName.includes('headset') || lowerName.includes('earphone')) {
                    headerIcon = 'ph-headphones';
                } else if (lowerName.includes('speakers') || lowerName.includes('haut-parleurs') || lowerName.includes('haut parleur') || lowerName.includes('speaker')) {
                    headerIcon = 'ph-speaker-high';
                } else if (lowerName.includes('hdmi') || lowerName.includes('tv') || lowerName.includes('display') || lowerName.includes('moniteur') || lowerName.includes('nvidia') || lowerName.includes('intel') || lowerName.includes('amd')) {
                    headerIcon = 'ph-monitor';
                }
            }
            btnIcon.className = `ph-fill ${headerIcon}`;
        }

        // Render items list
        const listContainer = this.content.querySelector('.audio-device-list-container');
        if (listContainer) {
            listContainer.innerHTML = devices.map(d => {
                const lowerName = d.name.toLowerCase();
                let icon = 'ph-speaker-low';
                if (lowerName.includes('casque') || lowerName.includes('headphones') || lowerName.includes('headset') || lowerName.includes('earphone')) {
                    icon = 'ph-headphones';
                } else if (lowerName.includes('speakers') || lowerName.includes('haut-parleurs') || lowerName.includes('haut parleur') || lowerName.includes('speaker')) {
                    icon = 'ph-speaker-high';
                } else if (lowerName.includes('hdmi') || lowerName.includes('tv') || lowerName.includes('display') || lowerName.includes('moniteur') || lowerName.includes('nvidia') || lowerName.includes('intel') || lowerName.includes('amd')) {
                    icon = 'ph-monitor';
                }

                const activeClass = d.isDefault ? 'active' : '';
                return `
                    <div class="audio-device-item ${activeClass}" onclick="event.stopPropagation(); window.island.selectAudioDevice('${escapeHtml(d.id)}')">
                        <span class="audio-device-icon"><i class="ph-fill ${icon}"></i></span>
                        <span class="device-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                        <span class="device-active-dot"></span>
                    </div>
                `;
            }).join('');
        }

        // Ajuste la hauteur quand la liste sortie change
        this.autoSizeMixer();
    }

     async selectAudioDevice(deviceId) {
        if (!ipcRenderer) return;
        try {
            const success = await ipcRenderer.invoke('set-default-audio-device', deviceId);
            if (success) {
                const device = this.audioDevices.find(d => d.id === deviceId);
                const name = device ? device.name : 'Périphérique audio';
                this.showIslandFeedback(`Sortie : ${name}`, 'ph-speaker-high');
                
                await this.loadAudioDevices(true);
                
                setTimeout(() => {
                    if (this.isAudioDeviceDropdownOpen) {
                        this.toggleAudioDeviceDropdown();
                    }
                }, 300);
            } else {
                this.showIslandFeedback('Erreur de changement', 'ph-warning');
            }
        } catch (e) {
            console.error('Error setting audio device:', e);
            this.showIslandFeedback('Erreur', 'ph-warning');
        }
    }

    renderMicDevicesInDropdown() {
        const devices = this.audioInputDevices || [];
        const listContainer = this.content.querySelector('.mic-device-list-container');
        if (listContainer) {
            listContainer.innerHTML = devices.map(d => {
                const lowerName = d.name.toLowerCase();
                let icon = 'ph-microphone';
                if (lowerName.includes('headset') || lowerName.includes('casque') || lowerName.includes('écouteurs') || lowerName.includes('earphone')) {
                    icon = 'ph-microphone-stage';
                }

                const activeClass = d.isDefault ? 'active' : '';
                return `
                    <div class="audio-device-item ${activeClass}" onclick="event.stopPropagation(); window.island.selectMicDevice('${escapeHtml(d.id)}')">
                        <span class="audio-device-icon"><i class="ph-fill ${icon}"></i></span>
                        <span class="device-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                        <span class="device-active-dot"></span>
                    </div>
                `;
            }).join('');
        }

        // Ajuste la hauteur quand la liste micro change
        this.autoSizeMixer();
    }

    autoSizeMixer() {
        if (!this.isExpanded || this.mode !== 'mixer') return;

        const container = this.content?.querySelector?.('.mixer-container');
        if (!container) return;

        const header = container.querySelector('.mixer-header');
        const body = container.querySelector('.mixer-body-wrapper');
        if (!header || !body) return;

        const px = (v) => {
            const n = parseFloat(v || '0');
            return Number.isFinite(n) ? n : 0;
        };

        const padTop = px(getComputedStyle(container).paddingTop);
        const padBottom = px(getComputedStyle(container).paddingBottom);
        const headerMb = px(getComputedStyle(header).marginBottom);
        const headerH = header.getBoundingClientRect().height || 0;

        let bodyTarget = 140; // fallback safe

        // 1) Dropdown devices (sortie / entrée)
        if (this.isAudioDeviceDropdownOpen || this.isMicDeviceDropdownOpen) {
            const dropdown = this.content.querySelector(this.isAudioDeviceDropdownOpen ? '#audio-device-dropdown' : '#mic-device-dropdown');
            if (dropdown) {
                const ddHeader = dropdown.querySelector('.audio-device-dropdown-header');
                const list = dropdown.querySelector('.audio-device-list-container');
                const items = list ? Array.from(list.querySelectorAll('.audio-device-item')) : [];

                const ddHeaderH = ddHeader ? ddHeader.getBoundingClientRect().height : 0;
                const ddHeaderMb = ddHeader ? px(getComputedStyle(ddHeader).marginBottom) : 0;

                const itemH = items[0]?.getBoundingClientRect?.().height || 54;
                const itemMb = items[0] ? px(getComputedStyle(items[0]).marginBottom) : 8;
                const count = items.length;
                const maxVisible = 8; // évite une fenêtre gigantesque si beaucoup de périphériques
                const visible = Math.max(1, Math.min(count || 1, maxVisible));

                const listH = count === 0 ? 110 : (visible * itemH) + ((visible - 1) * itemMb);
                bodyTarget = ddHeaderH + ddHeaderMb + listH;
            }
        } else {
            // 2) Liste des sessions (mélangeur)
            const list = body.querySelector('.mixer-sessions-list');
            const rows = list ? Array.from(list.querySelectorAll('.mixer-session-row')) : [];
            const empty = list ? list.querySelector('.mixer-empty-state') : null;

            if (empty) {
                bodyTarget = empty.getBoundingClientRect().height || 120;
            } else {
                const rowH = rows[0]?.getBoundingClientRect?.().height || 62;
                const count = rows.length;
                const maxVisible = 5; // ton besoin: hauteur = nb de flux, jusqu'à 5
                const visible = Math.max(1, Math.min(count || 1, maxVisible));
                bodyTarget = visible * rowH;
            }
        }

        // 3) Total height = padding + header + body + micro marge de sécurité
        let target = padTop + padBottom + headerH + headerMb + bodyTarget + 6;

        // Gardes-fous (évite un truc trop petit ou trop grand)
        const minH = 260;
        const maxH = 520;
        target = Math.max(minH, Math.min(maxH, target));

        this.el.style.height = `${Math.round(target)}px`;
    }

    async selectMicDevice(deviceId) {
        if (!ipcRenderer) return;
        try {
            const success = await ipcRenderer.invoke('set-default-audio-device', deviceId);
            if (success) {
                const device = this.audioInputDevices.find(d => d.id === deviceId);
                const name = device ? device.name : 'Microphone';
                this.showIslandFeedback(`Micro : ${name}`, 'ph-microphone');
                
                await this.loadAudioInputDevices(true);
                
                setTimeout(() => {
                    if (this.isMicDeviceDropdownOpen) {
                        this.toggleMicDeviceDropdown();
                    }
                }, 300);
            } else {
                this.showIslandFeedback('Erreur de changement', 'ph-warning');
            }
        } catch (e) {
            console.error('Error setting mic device:', e);
            this.showIslandFeedback('Erreur', 'ph-warning');
        }
    }

    renderMixer() {
        const grouped = this.getGroupedSessions(this.audioSessions || []);
        
        let listHtml = '';
        if (grouped.length === 0) {
            listHtml = `
                <div class="mixer-empty-state">
                    <i class="ph-fill ph-speaker-none"></i>
                    <span>Aucun flux audio détecté</span>
                </div>
            `;
        } else {
            listHtml = grouped.map(s => {
                const icon = s.icon || getMixerIcon(s.name, s.title);
                const isMuted = s.volume === 0 || s.muted;
                const activeVol = isMuted ? 0 : Math.round(s.volume);
                
                let iconHtml = '';
                if (icon) {
                    iconHtml = `
                        <img src="${icon}" class="mixer-app-icon-img" alt="${s.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                        <i class="ph-fill ph-music-note mixer-app-icon-fallback" style="display: none;"></i>
                    `;
                } else {
                    iconHtml = `<i class="ph-fill ph-music-note mixer-app-icon-fallback"></i>`;
                }
                
                const muteIcon = isMuted ? 'ph-speaker-slash' : (activeVol < 50 ? 'ph-speaker-low' : 'ph-speaker-high');
                const rowMutedClass = isMuted ? 'muted' : '';
                const btnMutedClass = isMuted ? 'muted' : '';
                
                let cleanName = s.name.replace('.exe', '');
                if (cleanName.toLowerCase() === 'audiodg') cleanName = 'System Sounds';
                if (cleanName.toLowerCase() === 'msedge') cleanName = 'Microsoft Edge';
                
                const displayTitle = s.title && s.title.trim().length > 0 ? s.title : 'Flux audio actif';
                
                return `
                    <div class="mixer-session-row ${rowMutedClass}">
                        <div class="mixer-app-icon-wrapper">
                            ${iconHtml}
                        </div>
                        <div class="mixer-details">
                            <div class="mixer-app-name-row">
                                <span class="mixer-app-name">${cleanName}</span>
                                <span class="mixer-app-vol-badge">${activeVol}%</span>
                            </div>
                            <span class="mixer-title-text" title="${displayTitle}">${displayTitle}</span>
                            <div class="mixer-slider-wrapper">
                                <input type="range" class="mixer-volume-slider" data-pid="${s.pid}" min="0" max="100" value="${activeVol}">
                            </div>
                        </div>
                        <button class="mixer-mute-btn ${btnMutedClass}" data-pid="${s.pid}">
                            <i class="ph-fill ${muteIcon}"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Determine active device icon for header
        const activeDevice = this.audioDevices?.find(d => d.isDefault);
        let headerIcon = 'ph-speaker-high';
        if (activeDevice) {
            const lowerName = activeDevice.name.toLowerCase();
            if (lowerName.includes('casque') || lowerName.includes('headphones') || lowerName.includes('headset') || lowerName.includes('earphone')) {
                headerIcon = 'ph-headphones';
            } else if (lowerName.includes('speakers') || lowerName.includes('haut-parleurs') || lowerName.includes('haut parleur') || lowerName.includes('speaker')) {
                headerIcon = 'ph-speaker-high';
            } else if (lowerName.includes('hdmi') || lowerName.includes('tv') || lowerName.includes('display') || lowerName.includes('moniteur') || lowerName.includes('nvidia') || lowerName.includes('intel') || lowerName.includes('amd')) {
                headerIcon = 'ph-monitor';
            }
        }

        if (!this.audioDevices || this.audioDevices.length === 0) {
            this.loadAudioDevices(false);
        }
        if (!this.audioInputDevices || this.audioInputDevices.length === 0) {
            this.loadAudioInputDevices(false);
        }

        const activeOutBtnClass = this.isAudioDeviceDropdownOpen ? 'active' : '';
        const activeMicBtnClass = this.isMicDeviceDropdownOpen ? 'active' : '';

        this.content.innerHTML = `
            <div class="mixer-container">
                <div class="mixer-header">
                    <span class="mixer-title"><i class="ph-fill ph-sliders"></i> Mélangeur Audio</span>
                    <div class="music-action-cluster">
                        <button class="island-action-btn device-select-btn ${activeOutBtnClass}" onclick="event.stopPropagation(); window.island.toggleAudioDeviceDropdown()" title="Périphérique de sortie">
                            <i class="ph-fill ${headerIcon}"></i>
                        </button>
                        <button class="island-action-btn mic-select-btn ${activeMicBtnClass}" onclick="event.stopPropagation(); window.island.toggleMicDeviceDropdown()" title="Entrée audio / Micro">
                            <i class="ph-fill ph-microphone"></i>
                        </button>
                        <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
                            <i class="ph-fill ph-squares-four"></i>
                        </button>
                    </div>
                </div>
                <div class="mixer-body-wrapper" style="position: relative; flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div class="mixer-sessions-list">
                        ${listHtml}
                    </div>
                    
                    <div class="audio-device-dropdown" id="audio-device-dropdown">
                        <div class="audio-device-dropdown-header">
                            <span class="audio-device-dropdown-title">Sortie Audio</span>
                            <button class="audio-device-dropdown-close" onclick="event.stopPropagation(); window.island.toggleAudioDeviceDropdown()">
                                <i class="ph-bold ph-x"></i>
                            </button>
                        </div>
                        <div class="audio-device-list-container">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div class="audio-device-dropdown" id="mic-device-dropdown">
                        <div class="audio-device-dropdown-header">
                            <span class="audio-device-dropdown-title">Entrée Audio / Micro</span>
                            <button class="audio-device-dropdown-close" onclick="event.stopPropagation(); window.island.toggleMicDeviceDropdown()">
                                <i class="ph-bold ph-x"></i>
                            </button>
                        </div>
                        <div class="audio-device-list-container mic-device-list-container">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (this.isAudioDeviceDropdownOpen) {
            const dropdown = this.content.querySelector('#audio-device-dropdown');
            if (dropdown) dropdown.classList.add('show');
            this.renderAudioDevicesInDropdown();
        }

        if (this.isMicDeviceDropdownOpen) {
            const dropdown = this.content.querySelector('#mic-device-dropdown');
            if (dropdown) dropdown.classList.add('show');
            this.renderMicDevicesInDropdown();
        }

        // Ajuste la hauteur après rendu (mixer / dropdowns)
        setTimeout(() => this.autoSizeMixer(), 0);
    }

    updateMixerUI(sessions) {
        if (this.isScrubbingMixer) return;
        
        const listContainer = this.content.querySelector('.mixer-sessions-list');
        if (!listContainer) return;
        
        const existingRows = listContainer.querySelectorAll('.mixer-session-row');
        if (existingRows.length !== sessions.length) {
            this.renderMixer();
            return;
        }
        
        sessions.forEach((s, idx) => {
            const row = existingRows[idx];
            if (!row) return;
            
            const slider = row.querySelector('.mixer-volume-slider');
            const badge = row.querySelector('.mixer-app-vol-badge');
            const title = row.querySelector('.mixer-title-text');
            const muteBtn = row.querySelector('.mixer-mute-btn');
            
            const isMuted = s.volume === 0 || s.muted;
            const activeVol = isMuted ? 0 : Math.round(s.volume);
            
            if (slider && parseInt(slider.value) !== activeVol) {
                slider.value = activeVol;
            }
            if (badge) {
                badge.innerText = `${activeVol}%`;
            }
            if (title) {
                const displayTitle = s.title && s.title.trim().length > 0 ? s.title : 'Flux audio actif';
                if (title.innerText !== displayTitle) {
                    title.innerText = displayTitle;
                    title.title = displayTitle;
                }
            }
            
            if (muteBtn) {
                const muteIcon = isMuted ? 'ph-speaker-slash' : (activeVol < 50 ? 'ph-speaker-low' : 'ph-speaker-high');
                muteBtn.className = `mixer-mute-btn ${isMuted ? 'muted' : ''}`;
                muteBtn.innerHTML = `<i class="ph-fill ${muteIcon}"></i>`;
            }
            
            row.className = `mixer-session-row ${isMuted ? 'muted' : ''}`;
        });

        // Si le nombre de lignes change (ou au 1er rendu), recalcul de la hauteur
        if (this._lastMixerRowCount !== sessions.length) {
            this._lastMixerRowCount = sessions.length;
            this.autoSizeMixer();
        }
    }

    updateCompactMixerUI(sessions) {
        const card = this.content.querySelector('.ic-mixer-card');
        if (!card) return;
        
        const rows = card.querySelectorAll('.ic-mixer-row');
        sessions.slice(0, 3).forEach((s, idx) => {
            const row = rows[idx];
            if (!row) return;
            
            const slider = row.querySelector('.ic-mixer-slider');
            const volText = row.querySelector('.ic-mixer-vol');
            const muteIcon = row.querySelector('.ic-mixer-mute');
            
            const isMuted = s.volume === 0 || s.muted;
            const activeVol = isMuted ? 0 : Math.round(s.volume);
            
            if (slider && !this.isScrubbingMixer) {
                slider.value = activeVol;
            }
            if (volText) {
                volText.innerText = `${activeVol}%`;
            }
            if (muteIcon) {
                muteIcon.className = `ic-mixer-mute ${isMuted ? 'muted' : ''}`;
                muteIcon.innerHTML = `<i class="ph-fill ${isMuted ? 'ph-speaker-slash' : (activeVol < 50 ? 'ph-speaker-low' : 'ph-speaker-high')}"></i>`;
            }
        });
    }

    renderStats(stats) {
        const cpu = stats ? stats.cpu : 0;
        const ram = stats ? stats.ram : 0; // Added RAM

        // --- Gauge Configuration ---
        const r = 32;
        const C = 201;

        const cpuOffset = C - (cpu / 100) * C;
        const ramOffset = C - (ram / 100) * C;

        const items = [];

        // 1. CPU Usage (Always show)
        items.push({
            id: 'cpu',
            val: cpu + '%',
            label: 'CPU',
            offset: cpuOffset,
            icon: 'ph-cpu',
            color: 'var(--neon-primary)'
        });

        // 2. RAM Usage (Lightweight alternative to GPU/Temp)
        items.push({
            id: 'ram',
            val: ram + '%',
            label: 'RAM',
            offset: ramOffset,
            icon: 'ph-memory',
            color: 'var(--neon-secondary)'
        });

        // If we still have space and detected both GPU stats, maybe show the 4th?
        // Current island logic fits ~3 comfortably.

        // Optimize: Update existing DOM if structure matches (same number of items)
        const existing = this.content.querySelector('.stats-pulse-container');
        const existingItems = existing ? existing.querySelectorAll('.gauge-wrapper') : [];
        if (existing && existingItems.length === items.length) {
            items.forEach((item, index) => {
                const el = existingItems[index];
                const circle = el.querySelector('.gauge-progress');
                const valText = el.querySelector('.gauge-value');
                // const label = el.querySelector('.gauge-label');

                if (circle) circle.style.strokeDashoffset = item.offset;
                if (valText) valText.innerText = item.val;
            });
            return;
        }

        // Generate HTML
        const gaugesHtml = items.map(item => `
            <div class="gauge-wrapper item-${item.id}">
                <svg class="gauge-svg" viewBox="0 0 80 80" style="overflow: visible;">
                    <circle class="gauge-bg" cx="40" cy="40" r="${r}"></circle>
                    <circle class="gauge-progress" cx="40" cy="40" r="${r}" 
                            style="stroke-dasharray: ${C}; stroke-dashoffset: ${item.offset}; stroke: ${item.color}; filter: drop-shadow(0 0 8px ${item.color});"></circle>
                </svg>
                <div class="gauge-content">
                    <i class="ph-fill ${item.icon} gauge-icon" style="color: ${item.color};"></i>
                    <div class="gauge-value">${item.val}</div>
                    <div class="gauge-label">${item.label}</div>
                </div>
            </div>
        `).join('');

        // Initial Layout
        this.content.innerHTML = `
      <div class="stats-pulse-container">
        <div class="stats-pulse-header">
            <div class="stats-pulse-title">
                <i class="ph-fill ph-gauge" style="color: var(--neon-primary);"></i> System Pulse
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
                    <i class="ph-fill ph-squares-four"></i>
                </button>
            </div>
        </div>
        
        <div class="stats-gauges-row" style="gap: ${items.length > 2 ? '25px' : '40px'};">
            ${gaugesHtml}
        </div>
      </div>
    `;
    }

    renderNetwork() {
        // --- Network Simulation Logic ---
        if (!this.networkState) {
            this.networkState = { dl: 50, ul: 10 };
        }

        // Random drift smoother
        const targetDl = this.networkState.dl + (Math.random() - 0.5) * 30;
        const targetUl = this.networkState.ul + (Math.random() - 0.5) * 5;

        // Clamp
        this.networkState.dl = Math.max(5, Math.min(950, targetDl));
        this.networkState.ul = Math.max(1, Math.min(300, targetUl));

        const dl = this.networkState.dl.toFixed(1);
        const ul = this.networkState.ul.toFixed(1);

        // Determine Speed Class
        let speedClass = 'speed-slow';
        if (this.networkState.dl > 50) speedClass = 'speed-medium';
        if (this.networkState.dl > 150) speedClass = 'speed-fast';
        if (this.networkState.dl > 500) speedClass = 'speed-fiber';

        // Direction based on dominant traffic
        const waveClass = this.networkState.dl > (this.networkState.ul * 2) ? 'download-wave' : 'upload-wave';

        // Check if already rendered to update inplace (Prevents animation reset)
        const container = this.content.querySelector('.network-pulse-container');
        if (container) {
            const waveContainer = container.querySelector('.network-pulse-wave');
            if (waveContainer.className !== `network-pulse-wave ${speedClass}`) {
                waveContainer.className = `network-pulse-wave ${speedClass}`;
            }

            const svg = container.querySelector('.pulse-wave-svg');
            // Only change direction if strictly needed (to keep animation smooth)
            if (!svg.classList.contains(waveClass)) {
                svg.setAttribute('class', `pulse-wave-svg ${waveClass}`);
            }

            // Update Texts
            const dlText = container.querySelector('.net-wave-dl-text');
            if (dlText) dlText.innerHTML = `<i class="ph-bold ph-arrow-down"></i> ${dl} <small>Mbps</small>`;

            const ulText = container.querySelector('.net-wave-ul-text');
            if (ulText) ulText.innerHTML = `<i class="ph-bold ph-arrow-up"></i> ${ul} <small>Mbps</small>`;

            const dlDisp = container.querySelector('.net-display-dl');
            if (dlDisp) dlDisp.innerHTML = `${dl}<span class="speed-unit">Mbps</span>`;

            const ulDisp = container.querySelector('.net-display-ul');
            if (ulDisp) ulDisp.innerHTML = `${ul}<span class="speed-unit">Mbps</span>`;

            return;
        }

        // Initial Render
        this.content.innerHTML = `
            <div class="network-pulse-container">
                <div class="network-pulse-header">
                    <div class="network-pulse-title">
                        <i class="ph-fill ph-globe-stand"></i> Pulse Réseau
                    </div>
                    <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
                        <i class="ph-fill ph-squares-four"></i>
                    </button>
                </div>

                <div class="network-pulse-wave ${speedClass}">
                    <svg class="pulse-wave-svg ${waveClass}" viewBox="0 0 1440 320" preserveAspectRatio="none">
                         <path fill="var(--wave-color)" fill-opacity="0.3" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                    </svg>
                    <div style="position: absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:30px;">
                        <span class="net-wave-dl-text" style="font-size:12px; font-weight:bold; color: var(--wave-color); text-shadow: 0 1px 2px rgba(0,0,0,0.8);"><i class="ph-bold ph-arrow-down"></i> ${dl} <small>Mbps</small></span>
                        <span class="net-wave-ul-text" style="font-size:12px; font-weight:bold; color: #fff; opacity:0.7; text-shadow: 0 1px 2px rgba(0,0,0,0.8);"><i class="ph-bold ph-arrow-up"></i> ${ul} <small>Mbps</small></span>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; width: 100%; align-items: flex-end; padding: 0 5px;">
                     <div class="speed-item">
                        <span class="speed-label"><i class="ph-fill ph-download-simple"></i> Download</span>
                        <div class="speed-value net-display-dl">${dl}<span class="speed-unit">Mbps</span></div>
                     </div>
                     <div style="height: 30px; width: 1px; background: rgba(255,255,255,0.1);"></div>
                     <div class="speed-item">
                        <span class="speed-label"><i class="ph-fill ph-upload-simple"></i> Upload</span>
                        <div class="speed-value net-display-ul" style="color: rgba(255,255,255,0.7);">${ul}<span class="speed-unit">Mbps</span></div>
                     </div>
                </div>
            </div>
        `;
    }

    renderTimer() {
        const mins = Math.floor(this.timerValue / 60).toString().padStart(2, '0');
        const secs = (this.timerValue % 60).toString().padStart(2, '0');
        const status = this.isTimerRunning ? 'En cours' : (this.timerValue > 0 ? 'En pause' : 'Prêt');

        this.content.innerHTML = `
        <div class="island-timer-container">
            <div class="island-timer-header">
                <div class="timer-title"><i class="ph-fill ph-timer"></i><span>Chrono</span></div>
                <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
                    <i class="ph-fill ph-squares-four"></i>
                </button>
            </div>
            <div class="timer-stage">
                <div class="timer-status">${status}</div>
                <div class="timer-readout">${mins}:${secs}</div>
                <div class="timer-controls">
                    <button class="timer-control-btn" onclick="event.stopPropagation(); window.island.timerValue = 0; window.island.isTimerRunning = false; window.island.renderTimer()" title="Réinitialiser">
                        <i class="ph-fill ph-arrow-counter-clockwise"></i>
                    </button>
                    <button class="timer-control-btn primary ${this.isTimerRunning ? 'is-running' : ''}" onclick="event.stopPropagation(); window.island.isTimerRunning = !window.island.isTimerRunning; window.island.renderTimer()" title="${this.isTimerRunning ? 'Pause' : 'Démarrer'}">
                        <i class="ph-fill ${this.isTimerRunning ? 'ph-pause' : 'ph-play'}"></i>
                    </button>
                </div>
            </div>
        </div>
      `;
    }

    updateMusic(data) {
        // Enforce temporary progress suppression to make seeking feel instantaneous and prevent snapbacks
        if (this.musicData && this.suppressProgressUpdatesUntil && Date.now() < this.suppressProgressUpdatesUntil) {
            // Keep our current estimated progress and duration, ignore the incoming old progress from the system
            data.progress = this.musicData.progress;
            data.duration = this.musicData.duration;
        }
        if (this._mediaControlExpectedIsPlaying !== null && Date.now() < this._mediaControlPendingUntil) {
            const pendingTrackKey = this._mediaControlPendingTrackKey;
            const incomingTrackKey = data.trackKey || getMusicHistoryKey(data);
            const currentTrackKey = this.musicData ? (this.musicData.trackKey || getMusicHistoryKey(this.musicData)) : "";
            const sameTrack = !pendingTrackKey || !incomingTrackKey || pendingTrackKey === incomingTrackKey || currentTrackKey === incomingTrackKey;

            if (sameTrack) {
                const stableProgress = this.getEstimatedMediaProgress();
                data.isPlaying = this._mediaControlExpectedIsPlaying;
                data.progress = stableProgress;
                if (this.musicData?.duration) {
                    data.duration = this.musicData.duration;
                }
            } else {
                this.clearOptimisticPlaybackState();
            }
        } else if (this._mediaControlExpectedIsPlaying !== null) {
            this.clearOptimisticPlaybackState();
        }

        const previousDisplayArt = this.musicData ? getDisplayMediaArt(this.musicData) : "";
        const currentTrackKey = this.musicData ? (this.musicData.trackKey || getMusicHistoryKey(this.musicData)) : "";
        const incomingTrackKey = data.trackKey || getMusicHistoryKey(data);
        const fallbackSameIdentity = this.musicData &&
            (this.musicData.title || "") === (data.title || "") &&
            (this.musicData.artist || "") === (data.artist || "");
        const sameTrackIdentity = Boolean(currentTrackKey && incomingTrackKey)
            ? currentTrackKey === incomingTrackKey
            : fallbackSameIdentity;
        const realTrackIdentityChanged = Boolean(this.musicData && currentTrackKey && incomingTrackKey && currentTrackKey !== incomingTrackKey);
        const incomingPlaybackChanged = this.musicData && this.musicData.isPlaying !== data.isPlaying;
        const playbackGuardActive = this._mediaControlExpectedIsPlaying !== null && Date.now() < this._mediaControlPendingUntil;
        const shouldFreezeCover = sameTrackIdentity && previousDisplayArt && (incomingPlaybackChanged || playbackGuardActive);
        let effectiveArt = shouldFreezeCover
            ? previousDisplayArt
            : this.getStableDisplayArt(data);

        data.displayCover = effectiveArt;
        const renderIdentityChanged = !this._lastRenderedTrack ||
            this._lastRenderedTrack.title !== data.title ||
            this._lastRenderedTrack.artist !== data.artist;
        const coverChanged = !this._lastRenderedTrack ||
            this._lastRenderedTrack.cover !== effectiveArt;
        const trackChanged = renderIdentityChanged || (!shouldFreezeCover && coverChanged);
        const playbackChanged = !this._lastRenderedTrack ||
            this._lastRenderedTrack.isPlaying !== data.isPlaying;
        const shouldAnimateCover = realTrackIdentityChanged &&
            !playbackGuardActive &&
            previousDisplayArt &&
            effectiveArt &&
            previousDisplayArt !== effectiveArt;

        data.previousDisplayCover = shouldAnimateCover ? previousDisplayArt : "";
        data.animateCover = shouldAnimateCover;
        if (shouldAnimateCover) {
            this._pendingCoverAnimationTrackKey = incomingTrackKey;
        }

        if (trackChanged || playbackChanged) {
            this._lastRenderedTrack = {
                title: data.title,
                artist: data.artist,
                cover: effectiveArt,
                isPlaying: data.isPlaying
            };
        }

        const isNewTrack = realTrackIdentityChanged || !this._lastTrackId;

        if (isNewTrack) {
            this._lastTrackId = {
                title: data.title,
                artist: data.artist
            };
        }
        this._isNewTrackSignal = shouldAnimateCover;

        this.musicData = data;
        this.isPlaying = data.isPlaying;
        this.lastMediaUpdate = Date.now();

        if (trackChanged) {
            this.addMusicHistoryItem(data);
        }

        this.updatePlaybackVisualState(data.isPlaying);

        // Enforce active cover artwork and colors synchronously for instant transition!
        this.syncGlobalCoverAesthetics();

        // Real-time dynamic updates to Control Center Now Playing widget elements if visible
        if (this.isExpanded && this.mode === 'control') {
            const npTitle = document.getElementById('ic-np-title-val');
            const npArtist = document.getElementById('ic-np-artist-val');
            const npCover = document.getElementById('ic-np-cover-img');
            const npPlayBtn = document.getElementById('ic-np-play-btn-val');
            
            if (npTitle) npTitle.innerText = data.title || "Sans titre";
            if (npArtist) npArtist.innerText = data.artist || "Artiste inconnu";
            if (npPlayBtn) {
                npPlayBtn.setAttribute('onclick', `event.stopPropagation(); window.spotifyControl('toggle')`);
                npPlayBtn.innerHTML = `<i class="ph-fill ph-${data.isPlaying ? 'pause' : 'play'}"></i>`;
            }
            if (npCover) {
                const effectiveNpArt = getDisplayMediaArt(data);
                if (effectiveNpArt && effectiveNpArt.length > 0) {
                    if (npCover.tagName === 'IMG') {
                        npCover.src = effectiveNpArt;
                        npCover.className = 'ic-np-cover';
                    } else {
                        const parent = npCover.parentNode;
                        const img = document.createElement('img');
                        img.id = 'ic-np-cover-img';
                        img.className = 'ic-np-cover';
                        img.src = effectiveNpArt;
                        parent.replaceChild(img, npCover);
                    }
                } else {
                    if (npCover.tagName === 'IMG') {
                        npCover.src = APP_LOGO_ART;
                        npCover.className = 'ic-np-cover app-logo-art';
                    } else {
                        const parent = npCover.parentNode;
                        if (!parent) return;
                        const img = document.createElement('img');
                        img.id = 'ic-np-cover-img';
                        img.className = 'ic-np-cover app-logo-art';
                        img.src = APP_LOGO_ART;
                        img.alt = 'Liquid Dynamic Island';
                        parent.replaceChild(img, npCover);
                    }
                }
            }
        }

        // Extract colors if cover has changed
        const effectiveCoverArt = getDisplayMediaArt(data);
        if (effectiveCoverArt !== this._lastCoverUrl) {
            this._lastCoverUrl = effectiveCoverArt;
            this._extractColorsFromCover(effectiveCoverArt);
        }

        // Tell visualizer service about playback state
        visualizerService.setPlaybackState(data.isPlaying);

        const musicEnabled = localStorage.getItem('liquid_music_enabled') !== 'false';

        if (!musicEnabled) {
            if (this.mode === 'music') {
                if (trackChanged) {
                    this.renderIdle();
                }
            }
            return;
        }

        if (this.isExpanded && this.mode === 'music') {
            if (this.isScrubbing) return; // Do not re-render DOM while user is actively dragging the scrubber!
            if (trackChanged) {
                this.renderMusic();
            } else if (playbackChanged) {
                this.updatePlaybackVisualState(data.isPlaying);
            }
        } else if (this.isExpanded && this.mode === 'music-history') {
            if (trackChanged) {
                this.renderMusicHistory();
            }
        } else if (!this.isExpanded) {
            if (trackChanged) {
                this.renderIdle();
            }
        }
    }

    async mirrorCurrentMedia() {
        if (!this.musicData) return;
        
        if (!ipcRenderer) return;

        const sources = await ipcRenderer.invoke('get-desktop-sources');

        // Logic de matching intelligente
        const appId = (this.musicData.appId || "").toLowerCase();
        const artist = (this.musicData.artist || "").toLowerCase();
        const title = (this.musicData.title || "").toLowerCase();

        // 1. Essayer de matcher par l'ID de l'application (Spotify.exe -> "Spotify")
        let target = sources.find(s => {
            const sName = s.name.toLowerCase();
            const cleanAppId = appId.split('.')[0].replace('microsoft.', '');
            if (cleanAppId && sName.includes(cleanAppId)) return true;
            return false;
        });

        // 2. Si pas de match, essayer par titre ou artiste (Utile pour YouTube/Chrome)
        if (!target) {
            target = sources.find(s => {
                const sName = s.name.toLowerCase();
                const cleanTitle = title.split(' - ')[0].split(' | ')[0].trim().toLowerCase();
                if (cleanTitle.length > 3 && sName.includes(cleanTitle)) return true;
                if (artist.length > 3 && sName.includes(artist)) return true;
                return false;
            });
        }

        if (target) {
            window.dispatchEvent(new CustomEvent('liquid-open-widget', { detail: 'mirror' }));
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('liquid-mirror-start', { detail: target }));
            }, 500);
            this.showNotification('Miroir', `Projection de ${target.name}`, 'ph-screencast');
        } else {
            console.warn("Mirror target not found for media:", this.musicData);
            this.showNotification('Miroir', 'Fenêtre source introuvable', 'ph-warning-circle');
        }
    }

    renderSettings() {
        const config = this.getSavedAppConfig();
        const glow = config.glow;
        const modules = config.modules;
        const isPersistent = localStorage.getItem('liquid_island_persistent') === 'true';
        const notificationsEnabled = localStorage.getItem('liquid_notifications_enabled') !== 'false';
        const isCoverSync = localStorage.getItem('liquid_cover_color_sync') !== 'false';
        const mediaDebugEnabled = localStorage.getItem('liquid_media_debug') === 'true';
        const compactMode = localStorage.getItem('liquid_idle_compact_mode') || 'cover';
        const isControlEnabled = localStorage.getItem('liquid_island_control_enabled') !== 'false';
        const shortcut = localStorage.getItem('liquid_island_shortcut') || 'Alt+I';
        const profiles = this.loadProfiles();
        const activeProfileId = this.getActiveProfileId();
        const activeProfile = profiles.find(profile => profile.id === activeProfileId) || profiles[0];
        const motionLevel = this.getMotionLevel();
        const motionIndex = Math.max(0, MOTION_LEVELS.indexOf(motionLevel));

        const defaultShortcuts = DEFAULT_CONTROL_SHORTCUTS;
        const shortcuts = JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts));
        const widgetType = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
        const settingsTabs = [
            { id: 'quick', label: 'Essentiel', icon: 'ph-sliders-horizontal' },
            { id: 'media', label: 'Media', icon: 'ph-music-notes' },
            { id: 'appearance', label: 'Apparence', icon: 'ph-palette' },
            { id: 'control', label: 'Centre', icon: 'ph-squares-four' },
            { id: 'profiles', label: 'Profils', icon: 'ph-user-switch' }
        ];
        const savedSettingsTab = localStorage.getItem('liquid_settings_tab') || 'quick';
        const activeSettingsTab = settingsTabs.some(tab => tab.id === savedSettingsTab) ? savedSettingsTab : 'quick';

        this.content.innerHTML = `
            <div class="island-settings-container">
                <div class="island-settings-header">
                    <div class="island-settings-title"><i class="ph-fill ph-gear"></i> Réglages</div>
                    <button class="ic-close" onclick="event.stopPropagation(); window.island.setMode('menu')"><i class="ph ph-arrow-left" style="font-size: 14px;"></i></button>
                </div>
                <div class="settings-tabbar">
                    ${settingsTabs.map(tab => `
                        <button class="settings-tab-btn ${activeSettingsTab === tab.id ? 'is-active' : ''}" data-settings-tab="${tab.id}">
                            <i class="ph-fill ${tab.icon}"></i>
                            <span>${tab.label}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="island-settings-body has-tabs">
                    <div class="settings-column">
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'profiles' ? 'is-active' : ''}" data-settings-tab-section="profiles">
                            <span class="settings-inner-label">Profils</span>
                            <div class="settings-inner-card">
                                <div class="setting-inner-item" style="justify-content: space-between; align-items: center; gap: 8px;">
                                    <div class="inner-item-info">
                                        <span class="inner-item-label">Profil actif</span>
                                        <span class="inner-item-desc">${activeProfile.locked ? 'Profil systeme' : 'Profil perso'} - ${escapeHtml(MOTION_LABELS[motionLevel])}</span>
                                    </div>
                                    <select id="inner-profile-select" class="inner-theme-select" style="max-width: 150px;">
                                        ${profiles.map(profile => `<option value="${escapeHtml(profile.id)}" ${profile.id === activeProfile.id ? 'selected' : ''}>${profile.locked ? '* ' : ''}${escapeHtml(profile.name)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="profile-action-row">
                                    <input type="text" id="inner-profile-name" class="inner-input" placeholder="Nouveau profil" maxlength="24">
                                    <button id="inner-profile-create" class="inner-action-btn compact" title="Creer depuis les reglages actuels"><i class="ph-fill ph-plus"></i></button>
                                    <button id="inner-profile-delete" class="inner-action-btn compact danger" ${activeProfile.locked ? 'disabled' : ''} title="Supprimer le profil"><i class="ph-fill ph-trash"></i></button>
                                </div>
                                <div class="profile-action-row">
                                    <button id="inner-settings-export" class="inner-action-btn secondary"><i class="ph-fill ph-download-simple"></i> Exporter</button>
                                    <button id="inner-settings-import" class="inner-action-btn secondary"><i class="ph-fill ph-upload-simple"></i> Importer</button>
                                    <input type="file" id="inner-settings-import-file" class="hidden" accept="application/json,.json">
                                </div>
                            </div>
                        </div>
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'appearance' ? 'is-active' : ''}" data-settings-tab-section="appearance">
                            <span class="settings-inner-label">Apparence</span>
                            <div class="settings-inner-card">
                                <div class="setting-inner-item range-type">
                                    <div class="range-header"><span class="inner-item-label">Animations</span><span id="inner-val-motion" class="inner-badge">${escapeHtml(MOTION_LABELS[motionLevel])}</span></div>
                                    <input type="range" id="inner-range-motion" min="0" max="2" step="1" value="${motionIndex}" class="inner-premium-range">
                                </div>
                                <div class="setting-inner-item range-type">
                                    <div class="range-header"><span class="inner-item-label">Opacité</span><span id="inner-val-opacity" class="inner-badge">${glow.opacity}%</span></div>
                                    <input type="range" id="inner-range-opacity" min="50" max="100" value="${glow.opacity}" class="inner-premium-range">
                                </div>
                                <div class="setting-inner-item range-type">
                                    <div class="range-header"><span class="inner-item-label">Flou d'arrière-plan</span><span id="inner-val-blur" class="inner-badge">${glow.blur}px</span></div>
                                    <input type="range" id="inner-range-blur" min="0" max="50" value="${glow.blur}" class="inner-premium-range">
                                </div>
                                <div class="setting-inner-item">
                                    <div class="inner-item-info"><span class="inner-item-label">Halo lumineux</span><span class="inner-item-desc">Lueur autour de l'island</span></div>
                                    <label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-glow" ${glow.glowEnabled !== false ? 'checked' : ''}><span class="inner-switch-slider"></span></label>
                                </div>
                                <div class="setting-inner-item range-type ${glow.glowEnabled !== false ? '' : 'hidden'}" id="inner-glow-density-container">
                                    <div class="range-header"><span class="inner-item-label">Intensité du halo</span><span id="inner-val-glow-density" class="inner-badge">${glow.glowDensity || 20}px</span></div>
                                    <input type="range" id="inner-range-glow-density" min="5" max="50" value="${glow.glowDensity || 20}" class="inner-premium-range">
                                </div>
                            </div>
                        </div>
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'media' ? 'is-active' : ''}" data-settings-tab-section="media">
                            <span class="settings-inner-label">Visualiseur Audio</span>
                            <div class="settings-inner-card">
                                <div class="setting-inner-item" style="justify-content: space-between;">
                                    <span class="inner-item-label">Couleurs</span>
                                    <select id="inner-viz-color-mode" class="inner-theme-select">
                                        <option value="cover" ${glow.vizColorMode === 'cover' ? 'selected' : ''}>Pochette</option>
                                        <option value="cyberpunk" ${glow.vizColorMode === 'cyberpunk' ? 'selected' : ''}>Dégradé Liquide</option>
                                        <option value="solid" ${glow.vizColorMode === 'solid' ? 'selected' : ''}>Couleur unique</option>
                                        <option value="gradient" ${glow.vizColorMode === 'gradient' ? 'selected' : ''}>Dégradé</option>
                                    </select>
                                </div>
                                <div class="setting-inner-item ${glow.vizColorMode === 'solid' ? '' : 'hidden'}" id="inner-viz-solid-container" style="justify-content: space-between;">
                                    <span class="inner-item-label">Couleur</span>
                                    <div class="inner-color-picker-wrapper"><input type="color" id="inner-viz-color-solid" value="${glow.vizColorSolid || '#00f3ff'}"></div>
                                </div>
                                <div class="setting-inner-item ${glow.vizColorMode === 'gradient' ? '' : 'hidden'}" id="inner-viz-gradient-container" style="flex-direction: column; align-items: stretch; gap: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><span class="inner-item-label">Début</span><div class="inner-color-picker-wrapper"><input type="color" id="inner-viz-color-grada" value="${glow.vizColorGradA || '#00f3ff'}"></div></div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 6px;"><span class="inner-item-label">Fin</span><div class="inner-color-picker-wrapper"><input type="color" id="inner-viz-color-gradb" value="${glow.vizColorGradB || '#ff00ff'}"></div></div>
                                </div>
                            </div>
                        </div>
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'media' ? 'is-active' : ''}" data-settings-tab-section="media">
                            <span class="settings-inner-label">Smart Media</span>
                            <div class="settings-inner-card">
                                <div class="setting-inner-item">
                                    <div class="inner-item-info"><span class="inner-item-label">Couleurs adaptatives</span><span class="inner-item-desc">S'adapte a la pochette en cours</span></div>
                                    <label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-cover-sync" ${isCoverSync ? 'checked' : ''}><span class="inner-switch-slider"></span></label>
                                </div>
                                <div class="setting-inner-item">
                                    <div class="inner-item-info"><span class="inner-item-label">Debug media</span><span class="inner-item-desc">Affiche source, cover et trackKey</span></div>
                                    <label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-media-debug" ${mediaDebugEnabled ? 'checked' : ''}><span class="inner-switch-slider"></span></label>
                                </div>
                                <div class="setting-inner-item" style="justify-content: space-between; align-items: center; gap: 8px;">
                                    <div class="inner-item-info"><span class="inner-item-label">Pilule compacte</span><span class="inner-item-desc">Contenu quand l'Island est reduite</span></div>
                                    <select id="inner-compact-mode" class="inner-theme-select" style="max-width: 150px;">
                                        <option value="cover" ${compactMode === 'cover' ? 'selected' : ''}>Pochette + viz</option>
                                        <option value="title" ${compactMode === 'title' ? 'selected' : ''}>Titre</option>
                                        <option value="volume" ${compactMode === 'volume' ? 'selected' : ''}>Volume app</option>
                                        <option value="progress" ${compactMode === 'progress' ? 'selected' : ''}>Progression</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="settings-column">
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'quick' ? 'is-active' : ''}" data-settings-tab-section="quick">
                            <span class="settings-inner-label">Comportement</span>
                            <div class="settings-inner-card">
                                <div class="setting-inner-item">
                                    <div class="inner-item-info"><span class="inner-item-label">Toujours visible</span><span class="inner-item-desc">Reste au-dessus des fenêtres</span></div>
                                    <label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-persistent" ${isPersistent ? 'checked' : ''}><span class="inner-switch-slider"></span></label>
                                </div>
                                <div class="setting-inner-item">
                                    <div class="inner-item-info"><span class="inner-item-label">Notifications Island</span><span class="inner-item-desc">Alertes temporaires dans l'ile</span></div>
                                    <label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-notifications" ${notificationsEnabled ? 'checked' : ''}><span class="inner-switch-slider"></span></label>
                                </div>
                                <div class="setting-inner-item hidden">
                                    <div class="inner-item-info"><span class="inner-item-label">Couleurs adaptatives</span><span class="inner-item-desc">S'adapte à la pochette en cours</span></div>
                                    <label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-cover-sync-unused" ${isCoverSync ? 'checked' : ''}><span class="inner-switch-slider"></span></label>
                                </div>
                                <div class="setting-inner-item hidden">
                                    <div class="inner-item-info"><span class="inner-item-label">Debug media</span><span class="inner-item-desc">Affiche source, cover et trackKey</span></div>
                                    <label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-media-debug-unused" ${mediaDebugEnabled ? 'checked' : ''}><span class="inner-switch-slider"></span></label>
                                </div>
                                <div class="setting-inner-item hidden" style="justify-content: space-between; align-items: center; gap: 8px;">
                                    <div class="inner-item-info"><span class="inner-item-label">Pilule compacte</span><span class="inner-item-desc">Contenu quand l'Island est reduite</span></div>
                                    <select id="inner-compact-mode-unused" class="inner-theme-select" style="max-width: 150px;">
                                        <option value="cover" ${compactMode === 'cover' ? 'selected' : ''}>Pochette + viz</option>
                                        <option value="title" ${compactMode === 'title' ? 'selected' : ''}>Titre</option>
                                        <option value="volume" ${compactMode === 'volume' ? 'selected' : ''}>Volume app</option>
                                        <option value="progress" ${compactMode === 'progress' ? 'selected' : ''}>Progression</option>
                                    </select>
                                </div>
                                <div class="setting-inner-item" style="justify-content: space-between; align-items: center; gap: 8px;">
                                    <div class="inner-item-info"><span class="inner-item-label">Raccourci clavier</span><span class="inner-item-desc">Afficher / masquer l'Island</span></div>
                                    <input type="text" id="inner-input-shortcut" value="${shortcut}" class="inner-input" style="width: 105px; text-align: center; text-transform: uppercase; cursor: pointer; font-weight: 700; font-family: var(--font-mono, monospace); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);" readonly>
                                </div>
                            </div>
                        </div>
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'quick' ? 'is-active' : ''}" data-settings-tab-section="quick" style="margin-bottom: 8px;">
                            <span class="settings-inner-label">Modules</span>
                            <div class="settings-inner-card">
                                <div class="setting-inner-item"><div class="inner-item-info"><span class="inner-item-label">Musique</span></div><label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-music" ${modules.music !== false ? 'checked' : ''}><span class="inner-switch-slider"></span></label></div>
                                <div class="setting-inner-item"><div class="inner-item-info"><span class="inner-item-label">Chronomètre</span></div><label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-timer" ${modules.timer !== false ? 'checked' : ''}><span class="inner-switch-slider"></span></label></div>
                                <div class="setting-inner-item"><div class="inner-item-info"><span class="inner-item-label">Centre de contrôle</span></div><label class="inner-ios-switch"><input type="checkbox" id="inner-toggle-control" ${isControlEnabled ? 'checked' : ''}><span class="inner-switch-slider"></span></label></div>
                            </div>
                        </div>
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'control' ? 'is-active' : ''}" data-settings-tab-section="control" style="margin-bottom: 8px;">
                            <span class="settings-inner-label">Dashboard Centre de Contrôle</span>
                            <div class="settings-inner-card">
                                <div class="setting-inner-item" style="justify-content: space-between; align-items: center;">
                                    <span class="inner-item-label">Widget actif</span>
                                    <select id="inner-control-widget-type" class="inner-theme-select" style="max-width: 150px; font-size: 10px;">
                                        <option value="launchpad" ${widgetType === 'launchpad' ? 'selected' : ''}>🚀 Raccourcis Rapides</option>
                                        <option value="stats" ${widgetType === 'stats' ? 'selected' : ''}>📊 Performance (CPU & RAM)</option>
                                        <option value="machine" ${widgetType === 'machine' ? 'selected' : ''}>🔋 Machine (Batterie & Disque)</option>
                                        <option value="weather" ${widgetType === 'weather' ? 'selected' : ''}>🌤️ Météo (Apple Weather)</option>
                                        <option value="mixer" ${widgetType === 'mixer' ? 'selected' : ''}>🔊 Mélangeur Audio</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="settings-inner-section settings-tab-section ${activeSettingsTab === 'control' ? 'is-active' : ''} ${widgetType === 'launchpad' ? '' : 'hidden'}" data-settings-tab-section="control" id="inner-shortcuts-section-container" style="margin-bottom: 8px;">
                            <span class="settings-inner-label">Configuration des Raccourcis</span>
                            <div class="settings-inner-card" style="gap: 6px; padding: 10px;">
                                ${[0, 1, 2, 3].map(i => {
                                    const s = shortcuts[i] || defaultShortcuts[i];
                                    return `
                                    <div class="setting-inner-item" style="flex-direction: column; align-items: stretch; gap: 4px; padding: 4px 0; border-bottom: ${i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none'};">
                                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                            <span class="inner-item-label" style="font-size: 10px; opacity: 0.85;">Bouton ${i + 1}</span>
                                            <select id="inner-shortcut-preset-${i}" class="inner-theme-select" style="max-width: 140px; padding: 2px 4px; font-size: 9px;">
                                                <option value="explorer" ${s.preset === 'explorer' ? 'selected' : ''}>📁 Explorateur</option>
                                                <option value="settings" ${s.preset === 'settings' ? 'selected' : ''}>⚙️ Paramètres</option>
                                                <option value="taskmgr" ${s.preset === 'taskmgr' ? 'selected' : ''}>💻 Gestionnaire</option>
                                                <option value="calc" ${s.preset === 'calc' ? 'selected' : ''}>🧮 Calculatrice</option>
                                                <option value="terminal" ${s.preset === 'terminal' ? 'selected' : ''}>📟 Terminal</option>
                                                <option value="notepad" ${s.preset === 'notepad' ? 'selected' : ''}>📝 Bloc-notes</option>
                                                <option value="paint" ${s.preset === 'paint' ? 'selected' : ''}>🎨 Paint</option>
                                                <option value="snipping" ${s.preset === 'snipping' ? 'selected' : ''}>📷 Capture</option>
                                                <option value="music" ${s.preset === 'music' ? 'selected' : ''}>Lecteur Island</option>
                                                <option value="history" ${s.preset === 'history' ? 'selected' : ''}>Historique musique</option>
                                                <option value="musicSearch" ${s.preset === 'musicSearch' ? 'selected' : ''}>Recherche musique</option>
                                                <option value="widgets" ${s.preset === 'widgets' ? 'selected' : ''}>Widgets Island</option>
                                                <option value="mixer" ${s.preset === 'mixer' ? 'selected' : ''}>Mixer audio</option>
                                                <option value="islandSettings" ${s.preset === 'islandSettings' ? 'selected' : ''}>Reglages Island</option>
                                                <option value="custom" ${s.preset === 'custom' ? 'selected' : ''}>✨ Personnalisé...</option>
                                            </select>
                                        </div>
                                        <div id="inner-shortcut-custom-container-${i}" class="${s.preset === 'custom' ? '' : 'hidden'}" style="display: flex; gap: 6px; margin-top: 2px;">
                                            <input type="text" id="inner-shortcut-name-${i}" placeholder="Nom" value="${s.name}" class="inner-input" style="flex: 1; padding: 4px; font-size: 9px;">
                                            <input type="text" id="inner-shortcut-cmd-${i}" placeholder="Commande" value="${s.cmd}" class="inner-input" style="flex: 2; padding: 4px; font-size: 9px;">
                                        </div>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const updateSettings = () => {
            const newConfig = {
                preset: 'cyberpunk',
                modules: { music: document.getElementById('inner-toggle-music').checked, timer: document.getElementById('inner-toggle-timer').checked, search: false, network: false },
                glow: {
                    opacity: parseInt(document.getElementById('inner-range-opacity').value),
                    blur: parseInt(document.getElementById('inner-range-blur').value),
                    glowEnabled: document.getElementById('inner-toggle-glow').checked,
                    glowDensity: parseInt(document.getElementById('inner-range-glow-density').value),
                    glowColor: '#00f3ff', bgImage: "", imgOpacity: 100,
                    vizColorMode: document.getElementById('inner-viz-color-mode').value,
                    vizColorSolid: document.getElementById('inner-viz-color-solid') ? document.getElementById('inner-viz-color-solid').value : '#00f3ff',
                    vizColorGradA: document.getElementById('inner-viz-color-grada').value,
                    vizColorGradB: document.getElementById('inner-viz-color-gradb').value
                }
            };
            localStorage.setItem('island_standalone_config', JSON.stringify(newConfig));
            localStorage.setItem('liquid_island_config', JSON.stringify(newConfig.glow));
            localStorage.setItem('liquid_music_enabled', newConfig.modules.music);
            localStorage.setItem('liquid_island_timer_enabled', newConfig.modules.timer);
            this._islandConfig = newConfig.glow;
            ThemeService.applyIslandSettings();
            window.dispatchEvent(new CustomEvent('liquid-island-config-changed', { detail: newConfig.glow }));
            
            if (ipcRenderer) ipcRenderer.send('config-changed', newConfig);
        };

        const profileSelect = this.content.querySelector('#inner-profile-select');
        const profileName = this.content.querySelector('#inner-profile-name');
        const profileCreate = this.content.querySelector('#inner-profile-create');
        const profileDelete = this.content.querySelector('#inner-profile-delete');
        const exportBtn = this.content.querySelector('#inner-settings-export');
        const importBtn = this.content.querySelector('#inner-settings-import');
        const importFile = this.content.querySelector('#inner-settings-import-file');
        const motionRange = this.content.querySelector('#inner-range-motion');

        this.content.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                SoundService.play('close');
                localStorage.setItem('liquid_settings_tab', btn.dataset.settingsTab || 'quick');
                this.renderSettings();
            });
        });

        profileSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            this.applyProfile(e.target.value);
        });
        profileCreate.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createProfileFromCurrent(profileName.value);
        });
        profileName.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') this.createProfileFromCurrent(profileName.value);
        });
        profileDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteProfile(profileSelect.value);
        });
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportAppSettings();
        });
        importBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            importFile.click();
        });
        importFile.addEventListener('change', (e) => {
            this.importAppSettingsFromFile(e.target.files && e.target.files[0]);
            e.target.value = '';
        });
        motionRange.addEventListener('input', (e) => {
            const level = MOTION_LEVELS[Number(e.target.value)] || 'fluid';
            localStorage.setItem('liquid_motion_level', level);
            this.content.querySelector('#inner-val-motion').innerText = MOTION_LABELS[level];
            this.syncMotionPreference();
        });

        // Sliders
        this.content.querySelector('#inner-range-opacity').addEventListener('input', (e) => { this.content.querySelector('#inner-val-opacity').innerText = `${e.target.value}%`; updateSettings(); });
        this.content.querySelector('#inner-range-blur').addEventListener('input', (e) => { this.content.querySelector('#inner-val-blur').innerText = `${e.target.value}px`; updateSettings(); });
        this.content.querySelector('#inner-range-glow-density').addEventListener('input', (e) => { this.content.querySelector('#inner-val-glow-density').innerText = `${e.target.value}px`; updateSettings(); });

        // Glow toggle
        this.content.querySelector('#inner-toggle-glow').addEventListener('change', (e) => { SoundService.play('close'); this.content.querySelector('#inner-glow-density-container').classList.toggle('hidden', !e.target.checked); updateSettings(); });

        // Viz color mode
        const vizSolid = this.content.querySelector('#inner-viz-solid-container');
        const vizGrad = this.content.querySelector('#inner-viz-gradient-container');
        this.content.querySelector('#inner-viz-color-mode').addEventListener('change', (e) => { SoundService.play('close'); vizSolid.classList.add('hidden'); vizGrad.classList.add('hidden'); if (e.target.value === 'solid') vizSolid.classList.remove('hidden'); if (e.target.value === 'gradient') vizGrad.classList.remove('hidden'); updateSettings(); });
        if (this.content.querySelector('#inner-viz-color-solid')) this.content.querySelector('#inner-viz-color-solid').addEventListener('input', updateSettings);
        this.content.querySelector('#inner-viz-color-grada').addEventListener('input', updateSettings);
        this.content.querySelector('#inner-viz-color-gradb').addEventListener('input', updateSettings);

        // Module switches
        ['inner-toggle-music', 'inner-toggle-timer'].forEach(id => { this.content.querySelector('#' + id).addEventListener('change', () => { SoundService.play('close'); updateSettings(); }); });
        this.content.querySelector('#inner-toggle-control').addEventListener('change', (e) => { SoundService.play('close'); localStorage.setItem('liquid_island_control_enabled', e.target.checked); });

        // Behaviour toggles
        this.content.querySelector('#inner-toggle-persistent').addEventListener('change', (e) => { SoundService.play('close'); localStorage.setItem('liquid_island_persistent', e.target.checked); this.syncPersistentSetting(); });
        this.content.querySelector('#inner-toggle-notifications').addEventListener('change', (e) => { SoundService.play('close'); localStorage.setItem('liquid_notifications_enabled', e.target.checked); });
        this.content.querySelector('#inner-toggle-cover-sync').addEventListener('change', (e) => { SoundService.play('close'); localStorage.setItem('liquid_cover_color_sync', e.target.checked); if (!e.target.checked) this.restorePresetTheme(); });
        this.content.querySelector('#inner-toggle-media-debug').addEventListener('change', (e) => { SoundService.play('close'); localStorage.setItem('liquid_media_debug', e.target.checked); this._lastRenderedTrack = null; });
        this.content.querySelector('#inner-compact-mode').addEventListener('change', (e) => {
            SoundService.play('close');
            localStorage.setItem('liquid_idle_compact_mode', e.target.value);
            this._vizCanvas = null;
            if (!this.isExpanded) this.renderIdle();
        });

        // Control Widget Type selector
        const widgetSelect = this.content.querySelector('#inner-control-widget-type');
        const shortcutsSection = this.content.querySelector('#inner-shortcuts-section-container');
        widgetSelect.addEventListener('change', (e) => {
            SoundService.play('close');
            const val = e.target.value;
            localStorage.setItem('liquid_control_widget_type', val);
            shortcutsSection.classList.toggle('hidden', val !== 'launchpad');
        });

        // Bind Shortcuts event listeners
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

        [0, 1, 2, 3].forEach(i => {
            const selectEl = this.content.querySelector(`#inner-shortcut-preset-${i}`);
            const customContainer = this.content.querySelector(`#inner-shortcut-custom-container-${i}`);
            const nameInput = this.content.querySelector(`#inner-shortcut-name-${i}`);
            const cmdInput = this.content.querySelector(`#inner-shortcut-cmd-${i}`);

            const saveShortcut = () => {
                const presetVal = selectEl.value;
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
                
                const current = JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts));
                current[i] = shortcutData;
                localStorage.setItem('liquid_control_shortcuts', JSON.stringify(current));
            };

            selectEl.addEventListener('change', (e) => {
                SoundService.play('close');
                const isCustom = e.target.value === 'custom';
                customContainer.classList.toggle('hidden', !isCustom);
                
                if (!isCustom) {
                    const preset = SHORTCUT_PRESETS[e.target.value];
                    nameInput.value = preset.name;
                    cmdInput.value = preset.cmd;
                }
                saveShortcut();
            });

            nameInput.addEventListener('input', saveShortcut);
            cmdInput.addEventListener('input', saveShortcut);
        });

        // Keyboard Shortcut recorder
        const shortcutInput = this.content.querySelector('#inner-input-shortcut');
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
                    let keyName = key;
                    if (key === ' ') keyName = 'Space';
                    else if (key.length === 1) keyName = key.toUpperCase();
                    else keyName = key.charAt(0).toUpperCase() + key.slice(1);
                    
                    keys.push(keyName);
                }

                if (keys.length > 0) {
                    const finalShortcut = keys.join('+');
                    shortcutInput.value = finalShortcut;
                    localStorage.setItem('liquid_island_shortcut', finalShortcut);
                    
                    if (ipcRenderer) {
                        try {
                            
                            ipcRenderer.send('register-shortcut', finalShortcut);
                        } catch (err) {}
                    }
                }
            });
            
            shortcutInput.addEventListener('focus', () => {
                shortcutInput.style.borderColor = 'var(--neon-primary)';
                shortcutInput.value = 'Press keys...';
            });
            shortcutInput.addEventListener('blur', () => {
                shortcutInput.style.borderColor = '';
                shortcutInput.value = localStorage.getItem('liquid_island_shortcut') || 'Alt+I';
            });
        }

        this.content.querySelector('.island-settings-container').onclick = (e) => e.stopPropagation();
    }
}
