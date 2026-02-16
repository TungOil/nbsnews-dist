// NBSNews - Frontend JavaScript

/**
 * NBSNews – Frontend App
 *
 * Purpose:
 * - Fetches the latest run's `step5-build-static-site/full-published.json` (via `state/latest.json`) and renders news cards.
 * - Shows last update time and basic error states.
 *
 * Why:
 * - Keeps client logic minimal and deterministic; all heavy lifting happens in backend tools.
 */

const DOM_IDS = Object.freeze({
    newsContainer: 'news-container',
    paginationContainer: 'news-pagination',
    lastUpdate: 'last-update',
    themeToggle: 'theme-toggle'
});

const DOM_ATTRS = Object.freeze({
    lang: 'lang',
    dataTheme: 'data-theme',
    ariaExpanded: 'aria-expanded',
    dataTarget: 'data-target'
});

const DOM_CLASSES = Object.freeze({
    readMore: 'read-more',
    readMoreSelector: '.read-more',
    collapsed: 'collapsed'
});

const THEME = Object.freeze({
    storageKey: 'theme',
    auto: 'auto',
    dark: 'dark',
    light: 'light',
    order: ['auto', 'dark', 'light'],
    mediaQuery: '(prefers-color-scheme: dark)'
});

const FETCH_OPTIONS = Object.freeze({ cache: 'no-store' });

const RUNTIME_PATHS = Object.freeze({
    latestPointer: 'state/latest.json',
    step5PublishedForRun: (runId) => `runs/success/${runId}/step5-build-static-site/full-published.json`
});

const I18N = Object.freeze({
    pl: {
        noNews: 'Brak dostępnych wiadomości.',
        previousPage: 'Poprzednia strona',
        nextPage: 'Następna strona',
        pageNav: 'Nawigacja stron',
        pageOf: (current, total) => `Strona ${current} z ${total}`,
        readMore: 'Rozwin',
        showLess: 'Zwiń',
        missingBody: '<p><em>Brak pełnej treści.</em></p>',
        noDate: 'Brak daty',
        errorTitle: 'Błąd podczas ładowania wiadomości',
        errorBody: 'Odśwież stronę lub sprawdź połączenie z internetem.',
        removedAddress: '[adres usunięty]',
        themeLabels: { auto: '🖥️ Auto', dark: '☀️ Jasny', light: '🌙 Ciemny' },
        locale: 'pl-PL'
    },
    en: {
        noNews: 'No news available.',
        previousPage: 'Previous page',
        nextPage: 'Next page',
        pageNav: 'Page navigation',
        pageOf: (current, total) => `Page ${current} of ${total}`,
        readMore: 'Read more',
        showLess: 'Show less',
        missingBody: '<p><em>Full content not available.</em></p>',
        noDate: 'Date unavailable',
        errorTitle: 'Error while loading news',
        errorBody: 'Try refreshing the page or check your internet connection.',
        removedAddress: '[address removed]',
        themeLabels: { auto: '🖥️ Auto', dark: '☀️ Light', light: '🌙 Dark' },
        locale: 'en-US'
    }
});

const FRONTEND_ERRORS = Object.freeze({
    loadNews: 'Error while loading news:',
    fetchData: 'Error while fetching data:',
    latestRunLoadFailed: 'Failed to load latest run publication',
    missingPublishedForLatest: 'full-published.json not found for latest run'
});

class NBSNews {
    /**
     * Initialize app bindings and kick off initial load.
     */
    constructor() {
        this.newsContainer = document.getElementById(DOM_IDS.newsContainer);
        this.paginationContainer = document.getElementById(DOM_IDS.paginationContainer);
        this.lastUpdateElement = document.getElementById(DOM_IDS.lastUpdate);
        this.language = this.getDocumentLanguage();
        this.pageSize = 15;
        this.currentPage = 1;
        this.articles = [];
        this.init();
    }

    /**
     * Boot sequence: load data and update the timestamp.
     */
    async init() {
        try {
            await this.loadNews();
            this.updateLastUpdateTime();
        } catch (error) {
            console.error(FRONTEND_ERRORS.loadNews, error);
            this.showError();
        }
    }

    /**
     * Fetch published JSON and render.
     */
    async loadNews() {
        try {
            const articles = await this.fetchPublishedArticles();
            this.renderNews(articles);
        } catch (error) {
            console.error(FRONTEND_ERRORS.fetchData, error);
            this.showError();
        }
    }

    async fetchPublishedArticles() {
        try {
            const latestPointer = await fetch(RUNTIME_PATHS.latestPointer, FETCH_OPTIONS);
            if (latestPointer.ok) {
                const latestState = await latestPointer.json();
                const runId = latestState && latestState.success && latestState.success.runId;
                if (runId) {
                    const runResponse = await fetch(RUNTIME_PATHS.step5PublishedForRun(runId), FETCH_OPTIONS);
                    if (runResponse.ok) {
                        const runPublished = await runResponse.json();
                        return Array.isArray(runPublished.articles) ? runPublished.articles : [];
                    }
                }
            }
        } catch (err) {
            console.warn(FRONTEND_ERRORS.latestRunLoadFailed, err);
        }

        throw new Error(FRONTEND_ERRORS.missingPublishedForLatest);
    }

