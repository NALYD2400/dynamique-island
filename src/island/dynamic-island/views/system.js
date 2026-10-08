/** Vues système : statistiques, réseau, minuteur. */
export const systemViews = {
    renderStats(stats) {
        const cpu = stats ? stats.cpu : 0;
        const ram = stats ? stats.ram : 0; // Added RAM

        // --- Gauge Configuration ---
        const r = 32;
        const C = 201;

        const cpuOffset = C - (cpu / 100) * C;
        const ramOffset = C - (ram / 100) * C;

        const items = [];

        // 1. CPU Usage (Always show)
        items.push({
            id: 'cpu',
            val: cpu + '%',
            label: 'CPU',
            offset: cpuOffset,
            icon: 'ph-cpu',
            color: 'var(--neon-primary)'
        });

        // 2. RAM Usage (Lightweight alternative to GPU/Temp)
        items.push({
            id: 'ram',
            val: ram + '%',
            label: 'RAM',
            offset: ramOffset,
            icon: 'ph-memory',
            color: 'var(--neon-secondary)'
        });

        // If we still have space and detected both GPU stats, maybe show the 4th?
        // Current island logic fits ~3 comfortably.

        // Optimize: Update existing DOM if structure matches (same number of items)
        const existing = this.content.querySelector('.stats-pulse-container');
        const existingItems = existing ? existing.querySelectorAll('.gauge-wrapper') : [];
        if (existing && existingItems.length === items.length) {
            items.forEach((item, index) => {
                const el = existingItems[index];
                const circle = el.querySelector('.gauge-progress');
                const valText = el.querySelector('.gauge-value');
                // const label = el.querySelector('.gauge-label');

                if (circle) circle.style.strokeDashoffset = item.offset;
                if (valText) valText.innerText = item.val;
            });
            return;
        }

        // Generate HTML
        const gaugesHtml = items.map(item => `
            <div class="gauge-wrapper item-${item.id}">
                <svg class="gauge-svg" viewBox="0 0 80 80" style="overflow: visible;">
                    <circle class="gauge-bg" cx="40" cy="40" r="${r}"></circle>
                    <circle class="gauge-progress" cx="40" cy="40" r="${r}" 
                            style="stroke-dasharray: ${C}; stroke-dashoffset: ${item.offset}; stroke: ${item.color}; filter: drop-shadow(0 0 8px ${item.color});"></circle>
                </svg>
                <div class="gauge-content">
                    <i class="ph-fill ${item.icon} gauge-icon" style="color: ${item.color};"></i>
                    <div class="gauge-value">${item.val}</div>
                    <div class="gauge-label">${item.label}</div>
                </div>
            </div>
        `).join('');

        // Initial Layout
        this.content.innerHTML = `
      <div class="stats-pulse-container">
        <div class="stats-pulse-header">
            <div class="stats-pulse-title">
                <i class="ph-fill ph-gauge" style="color: var(--neon-primary);"></i> System Pulse
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
                    <i class="ph-fill ph-squares-four"></i>
                </button>
            </div>
        </div>
        
        <div class="stats-gauges-row" style="gap: ${items.length > 2 ? '25px' : '40px'};">
            ${gaugesHtml}
        </div>
      </div>
    `;
    },

    renderNetwork() {
        // --- Network Simulation Logic ---
        if (!this.networkState) {
            this.networkState = { dl: 50, ul: 10 };
        }

        // Random drift smoother
        const targetDl = this.networkState.dl + (Math.random() - 0.5) * 30;
        const targetUl = this.networkState.ul + (Math.random() - 0.5) * 5;

        // Clamp
        this.networkState.dl = Math.max(5, Math.min(950, targetDl));
        this.networkState.ul = Math.max(1, Math.min(300, targetUl));

        const dl = this.networkState.dl.toFixed(1);
        const ul = this.networkState.ul.toFixed(1);

        // Determine Speed Class
        let speedClass = 'speed-slow';
        if (this.networkState.dl > 50) speedClass = 'speed-medium';
        if (this.networkState.dl > 150) speedClass = 'speed-fast';
        if (this.networkState.dl > 500) speedClass = 'speed-fiber';

        // Direction based on dominant traffic
        const waveClass = this.networkState.dl > (this.networkState.ul * 2) ? 'download-wave' : 'upload-wave';

        // Check if already rendered to update inplace (Prevents animation reset)
        const container = this.content.querySelector('.network-pulse-container');
        if (container) {
            const waveContainer = container.querySelector('.network-pulse-wave');
            if (waveContainer.className !== `network-pulse-wave ${speedClass}`) {
                waveContainer.className = `network-pulse-wave ${speedClass}`;
            }

            const svg = container.querySelector('.pulse-wave-svg');
            // Only change direction if strictly needed (to keep animation smooth)
            if (!svg.classList.contains(waveClass)) {
                svg.setAttribute('class', `pulse-wave-svg ${waveClass}`);
            }

            // Update Texts
            const dlText = container.querySelector('.net-wave-dl-text');
            if (dlText) dlText.innerHTML = `<i class="ph-bold ph-arrow-down"></i> ${dl} <small>Mbps</small>`;

            const ulText = container.querySelector('.net-wave-ul-text');
            if (ulText) ulText.innerHTML = `<i class="ph-bold ph-arrow-up"></i> ${ul} <small>Mbps</small>`;

            const dlDisp = container.querySelector('.net-display-dl');
            if (dlDisp) dlDisp.innerHTML = `${dl}<span class="speed-unit">Mbps</span>`;

            const ulDisp = container.querySelector('.net-display-ul');
            if (ulDisp) ulDisp.innerHTML = `${ul}<span class="speed-unit">Mbps</span>`;

            return;
        }

        // Initial Render
        this.content.innerHTML = `
            <div class="network-pulse-container">
                <div class="network-pulse-header">
                    <div class="network-pulse-title">
                        <i class="ph-fill ph-globe-stand"></i> Pulse Réseau
                    </div>
                    <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
                        <i class="ph-fill ph-squares-four"></i>
                    </button>
                </div>

                <div class="network-pulse-wave ${speedClass}">
                    <svg class="pulse-wave-svg ${waveClass}" viewBox="0 0 1440 320" preserveAspectRatio="none">
                         <path fill="var(--wave-color)" fill-opacity="0.3" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                    </svg>
                    <div style="position: absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:30px;">
                        <span class="net-wave-dl-text" style="font-size:12px; font-weight:bold; color: var(--wave-color); text-shadow: 0 1px 2px rgba(0,0,0,0.8);"><i class="ph-bold ph-arrow-down"></i> ${dl} <small>Mbps</small></span>
                        <span class="net-wave-ul-text" style="font-size:12px; font-weight:bold; color: #fff; opacity:0.7; text-shadow: 0 1px 2px rgba(0,0,0,0.8);"><i class="ph-bold ph-arrow-up"></i> ${ul} <small>Mbps</small></span>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; width: 100%; align-items: flex-end; padding: 0 5px;">
                     <div class="speed-item">
                        <span class="speed-label"><i class="ph-fill ph-download-simple"></i> Download</span>
                        <div class="speed-value net-display-dl">${dl}<span class="speed-unit">Mbps</span></div>
                     </div>
                     <div style="height: 30px; width: 1px; background: rgba(255,255,255,0.1);"></div>
                     <div class="speed-item">
                        <span class="speed-label"><i class="ph-fill ph-upload-simple"></i> Upload</span>
                        <div class="speed-value net-display-ul" style="color: rgba(255,255,255,0.7);">${ul}<span class="speed-unit">Mbps</span></div>
                     </div>
                </div>
            </div>
        `;
    },

    renderTimer() {
        const mins = Math.floor(this.timerValue / 60).toString().padStart(2, '0');
        const secs = (this.timerValue % 60).toString().padStart(2, '0');
        const status = this.isTimerRunning ? 'En cours' : (this.timerValue > 0 ? 'En pause' : 'Prêt');

        this.content.innerHTML = `
        <div class="island-timer-container">
            <div class="island-timer-header">
                <div class="timer-title"><i class="ph-fill ph-timer"></i><span>Chrono</span></div>
                <button class="island-action-btn menu-btn" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules">
                    <i class="ph-fill ph-squares-four"></i>
                </button>
            </div>
            <div class="timer-stage">
                <div class="timer-status">${status}</div>
                <div class="timer-readout">${mins}:${secs}</div>
                <div class="timer-controls">
                    <button class="timer-control-btn" onclick="event.stopPropagation(); window.island.timerValue = 0; window.island.isTimerRunning = false; window.island.renderTimer()" title="Réinitialiser">
                        <i class="ph-fill ph-arrow-counter-clockwise"></i>
                    </button>
                    <button class="timer-control-btn primary ${this.isTimerRunning ? 'is-running' : ''}" onclick="event.stopPropagation(); window.island.isTimerRunning = !window.island.isTimerRunning; window.island.renderTimer()" title="${this.isTimerRunning ? 'Pause' : 'Démarrer'}">
                        <i class="ph-fill ${this.isTimerRunning ? 'ph-pause' : 'ph-play'}"></i>
                    </button>
                </div>
            </div>
        </div>
      `;
    },
};
