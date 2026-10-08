/** Conversions et mélanges de couleurs. */

export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 243, b: 255 };
}

export function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function blendHexColors(baseHex, coverHex, coverWeight = 65) {
    const base = hexToRgb(baseHex);
    const cover = hexToRgb(coverHex);
    const weight = Math.max(0, Math.min(100, coverWeight)) / 100;
    const r = Math.round(base.r * (1 - weight) + cover.r * weight);
    const g = Math.round(base.g * (1 - weight) + cover.g * weight);
    const b = Math.round(base.b * (1 - weight) + cover.b * weight);
    return rgbToHex(r, g, b);
}
