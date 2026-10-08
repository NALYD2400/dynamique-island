/** Visualiseur audio (canvas) branché sur le niveau WASAPI. */
import { visualizerService } from '../../../services/AudioVisualizerService.js';
import { ThemeService } from '../../../services/ThemeService.js';
import { hexToRgb, rgbToHex } from '../helpers/color.js';

export const visualizerMethods = {
    _startVisualizer() {
        if (localStorage.getItem('liquid_eco_mode') === 'true') {
            visualizerService.setEcoMode(true);
            return;
        }

        if (this._vizUnsub) {
            this.syncVisualizerActivity();
            return;
        }

        visualizerService.setEcoMode(false);
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
    },

    syncVisualizerActivity() {
        const canvas = this._vizCanvas;
        const ecoMode = localStorage.getItem('liquid_eco_mode') === 'true';
        visualizerService.setEcoMode(ecoMode);

        const hasVisibleCanvas = Boolean(!ecoMode && canvas && canvas.isConnected && canvas.width > 0 && canvas.height > 0);
        if (hasVisibleCanvas && !this._vizUnsub) {
            this._startVisualizer();
            return;
        }

        if (hasVisibleCanvas && !visualizerService.isRunning) {
            visualizerService.start().catch(() => {});
        }
        visualizerService.setActive(hasVisibleCanvas);

        if (hasVisibleCanvas) {
            this._updateVizCanvas();
        }
    },

    _updateVizCanvas() {
        const canvas = this._vizCanvas;
        if (localStorage.getItem('liquid_eco_mode') === 'true') {
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }

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

        const vizColorMode = this._islandConfig.vizColorMode || 'cover';

        // Optimize: pre-parse colors outside the loop to avoid regex parsing 60 times per frame!
        let solidRgb = null;
        let gradARgb = null;
        let gradBRgb = null;
        
        if (vizColorMode === 'solid') {
            const hex = this._islandConfig.vizColorSolid || '#D49460';
            solidRgb = hexToRgb(hex);
        } else if (vizColorMode === 'gradient') {
            const hexA = this._islandConfig.vizColorGradA || '#D49460';
            const hexB = this._islandConfig.vizColorGradB || '#EDBC89';
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
                    r = Math.round(212 + (237 - 212) * t);
                    g = Math.round(148 + (188 - 148) * t);
                    b = Math.round(96 + (137 - 96) * t);
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
    },
};
