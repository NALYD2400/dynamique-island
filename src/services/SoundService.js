
export const SoundService = {
    audioContext: null,

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    play(type) {
        // Check if sound effects are enabled in settings
        const enabled = localStorage.getItem('liquid_sound_effects_enabled') !== 'false';
        if (!enabled) return;

        if (!this.audioContext) this.init();
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        switch (type) {
            case 'open':
                this.playCrystalTink(440, 0.1);
                break;
            case 'close':
                this.playBubblePop();
                break;
            case 'click':
                this.playSoftTick();
                break;
            case 'dock':
                this.playGlassSlide();
                break;
            case 'notification':
                this.playHarmonicChime();
                break;
            case 'hover':
                this.playSoftTick();
                break;
            case 'vortex_suck':
                this.playVortexSweep();
                break;
            case 'success':
                this.playCrystalTink(1200, 0.12);
                setTimeout(() => this.playCrystalTink(1800, 0.08), 70);
                break;
        }
    },

    playVortexSweep() {
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    },

    // --- Synthesized Crystal/Liquid Sounds ---

    playCrystalTink(freq = 880, volume = 0.1) {
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    },

    playBubblePop() {
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    },

    playGlassSlide() {
        const ctx = this.audioContext;
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.2);
        filter.Q.value = 10;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start();
    },

    playHarmonicChime() {
        const ctx = this.audioContext;
        const frequencies = [880, 1100, 1320]; // Major chord harmonies

        frequencies.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, ctx.currentTime + (i * 0.05));

            gain.gain.setValueAtTime(0, ctx.currentTime + (i * 0.05));
            gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + (i * 0.05) + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + (i * 0.05));
            osc.stop(ctx.currentTime + 1.0);
        });
    },

    playSoftTick() {
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, ctx.currentTime);

        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    }
};
