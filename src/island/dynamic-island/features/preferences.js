/** Préférences d’affichage : position, animations, mode éco, persistance. */
import { ipcRenderer } from '../../../shared/ipc.js';
import { visualizerService } from '../../../services/AudioVisualizerService.js';
import { MOTION_LEVELS } from '../helpers/constants.js';

export const preferenceMethods = {
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
    },

    getMotionLevel() {
        const saved = localStorage.getItem('liquid_motion_level') || 'fluid';
        return MOTION_LEVELS.includes(saved) ? saved : 'fluid';
    },

    syncMotionPreference() {
        const level = this.getMotionLevel();
        document.body.classList.remove('motion-sober', 'motion-fluid', 'motion-vivid');
        document.body.classList.add(`motion-${level}`);
        return level;
    },

    syncEcoMode() {
        this.isEcoMode = localStorage.getItem('liquid_eco_mode') === 'true';
        document.body.classList.toggle('eco-mode', this.isEcoMode);
        visualizerService.setEcoMode(this.isEcoMode);
        this.syncVisualizerActivity();
        return this.isEcoMode;
    },

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
    },

    syncPersistentSetting() {
        if (ipcRenderer) {
            const enabled = localStorage.getItem('liquid_island_persistent') === 'true';
            ipcRenderer.send('set-persistent-island', enabled);
        }
    },
};
