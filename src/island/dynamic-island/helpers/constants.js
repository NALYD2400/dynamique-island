/** Constantes partagées (niveaux d’animation, raccourcis par défaut). */

export const MOTION_LEVELS = ['sober', 'fluid', 'vivid'];

export const MOTION_LABELS = {
    sober: 'Sobre',
    fluid: 'Fluide',
    vivid: 'Vivante'
};

export const DEFAULT_CONTROL_SHORTCUTS = [
    { name: "Explorer", preset: "explorer", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
    { name: "Settings", preset: "settings", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
    { name: "TaskMgr", preset: "taskmgr", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
    { name: "Calc", preset: "calc", icon: "ph-fill ph-calculator", cmd: "calc.exe" }
];
