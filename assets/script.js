// NBSNews - Frontend JavaScript

/**
 * NBSNews – Frontend App
 *
 * Purpose:
 * - Fetches the latest run's `step5-publication/full-published.json` (via `state/latest.json`) and renders news cards.
 * - Shows last update time and basic error states.
 *
 * Why:
 * - Keeps client logic minimal and deterministic; all heavy lifting happens in backend tools.
 */

class NBSNews {
    /**
     * Initialize app bindings and kick off initial load.
     */
    constructor() {
        this.newsContainer = document.getElementById('news-container');
        this.paginationContainer = document.getElementById('news-pagination');
        this.lastUpdateElement = document.getElementById('last-update');
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
            console.error('Error while loading news:', error);
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
            console.error('Error while fetching data:', error);
            this.showError();
        }
    }

    async fetchPublishedArticles() {
        try {
            const latestPointer = await fetch('state/latest.json', { cache: 'no-store' });
            if (latestPointer.ok) {
                const latestState = await latestPointer.json();
                const runId = latestState && latestState.success && latestState.success.runId;
                if (runId) {
                    const runUrl = `runs/success/${runId}/step5-publication/full-published.json`;
                    const runResponse = await fetch(runUrl, { cache: 'no-store' });
                    if (runResponse.ok) {
                        const runPublished = await runResponse.json();
                        return Array.isArray(runPublished.articles) ? runPublished.articles : [];
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to load latest run publication', err);
        }

        throw new Error('full-published.json not found for latest run');
    }

    /**
     * Render list of articles into the container.
     * @param {Array} articles
     */
    renderNews(articles) {
        if (!articles || articles.length === 0) {
            this.newsContainer.innerHTML = this.language === 'pl'
                ? '<p>Brak dostępnych wiadomości.</p>'
                : '<p>No news available.</p>';
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

        const prevLabel = this.language === 'pl' ? 'Poprzednia strona' : 'Previous page';
        const nextLabel = this.language === 'pl' ? 'Następna strona' : 'Next page';
        const pageLabel = this.language === 'pl'
            ? `Strona ${this.currentPage} z ${totalPages}`
            : `Page ${this.currentPage} of ${totalPages}`;
        const isFirst = this.currentPage <= 1;
        const isLast = this.currentPage >= totalPages;

        this.paginationContainer.innerHTML = `
            <div class="news-pagination-controls" aria-label="${this.language === 'pl' ? 'Nawigacja stron' : 'Page navigation'}">
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
        const readMoreLabel = this.language === 'pl' ? 'Rozwin' : 'Read more';
        const bodyHtml = this.formatPlainTextToHtml(safeFullText);
        const missingBodyHtml = this.language === 'pl'
            ? '<p><em>Brak pełnej treści.</em></p>'
            : '<p><em>Full content not available.</em></p>';

        return `
            <article class="news-item">
                <h3>${this.escapeHtml(article.title)}</h3>
                <div class="news-meta">
                    <span class="news-time">${this.escapeHtml(dateLabel)}</span>
                </div>
                <p class="news-summary">${this.escapeHtml(safeSummary)}</p>
                <div class="news-body collapsed" id="${bodyId}">${bodyHtml || missingBodyHtml}</div>
                <button class="read-more" data-target="${bodyId}" aria-expanded="false">${readMoreLabel}</button>
                <div class="news-tags">
                    ${tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                </div>
            </article>
        `;
    }

    getDocumentLanguage() {
        const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
        return lang.startsWith('pl') ? 'pl' : 'en';
    }

    formatArticleDate(dateInput) {
        const date = new Date(dateInput);
        if (Number.isNaN(date.getTime())) {
            return this.language === 'pl' ? 'Brak daty' : 'Date unavailable';
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
        return String(text).replace(/https?:\/\/\S+/gi, '[adres usunięty]');
    }

    bindReadMoreButtons() {
        const readMoreLabel = this.language === 'pl' ? 'Rozwin' : 'Read more';
        const showLessLabel = this.language === 'pl' ? 'Zwiń' : 'Show less';

        this.newsContainer.querySelectorAll('.read-more').forEach((button) => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-target');
                if (!id) return;
                const body = document.getElementById(id);
                if (!body) return;
                const collapsed = body.classList.toggle('collapsed');
                button.textContent = collapsed ? readMoreLabel : showLessLabel;
                button.setAttribute('aria-expanded', (!collapsed).toString());
            });
        });
    }

    /**
     * Update the UI with the current local time.
     */
    updateLastUpdateTime() {
        const now = new Date();
        const locale = this.language === 'pl' ? 'pl-PL' : 'en-US';
        const timeString = now.toLocaleString(locale);
        if (this.lastUpdateElement) {
            this.lastUpdateElement.textContent = timeString;
        }
    }

    /**
     * Render a generic error message in the container.
     */
    showError() {
        const title = this.language === 'pl' ? 'Błąd podczas ładowania wiadomości' : 'Error while loading news';
        const body = this.language === 'pl'
            ? 'Odśwież stronę lub sprawdź połączenie z internetem.'
            : 'Try refreshing the page or check your internet connection.';
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
    const uiLang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
    const labels = uiLang === 'pl'
        ? { auto: '🖥️ Auto', dark: '☀️ Jasny', light: '🌙 Ciemny' }
        : { auto: '🖥️ Auto', dark: '☀️ Light', light: '🌙 Dark' };

    // Theme: init and toggle
    (function initTheme(){
        const root = document.documentElement;
        const btn = document.getElementById('theme-toggle');
        const saved = localStorage.getItem('theme') || 'auto';
        const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        let mediaListener = null;

        function applyAuto(){
            const dark = mql && mql.matches;
            root.setAttribute('data-theme', dark ? 'dark' : 'light');
            if (btn) btn.textContent = labels.auto;
        }
        function setTheme(mode){
            if (mode === 'auto') {
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
            } else if (mode === 'dark') {
                root.setAttribute('data-theme','dark');
                if (btn) btn.textContent = labels.dark;
                if (mediaListener && mql) {
                    if (mql.removeEventListener) mql.removeEventListener('change', mediaListener);
                    else if (mql.removeListener) mql.removeListener(mediaListener);
                }
            } else {
                root.setAttribute('data-theme','light');
                if (btn) btn.textContent = labels.light;
                if (mediaListener && mql) {
                    if (mql.removeEventListener) mql.removeEventListener('change', mediaListener);
                    else if (mql.removeListener) mql.removeListener(mediaListener);
                }
            }
            try { localStorage.setItem('theme', mode); } catch(_){}
        }
        // init
        setTheme(saved);
        if (btn) btn.addEventListener('click', () => {
            const current = localStorage.getItem('theme') || 'auto';
            const order = ['auto','dark','light'];
            const next = order[(order.indexOf(current)+1)%order.length];
            setTheme(next);
        });
    })();

    new NBSNews();
});
