const { createPublicationWorker } = require('./publicationWorkerClient.js');

const RESOURCE_PREFIX = '/api/publications/';
const RESOURCE_CSP = "default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; sandbox";

/** @typedef {{revision: number, key: string, manifest: import('../client/domain/book.js').EpubPackage['manifest']}} CachedPublication */
/** Shared HTTP/custom-protocol access to original publication resources.
 * @param {() => ReturnType<import('./dataStore.js').createDataStore>} getStore */
function createPublicationResources(getStore) {
    /** @type {Map<string, CachedPublication>} */
    const cache = new Map();
    /** @type {Map<string, Promise<CachedPublication | null>>} */
    const pending = new Map();
    const worker = createPublicationWorker();
    /** @type {Map<string, Uint8Array>} */
    const byteCache = new Map();
    /** @type {Map<string, Promise<Uint8Array>>} */
    const reading = new Map();
    let byteSize = 0;
    const byteBudget = 8 * 1024 * 1024;
    /** @param {string} key @param {string} path @param {string} mediaType @param {string} bookId */
    async function readResource(key, path, mediaType, bookId) {
        const resourceKey = JSON.stringify([key, path]);
        const cached = byteCache.get(resourceKey);
        if (cached) { byteCache.delete(resourceKey); byteCache.set(resourceKey, cached); return cached; }
        const activeRead = reading.get(resourceKey);
        if (activeRead) return activeRead;
        const operation = worker.request({ command: 'read', key, path, mediaType, bookId }).then(bytes => {
            if (bytes.byteLength <= byteBudget) {
                while (byteCache.size && byteSize + bytes.byteLength > byteBudget) {
                    const oldest = byteCache.keys().next().value;
                    if (oldest === undefined) break;
                    byteSize -= byteCache.get(oldest)?.byteLength || 0; byteCache.delete(oldest);
                }
                byteCache.set(resourceKey, bytes); byteSize += bytes.byteLength;
            }
            return bytes;
        });
        reading.set(resourceKey, operation);
        try { return await operation; } finally { reading.delete(resourceKey); }
    }

    /** @param {string} id @param {number} revision @param {ReturnType<import('./dataStore.js').createDataStore>} store */
    async function load(id, revision, store) {
        const cached = cache.get(id);
        if (cached?.revision === revision) {
            cache.delete(id); cache.set(id, cached);
            return cached;
        }
        if (cached) cache.delete(id);
        const key = JSON.stringify([id, revision]);
        if (pending.has(key)) return pending.get(key);
        const operation = (async () => {
            const row = store.one('SELECT payload FROM books WHERE id=? AND deleted=0 AND revision=?', id, revision);
            const epub = row && /** @type {import('../client/domain/book.js').Book} */ (JSON.parse(String(row.payload))).epub;
            if (epub?.version !== 1 || typeof epub.archive !== 'string') return null;
            await worker.request({ command: 'open', key, archive: epub.archive, encryption: epub.encryption, identifier: epub.identifier });
            const current = store.one('SELECT revision, deleted FROM books WHERE id=?', id);
            if (!current || current.deleted || Number(current.revision) !== revision) return null;
            const entry = { revision, key, manifest: epub.manifest };
            if (cache.size >= 2) cache.delete(cache.keys().next().value || '');
            cache.set(id, entry);
            return entry;
        })();
        pending.set(key, operation);
        try { return await operation; } finally { pending.delete(key); }
    }

    return {
        /** @param {{url: string, method: string}} request */
        async respond(request) {
            const headers = { 'Content-Security-Policy': RESOURCE_CSP, 'X-Content-Type-Options': 'nosniff',
                'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-store' };
            /** @param {number} status @param {BodyInit | null} [body] @param {Record<string, string>} [extra] */
            const reply = (status, body = null, extra = {}) => new Response(request.method === 'HEAD' ? null : body,
                { status, headers: { ...headers, ...extra } });
            if (!['GET', 'HEAD'].includes(request.method)) return reply(405);
            try {
                const url = new URL(request.url);
                if (!url.pathname.startsWith(RESOURCE_PREFIX)) return reply(404);
                const [key, ...segments] = url.pathname.slice(RESOURCE_PREFIX.length).split('/');
                if (!/^[A-Za-z0-9_-]+$/.test(key)) return reply(400);
                const id = Buffer.from(key, 'base64url').toString('utf8');
                if (Buffer.from(id).toString('base64url') !== key) return reply(400);
                const path = segments.map(decodeURIComponent).join('/');
                if (!path || /[\\\u0000]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) return reply(400);
                const store = getStore();
                const row = store.one('SELECT revision, deleted FROM books WHERE id=?', id);
                if (!row || row.deleted) {
                    const old = cache.get(id);
                    if (old) cache.delete(id);
                    return reply(404);
                }
                let publication = await load(id, Number(row.revision), store);
                const item = publication?.manifest?.find(item => item.path === path);
                if (!publication || !item) return reply(404);
                /** @type {Uint8Array} */
                let bytes;
                const read = () => readResource(publication?.key || '', path, item.mediaType, id);
                try { bytes = await read(); }
                catch (error) {
                    if (!(error instanceof Error) || error.message !== 'PUBLICATION_EVICTED') throw error;
                    cache.delete(id); publication = await load(id, Number(row.revision), store);
                    if (!publication) return reply(409);
                    bytes = await read();
                }
                // A deletion/reimport during decompression invalidates this response.
                const current = store.one('SELECT revision, deleted FROM books WHERE id=?', id);
                if (!current || current.deleted || current.revision !== row.revision) return reply(409);
                return reply(200, new Uint8Array(bytes).buffer, { 'Content-Type': item.mediaType === 'text/css' ? 'text/css; charset=utf-8' : item.mediaType || 'application/octet-stream',
                    'Content-Length': String(bytes.byteLength) });
            } catch (error) {
                console.error('Publication resource unavailable:', error instanceof Error ? error.message : String(error));
                return reply(404);
            }
        },
        clear() { cache.clear(); byteCache.clear(); byteSize = 0; worker.close(); }
    };
}

module.exports = { RESOURCE_PREFIX, RESOURCE_CSP, createPublicationResources };
