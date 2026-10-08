/** Mise en forme de textes (durées, HTML échappé, dates relatives). */

// Fonction utilitaire pour convertir les millisecondes en 'MM:SS'
export function formatTime(ms) {
    if (ms === undefined || ms === null || isNaN(ms)) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

export function formatHistoryTime(timestamp) {
    if (!timestamp) return '';

    const elapsed = Math.max(0, Date.now() - timestamp);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (elapsed < minute) return 'maintenant';
    if (elapsed < hour) return `${Math.floor(elapsed / minute)} min`;
    if (elapsed < day) return `${Math.floor(elapsed / hour)} h`;
    return `${Math.floor(elapsed / day)} j`;
}