    /**
     * Render list of articles into the container.
     * @param {Array} articles
     */
    renderNews(articles) {
        if (!articles || articles.length === 0) {
            this.newsContainer.innerHTML = `<p>${this.t('noNews')}</p>`;
            if (this.paginationContainer) {
                this.paginationContainer.innerHTML = '';
            }
            return;
        }

        this.articles = articles;
        this.currentPage = 1;
        this.renderPage(this.currentPage);
    }

    renderPage(pageNumber) {
        if (!Array.isArray(this.articles) || this.articles.length === 0) {
            this.newsContainer.innerHTML = '';
            if (this.paginationContainer) {
                this.paginationContainer.innerHTML = '';
            }
            return;
        }

        const totalPages = Math.max(1, Math.ceil(this.articles.length / this.pageSize));
        const safePage = Math.min(Math.max(1, Number(pageNumber) || 1), totalPages);
        const start = (safePage - 1) * this.pageSize;
        const pageArticles = this.articles.slice(start, start + this.pageSize);
        const newsHTML = pageArticles.map((article, index) => this.createNewsItem(article, start + index)).join('');
        this.newsContainer.innerHTML = newsHTML;
        this.currentPage = safePage;
        this.bindReadMoreButtons();
        this.renderPaginationTabs(totalPages);
    }

    renderPaginationTabs(totalPages) {
        if (!this.paginationContainer) return;
        if (totalPages <= 1) {
            this.paginationContainer.innerHTML = '';
            return;
        }

        const prevLabel = this.t('previousPage');
        const nextLabel = this.t('nextPage');
        const pageLabel = this.t('pageOf', this.currentPage, totalPages);
        const isFirst = this.currentPage <= 1;
        const isLast = this.currentPage >= totalPages;

        this.paginationContainer.innerHTML = `
            <div class="news-pagination-controls" aria-label="${this.t('pageNav')}">
                <button class="news-page-btn" type="button" data-action="prev" aria-label="${prevLabel}" ${isFirst ? 'disabled' : ''}>←</button>
                <span class="news-page-indicator" aria-live="polite">${pageLabel}</span>
                <button class="news-page-btn" type="button" data-action="next" aria-label="${nextLabel}" ${isLast ? 'disabled' : ''}>→</button>
            </div>
        `;

        const prevButton = this.paginationContainer.querySelector('[data-action="prev"]');
        const nextButton = this.paginationContainer.querySelector('[data-action="next"]');
        if (prevButton) {
            prevButton.addEventListener('click', () => this.renderPage(this.currentPage - 1));
        }
        if (nextButton) {
            nextButton.addEventListener('click', () => this.renderPage(this.currentPage + 1));
        }
    }

    /**
     * Create HTML string for a single article card.
     * @param {{title:string,summary:string,fullArticleText:string,publishedAt:string,tags:string[]}} article
     * @param {number} index
     * @returns {string}
     */
    createNewsItem(article, index) {
        const dateLabel = this.formatArticleDate(article.publishedAt);
        const safeSummary = this.redactSensitiveUrls(article.summary);
        const safeFullText = this.redactSensitiveUrls(article.fullArticleText || '');
        const tags = Array.isArray(article.tags) ? article.tags : [];
        const bodyId = `news-body-${index}`;
        const readMoreLabel = this.t('readMore');
        const bodyHtml = this.formatPlainTextToHtml(safeFullText);
        const missingBodyHtml = this.t('missingBody');

        return `
            <article class="news-item">
                <h3>${this.escapeHtml(article.title)}</h3>
                <div class="news-meta">
                    <span class="news-time">${this.escapeHtml(dateLabel)}</span>
                </div>
                <p class="news-summary">${this.escapeHtml(safeSummary)}</p>
                <div class="news-body ${DOM_CLASSES.collapsed}" id="${bodyId}">${bodyHtml || missingBodyHtml}</div>
                <button class="${DOM_CLASSES.readMore}" data-target="${bodyId}" aria-expanded="false">${readMoreLabel}</button>
                <div class="news-tags">
                    ${tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                </div>
            </article>
        `;
    }

    getDocumentLanguage() {
        const lang = (document.documentElement.getAttribute(DOM_ATTRS.lang) || 'en').toLowerCase();
        return lang.startsWith('pl') ? 'pl' : 'en';
    }

    t(key, ...args) {
        const dict = I18N[this.language] || I18N.en;
        const entry = dict[key];
        return typeof entry === 'function' ? entry(...args) : entry;
    }

