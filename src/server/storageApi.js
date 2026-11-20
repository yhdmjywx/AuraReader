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
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new StorageError("The request must use JSON.", 415);
    let size = 0; const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_JSON_BYTES) throw new StorageError("Data exceeds the 256 MB request limit.", 413);
        chunks.push(chunk);
    }
    try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        return value;
    }
    catch (_) { throw new StorageError("Invalid JSON."); }
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
            if (!localRequest(req)) throw new StorageError("Only the local reader may access the database.", 403);
            if (req.method === 'GET' && url.pathname === '/api/storage/session') return reply(200, { token });
            if (req.headers['x-aura-token'] !== token) throw new StorageError("Invalid database session.", 403);
            if (req.method === 'GET' && url.pathname === '/api/storage/books') return reply(200, { records: store.books() });
            if (req.method === 'GET' && url.pathname === '/api/storage/books/summary') return reply(200, { records: store.bookSummaries() });
            if (req.method === 'GET' && url.pathname === '/api/storage/goals/library') return reply(200, store.goalLibrary());
            if (req.method === 'POST') {
                const body = await readJson(req);
                const actions = {
                    '/api/storage/books/get': () => ({ record: store.book(body.id) }),
                    '/api/storage/books/save': () => store.saveBook(body),
                    '/api/storage/books/delete': () => store.deleteBook(body),
                    '/api/storage/goals/query': () => ({ records: store.goals(body.bookIds) }),
                    '/api/storage/goals/save': () => store.saveGoals(body),
                    '/api/storage/goals/library/save': () => store.saveGoalLibrary(body),
                    '/api/storage/notes/query': () => ({ records: store.notes(body.bookIds) }),
                    '/api/storage/notes/save': () => store.saveNote(body),
                    '/api/storage/notes/delete': () => store.deleteNote(body),
                    '/api/storage/restore': () => store.restore(body)
                };
                if (actions[url.pathname]) return reply(200, actions[url.pathname]());
            }
            throw new StorageError("Unknown database request.", 404);
        } catch (error) {
            if (!error.status) console.error('Storage API:', error);
            reply(error.status || 500, { error: error.status ? error.message : "Database operation failed. Existing data has been preserved.", details: error.details });
        }
    };
}
module.exports = { createStorageApi, localRequest, readJson };
