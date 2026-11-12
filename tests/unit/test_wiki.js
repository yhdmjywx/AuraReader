const assert = require('node:assert/strict');
const { createWikiService, validateWikiRequest } = require('../../src/server/wikiService.js');
const { wikiExternalUrl } = require('../../src/shared/wikiSites.js');
const input = { id: 'test', kind: 'article', site: 'zh', title: ' 坚硬的蛋壳 ' };
const page = { pageid: 7, title: '蛋壳', fullurl: 'https://zh.wikipedia.org/wiki/蛋壳', extract: 'First paragraph.\n\nSecond paragraph.' };
const rightsinfo = { text: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.zh' };
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

(async () => {
    const { WikiController } = await import('../../dist/client/features/wiki/wikiController.js');
    const { initialWikiSite } = await import('../../dist/shared/wiki.js');
    assert.equal(initialWikiSite('zh-Hant-TW', 'en'), 'zh');
    assert.equal(initialWikiSite('unknown', 'fr-FR'), 'fr');
    assert.equal(initialWikiSite('unknown', 'unknown'), 'en');
    assert.equal(initialWikiSite('ja', 'en'), 'en', 'initial sites match the six-choice menu');
    assert.throws(() => validateWikiRequest({ ...input, site: 'en', variant: 'zh-hant' }));
    assert.throws(() => validateWikiRequest({ ...input, variant: 'invalid' }));
    assert.throws(() => validateWikiRequest({ ...input, site: 'en.evil.test' }));
    for (const url of ['file:///C:/Windows', 'https://evil.test/wiki/A', 'https://en.wikipedia.org.evil.test/wiki/A',
        'https://en.wikipedia.org:444/wiki/A', 'https://user@en.wikipedia.org/wiki/A', 'https://en.wikipedia.org/w/api.php']) {
        assert.throws(() => wikiExternalUrl(url));
    }
    assert.ok(wikiExternalUrl(rightsinfo.url).endsWith('deed.zh'));
    const calls = [];
    let data = { query: { pages: [page], rightsinfo, redirects: [{ from: 'Alias', to: page.title }] } };
    const service = createWikiService({ fetch: async url => { calls.push(url); return response(data); } });
    const article = (await service.read(input)).article;
    assert.equal(article.extract, page.extract);
    assert.equal(calls[0].searchParams.get('titles'), '\x1f坚硬的蛋壳', 'only trim, never simplify a query');
    await service.read({ ...input, title: 'literal|pipe' });
    assert.equal(calls[1].searchParams.get('titles'), '\x1fliteral|pipe');
    const traditional = await service.read({ ...input, variant: 'zh-hant' });
    assert.equal(calls[2].searchParams.get('variant'), 'zh-hant');
    assert.equal(new URL(traditional.article.url).searchParams.get('variant'), 'zh-hant');
    data.query.pages = [{ ...page, pageprops: { disambiguation: '' } }];
    assert.equal((await service.read(input)).article.notice, 'disambiguation');
    data.query.pages = [page]; data.query.redirects = [{ tofragment: 'Section name' }];
    const section = (await service.read(input)).article;
    assert.equal(new URL(section.url).hash, '#Section%20name');
    assert.equal(section.extract, '');
    data = { query: { pages: [{ missing: true }] } };
    assert.equal((await service.read(input)).article, null);
    data = { error: { code: 'badrequest' } };
    await assert.rejects(service.read(input), /could not process/);
    data = { query: { pages: [{ ...page, extract: '' }], rightsinfo } };
    assert.equal((await service.read(input)).article.notice, 'empty');
    let count = 0;
    const paged = createWikiService({ fetch: async url => {
        count++;
        assert.equal(url.searchParams.get('llcontinue'), count === 1 ? null : 'next');
        return response({ query: { pages: [{ langlinks: [{ lang: count === 1 ? 'en' : 'ja', title: 'Linked title',
            autonym: count === 1 ? 'English' : '日本語', url: `https://${count === 1 ? 'en' : 'ja'}.wikipedia.org/wiki/Linked_title` }] }] },
            ...(count === 1 ? { continue: { continue: '||', llcontinue: 'next' } } : {}) });
    } });
    assert.equal((await paged.read({ ...input, kind: 'languages' })).languages.length, 2);
    let limitedCalls = 0;
    const limited = createWikiService({ fetch: async () => { limitedCalls++; return new Response('', { status: 429, headers: { 'Retry-After': '10' } }); } });
    await assert.rejects(limited.read(input), /busy/);
    await assert.rejects(limited.read(input), /busy/);
    assert.equal(limitedCalls, 1, 'Retry-After prevents immediate repeat requests');

    const pending = [];
    const controller = new WikiController(() => {}, (query, signal) => new Promise((resolve, reject) => pending.push({ query, signal, resolve, reject })));
    const settle = () => new Promise(resolve => setImmediate(resolve));
    controller.open('蛋壳', 'zh');
    pending[0].resolve({ kind: 'article', article }); await settle();
    assert.equal(controller.state.article, article, 'body is available before languages');
    pending[1].reject(new Error('Languages offline')); await settle();
    assert.match(controller.state.languagesError, /offline/);
    controller.retryLanguages();
    pending[2].resolve({ kind: 'languages', languages: [{ site: 'en', title: 'Eggshell', name: 'English' }] }); await settle();
    controller.switchLanguage('en');
    assert.equal(pending[3].query.title, 'Eggshell', 'switch uses the official linked title');
    assert.equal(controller.state.query, '蛋壳');
    pending[3].reject(new Error('Offline')); await settle();
    assert.equal(controller.state.article, article);
    assert.equal(controller.state.site, 'zh');
    controller.retryArticle();
    const english = { ...article, site: 'en', title: 'Eggshell', url: 'https://en.wikipedia.org/wiki/Eggshell' };
    pending[4].resolve({ kind: 'article', article: english }); await settle();
    pending[5].resolve({ kind: 'languages', languages: [] }); await settle();
    controller.submit('new title');
    assert.equal(pending[6].query.site, 'en');
    controller.submit('newer title');
    assert.equal(pending[6].signal.aborted, true);
    pending[6].resolve({ kind: 'article', article }); await settle();
    assert.equal(controller.state.query, 'newer title');
    controller.close();
    pending[7].resolve({ kind: 'article', article }); await settle();
    assert.equal(controller.state, null, 'closing revokes late responses');
    const variants = new WikiController(() => {}, async query => query.kind === 'article'
        ? { kind: 'article', article: { ...article, site: query.site } }
        : { kind: 'languages', languages: [] });
    variants.open('蛋壳', 'zh'); await settle();
    variants.switchLanguage('zh-hant'); await settle();
    assert.equal(variants.state.variant, 'zh-hant');
    assert.equal(variants.state.site, 'zh');
    assert.equal(variants.state.query, '蛋壳');
    variants.close();
    console.log('Wiki: literal titles, redirects, page states, continuation, rate limits, linked-language switching and request cancellation passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
