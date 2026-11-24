const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('../../src/server/server');

async function sqliteServer() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-test-'));
    let server; let base; let token;
    async function start() {
        // Windows can assign ephemeral ports rejected by the bundled Fetch.
        // Retry once on its actual port error so the fixture stays independent
        // of Node's version-specific deny list.
        for (let attempt = 0; ; attempt++) {
            server = createServer({ dataDirectory: directory });
            server.listen(0, '127.0.0.1'); await once(server, 'listening');
            base = `http://127.0.0.1:${server.address().port}`;
            try {
                token = (await (await fetch(base + '/api/storage/session')).json()).token;
                return;
            } catch (error) {
                await stop();
                if (attempt || error.cause?.message !== 'bad port') throw error;
            }
        }
    }
    async function stop() { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; }
    await start();
    const api = {
        directory, get base() { return base; },
        read(table, id) {
            if (!['books', 'annotations'].includes(table)) throw new Error('Invalid test table');
            const { DatabaseSync } = require('node:sqlite');
            const db = new DatabaseSync(path.join(directory, 'aurareader.sqlite'), { readOnly: true });
            try {
                const rows = id == null ? db.prepare(`SELECT * FROM ${table} WHERE deleted=0 ORDER BY id`).all()
                    : db.prepare(`SELECT * FROM ${table} WHERE id=? AND deleted=0`).all(id);
                return id == null ? rows.map(r => JSON.parse(r.payload)) : rows.length ? JSON.parse(rows[0].payload) : undefined;
            } finally { db.close(); }
        },
        async request(route, body, extra = {}) {
            const response = await fetch(base + '/api/storage/' + route, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Aura-Token': token, ...extra },
                body: body === undefined ? undefined : JSON.stringify(body)
            });
            return { status: response.status, ...(await response.json()) };
        },
        async restart() { await stop(); await start(); },
        async close() {
            await stop();
            const target = path.resolve(directory);
            if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-test-')) throw new Error('Unsafe test cleanup');
            await fs.rm(target, { recursive: true, force: true });
        }
    };
    return api;
}
module.exports = { sqliteServer };

// Browser code may fetch same-origin publication URLs. Keep real HTTP and
// resource decoding in Node tests while supplying the browser's URL base.
function browserFetch(base) {
    const fetcher = globalThis.fetch;
    return (input, options) => fetcher(typeof input === 'string' ? new URL(input, base) : input, options);
}
module.exports.browserFetch = browserFetch;

async function clientStorage(books = [], options = {}) {
    const server = await sqliteServer();
    const client = await import('../../dist/client/infrastructure/storageClient.js');
    const data = await import('../../dist/client/infrastructure/demoData.js');
    const builtinBooks = Object.entries(data.demoBooks).map(([id, b]) => ({ id, ...b }));
    const allBooks = [...builtinBooks, ...books];
    const result = await server.request('restore', { opId: require('node:crypto').randomUUID(), books: allBooks, notes: data.getSeedNotes() });
    if (result.status !== 200) throw new Error(JSON.stringify(result));
    const configure = fetcher => client.configureStorage({ baseUrl: server.base + '/api/storage', fetch: fetcher || options.fetch || globalThis.fetch });
    configure();
    await client.initializeStorage();
    server.configureClient = configure;
    server.drain = client.drainStorage;
    server.bufferedNotes = bookId => {
        const notes = new Map(server.read('annotations').filter(n => n.bookId === bookId).map(n => [n.id, n]));
        let pending = [];
        try { pending = JSON.parse(localStorage.getItem('aura_notes_pending_' + bookId) || '[]'); } catch (_) {}
        for (const e of pending) { if (e.operation === 'delete') notes.delete(e.id); else notes.set(e.id, e.note); }
        return [...notes.values()];
    };
    return server;
}
module.exports.clientStorage = clientStorage;
