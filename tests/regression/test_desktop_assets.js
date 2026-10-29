const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { APP_URL, createAssetHandler, resourcePath } = require('../../src/desktop/assets.cjs');

(async () => {
    const root = path.resolve(__dirname, '../..');
    const serve = await createAssetHandler(root);
    const request = (url, method = 'GET') => serve({ url: new URL(url, APP_URL).href, method });
    const html = await (await request(APP_URL)).text();
    const browser = await fs.readFile(path.join(root, 'dist/renderer/index.html'), 'utf8');
    assert.equal(html, browser, 'browser and desktop use the same built HTML');
    const dom = new JSDOM(html, { url: APP_URL });
    try {
        const document = dom.window.document;
        assert.ok(document.querySelector('script[type="module"][src^="./assets/"]'));
        assert.ok(document.getElementById('react-root'));
        assert.equal(document.querySelectorAll('[src^="http"], [href^="http"]').length, 0);
        assert.equal(document.getElementById('book-paper'), null, 'the entry mounts the React shell at runtime');
        const entryUrl = document.querySelector('script[type="module"]').getAttribute('src');
        const entry = await (await request(entryUrl)).text();
        assert.ok(entry.includes('book-paper') && entry.includes('btn-import-book'), 'the shipped entry contains the workbench shell');
        for (const element of document.querySelectorAll('script[src], link[href]')) {
            const url = element.getAttribute('src') || element.getAttribute('href');
            const response = await request(url);
            assert.equal(response.status, 200, url);
            assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
            assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self'/);
            assert.ok((await response.arrayBuffer()).byteLength > 0);
        }
        for (const [url, type] of [['/fonts/literata.woff2', 'font/woff2'], ['/fonts/inventory.json', 'application/json']]) {
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
    console.log('PASS: shared Vite output, hashed entry resources, fonts, CSP/MIME and resource boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
