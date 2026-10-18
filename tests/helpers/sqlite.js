const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('../../src/server/server');

async function sqliteServer() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-test-'));
    let server; let base; let token;
    async function start() {
        server = createServer({ dataDirectory: directory });
        server.listen(0, '127.0.0.1'); await once(server, 'listening');
        base = `http://127.0.0.1:${server.address().port}`;
        token = (await (await fetch(base + '/api/storage/session')).json()).token;
    }
    async function stop() { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; }
    await start();
    return {
        directory, get base() { return base; },
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
}
module.exports = { sqliteServer };
