const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');
const { sqliteServer, browserFetch } = require('../helpers/sqlite.js');
const { publicationFixture } = require('../helpers/epub.cjs');
const { createAssetHandler } = require('../../src/desktop/assets.cjs');
const { createDesktopStorage } = require('../../src/desktop/storage.cjs');
const path = require('node:path');

(async () => {
    const dom = new JSDOM('<section><div class="reader-viewport"><div class="paper-container"><article class="book-paper"></article></div></div></section>', { url: 'http://localhost/', pretendToBeVisual: true });
    const keys = ['window', 'document', 'DOMParser', 'localStorage', 'NodeFilter', 'Node', 'fetch'];
    const prior = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    keys.filter(key => key !== 'fetch').forEach(key => { globalThis[key] = dom.window[key]; });
    let api, runtime, desktop;
    try {
        const { parseEpub, findZipFile } = await import('../../dist/client/infrastructure/epubParser.js');
        const { resolveEpubUrl, publicationResourceUrl } = await import('../../dist/client/infrastructure/epubPaths.js');
        const { retainEpubLocations } = await import('../../dist/client/infrastructure/epubCompatibility.js');
        const { ReaderRuntime } = await import('../../dist/client/features/reader/readerRuntime.js');
        const { readerRect } = await import('../../dist/client/features/reader/readerDocument.js');
        const { interceptInTextLinks } = await import('../../dist/client/features/reader/paperRenderer.js');
        const bytes = await publicationFixture();
        const book = await parseEpub(bytes, 'P0-fixture.epub', JSZip);
        assert.equal(book.pages.length, 2);
        assert.deepEqual(Buffer.from(book.epub.archive, 'base64'), bytes, 'original EPUB survives byte-for-byte');
        assert.deepEqual(book.epub.documents.map(item => [item.page, item.path, item.sectionId]), [[1, 'OPS/Text/first.xhtml', 'chapter-1'], [2, 'OPS/Other/first.xhtml', 'chapter-2']]);
        assert.equal(book.hrefToPageMap['first.xhtml'], undefined, 'no ambiguous basename aliases');
        assert.equal(book.hrefToPageMap['OPS/Other/first.xhtml'], 2);
        assert.deepEqual(resolveEpubUrl('../Other/./first.xhtml?edition=1#%E7%9B%AE%E6%A0%87', 'OPS/Text/first.xhtml'), { path: 'OPS/Other/first.xhtml', query: '?edition=1', fragment: '目标' });
        for (const invalid of ['../../../outside', '%2e%2e/%2e%2e/outside', 'file:///secret', 'https://example.com/a', '//example.com/a', 'a%5cb']) assert.equal(resolveEpubUrl(invalid, 'OPS/one.xhtml'), null);
        const zip = await JSZip.loadAsync(bytes);
        assert.equal(findZipFile(zip, 'OPS/text/first.xhtml'), null);
        assert.equal(findZipFile(zip, 'first.xhtml'), null);
        const encodedDirectory = new JSZip();
        for (const file of Object.values(zip.files).filter(file => !file.dir)) {
            const name = file.name.replace(/^OPS\//, 'OPS% R/');
            const content = file.name === 'META-INF/container.xml'
                ? (await file.async('string')).replace('OPS/package.opf', 'OPS%25%20R/package.opf')
                : await file.async('uint8array');
            encodedDirectory.file(name, content);
        }
        const encodedBook = await parseEpub(await encodedDirectory.generateAsync({ type: 'nodebuffer' }), 'encoded.epub', JSZip);
        assert.equal(encodedBook.epub.packagePath, 'OPS% R/package.opf');
        assert.equal(encodedBook.toc[1].page, 2, 'encoded container directories work for package, chapter and NAV bases');
        const projection = new DOMParser().parseFromString(book.pages[0], 'text/html');
        assert.equal(projection.getElementById('cross').getAttribute('href'), '../Other/./first.xhtml?edition=1#%E7%9B%AE%E6%A0%87', 'ordinary anchor keeps its URL');
        assert.equal(projection.getElementById('picture').getAttribute('src'), '../Images/./green%20%23.svg?size=small#image', 'import retains source URLs for on-demand reading resources');
        const previous = { ...book, epub: undefined, pages: [...book.pages].reverse() };
        const remapped = retainEpubLocations(book, previous);
        assert.equal(remapped.epub.documents.find(item => item.page === 1).path, 'OPS/Other/first.xhtml');
        assert.deepEqual(remapped.pages, previous.pages);
        assert.throws(() => retainEpubLocations(book, { ...previous, pages: ['<p>Different text</p>'] }), /different book version/);

        const text = projection.body.textContent;
        const quote = 'Stable quotation';
        const start = text.indexOf(quote);
        const note = { id: 'p0-note', bookId: book.id, kind: 'note', page: 1, quote, comment: 'Saved before document isolation', location: { sectionId: 'chapter-1', page: 1, start, end: start + quote.length, offset: start } };
        runtime = new ReaderRuntime(); runtime.mount(document.querySelector('section')); runtime.setBook(book, [note]);
        const paper = runtime.reader.elements.bookPaper;
        const frame = document.querySelector('iframe.reader-document');
        assert.equal(frame.getAttribute('sandbox'), 'allow-same-origin');
        assert.notEqual(paper.ownerDocument, document);
        assert.equal(document.querySelector('.annotation-token'), null, 'publication DOM is outside the React document');
        assert.equal(paper.querySelector('.annotation-token').textContent, quote);
        assert.match(paper.querySelector('#picture').getAttribute('src'), /^\/api\/publications\//);
        const externalRoot = paper.ownerDocument.createElement('div');
        externalRoot.innerHTML = '<a href="https://example.org/source">External reference</a>';
        const opened = [];
        window.open = (...args) => { opened.push(args); };
        interceptInTextLinks({ bookPaper: externalRoot, readerPanel: document.querySelector('section') }, book, null);
        externalRoot.querySelector('a').click();
        assert.deepEqual(opened, [['https://example.org/source', '_blank', 'noopener,noreferrer']], 'external references open from the surrounding browser UI');
        frame.getBoundingClientRect = () => ({ left: 100, top: 80, width: 560, height: 600 });
        assert.deepEqual(readerRect({ left: 10, top: 20, right: 30, bottom: 40 }, paper.ownerDocument), { left: 110, top: 100, right: 130, bottom: 120, width: 20, height: 20 });
        paper.querySelector('#cross').click();
        assert.equal(runtime.reader.getCurrentPage(), 2);
        assert.match(paper.textContent, /same filename/);
        paper.querySelector('a').click();
        assert.equal(runtime.reader.getCurrentPage(), 1);

        api = await sqliteServer();
        assert.equal((await api.request('restore', { opId: randomUUID(), books: [book], notes: [note] })).status, 200);
        globalThis.fetch = browserFetch(api.base);
        const { withExportImages } = await import('../../dist/client/infrastructure/epubExport.js');
        const exported = await withExportImages(book, new Set([1]));
        const exportDocument = new DOMParser().parseFromString(exported.pages[0], 'text/html');
        const exportedImage = exportDocument.getElementById('picture').getAttribute('src');
        assert.match(exportedImage, /^data:image\/svg\+xml;base64,/);
        assert.match(Buffer.from(exportedImage.split(',')[1].split('#')[0], 'base64').toString(), /#208542/);
        assert.equal(exported.pages[1], book.pages[1], 'unselected export pages remain unchanged');
        assert.equal(projection.getElementById('picture').getAttribute('src'), '../Images/./green%20%23.svg?size=small#image', 'export does not mutate stored reading pages');
        const resource = publicationResourceUrl(book.id, 'OPS/Images/green #.svg');
        let response = await fetch(api.base + resource);
        assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/svg+xml');
        assert.match(await response.text(), /#208542/);
        assert.equal((await fetch(api.base + resource.replace('Images', 'images'))).status, 404);
        assert.equal((await fetch(api.base + resource, { headers: { Origin: 'https://other.example' } })).status, 403);
        assert.equal((await fetch(api.base + resource, { method: 'POST' })).status, 405);
        response = await fetch(api.base + resource, { method: 'HEAD' });
        assert.equal(response.status, 200); assert.equal(await response.text(), '');
        await api.restart();
        assert.deepEqual(api.read('books', book.id).epub, JSON.parse(JSON.stringify(book.epub)), 'restart preserves the complete JSON package record');
        assert.deepEqual(api.read('annotations', note.id), note);
        assert.equal((await fetch(api.base + resource)).status, 200);
        // Same service is used by the desktop protocol, including an initialized desktop store.
        const desktopDirectory = path.join(api.directory, 'desktop');
        desktop = createDesktopStorage(desktopDirectory);
        await desktop.call('createLibrary');
        await desktop.call('restore', JSON.parse(JSON.stringify({ opId: randomUUID(), books: [book], notes: [note] })));
        const serve = await createAssetHandler(path.resolve(__dirname, '../..'), undefined, desktop.publicationResource);
        response = await serve({ url: 'aurareader://app' + resource, method: 'GET' });
        assert.equal(response.status, 200); assert.match(await response.text(), /#208542/);
        await desktop.settle(); desktop.close(); desktop = null;
        const records = await api.request('books');
        const row = records.records.find(row => row.id === book.id);
        await api.request('books/delete', { opId: randomUUID(), expected: row.revision, id: book.id });
        assert.equal((await fetch(api.base + resource)).status, 404, 'deleted publications cannot serve cached resources');
        console.log('PASS: precise EPUB paths/links/images, original archive, stable reimport coordinates, iframe isolation/geometry, persisted notes, HTTP and desktop resources, restart and cache invalidation');
    } finally {
        runtime?.destroy(); desktop?.close(); await api?.close(); dom.window.close();
        for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
