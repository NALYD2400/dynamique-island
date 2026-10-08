/** Préréglages : raccourcis du centre de contrôle, profils rapides et listes de choix. */

export const SHORTCUT_PRESETS = {
    explorer: { name: 'Explorateur', icon: 'ph-fill ph-folder', cmd: 'explorer.exe' },
    settings: { name: 'Paramètres', icon: 'ph-fill ph-gear', cmd: 'ms-settings:' },
    taskmgr: { name: 'Gestionnaire', icon: 'ph-fill ph-cpu', cmd: 'taskmgr.exe' },
    calc: { name: 'Calculatrice', icon: 'ph-fill ph-calculator', cmd: 'calc.exe' },
    terminal: { name: 'Terminal', icon: 'ph-fill ph-terminal', cmd: 'cmd.exe' },
    notepad: { name: 'Bloc-notes', icon: 'ph-fill ph-note-pencil', cmd: 'notepad.exe' },
    paint: { name: 'Paint', icon: 'ph-fill ph-palette', cmd: 'ms-paint:' },
    snipping: { name: 'Capture d’écran', icon: 'ph-fill ph-camera', cmd: 'ms-screenclip:' },
    music: { name: 'Lecteur', icon: 'ph-fill ph-music-notes', cmd: 'liquid:music' },
    history: { name: 'Historique', icon: 'ph-fill ph-clock-counter-clockwise', cmd: 'liquid:music-history' },
    musicSearch: { name: 'Recherche', icon: 'ph-bold ph-magnifying-glass', cmd: 'liquid:music-search' },
    widgets: { name: 'Widgets', icon: 'ph-fill ph-squares-four', cmd: 'liquid:menu' },
    mixer: { name: 'Mixer', icon: 'ph-fill ph-sliders-horizontal', cmd: 'liquid:mixer' },
    islandSettings: { name: 'Réglages', icon: 'ph-fill ph-gear-six', cmd: 'liquid:settings' },
    custom: { name: 'Perso', icon: 'ph-fill ph-sparkle', cmd: '' },
};

/** Groupes affichés dans le menu de choix d'un raccourci. */
export const SHORTCUT_GROUPS = [
    { label: 'Windows', keys: ['explorer', 'settings', 'taskmgr', 'calc', 'terminal', 'notepad', 'paint', 'snipping'] },
    { label: 'Island', keys: ['music', 'history', 'musicSearch', 'widgets', 'mixer', 'islandSettings'] },
    { label: 'Autre', keys: ['custom'] },
];

export const DEFAULT_SHORTCUTS = [
    { name: 'Explorer', preset: 'explorer', icon: 'ph-fill ph-folder', cmd: 'explorer.exe' },
    { name: 'Settings', preset: 'settings', icon: 'ph-fill ph-gear', cmd: 'ms-settings:' },
    { name: 'TaskMgr', preset: 'taskmgr', icon: 'ph-fill ph-cpu', cmd: 'taskmgr.exe' },
    { name: 'Calc', preset: 'calc', icon: 'ph-fill ph-calculator', cmd: 'calc.exe' },
];

export const MOTION_OPTIONS = [
    { value: 'sober', label: 'Sobre' },
    { value: 'fluid', label: 'Fluide' },
    { value: 'vivid', label: 'Vivante' },
];

export const MATERIAL_OPTIONS = [
    { value: 'glass', label: 'Verre', icon: 'ph-drop' },
    { value: 'metal', label: 'Métal', icon: 'ph-circle-half' },
    { value: 'holo', label: 'Holo', icon: 'ph-sparkle' },
];

export const GRAIN_OPTIONS = [
    { value: 'none', label: 'Aucun' },
    { value: 'light', label: 'Léger' },
    { value: 'medium', label: 'Marqué' },
];

export const GLOW_COLOR_OPTIONS = [
    { value: 'cover', label: 'Pochette' },
    { value: 'mix', label: 'Mixte' },
    { value: 'fixed', label: 'Fixe' },
];

export const VIZ_COLOR_OPTIONS = [
    { value: 'cyberpunk', label: 'Liquide' },
    { value: 'cover', label: 'Pochette' },
    { value: 'solid', label: 'Unie' },
    { value: 'gradient', label: 'Dégradé' },
];

export const COMPACT_MODE_OPTIONS = [
    { value: 'cover', label: 'Pochette et visualiseur' },
    { value: 'title', label: 'Titre du morceau' },
    { value: 'volume', label: 'Volume de l’application' },
    { value: 'progress', label: 'Progression' },
];

export const WALLPAPER_STYLE_OPTIONS = [
    { value: 'blur', label: 'Flou ambiant', icon: 'ph-drop-half' },
    { value: 'cinematic', label: 'Cinématique', icon: 'ph-film-strip' },
    { value: 'sharp', label: 'Pochette nette', icon: 'ph-image' },
];

export const WALLPAPER_BLUR_OPTIONS = [
    { value: 'light', label: 'Léger' },
    { value: 'moderate', label: 'Moyen' },
    { value: 'strong', label: 'Fort' },
];

export const WIDGET_OPTIONS = [
    { value: 'launchpad', label: 'Raccourcis', icon: 'ph-rocket-launch' },
    { value: 'stats', label: 'Performance', icon: 'ph-chart-line' },
    { value: 'machine', label: 'Batterie', icon: 'ph-battery-high' },
    { value: 'weather', label: 'Météo', icon: 'ph-cloud-sun' },
    { value: 'mixer', label: 'Mixeur', icon: 'ph-sliders-horizontal' },
];

/** Profils rapides (mêmes valeurs que la version précédente). */
export const QUICK_PROFILES = {
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
            opacity: 94, blur: 30, glowEnabled: true, glowDensity: 28, glowColorMode: 'cover', glowBlend: 80,
            glowColor: '#00f3ff', vizColorMode: 'cover', vizColorSolid: '#00f3ff', vizColorGradA: '#00f3ff',
            vizColorGradB: '#ff00ff', materialStyle: 'glass', grainEffect: 'none',
        },
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
            opacity: 92, blur: 30, glowEnabled: true, glowDensity: 20, glowColorMode: 'mix', glowBlend: 70,
            glowColor: '#00f3ff', vizColorMode: 'cover', vizColorSolid: '#00f3ff', vizColorGradA: '#00f3ff',
            vizColorGradB: '#ff00ff', materialStyle: 'glass', grainEffect: 'light',
        },
    },
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
            opacity: 88, blur: 14, glowEnabled: false, glowDensity: 8, glowColorMode: 'fixed', glowBlend: 0,
            glowColor: '#00f3ff', vizColorMode: 'cyberpunk', vizColorSolid: '#00f3ff', vizColorGradA: '#00f3ff',
            vizColorGradB: '#bc13fe', materialStyle: 'metal', grainEffect: 'none',
        },
    },
};
