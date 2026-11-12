const { validWikiSite, wikipediaUrl, licenseUrl } = require('../shared/wikiSites.js');
const { version } = require('../../package.json');

/** @param {unknown} input @returns {import('../shared/wiki.js').WikiRequest} */
function validateWikiRequest(input) {
    const value = /** @type {import('../shared/wiki.js').WikiRequest} */ (input);
    if (!value || typeof value !== 'object' || !validWikiSite(value.site)
        || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 2048
        || typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id)
        || !['article', 'languages'].includes(value.kind)
        || (value.variant !== undefined && (value.site !== 'zh' || !['zh-hans', 'zh-hant'].includes(value.variant)))
        || Object.keys(value).some(key => !['id', 'site', 'title', 'kind', 'variant'].includes(key))) {
        throw new Error('Invalid Wikipedia request.');
    }
    return { ...value, title: value.title.trim() };
}

/** Shared by the local HTTP server and Electron main process. No renderer URLs are fetched.
 * @param {{fetch?: typeof fetch}} [options] */
function createWikiService({ fetch: request = fetch } = {}) {
    /** @type {Map<string, number>} */
    const cooldown = new Map();
    /** @param {string} site @param {Record<string, string>} params @param {AbortSignal} signal */
    async function query(site, params, signal) {
        if ((cooldown.get(site) || 0) > Date.now()) throw new Error('Wikipedia is busy. Please try again later.');
        const url = new URL(`https://${site}.wikipedia.org/w/api.php`);
        url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', ...params }).toString();
        const response = await request(url, { signal, redirect: 'error', headers: {
            'User-Agent': `AuraReader/${version} (https://github.com/yhdmjywx/AuraReader)`,
            Accept: 'application/json'
        } });
        if (response.status === 429 || response.status === 503) {
            const retry = response.headers.get('Retry-After');
            const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry || '') - Date.now());
            cooldown.set(site, Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 5000));
            throw new Error('Wikipedia is busy. Please try again later.');
        }
        if (!response.ok) throw new Error(`Wikipedia request failed (${response.status}).`);
        const data = await response.json();
        if (data.error) {
            if (['maxlag', 'ratelimited'].includes(data.error.code)) {
                cooldown.set(site, Date.now() + 5000);
                throw new Error('Wikipedia is busy. Please try again later.');
            }
            throw new Error('Wikipedia could not process this request.');
        }
        if (!data.query) throw new Error('Wikipedia returned an invalid response.');
        return data;
    }
    /** @param {unknown} input @param {AbortSignal} [cancel] @returns {Promise<import('../shared/wiki.js').WikiResponse>} */
    async function read(input, cancel) {
        const { site, title, kind, variant } = validateWikiRequest(input);
        const timeout = AbortSignal.timeout(15000);
        const signal = cancel ? AbortSignal.any([cancel, timeout]) : timeout;
        try {
            if (kind === 'article') {
                // U+001F prevents a literal pipe in the selected title becoming a multi-title request.
                const data = await query(site, { titles: '\x1f' + title, redirects: '1', converttitles: '1',
                    prop: 'info|extracts|pageprops', inprop: 'url', ppprop: 'disambiguation', exintro: '1', explaintext: '1',
                    meta: 'siteinfo', siprop: 'rightsinfo', ...(variant ? { variant } : {}) }, signal);
                const page = data.query.pages?.[0];
                if (!page) throw new Error('Wikipedia returned no page information.');
                if (page.missing || page.invalid) return { kind, article: null };
                if (!(page.pageid > 0) || typeof page.title !== 'string' || typeof page.extract !== 'string') {
                    throw new Error('Wikipedia returned an invalid article.');
                }
                const url = wikipediaUrl(page.fullurl, site);
                const fragment = data.query.redirects?.find(/** @param {{tofragment?: string}} redirect */ redirect => redirect.tofragment)?.tofragment;
                if (fragment) url.hash = fragment;
                if (variant) url.searchParams.set('variant', variant);
                const rights = data.query.rightsinfo;
                const license = { name: String(rights?.text || 'CC BY-SA'), url: licenseUrl(rights?.url).href };
                const notice = fragment ? 'section' : Object.hasOwn(page.pageprops || {}, 'disambiguation')
                    ? 'disambiguation' : !page.extract.trim() ? 'empty' : null;
                return { kind, article: { site, pageid: page.pageid, title: page.title, url: url.href,
                    extract: notice ? '' : page.extract, notice, license } };
            }
            /** @type {Map<string, import('../shared/wiki.js').WikiLanguage>} */
            const editions = new Map();
            /** @type {Record<string, string>} */
            let continuation = {};
            const seen = new Set();
            do {
                const data = await query(site, { titles: '\x1f' + title, prop: 'langlinks',
                    llprop: 'url|langname|autonym', lllimit: 'max', ...continuation }, signal);
                const page = data.query.pages?.[0];
                if (!page || page.missing || page.invalid) throw new Error('This Wikipedia language edition is no longer available.');
                for (const link of page.langlinks || []) {
                    const url = wikipediaUrl(link.url);
                    const target = url.hostname.slice(0, -'.wikipedia.org'.length);
                    if (typeof link.title !== 'string') throw new Error('Wikipedia returned an invalid language link.');
                    editions.set(target, { site: target, title: link.title, name: link.autonym || link.langname || link.lang });
                }
                continuation = data.continue || {};
                const key = JSON.stringify(continuation);
                if (Object.keys(continuation).length && seen.has(key)) throw new Error('Wikipedia language links could not be completed.');
                seen.add(key);
            } while (Object.keys(continuation).length);
            return { kind, languages: [...editions.values()].filter(link => link.site !== site) };
        } catch (error) {
            if (timeout.aborted && !cancel?.aborted) throw new Error('Wikipedia timed out. Please try again.');
            throw error;
        }
    }
    return { read };
}
module.exports = { createWikiService, validateWikiRequest };
