const { randomUUID } = require('node:crypto');
const { StorageError } = require('./dataStore');

const MAX_JSON_BYTES = 256 * 1024 * 1024;
function localRequest(req) {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    let url;
    try { url = new URL(`http://${req.headers.host}`); } catch (_) { return false; }
    if (!local || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    return !req.headers.origin || req.headers.origin === url.origin;
}
async function readJson(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new StorageError('请求必须使用 JSON', 415);
    let size = 0; const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_JSON_BYTES) throw new StorageError('数据超过单次 256MB 上限，请保留原数据并分批迁移', 413);
        chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch (_) { throw new StorageError('无效 JSON'); }
}
function createStorageApi(store) {
    const token = randomUUID();
    return async (req, res, url) => {
        const reply = (status, body) => {
            res.removeHeader('Access-Control-Allow-Origin');
            res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        };
        try {
            if (!localRequest(req)) throw new StorageError('只允许本机阅读器访问数据库', 403);
            if (req.method === 'GET' && url.pathname === '/api/storage/session') return reply(200, { token });
            if (req.headers['x-aura-token'] !== token) throw new StorageError('无效的数据库会话', 403);
            if (req.method === 'GET' && url.pathname === '/api/storage/books') return reply(200, { records: store.books() });
            if (req.method === 'POST') {
                const body = await readJson(req);
                const actions = {
                    '/api/storage/books/save': () => store.saveBook(body),
                    '/api/storage/books/delete': () => store.deleteBook(body),
                    '/api/storage/notes/query': () => ({ records: store.notes(body.bookIds) }),
                    '/api/storage/notes/save': () => store.saveNote(body),
                    '/api/storage/notes/delete': () => store.deleteNote(body),
                    '/api/storage/restore': () => store.restore(body)
                };
                if (actions[url.pathname]) return reply(200, actions[url.pathname]());
            }
            throw new StorageError('未知数据库请求', 404);
        } catch (error) {
            if (!error.status) console.error('Storage API:', error);
            reply(error.status || 500, { error: error.status ? error.message : '数据库操作失败，原数据未清除', details: error.details });
        }
    };
}
module.exports = { createStorageApi, localRequest, readJson };
