const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');

(async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-test-'));
    let child; let base; let token;
    async function start() {
        child = fork(path.join(__dirname, '../helpers/sqlite_child.cjs'), [directory], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
        const error = [];
        child.stderr.on('data', data => error.push(String(data)));
        const port = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('SQLite child startup timeout')), 10000);
            child.once('message', message => { clearTimeout(timer); resolve(message.port); });
            child.once('error', reject);
            child.once('exit', code => { clearTimeout(timer); reject(new Error(`Child exited ${code}: ${error.join('')}`)); });
        });
        base = `http://127.0.0.1:${port}/api/storage/`;
        token = (await (await fetch(base + 'session')).json()).token;
    }
    async function request(route, body) {
        const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Aura-Source': 'restart', 'X-Aura-Token': token }, body: body ? JSON.stringify(body) : undefined });
        const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
    }
    try {
        await start();
        const book = { id: 'restart', pages: ['<p>原文😀</p>', '<p>' + '章节正文'.repeat(150000) + '</p>'], extension: { unknown: [null, true] } };
        const note = { id: 'n', bookId: book.id, kind: 'note', quote: '原文😀', comment: '跨进程保留\n', location: { start: 0, end: 4 } };
        const snapshot = { origin: '', indexedDB: { books: [book], notes: [note] }, caches: {}, pending: {}, builtins: { books: [], notes: [] } };
        const saved = await request('migration/snapshot', snapshot);
        await request('migration/commit', saved);
        const first = await request('notes/query', { bookIds: ['restart'] });
        const bookRow = (await request('books')).records[0];
        const gracefullyExited = once(child, 'exit');
        child.send('close');
        assert.equal((await gracefullyExited)[0], 0);
        await start();
        assert.deepEqual((await request('books')).records[0].value, book);
        assert.deepEqual((await request('notes/query', { bookIds: ['restart'] })).records[0].value, note);
        await request('notes/save', { opId: randomUUID(), expected: first.records[0].revision, generation: bookRow.generation, note: { ...note, comment: '强制终止前已确认\n' } });
        const exited = once(child, 'exit'); child.kill(); await exited;
        await start();
        assert.deepEqual((await request('books')).records[0].value, book);
        assert.equal((await request('notes/query', { bookIds: ['restart'] })).records[0].value.comment, '强制终止前已确认\n');
        assert.equal((await request('migration/status')).completed, true);
        console.log('✅ SQLite 进程持久化：真实 Node.js 正常退出及强制终止／重启、大章节 HTML、完整字段及已确认笔记保留通过');
    } finally {
        if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-test-')) throw new Error('Unsafe cleanup');
        await fs.rm(target, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
