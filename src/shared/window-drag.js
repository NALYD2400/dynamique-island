/**
 * Déplacement des fenêtres sans bordure.
 *
 * Electron gérait nativement `-webkit-app-region: drag`. Ici, on garde ces
 * mêmes déclarations CSS et on démarre le déplacement natif au clic sur une
 * zone « drag » (une zone « no-drag » plus proche l'emporte, comme avant).
 */
import { native } from './ipc.js';

const INTERACTIVE = 'button, input, select, textarea, a[href], [contenteditable="true"]';

function appRegionOf(element) {
    const style = getComputedStyle(element);
    return style.getPropertyValue('app-region') || style.getPropertyValue('-webkit-app-region') || style.webkitAppRegion || '';
}

function isDragRegion(target) {
    for (let el = target; el && el !== document.documentElement; el = el.parentElement) {
        if (el.matches(INTERACTIVE)) return false;
        const region = appRegionOf(el).trim();
        if (region === 'no-drag') return false;
        if (region === 'drag') return true;
    }
    return false;
}

export function enableWindowDragging() {
    document.addEventListener('mousedown', (event) => {
        if (event.button !== 0 || event.detail > 1) return;
        if (!isDragRegion(event.target)) return;
        native.startDragging().catch(() => {});
    });
}
