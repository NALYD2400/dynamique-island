/**
 * Effet verre (Liquid Glass) sur les boutons de la vue musique.
 *
 * Le verre réfracte la couche `.island-glass-backdrop` (la pochette floutée en
 * fond de l'Island), pas le bureau Windows. Il n'est donc activé que là où il y
 * a quelque chose dessous : le lecteur déplié. Le SDK n'est chargé qu'au premier
 * usage, et la scène est libérée dès qu'on quitte le lecteur.
 */
import { rgbToHex } from '../helpers/color.js';

const MUSIC_SURFACES = [
    // Précédent / suivant : icônes seules, le verre n'apparaît qu'au survol (comme Apple Music).
    { selector: '.music-controls .control-btn-music:not(.play-btn)', options: { material: 'clear', radius: 'circle', interactive: true }, hoverOnly: true },
    { selector: '.music-controls .play-btn', options: { material: 'regular', radius: 'circle', interactive: true }, tinted: true },
    { selector: '.music-action-cluster', options: { material: 'clear', radius: 'capsule' } },
];

let glassModule = null;
const loadGlass = () => (glassModule ??= import('../../glass-scene.js'));

export const glassMethods = {
    isGlassControlsEnabled() {
        return this._islandConfig?.glassControls !== false
            && localStorage.getItem('liquid_eco_mode') !== 'true';
    },

    /** Retire le verre des boutons, et libère la scène si elle ne sert plus. */
    releaseGlassControls({ keepScene = false } = {}) {
        this._glassToken = (this._glassToken || 0) + 1;
        (this._glassCleanups || []).forEach((cleanup) => cleanup());
        this._glassCleanups = [];
        this.el.classList.remove('glass-controls');
        if (!keepScene && this._glassScene) {
            this._glassScene.dispose();
            this._glassScene = null;
        }
    },

    /** À appeler après chaque rendu du lecteur : les boutons ont été recréés. */
    async syncGlassControls() {
        const wanted = this.isGlassControlsEnabled() && this.isExpanded && this.mode === 'music';
        this.releaseGlassControls({ keepScene: wanted });
        if (!wanted) return;

        const token = this._glassToken;
        let createGlassScene;
        try {
            ({ createGlassScene } = await loadGlass());
        } catch (e) {
            console.warn('[Glass] SDK indisponible, boutons classiques conservés.', e);
            return;
        }
        if (token !== this._glassToken) return; // un autre rendu est passé entre-temps

        try {
            if (!this._glassScene) {
                this._glassScene = createGlassScene(this.el, { maxSurfaces: 8 });
                this._glassScene.setContent(this.el.querySelector('.island-glass-backdrop'));
            }
            const tint = this._coverColors && localStorage.getItem('liquid_cover_color_sync') !== 'false'
                ? rgbToHex(this._coverColors.primary.r, this._coverColors.primary.g, this._coverColors.primary.b)
                : undefined;

            const scene = this._glassScene;
            const attach = (element, surfaceOptions) => {
                element.classList.add('lg-surface');
                const remove = scene.addSurface(element, surfaceOptions);
                return () => {
                    remove();
                    element.classList.remove('lg-surface');
                };
            };

            for (const { selector, options, tinted, hoverOnly } of MUSIC_SURFACES) {
                const surfaceOptions = { ...options, appearance: 'dark', tint: tinted ? tint : undefined };
                for (const element of this.content.querySelectorAll(selector)) {
                    if (!hoverOnly) {
                        this._glassCleanups.push(attach(element, surfaceOptions));
                        continue;
                    }
                    let detach = null;
                    const show = () => { detach ??= attach(element, surfaceOptions); };
                    const hide = () => { detach?.(); detach = null; };
                    element.addEventListener('pointerenter', show);
                    element.addEventListener('pointerleave', hide);
                    if (element.matches(':hover')) show();
                    this._glassCleanups.push(() => {
                        element.removeEventListener('pointerenter', show);
                        element.removeEventListener('pointerleave', hide);
                        hide();
                    });
                }
            }
            this.el.classList.add('glass-controls');
        } catch (e) {
            console.warn('[Glass] Échec de l’activation du verre.', e);
            this.releaseGlassControls();
        }
    },
};
