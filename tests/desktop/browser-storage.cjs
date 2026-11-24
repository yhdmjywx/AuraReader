const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { app, BrowserWindow } = require('electron');
const { sqliteServer } = require('../helpers/sqlite.js');

// Keep the process alive after the test window closes so the HTTP server can close.
app.on('window-all-closed', () => {});

// A WebContents on the local HTTP origin exercises browser mode without preload or IPC.
async function checkBrowserStorage(output) {
    const profile = path.join(output, 'browser-storage-profile');
    fs.mkdirSync(profile);
    app.setPath('userData', profile);
    app.setAppLogsPath(path.join(profile, 'logs'));

    const sqliteText = 'SQLite 中的正文';
    const book = { id: 'notre-dame-fixture', title: '巴黎圣母院', pages: [`<p>${sqliteText}</p>`], toc: [], format: 'txt', language: 'zh' };
    const legacy = { ...book, pages: ['<p>IndexedDB 中的旧正文</p>'] };
    const server = await sqliteServer();
    let window;
    try {
        const saved = await server.request('books/save', { opId: randomUUID(), expected: 0, book });
        assert.equal(saved.status, 200, JSON.stringify(saved));
        await app.whenReady();
        window = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, partition: 'browser-storage-test' } });
        const run = source => window.webContents.executeJavaScript(source);
        const waitFor = expression => run(`(async () => {
            const deadline = Date.now() + 10000;
            while (!(${expression})) {
                if (Date.now() > deadline) throw new Error(${JSON.stringify(expression)});
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        })()`);
        const accessLegacyBook = write => run(`(${legacyBookFixture})(${write}, ${JSON.stringify(legacy)})`);

        // Open the origin without booting the app so the old record is present on first load.
        await window.loadURL(server.base + '/api/health');
        await accessLegacyBook(true);
        const requests = [];
        window.webContents.session.webRequest.onCompleted({ urls: [server.base + '/api/storage/*'] }, response => {
            requests.push({ path: new URL(response.url).pathname, status: response.statusCode });
        });
        await window.loadURL(server.base + '/');
        for (let pass = 0; pass < 2; pass++) {
            if (pass) {
                const loaded = once(window.webContents, 'did-finish-load');
                window.webContents.reload();
                await loaded;
            }
            await waitFor(`document.querySelector('#home-books .home-book-title')?.textContent === ${JSON.stringify(book.title)}`);
            await run("document.querySelector('#home-books .home-book-title').click(); true");
            await waitFor(`document.querySelector('iframe.reader-document')?.contentDocument?.getElementById('book-paper')?.textContent.includes(${JSON.stringify(sqliteText)})`);
        }
        for (const endpoint of ['books/summary', 'books/get']) {
            assert.ok(requests.filter(request => request.path === '/api/storage/' + endpoint && request.status === 200).length >= 2, JSON.stringify(requests));
        }
        assert.ok(requests.every(request => request.status !== 423 && !request.path.includes('/migration/')), JSON.stringify(requests));
        assert.deepEqual(await accessLegacyBook(false), legacy);
        assert.deepEqual(server.read('books', book.id), book);
        return requests;
    } finally {
        window?.destroy();
        await server.close();
    }
}

function legacyBookFixture(write, book) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open('AuraReaderDB', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('books', { keyPath: 'id' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            const transaction = db.transaction('books', write ? 'readwrite' : 'readonly');
            const books = transaction.objectStore('books');
            const request = write ? books.put(book) : books.get(book.id);
            transaction.onabort = () => { db.close(); reject(transaction.error); };
            transaction.oncomplete = () => {
                db.close();
                if (write) localStorage.setItem('aura_sqlite_source', 'unmigrated-browser');
                resolve(request.result);
            };
        };
    });
}

const output = process.argv[2];
checkBrowserStorage(output).then(requests => {
    fs.writeFileSync(path.join(output, 'browser-storage.json'), JSON.stringify({ passed: true, requests }, null, 2));
    console.log('PASS: browser opens and reloads the SQLite book with a conflicting IndexedDB record');
    app.exit(0);
}).catch(error => {
    console.error(error);
    app.exit(1);
});