    formatArticleDate(dateInput) {
        const date = new Date(dateInput);
        if (Number.isNaN(date.getTime())) {
            return this.t('noDate');
        }

        const monthsPl = [
            'Stycznia', 'Lutego', 'Marca', 'Kwietnia', 'Maja', 'Czerwca',
            'Lipca', 'Sierpnia', 'Września', 'Października', 'Listopada', 'Grudnia'
        ];
        const monthsEn = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const day = date.getUTCDate();
        const year = date.getUTCFullYear();
        const monthName = this.language === 'pl'
            ? monthsPl[date.getUTCMonth()]
            : monthsEn[date.getUTCMonth()];

        return `${day} ${monthName} ${year}`;
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const value = String(text);
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeAttr(text) {
        const value = text === null || text === undefined ? '' : String(text);
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    formatPlainTextToHtml(text) {
        if (!text || typeof text !== 'string') return '';
        const escaped = this.escapeHtml(text);
        const paragraphs = escaped.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
        if (paragraphs.length === 0) return '';
        return paragraphs.map(part => `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
    }

    redactSensitiveUrls(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/https?:\/\/\S+/gi, this.t('removedAddress'));
    }

    bindReadMoreButtons() {
        const readMoreLabel = this.t('readMore');
        const showLessLabel = this.t('showLess');

        this.newsContainer.querySelectorAll(DOM_CLASSES.readMoreSelector).forEach((button) => {
            button.addEventListener('click', () => {
                const id = button.getAttribute(DOM_ATTRS.dataTarget);
                if (!id) return;
                const body = document.getElementById(id);
                if (!body) return;
                const collapsed = body.classList.toggle(DOM_CLASSES.collapsed);
                button.textContent = collapsed ? readMoreLabel : showLessLabel;
                button.setAttribute(DOM_ATTRS.ariaExpanded, (!collapsed).toString());
            });
        });
    }

    /**
     * Update the UI with the current local time.
     */
    updateLastUpdateTime() {
        const now = new Date();
        const locale = this.t('locale');
        const timeString = now.toLocaleString(locale);
        if (this.lastUpdateElement) {
            this.lastUpdateElement.textContent = timeString;
        }
    }

    /**
     * Render a generic error message in the container.
     */
    showError() {
        const title = this.t('errorTitle');
        const body = this.t('errorBody');
        this.newsContainer.innerHTML = `
            <div class="error-message">
                <h3>${title}</h3>
                <p>${body}</p>
            </div>
        `;
    }
}

// Initialize app after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const uiLang = (document.documentElement.getAttribute(DOM_ATTRS.lang) || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
    const labels = I18N[uiLang].themeLabels;

    // Theme: init and toggle
    (function initTheme(){
        const root = document.documentElement;
        const btn = document.getElementById(DOM_IDS.themeToggle);
        const saved = localStorage.getItem(THEME.storageKey) || THEME.auto;
        const mql = window.matchMedia && window.matchMedia(THEME.mediaQuery);
        let mediaListener = null;

        function applyAuto(){
            const dark = mql && mql.matches;
            root.setAttribute(DOM_ATTRS.dataTheme, dark ? THEME.dark : THEME.light);
            if (btn) btn.textContent = labels[THEME.auto];
        }
        function setTheme(mode){
            if (mode === THEME.auto) {
                applyAuto();
                if (mediaListener && mql) {
                    if (mql.removeEventListener) mql.removeEventListener('change', mediaListener);
                    else if (mql.removeListener) mql.removeListener(mediaListener);
                }
                mediaListener = () => applyAuto();
                if (mql) {
                    if (mql.addEventListener) mql.addEventListener('change', mediaListener);
                    else if (mql.addListener) mql.addListener(mediaListener);
                }
            } else if (mode === THEME.dark) {
                root.setAttribute(DOM_ATTRS.dataTheme, THEME.dark);
                if (btn) btn.textContent = labels[THEME.dark];
                if (mediaListener && mql) {
                    if (mql.removeEventListener) mql.removeEventListener('change', mediaListener);
                    else if (mql.removeListener) mql.removeListener(mediaListener);
                }
            } else {
                root.setAttribute(DOM_ATTRS.dataTheme, THEME.light);
                if (btn) btn.textContent = labels[THEME.light];
                if (mediaListener && mql) {
                    if (mql.removeEventListener) mql.removeEventListener('change', mediaListener);
                    else if (mql.removeListener) mql.removeListener(mediaListener);
                }
            }
            try { localStorage.setItem(THEME.storageKey, mode); } catch(_){}
        }
        // init
        setTheme(saved);
        if (btn) btn.addEventListener('click', () => {
            const current = localStorage.getItem(THEME.storageKey) || THEME.auto;
            const next = THEME.order[(THEME.order.indexOf(current) + 1) % THEME.order.length];
            setTheme(next);
        });
    })();

    new NBSNews();
});
