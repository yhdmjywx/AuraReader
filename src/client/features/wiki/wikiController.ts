import type { WikiArticle, WikiLanguage, WikiQuery, WikiResponse, WikiVariant } from '../../../shared/wiki.js';
import { readWiki } from '../../infrastructure/wikiClient.js';

export interface WikiState {
    query: string;
    site: string;
    variant: WikiVariant;
    article: WikiArticle | null;
    languages: WikiLanguage[];
    loading: boolean;
    languagesLoading: boolean;
    missing: boolean;
    error: string;
    languagesError: string;
}
type ReadWiki = (input: WikiQuery & { kind: 'article' | 'languages' }, signal: AbortSignal) => Promise<WikiResponse>;

/** Ephemeral query state. A replacement owns both requests; late responses have no authority. */
export class WikiController {
    state: WikiState | null = null;
    private request?: AbortController;
    private retry?: () => void;
    constructor(private changed: () => void, private read: ReadWiki = readWiki) {}
    close() {
        this.request?.abort(); this.request = undefined;
        this.state = null; this.retry = undefined; this.changed();
    }
    open(query: string, site: string) { void this.lookup(query, site); }
    submit(query: string) { if (this.state && query.trim()) void this.lookup(query.trim(), this.state.site); }
    switchLanguage(site: string) {
        if (!this.state) return;
        const variant = site === 'zh-hant' ? 'zh-hant' : 'zh-hans';
        const target = site.startsWith('zh-') ? 'zh' : site;
        const edition = target === this.state.site && this.state.article
            ? { title: this.state.article.title, site: target }
            : this.state.languages.find(language => language.site === target);
        if (edition) void this.lookup(edition.title, edition.site, true, variant);
    }
    retryArticle() { this.retry?.(); }
    private publish(change: Partial<WikiState>) {
        if (!this.state) return;
        this.state = { ...this.state, ...change }; this.changed();
    }
    private async lookup(title: string, site: string, switching = false, variant: WikiVariant = this.state?.variant || 'zh-hans') {
        const previous = this.state;
        this.request?.abort();
        const request = this.request = new AbortController();
        const current = () => this.request === request && !request.signal.aborted;
        if (switching && previous) this.publish({ loading: true, error: '', languagesError: '' });
        else {
            this.state = { query: title.trim(), site, article: null, languages: [], loading: true,
                variant, languagesLoading: false, missing: false, error: '', languagesError: '' };
            this.changed();
        }
        this.retry = () => { void this.lookup(title, site, switching, variant); };
        try {
            const result = await this.read({ site, title, kind: 'article', ...(site === 'zh' ? { variant } : {}) }, request.signal);
            if (!current()) return;
            if (result.kind !== 'article') throw new Error('Wikipedia returned an invalid article response.');
            if (!result.article && switching) throw new Error('This language edition is no longer available.');
            this.publish({ article: result.article, site, variant, loading: false, missing: !result.article, languages: [] });
            if (result.article) await this.loadLanguages(result.article, request);
        } catch (error) {
            if (!current()) return;
            if (switching && previous) this.state = { ...previous, loading: false, languagesLoading: false };
            this.publish({ loading: false, error: error instanceof Error ? error.message : 'Wikipedia is unavailable. Please try again.' });
        }
    }
    retryLanguages() {
        const article = this.state?.article;
        if (!article || !this.request) return;
        void this.loadLanguages(article, this.request);
    }
    private async loadLanguages(article: WikiArticle, request: AbortController) {
        this.publish({ languagesLoading: true, languagesError: '' });
        try {
            const result = await this.read({ site: article.site, title: article.title, kind: 'languages' }, request.signal);
            if (this.request !== request || request.signal.aborted) return;
            if (result.kind !== 'languages') throw new Error('Wikipedia returned an invalid language response.');
            this.publish({ languages: result.languages, languagesLoading: false });
        } catch (error) {
            if (this.request !== request || request.signal.aborted) return;
            this.publish({ languagesLoading: false, languagesError: error instanceof Error ? error.message : 'Language editions could not be loaded.' });
        }
    }
}
