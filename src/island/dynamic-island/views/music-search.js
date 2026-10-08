/** Recherche musicale. */
import { SoundService } from '../../../services/SoundService.js';
import { escapeHtml } from '../helpers/format.js';
import { getCurrentTrackSearchQuery, getMusicSearchProvider, getMusicSearchTarget } from '../helpers/music-search.js';

export const musicSearchView = {
    renderMusicSearch() {
        const data = this.musicData || {};
        const provider = this.musicSearchProviderOverride || getMusicSearchProvider(data);
        const currentQuery = getCurrentTrackSearchQuery(data);
        const draft = this.musicSearchDraft || '';
        const hasCurrentTrack = currentQuery.length > 0;

        this.content.innerHTML = `
      <div class="music-search-panel">
        <div class="music-search-header">
          <button class="island-action-btn music-search-back" id="music-search-back" title="Retour lecteur">
            <i class="ph-bold ph-arrow-left"></i>
          </button>
          <div class="music-search-heading">
            <span>Recherche musique</span>
            <small><i class="ph-fill ${provider.icon}"></i> ${escapeHtml(provider.label)} detecte</small>
          </div>
        </div>

        <div class="music-search-field">
          <i class="ph-bold ph-magnifying-glass"></i>
          <input id="music-search-input" type="text" value="${escapeHtml(draft)}" placeholder="Titre, artiste, album...">
          <button id="music-search-submit" title="Lancer la recherche">
            <i class="ph-bold ph-arrow-square-out"></i>
          </button>
        </div>

        <div class="music-search-actions">
          ${hasCurrentTrack ? `
            <button class="music-search-chip" id="music-search-current" title="Rechercher le morceau en cours">
              <i class="ph-fill ph-music-note"></i>
              <span>${escapeHtml(currentQuery)}</span>
            </button>
          ` : `
            <div class="music-search-empty">Aucun morceau en cours a reprendre.</div>
          `}
        </div>

        <div class="music-search-hint" id="music-search-hint">
          Ouvre directement la recherche dans ${escapeHtml(provider.label)} quand c'est possible.
        </div>
      </div>
    `;

        this._vizCanvas = null;

        const input = this.content.querySelector('#music-search-input');
        const submitBtn = this.content.querySelector('#music-search-submit');
        const backBtn = this.content.querySelector('#music-search-back');
        const currentBtn = this.content.querySelector('#music-search-current');

        const submit = (value) => {
            this.openMusicSearch(value || input.value);
        };

        input.addEventListener('input', () => {
            this.musicSearchDraft = input.value;
        });
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                submit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.musicSearchProviderOverride = null;
                this.setMode('music');
            }
        });
        input.addEventListener('click', (e) => e.stopPropagation());

        submitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            submit();
        });
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.musicSearchProviderOverride = null;
            this.setMode('music');
        });
        if (currentBtn) {
            currentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                submit(currentQuery);
            });
        }

        setTimeout(() => {
            input.focus();
            input.select();
        }, 120);
    },

    openMusicSearchPanel(query = '', providerOverride = null) {
        this.musicSearchDraft = query || '';
        this.musicSearchProviderOverride = providerOverride;
        this.setMode('music-search');
    },

    openMusicSearch(query, providerOverride = null) {
        const cleanQuery = String(query || '').trim();
        const hint = this.content.querySelector('#music-search-hint');
        const input = this.content.querySelector('#music-search-input');

        if (!cleanQuery) {
            if (hint) {
                hint.textContent = 'Tape un titre ou clique sur le morceau en cours.';
                hint.classList.add('is-warning');
            }
            if (input) input.focus();
            return;
        }

        this.musicSearchDraft = cleanQuery;
        const provider = providerOverride || this.musicSearchProviderOverride || getMusicSearchProvider(this.musicData);
        const target = getMusicSearchTarget(cleanQuery, provider);

        SoundService.play('success');
        this.launchShortcut(target);

        this.musicSearchProviderOverride = null;
        this.mode = 'music';
        this.isExpanded = false;
        this.renderContent();
    },
};
