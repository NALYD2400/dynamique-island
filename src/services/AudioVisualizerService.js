/**
 * AudioVisualizerService
 * Captures system audio via Web Audio API (Electron loopback)
 * and provides real-time frequency data for visualizer bars.
 */

class AudioVisualizerService {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.stream = null;
        this.isRunning = false;
        this.subscribers = new Set();
        this._animFrame = null;
        this._fallbackMode = false; // If loopback fails, use smart simulation
        this._simPhase = 0;
        this._simBeatTimer = 0;
        this._simBPM = 120;
        this._simAmplitude = 0;
        this.currentMode = null;
        this._isLoopActive = false;
    }

    /**
     * Start audio capture and analysis.
     * Tries to capture system audio (loopback) in Electron.
     * Falls back to a smart music-reactive simulation if unavailable.
     */
    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        const mode = localStorage.getItem('liquid_visualizer_mode') || 'real';
        this.currentMode = mode;
        if (mode === 'simulation') {
            this._fallbackMode = true;
            this._startSimulation();
        } else {
            try {
                await this._startLoopback();
            } catch (err) {
                console.warn('[Visualizer] Loopback failed, using simulation mode:', err.message);
                this._fallbackMode = true;
                this._startSimulation();
            }
        }
    }

    async setMode(mode) {
        if (!this.isRunning) return;
        if (this.currentMode === mode) return;
        this.currentMode = mode;

        // Stop current animation frame, stream, context
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }

        if (this.source) {
            try { this.source.disconnect(); } catch (e) { }
            this.source = null;
        }

        if (this.audioContext) {
            try { this.audioContext.close(); } catch (e) { }
            this.audioContext = null;
            this.analyser = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }

        if (mode === 'simulation') {
            console.log('[Visualizer] Switching to Simulation Mode...');
            this._fallbackMode = true;
            this._startSimulation();
        } else {
            console.log('[Visualizer] Switching to Real Audio Loopback Mode...');
            try {
                await this._startLoopback();
            } catch (err) {
                console.warn('[Visualizer] Loopback failed on mode switch, using simulation mode:', err.message);
                this._fallbackMode = true;
                this._startSimulation();
            }
        }
    }

    _startLoopIfNeeded() {
        if (this._isLoopActive) return;
        this._isLoopActive = true;
        if (this.currentMode === 'simulation') {
            this._simTick();
        } else {
            this._tick();
        }
    }

    async _startLoopback() {
        let stream = null;
        try {
            const { ipcRenderer } = window.require('electron');
            const sourceId = await ipcRenderer.invoke('get-audio-screen-source');
            if (sourceId) {
                console.log('[Visualizer] Attempting getUserMedia loopback with source ID:', sourceId);
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId
                        }
                    },
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('[Visualizer] getUserMedia loopback failed, trying getDisplayMedia fallback:', e.message);
        }

        if (!stream) {
            // Fallback to legacy getDisplayMedia
            stream = await navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: true
            });
        }

        // Stop the video track immediately - we only need audio
        stream.getVideoTracks().forEach(track => track.stop());

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
            throw new Error('No audio track in media stream');
        }

        this.stream = stream;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        this.source = this.audioContext.createMediaStreamSource(new MediaStream(audioTracks));
        this.source.connect(this.analyser);

        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this._fallbackMode = false;
        console.log('[Visualizer] Real system audio loopback started successfully!');
        this._startLoopIfNeeded();
    }

    _startSimulation() {
        // Smart simulation: creates musical-looking bars that sync with the beat
        this._simPhase = 0;
        this._simBeatTimer = 0;
        this._simAmplitude = 0.85;
        this._startLoopIfNeeded();
    }

    _tick() {
        if (!this.isRunning || !this.analyser || this.currentMode !== 'real') {
            this._isLoopActive = false;
            return;
        }

        if (this._simAmplitude <= 0) {
            // Smooth fade out: notify zero levels and stop requestAnimationFrame
            this._notify({ bands: [0, 0, 0, 0, 0], raw: new Uint8Array(this.analyser.frequencyBinCount), isSimulation: false });
            this._isLoopActive = false;
            this._animFrame = null;
            return;
        }

        this.analyser.getByteFrequencyData(this.dataArray);

        // Extract key frequency bands (bass, mid, treble)
        const bufLen = this.dataArray.length;
        const bass = this._average(this.dataArray, 0, Math.floor(bufLen * 0.1));
        const lowMid = this._average(this.dataArray, Math.floor(bufLen * 0.1), Math.floor(bufLen * 0.25));
        const mid = this._average(this.dataArray, Math.floor(bufLen * 0.25), Math.floor(bufLen * 0.5));
        const highMid = this._average(this.dataArray, Math.floor(bufLen * 0.5), Math.floor(bufLen * 0.75));
        const treble = this._average(this.dataArray, Math.floor(bufLen * 0.75), bufLen);

        // Retrieve visualizer sensitivity from localStorage (default 2.5)
        const sensitivity = parseFloat(localStorage.getItem('liquid_visualizer_sensitivity') || '2.5');

        this._notify({
            bands: [bass, lowMid, mid, highMid, treble].map(v => Math.min(1.0, (v / 255) * sensitivity)),
            raw: this.dataArray,
            isSimulation: false
        });

        this._animFrame = requestAnimationFrame(() => this._tick());
    }

    _simTick() {
        if (!this.isRunning || this.currentMode !== 'simulation') {
            this._isLoopActive = false;
            return;
        }

        if (this._simAmplitude <= 0) {
            // Smooth fade out: notify zero levels and stop requestAnimationFrame
            this._notify({ bands: [0, 0, 0, 0, 0], raw: null, isSimulation: true });
            this._isLoopActive = false;
            this._animFrame = null;
            return;
        }

        const t = performance.now() / 1000;
        const bps = this._simBPM / 60;

        // Create organic movement based on sine waves at musical frequencies
        const beat = Math.abs(Math.sin(t * bps * Math.PI)); // 0-1 beat pulse
        const beatSharp = Math.pow(beat, 3); // Sharper beat attack

        // Five frequency bands with musical characteristics
        const bands = [
            // Bass: strong beat punch
            Math.min(1, beatSharp * 0.9 + Math.abs(Math.sin(t * bps * Math.PI * 0.5)) * 0.3 + Math.random() * 0.08),
            // Low mid: medium beat response
            Math.min(1, Math.abs(Math.sin(t * bps * Math.PI + 0.3)) * 0.7 + Math.abs(Math.sin(t * 2.3)) * 0.2 + Math.random() * 0.07),
            // Mid: melodic variation
            Math.min(1, Math.abs(Math.sin(t * bps * Math.PI * 1.5 + 0.7)) * 0.6 + Math.abs(Math.sin(t * 3.7)) * 0.25 + Math.random() * 0.06),
            // High mid: harmony
            Math.min(1, Math.abs(Math.sin(t * bps * Math.PI * 2 + 1.2)) * 0.5 + Math.abs(Math.sin(t * 5.1)) * 0.2 + Math.random() * 0.05),
            // Treble: sparkle
            Math.min(1, Math.abs(Math.sin(t * bps * Math.PI * 3 + 1.8)) * 0.35 + Math.random() * 0.15)
        ].map(v => v * this._simAmplitude);

        this._notify({ bands, raw: null, isSimulation: true });

        this._animFrame = requestAnimationFrame(() => this._simTick());
    }

    _average(arr, start, end) {
        let sum = 0;
        for (let i = start; i < end; i++) sum += arr[i];
        return sum / Math.max(1, end - start);
    }

    _notify(data) {
        this.subscribers.forEach(cb => {
            try { cb(data); } catch (e) { /* ignore */ }
        });
    }

    /**
     * Subscribe to audio data. Returns unsubscribe function.
     * @param {Function} callback - Called with {bands: number[], raw: Uint8Array, isSimulation: boolean}
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Update the playback state (used to modulate simulation amplitude).
     * @param {boolean} isPlaying
     * @param {number} bpm - Estimated BPM (optional)
     */
    setPlaybackState(isPlaying, bpm = 120) {
        this._simBPM = bpm;
        const targetAmplitude = isPlaying ? 0.85 : 0;

        if (isPlaying) {
            this._startLoopIfNeeded();
        }

        // Smooth amplitude transition
        const step = () => {
            const diff = targetAmplitude - this._simAmplitude;
            if (Math.abs(diff) < 0.01) {
                this._simAmplitude = targetAmplitude;
                return;
            }
            this._simAmplitude += diff * 0.08;
            
            if (isPlaying) {
                this._startLoopIfNeeded();
            }
            
            requestAnimationFrame(step);
        };
        step();
    }

    stop() {
        this.isRunning = false;

        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }

        if (this.source) {
            try { this.source.disconnect(); } catch (e) { }
            this.source = null;
        }

        if (this.audioContext) {
            try { this.audioContext.close(); } catch (e) { }
            this.audioContext = null;
            this.analyser = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
    }
}

// Singleton
export const visualizerService = new AudioVisualizerService();
