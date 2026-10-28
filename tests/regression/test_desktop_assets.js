const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { APP_URL, createAssetHandler, desktopHtml, resourcePath } = require('../../src/desktop/assets.cjs');

(async () => {
    const root = path.resolve(__dirname, '../..');
    const serve = await createAssetHandler(root);
    const request = (url, method = 'GET') => serve({ url: new URL(url, APP_URL).href, method });
    const html = await (await request(APP_URL)).text();
    const browser = await fs.readFile(path.join(root, 'src/client/index.html'), 'utf8');
    assert.match(browser, /https:\/\/cdn.jsdelivr.net/);
    assert.match(browser, /src="main.js/);
    assert.throws(() => desktopHtml(browser.replace(/src="main.js[^\"]*"/, 'src="new-entry.js"')));
    const dom = new JSDOM(html, { url: APP_URL });
    try {
        const document = dom.window.document;
        assert.deepEqual([...document.querySelectorAll('script')].map(script => script.getAttribute('src')),
            ['vendor/jszip.min.js', 'desktop-shell.js']);
        assert.equal(document.querySelectorAll('[src^="http"], [href^="http"]').length, 0);
        assert.ok(document.getElementById('book-paper'));
        assert.ok(document.getElementById('btn-import-book'));
        for (const element of document.querySelectorAll('script[src], link[href]')) {
            const url = element.getAttribute('src') || element.getAttribute('href');
            const response = await request(url);
            assert.equal(response.status, 200, url);
            assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
            assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self'/);
            assert.ok((await response.arrayBuffer()).byteLength > 0);
        }
        for (const [url, type] of [['/main.js?v=15', 'application/javascript'],
            ['/assets/fonts/literata.woff2', 'font/woff2'], ['/vendor/remixicon.woff2?t=1', 'font/woff2']]) {
            const response = await request(url);
            assert.equal(response.status, 200, url);
            assert.ok(response.headers.get('Content-Type').startsWith(type), url);
        }
        for (const url of ['/data/aurareader.sqlite', '/src/server/server.js', '/package.json',
            '/main.ts', '/api/storage/session', '/node_modules/electron/index.js']) {
            assert.equal((await request(url)).status, 404, url);
        }
        for (const url of ['aurareader://evil/index.html', 'file:///C:/Windows/win.ini',
            'aurareader://user:pass@app/index.html', 'aurareader://app:123/index.html',
            'aurareader://app/%2e%2e%2fdata/aurareader.sqlite', 'aurareader://app/a%5c..%5csecret',
            'aurareader://app/%00', 'aurareader://app/%E0%A4%A']) {
            assert.equal((await serve({ url, method: 'GET' })).status, 403, url);
        }
        assert.equal(resourcePath('aurareader://app/'), '/index.html');
        assert.equal((await request(APP_URL, 'POST')).status, 405);
        const head = await request(APP_URL, 'HEAD');
        assert.equal(head.status, 200); assert.equal(await head.text(), '');
    } finally { dom.window.close(); }
    console.log('PASS: desktop resource responses, browser entry preservation, CSP/MIME, source/data exclusion and malformed/traversal requests');
})().catch(error => { console.error(error); process.exitCode = 1; });
