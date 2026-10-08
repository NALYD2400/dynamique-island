/** Centre de contrôle (tuiles, curseurs, widgets). */
import { ipcRenderer } from '../../../shared/ipc.js';
import { SoundService } from '../../../services/SoundService.js';
import { escapeHtml } from '../helpers/format.js';
import { APP_LOGO_ART, getDisplayMediaArt } from '../helpers/media-art.js';
import { getMixerIcon } from '../helpers/mixer-icons.js';
import { getMusicHistoryKey } from '../helpers/music-search.js';

export const controlCenterView = {
    renderControl() {
        let wifiEnabled = localStorage.getItem('liquid_wifi_enabled') !== 'false';
        let btEnabled = localStorage.getItem('liquid_bluetooth_enabled') !== 'false';
        let dndEnabled = localStorage.getItem('liquid_dnd_enabled') === 'true';
        const isEcoMode = localStorage.getItem('liquid_eco_mode') === 'true';
        const isFocusMode = localStorage.getItem('liquid_focus_mode') === 'true';

        // 1. Synchronously render UI with cached/default states immediately
        let sysVol = 70; // Will be updated asynchronously
        
        // CPU / RAM / disque réels lus par le cœur natif (dernières valeurs connues en attendant).
        const getSystemStats = async () => {
            try {
                const live = await ipcRenderer.invoke('get-system-stats');
                if (live) this._systemStats = live;
            } catch(e){}
            return this._systemStats || { cpu: 12, ram: 45 };
        };
        const applySystemStats = (currentStats) => {
            const cpuVal = document.getElementById('ic-stat-val-cpu');
            const cpuFill = document.getElementById('ic-stat-fill-cpu');
            const ramVal = document.getElementById('ic-stat-val-ram');
            const ramFill = document.getElementById('ic-stat-fill-ram');

            if (cpuVal) cpuVal.innerText = `${currentStats.cpu}%`;
            if (cpuFill) cpuFill.style.width = `${currentStats.cpu}%`;
            if (ramVal) ramVal.innerText = `${currentStats.ram}%`;
            if (ramFill) ramFill.style.width = `${currentStats.ram}%`;
        };

        const stats = this._systemStats || { cpu: 12, ram: 45 };
        getSystemStats().then(applySystemStats);

        // Default battery status
        let batteryLevel = 100;
        let batteryCharging = true;
        
        // Default disk space status (C: drive)
        let diskFreeGb = 150;
        let diskPercent = 70;

        // Music info fallback
        const musicData = this.musicData || { title: "Aucune lecture", artist: "Système", cover: "", isPlaying: false };
        const effectiveNpArt = getDisplayMediaArt(musicData);
        const hasCover = effectiveNpArt && effectiveNpArt.length > 0;
        const controlTrackKey = musicData.trackKey || getMusicHistoryKey(musicData);
        const flipClass = this._pendingCoverAnimationTrackKey && this._pendingCoverAnimationTrackKey === controlTrackKey ? 'flip-active' : '';
        const npCoverHtml = hasCover
            ? `<img id="ic-np-cover-img" src="${effectiveNpArt}" class="ic-np-cover ${flipClass}">`
            : `<img id="ic-np-cover-img" src="${APP_LOGO_ART}" class="ic-np-cover app-logo-art ${flipClass}" alt="Liquid Dynamic Island">`;

        // Render customizable third card based on user preference
        const widgetType = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
        let thirdCardHtml = '';
        
        if (widgetType === 'launchpad') {
            const defaultShortcuts = [
                { name: "Explorer", preset: "explorer", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
                { name: "Settings", preset: "settings", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
                { name: "TaskMgr", preset: "taskmgr", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
                { name: "Calc", preset: "calc", icon: "ph-fill ph-calculator", cmd: "calc.exe" }
            ];
            const shortcuts = JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts));
            
            thirdCardHtml = `
                <div class="ic-launchpad-card">
                    ${shortcuts.map((s, idx) => `
                        <button class="ic-launchpad-btn" id="ic-lp-btn-${idx}" title="${escapeHtml(s.name)}">
                            <i class="${escapeHtml(s.icon)}"></i>
                        </button>
                    `).join('')}
                </div>
            `;
        } else if (widgetType === 'stats') {
            thirdCardHtml = `
                <div class="ic-stats-card">
                    <div class="ic-stats-half">
                        <div class="ic-stats-info">
                            <span class="ic-stats-label"><i class="ph-fill ph-cpu"></i> CPU</span>
                            <span id="ic-stat-val-cpu" class="ic-stats-val">${stats.cpu}%</span>
                        </div>
                        <div class="ic-stats-bar">
                            <div id="ic-stat-fill-cpu" class="ic-stats-fill" style="width: ${stats.cpu}%; background: var(--neon-primary);"></div>
                        </div>
                    </div>
                    <div class="ic-stats-half" style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
                        <div class="ic-stats-info">
                            <span class="ic-stats-label"><i class="ph-fill ph-database"></i> RAM</span>
                            <span id="ic-stat-val-ram" class="ic-stats-val">${stats.ram}%</span>
                        </div>
                        <div class="ic-stats-bar">
                            <div id="ic-stat-fill-ram" class="ic-stats-fill" style="width: ${stats.ram}%; background: var(--neon-secondary);"></div>
                        </div>
                    </div>
                </div>
            `;
        } else if (widgetType === 'weather') {
            const hour = new Date().getHours();
            let temp = '21°';
            let desc = 'Ensoleillé';
            let minMax = 'Min. 14° / Max. 25°';
            let icon = 'ph-sun';
            let iconColor = '#ff9f0a';

            if (hour >= 6 && hour < 18) {
                temp = '21°';
                desc = 'Ensoleillé';
                minMax = 'Min. 14° / Max. 25°';
                icon = 'ph-sun';
                iconColor = '#ff9f0a';
            } else if (hour >= 18 && hour < 22) {
                temp = '16°';
                desc = 'Partiellement nuageux';
                minMax = 'Min. 11° / Max. 19°';
                icon = 'ph-cloud-moon';
                iconColor = '#5856d6';
            } else {
                temp = '12°';
                desc = 'Nuit Claire';
                minMax = 'Min. 9° / Max. 14°';
                icon = 'ph-moon-stars';
                iconColor = '#64d2ff';
            }

            thirdCardHtml = `
                <div class="ic-weather-card">
                    <div class="ic-weather-info">
                        <span class="ic-weather-label"><i class="ph-fill ph-cloud-sun"></i> Météo</span>
                        <span class="ic-weather-val">${temp}</span>
                    </div>
                    <div class="ic-weather-condition">
                        <span class="ic-weather-desc">${desc}</span>
                        <span class="ic-weather-hl">${minMax}</span>
                    </div>
                    <div class="ic-weather-icon-wrapper">
                        <i class="ph-fill ${icon} ic-weather-icon" style="color: dots; color: ${iconColor}; filter: drop-shadow(0 0 8px ${iconColor}4d);"></i>
                    </div>
                </div>
            `;
        } else if (widgetType === 'mixer') {
            thirdCardHtml = `
                <div class="ic-mixer-card" id="ic-cc-mixer-card">
                    <div style="grid-column: 1/-1; opacity: 0.5; font-size: 11px; text-align: center; padding: 15px 0;">
                        Chargement des flux audio...
                    </div>
                </div>
            `;
        } else {
            // Machine widget default
            const battIcon = batteryCharging ? 'ph-battery-charging' : 'ph-battery-high';
            const battLabelText = batteryCharging ? 'Secteur' : 'Batterie';
            
            thirdCardHtml = `
                <div class="ic-machine-card">
                    <div class="ic-machine-half">
                        <div class="ic-machine-info">
                            <span class="ic-machine-label" id="ic-mach-lbl-batt"><i class="ph-fill ${battIcon}" style="${batteryCharging ? 'color: #34c759;' : ''}"></i> ${battLabelText}</span>
                            <span id="ic-mach-val-batt" class="ic-machine-val">${batteryLevel}%</span>
                        </div>
                        <div class="ic-machine-bar">
                            <div id="ic-mach-fill-batt" class="ic-machine-fill" style="width: ${batteryLevel}%; background: #34c759;"></div>
                        </div>
                    </div>
                    <div class="ic-machine-half" style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
                        <div class="ic-machine-info">
                            <span class="ic-machine-label"><i class="ph-fill ph-hard-drive"></i> Disque C:</span>
                            <span class="ic-machine-val" id="ic-mach-val-disk">${diskFreeGb} Go libres</span>
                        </div>
                        <div class="ic-machine-bar">
                            <div class="ic-machine-fill" id="ic-mach-fill-disk" style="width: ${diskPercent}%; background: var(--neon-primary);"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        this.content.innerHTML = `
            <div class="island-control-container">
                <div class="island-control-header">
                    <div class="ic-header-copy">
                        <span class="ic-title">Centre de Contrôle</span>
                        <span class="ic-time"><i class="ph-fill ph-clock"></i>${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="ic-header-actions">
                        <button class="ic-action-btn" onclick="event.stopPropagation(); window.island.setMode('settings')" title="Réglages"><i class="ph ph-gear"></i></button>
                        <button class="ic-action-btn power" id="ic-shutdown" title="Éteindre"><i class="ph ph-power"></i></button>
                        <button class="ic-close" onclick="event.stopPropagation(); window.island.setMode('menu')" title="Menu des modules"><i class="ph-fill ph-squares-four"></i></button>
                    </div>
                </div>
                
                <div class="ic-main-layout">
                    <!-- Left Column: Frosted Toggles + Now Playing + customizable third widget -->
                    <div class="ic-control-stack">
                        <div class="ic-toggles-grid">
                            <div class="ic-tile ${wifiEnabled ? 'active' : ''}" id="ic-wifi">
                                <i class="ph-fill ph-wifi-high"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Wi-Fi</span>
                                    <span class="ic-tile-status">${wifiEnabled ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${btEnabled ? 'active' : ''}" id="ic-bluetooth">
                                <i class="ph-fill ph-bluetooth"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Bluetooth</span>
                                    <span class="ic-tile-status">${btEnabled ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${dndEnabled ? 'active' : ''}" id="ic-dnd" title="Ne pas déranger : coupe les notifications de Windows">
                                <i class="ph-fill ph-moon"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">DND</span>
                                    <span class="ic-tile-status">${dndEnabled ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${isFocusMode ? 'active' : ''}" id="ic-focus" title="Focus : plus de notifications dans l’Island, pilule estompée au repos">
                                <i class="ph-fill ph-target"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Focus</span>
                                    <span class="ic-tile-status">${isFocusMode ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile ${isEcoMode ? 'active' : ''}" id="ic-eco">
                                <i class="ph-fill ph-leaf"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Éco</span>
                                    <span class="ic-tile-status">${isEcoMode ? 'Activé' : 'Désactivé'}</span>
                                </div>
                            </div>
                            <div class="ic-tile" id="ic-sett-tile" title="Ouvrir les Réglages">
                                <i class="ph-fill ph-gear"></i>
                                <div class="ic-tile-text">
                                    <span class="ic-tile-label">Réglages</span>
                                    <span class="ic-tile-status">Configurer</span>
                                </div>
                            </div>
                        </div>

                        <!-- Real-time Now Playing Widget -->
                        <div class="ic-now-playing-card">
                            ${npCoverHtml}
                            <div class="ic-np-details">
                                <span class="ic-np-title" id="ic-np-title-val">${escapeHtml(musicData.title)}</span>
                                <span class="ic-np-artist" id="ic-np-artist-val">${escapeHtml(musicData.artist)}</span>
                            </div>
                            <div class="ic-np-controls">
                                <button class="ic-np-btn" onclick="event.stopPropagation(); window.spotifyControl('prev')"><i class="ph-fill ph-skip-back"></i></button>
                                <button class="ic-np-btn play" id="ic-np-play-btn-val" onclick="event.stopPropagation(); window.spotifyControl('toggle')"><i class="ph-fill ph-${musicData.isPlaying ? 'pause' : 'play'}"></i></button>
                                <button class="ic-np-btn" onclick="event.stopPropagation(); window.spotifyControl('next')"><i class="ph-fill ph-skip-forward"></i></button>
                            </div>
                        </div>

                        <!-- Dynamically loaded widget -->
                        ${thirdCardHtml}
                    </div>
                    
                    <!-- Right Column: Stretched Volume Vertical Slider -->
                    <div class="ic-sliders-layout" style="width: 60px;">
                        <div class="ic-vertical-slider" id="ic-volume-slider" style="--slider-val-pct: ${Math.round(sysVol)}%" title="Volume Système">
                            <div class="ic-slider-fill"></div>
                            <div class="ic-slider-icon"><i class="ph-fill ph-speaker-high"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind Container Stop Propagation
        const container = this.content.querySelector('.island-control-container');
        container.onclick = (e) => e.stopPropagation();

        // Bind Launchpad buttons click handlers
        if (widgetType === 'launchpad') {
            const defaultShortcuts = [
                { name: "Explorer", preset: "explorer", icon: "ph-fill ph-folder", cmd: "explorer.exe" },
                { name: "Settings", preset: "settings", icon: "ph-fill ph-gear", cmd: "ms-settings:" },
                { name: "TaskMgr", preset: "taskmgr", icon: "ph-fill ph-cpu", cmd: "taskmgr.exe" },
                { name: "Calc", preset: "calc", icon: "ph-fill ph-calculator", cmd: "calc.exe" }
            ];
            const shortcuts = JSON.parse(localStorage.getItem('liquid_control_shortcuts') || JSON.stringify(defaultShortcuts));
            
            shortcuts.forEach((s, idx) => {
                const btn = container.querySelector(`#ic-lp-btn-${idx}`);
                if (btn) {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        SoundService.play('click');
                        const launched = await this.launchShortcut(s.cmd);
                        if (launched === false) {
                            // Raccourci introuvable ou refusé : petit tremblement au lieu d'un échec silencieux.
                            btn.classList.remove('is-error');
                            void btn.offsetWidth;
                            btn.classList.add('is-error');
                            btn.title = `${s.name} : impossible de l’ouvrir`;
                        }
                    };
                }
            });
        }

        // Helper to bind vertical sliders dragging with mouse support
        const bindVerticalSlider = (sliderEl, onChange) => {
            if (!sliderEl) return () => {};

            let isDragging = false;

            const updateFromEvent = (e) => {
                const rect = sliderEl.getBoundingClientRect();
                const pct = Math.max(0, Math.min(100, Math.round(((rect.bottom - e.clientY) / rect.height) * 100)));
                sliderEl.style.setProperty('--slider-val-pct', `${pct}%`);
                onChange(pct);
            };

            const onMouseDown = (e) => {
                e.stopPropagation();
                e.preventDefault();
                isDragging = true;
                sliderEl.classList.add('active');
                updateFromEvent(e);
            };

            const onMouseMove = (e) => {
                if (isDragging) {
                    e.stopPropagation();
                    e.preventDefault();
                    updateFromEvent(e);
                }
            };

            const onMouseUp = (e) => {
                if (isDragging) {
                    e.stopPropagation();
                    e.preventDefault();
                    isDragging = false;
                    sliderEl.classList.remove('active');
                }
            };

            sliderEl.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            return () => {
                isDragging = false;
                sliderEl.classList.remove('active');
                sliderEl.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
        };

        // Bind Volume Vertical Slider
        const volSlider = container.querySelector('#ic-volume-slider');
        this._controlSliderCleanup = bindVerticalSlider(volSlider, (val) => {
            if (ipcRenderer) {
                ipcRenderer.invoke('set-system-volume', val);
            }
        });

        // Bind Quick Tiles Toggle Handlers
        const TOGGLE_ERRORS = { denied: 'Accès refusé', not_found: 'Introuvable', failed: 'Échec', unknown: 'Échec', error: 'Échec' };
        const setTileState = (el, key, enabled, message) => {
            localStorage.setItem(key, enabled);
            el.classList.toggle('active', enabled);
            el.classList.toggle('has-error', Boolean(message));
            const statusText = el.querySelector('.ic-tile-status');
            if (statusText) statusText.innerText = message || (enabled ? 'Activé' : 'Désactivé');
            // La tuile allumée passe en verre teinté.
            this.syncGlassControls();
        };

        // État réel de Windows (le Wi-Fi a pu être coupé ailleurs) : on corrige les tuiles.
        [['#ic-wifi', 'liquid_wifi_enabled', 'wifi-control'], ['#ic-bluetooth', 'liquid_bluetooth_enabled', 'bluetooth-control'], ['#ic-dnd', 'liquid_dnd_enabled', 'dnd-control']]
            .forEach(async ([selector, key, channel]) => {
                const status = await ipcRenderer.invoke(channel, 'status').catch(() => 'unknown');
                const el = container.querySelector(selector);
                if (!el || !el.isConnected || el.classList.contains('is-busy')) return;
                if (status === 'on' || status === 'off') {
                    const enabled = status === 'on';
                    if (el.classList.contains('active') !== enabled) setTileState(el, key, enabled);
                } else if (status === 'not_found') {
                    el.classList.add('is-unavailable');
                    const statusText = el.querySelector('.ic-tile-status');
                    if (statusText) statusText.innerText = 'Indisponible';
                }
            });

        const tiles = [
            { 
                id: '#ic-wifi', 
                key: 'liquid_wifi_enabled', 
                isDefaultTrue: true, 
                onToggle: async (state) => {
                    return ipcRenderer.invoke('wifi-control', state ? 'on' : 'off').catch(() => 'error');
                } 
            },
            { 
                id: '#ic-bluetooth', 
                key: 'liquid_bluetooth_enabled', 
                isDefaultTrue: true, 
                onToggle: async (state) => {
                    return ipcRenderer.invoke('bluetooth-control', state ? 'on' : 'off').catch(() => 'error');
                } 
            },
            { 
                id: '#ic-dnd', 
                key: 'liquid_dnd_enabled', 
                isDefaultTrue: false, 
                onToggle: async (state) => {
                    return ipcRenderer.invoke('dnd-control', state ? 'on' : 'off').catch(() => 'error');
                } 
            },
            { 
                id: '#ic-focus', 
                key: 'liquid_focus_mode', 
                isDefaultTrue: false, 
                onToggle: (state) => {
                    document.body.classList.toggle('focus-mode-active', state);
                }
            },
            { 
                id: '#ic-eco', 
                key: 'liquid_eco_mode', 
                isDefaultTrue: false, 
                onToggle: (state) => {
                    window.dispatchEvent(new CustomEvent('liquid-eco-mode-changed', { detail: state }));
                }
            }
        ];

        tiles.forEach(tile => {
            const el = container.querySelector(tile.id);
            if (el) {
                el.onclick = async () => {
                    if (el.classList.contains('is-busy')) return;
                    const currentVal = tile.isDefaultTrue 
                        ? localStorage.getItem(tile.key) !== 'false' 
                        : localStorage.getItem(tile.key) === 'true';
                    const newVal = !currentVal;
                    setTileState(el, tile.key, newVal);

                    // Le cœur natif répond « ok » ou la raison de l'échec : on revient
                    // en arrière au lieu d'afficher un état faux.
                    el.classList.add('is-busy');
                    const result = await tile.onToggle(newVal);
                    el.classList.remove('is-busy');
                    if (typeof result === 'string' && result !== 'ok') {
                        setTileState(el, tile.key, currentVal, TOGGLE_ERRORS[result] || 'Échec');
                    }
                };
            }
        });

        // Setup stats real-time update interval (2s)
        this.statsInterval = setInterval(async () => {
            const currentWidget = localStorage.getItem('liquid_control_widget_type') || 'launchpad';
            
            if (currentWidget === 'stats') {
                applySystemStats(await getSystemStats());
            } else if (currentWidget === 'machine') {
                if (navigator.getBattery) {
                    try {
                        const batt = await navigator.getBattery();
                        const bLevel = Math.round(batt.level * 100);
                        const bCharging = batt.charging;
                        
                        const battVal = document.getElementById('ic-mach-val-batt');
                        const battFill = document.getElementById('ic-mach-fill-batt');
                        const battLabel = document.getElementById('ic-mach-lbl-batt');
                        
                        if (battVal) battVal.innerText = `${bLevel}%`;
                        if (battFill) battFill.style.width = `${bLevel}%`;
                        if (battLabel) {
                            const bIcon = bCharging ? 'ph-battery-charging' : 'ph-battery-high';
                            const bText = bCharging ? 'Secteur' : 'Batterie';
                            battLabel.innerHTML = `<i class="ph-fill ${bIcon}" style="${bCharging ? 'color: #34c759;' : ''}"></i> ${bText}`;
                        }
                    } catch(e){}
                }
            }
        }, 2000);

        // Bind Settings quick tile
        const settTile = container.querySelector('#ic-sett-tile');
        if (settTile) {
            settTile.onclick = () => {
                this.setMode('settings');
                this.renderContent();
            };
        }

        // Shutdown Event Trigger
        const shutdownBtn = container.querySelector('#ic-shutdown');
        if (shutdownBtn) {
            shutdownBtn.onclick = () => {
                const existing = container.querySelector('.ic-confirm-overlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.className = 'ic-confirm-overlay';
                overlay.innerHTML = `
                    <div class="ic-confirm-box">
                        <i class="ph-fill ph-power ic-confirm-icon"></i>
                        <span class="ic-confirm-title">Quitter l'Island ?</span>
                        <span class="ic-confirm-desc">Voulez-vous fermer l'application Dynamic Island ?</span>
                        <div class="ic-confirm-buttons">
                            <button class="ic-confirm-btn cancel" id="confirm-cancel">Annuler</button>
                            <button class="ic-confirm-btn confirm" id="confirm-ok">Quitter</button>
                        </div>
                    </div>
                `;

                container.appendChild(overlay);

                // Bind Cancel button
                overlay.querySelector('#confirm-cancel').onclick = (e) => {
                    e.stopPropagation();
                    overlay.remove();
                };

                // Bind Confirm button
                overlay.querySelector('#confirm-ok').onclick = (e) => {
                    e.stopPropagation();
                    this.mode = 'music';
                    this.isExpanded = false;
                    this.renderContent();

                    if (ipcRenderer) {
                        ipcRenderer.send('exit-app'); // Clean shutdown via exit-app
                    }
                };
                
                // Stop click propagation on overlay to avoid closing the island
                overlay.onclick = (e) => e.stopPropagation();
            };
        }

        // 3. ASYNCHRONOUS UPDATE OF DYNAMIC SYSTEM VALUES
        const updateAsyncSystemData = async () => {
            if (!ipcRenderer) return;
            

            // System Volume
            try {
                const fetchedVol = await ipcRenderer.invoke('get-system-volume');
                if (fetchedVol !== undefined && fetchedVol !== null) {
                    sysVol = fetchedVol;
                    if (volSlider) {
                        volSlider.style.setProperty('--slider-val-pct', `${Math.round(sysVol)}%`);
                    }
                }
            } catch (e) { }

            // Wi-Fi Status
            try {
                const realWifi = await ipcRenderer.invoke('wifi-control', 'status');
                if (realWifi === 'on' || realWifi === 'off') {
                    const active = realWifi === 'on';
                    localStorage.setItem('liquid_wifi_enabled', active);
                    const tileEl = container.querySelector('#ic-wifi');
                    if (tileEl) {
                        tileEl.classList.toggle('active', active);
                        const statusText = tileEl.querySelector('.ic-tile-status');
                        if (statusText) statusText.innerText = active ? 'Activé' : 'Désactivé';
                    }
                }
            } catch (e) { }

            // Bluetooth Status
            try {
                const realBt = await ipcRenderer.invoke('bluetooth-control', 'status');
                if (realBt === 'on' || realBt === 'off') {
                    const active = realBt === 'on';
                    localStorage.setItem('liquid_bluetooth_enabled', active);
                    const tileEl = container.querySelector('#ic-bluetooth');
                    if (tileEl) {
                        tileEl.classList.toggle('active', active);
                        const statusText = tileEl.querySelector('.ic-tile-status');
                        if (statusText) statusText.innerText = active ? 'Activé' : 'Désactivé';
                    }
                }
            } catch (e) { }

            // DND Status
            try {
                const realDnd = await ipcRenderer.invoke('dnd-control', 'status');
                if (realDnd === 'on' || realDnd === 'off') {
                    const active = realDnd === 'on';
                    localStorage.setItem('liquid_dnd_enabled', active);
                    const tileEl = container.querySelector('#ic-dnd');
                    if (tileEl) {
                        tileEl.classList.toggle('active', active);
                        const statusText = tileEl.querySelector('.ic-tile-status');
                        if (statusText) statusText.innerText = active ? 'Activé' : 'Désactivé';
                    }
                }
            } catch (e) { }

            // Battery Status
            if (widgetType === 'machine' && navigator.getBattery) {
                try {
                    const batt = await navigator.getBattery();
                    batteryLevel = Math.round(batt.level * 100);
                    batteryCharging = batt.charging;
                    
                    const battVal = document.getElementById('ic-mach-val-batt');
                    const battFill = document.getElementById('ic-mach-fill-batt');
                    const battLabel = document.getElementById('ic-mach-lbl-batt');
                    
                    if (battVal) battVal.innerText = `${batteryLevel}%`;
                    if (battFill) battFill.style.width = `${batteryLevel}%`;
                    if (battLabel) {
                        const battIcon = batteryCharging ? 'ph-battery-charging' : 'ph-battery-high';
                        const battLabelText = batteryCharging ? 'Secteur' : 'Batterie';
                        battLabel.innerHTML = `<i class="ph-fill ${battIcon}" style="dots; color: ${batteryCharging ? '#34c759' : ''}"></i> ${battLabelText}`;
                    }
                } catch(e){}
            }

            // Disk Space Status (cœur natif)
            if (widgetType === 'machine') {
                try {
                    const live = await getSystemStats();
                    const diskData = live && live.diskTotal ? { FreeSpace: live.diskFree, Size: live.diskTotal } : null;

                    if (diskData) {
                        const freeBytes = diskData.FreeSpace;
                        const totalBytes = diskData.Size;
                        diskFreeGb = Math.round(freeBytes / (1024 * 1024 * 1024));
                        diskPercent = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
                        
                        const diskVal = document.getElementById('ic-mach-val-disk');
                        const diskFill = document.getElementById('ic-mach-fill-disk');
                        
                        if (diskVal) diskVal.innerText = `${diskFreeGb} Go libres`;
                        if (diskFill) diskFill.style.width = `${diskPercent}%`;
                    }
                } catch(e){}
            }

            // Grouped Audio sessions for Mixer Widget
            if (widgetType === 'mixer') {
                try {
                    const mixerCard = document.getElementById('ic-cc-mixer-card');
                    if (mixerCard) {
                        const sessions = await ipcRenderer.invoke('get-audio-sessions');
                        if (sessions) {
                            this.audioSessions = sessions;
                            const grouped = this.getGroupedSessions(sessions);
                            let mixerRowsHtml = '';
                            
                            if (grouped.length === 0) {
                                mixerRowsHtml = `
                                    <div style="grid-column: 1/-1; opacity: 0.5; font-size: 11px; text-align: center; padding: 15px 0;">
                                        Aucun flux audio détecté
                                    </div>
                                `;
                            } else {
                                mixerRowsHtml = grouped.slice(0, 3).map(s => {
                                    const icon = s.icon || getMixerIcon(s.name, s.title);
                                    const isMuted = s.volume === 0 || s.muted;
                                    const activeVol = isMuted ? 0 : Math.round(s.volume);
                                    
                                    let iconHtml = '';
                                    if (icon) {
                                        iconHtml = `
                                            <img src="${icon}" style="width: 14px; height: 14px; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                                            <i class="ph-fill ph-music-note" style="display: none; font-size: 12px;"></i>
                                        `;
                                    } else {
                                        iconHtml = `<i class="ph-fill ph-music-note"></i>`;
                                    }
                                    
                                    const muteIcon = isMuted ? 'ph-speaker-slash' : (activeVol < 50 ? 'ph-speaker-low' : 'ph-speaker-high');
                                    
                                    let cleanName = s.name.replace('.exe', '');
                                    if (cleanName.toLowerCase() === 'audiodg') cleanName = 'System Sounds';
                                    
                                    return `
                                        <div class="ic-mixer-row">
                                            <div class="ic-mixer-app-icon" title="${cleanName}">
                                                ${iconHtml}
                                            </div>
                                            <div class="ic-mixer-slider-wrapper">
                                                <input type="range" class="ic-mixer-slider" data-pid="${s.pid}" min="0" max="100" value="${activeVol}">
                                            </div>
                                            <span class="ic-mixer-vol">${activeVol}%</span>
                                            <div class="ic-mixer-mute ${isMuted ? 'muted' : ''}" data-pid="${s.pid}">
                                                <i class="ph-fill ${muteIcon}"></i>
                                            </div>
                                        </div>
                                    `;
                                }).join('');
                            }
                            mixerCard.innerHTML = mixerRowsHtml;
                        }
                    }
                } catch(e){}
            }
        };

        // Fire async updates immediately without blocking the synchronous render thread!
        updateAsyncSystemData();
        this.syncGlassControls();
    },
};
