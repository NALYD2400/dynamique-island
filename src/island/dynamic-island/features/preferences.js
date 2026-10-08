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
        const scaleLabel = document.querySelector('#layout-edit-toolbar .layout-edit-scale');
        if (scaleLabel) scaleLabel.textContent = `${Math.round(safeScale * 100)} %`;
    },

    /** Change la taille par pas de 5 %, dans les limites du cœur natif (65 à 150 %). */
    stepLayoutScale(direction) {
        const current = Number(this._layoutConfig.scale) || 1;
        const next = Math.min(1.5, Math.max(0.65, Math.round((current + direction * 0.05) * 100) / 100));
        if (next === current) return;
        this.applyLayoutConfig({ scale: next }); // pourcentage à jour sans attendre le cœur natif
        ipcRenderer.send('layout-config-changed', { scale: next });
    },

    /** Barre de placement sous l'Island : taille, recentrage, fin du mode. Branchée une seule fois. */
    initLayoutEditToolbar() {
        const toolbar = document.getElementById('layout-edit-toolbar');
        if (!toolbar || toolbar.dataset.ready) return;
        toolbar.dataset.ready = 'true';

        toolbar.addEventListener('click', (e) => {
            const action = e.target.closest('[data-layout]')?.dataset.layout;
            if (!action) return;
            e.stopPropagation();
            if (action === 'smaller') this.stepLayoutScale(-1);
            else if (action === 'bigger') this.stepLayoutScale(1);
            else if (action === 'center') ipcRenderer.send('layout-reset');
            else if (action === 'done') ipcRenderer.send('set-layout-edit-mode', false);
        });

        // Molette au-dessus de l'Island ou de la barre : taille.
        const onWheel = (e) => {
            if (!this._layoutEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            this.stepLayoutScale(e.deltaY < 0 ? 1 : -1);
        };
        document.getElementById('dynamic-island-container')?.addEventListener('wheel', onWheel, { passive: false, capture: true });

        document.addEventListener('keydown', (e) => {
            if (!this._layoutEditMode) return;
            if (e.key === 'Escape' || e.key === 'Enter') {
                e.preventDefault();
                ipcRenderer.send('set-layout-edit-mode', false);
            } else if (e.key === '+' || e.key === '=' || e.key === '-') {
                e.preventDefault();
                this.stepLayoutScale(e.key === '-' ? -1 : 1);
            }
        });
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
        this.initLayoutEditToolbar();
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
