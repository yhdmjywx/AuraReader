export type WikiVariant = 'zh-hans' | 'zh-hant';
export interface WikiQuery { site: string; title: string; variant?: WikiVariant }
export interface WikiLanguage extends WikiQuery { name: string }
export interface WikiArticle {
    site: string;
    pageid: number;
    title: string;
    url: string;
    extract: string;
    notice: 'disambiguation' | 'section' | 'empty' | null;
    license: { name: string; url: string };
}
export interface WikiRequest extends WikiQuery {
    id: string;
    kind: 'article' | 'languages';
}
export type WikiResponse = { kind: 'article'; article: WikiArticle | null }
    | { kind: 'languages'; languages: WikiLanguage[] };

const initialSites = new Set(['en', 'zh', 'fr', 'de', 'es']);
export function initialWikiSite(bookLanguage?: string, systemLanguage?: string) {
    const supported = (language = '') => {
        const code = language.toLowerCase().split(/[-_]/)[0]!;
        return initialSites.has(code) ? code : null;
    };
    return supported(bookLanguage) || supported(systemLanguage) || 'en';
}
