/** Petit « clic » de verre pour les contrôles, si les effets sonores sont activés. */
let context = null;

export function playClick() {
    if (localStorage.getItem('liquid_sound_effects_enabled') === 'false') return;
    context ??= new AudioContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.06);
}
