const fs = require('node:fs/promises');
const path = require('node:path');

const APP_URL = 'aurareader://app/index.html';
const CSP = [
    "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
    "object-src 'none'", "frame-src 'none'", "frame-ancestors 'none'",
    "base-uri 'none'", "form-action 'none'", "worker-src 'none'"
].join('; ');

/** @param {string} raw */
function resourcePath(raw) {
    const url = new URL(raw);
    if (url.protocol !== 'aurareader:' || url.hostname !== 'app' || url.port || url.username || url.password) {
        throw new Error('Untrusted resource origin');
    }
    const decoded = decodeURIComponent(url.pathname);
    if (/[\\\u0000:]/.test(decoded) || decoded.split('/').some(part => part === '..' || part === '.')) {
        throw new Error('Invalid resource path');
    }
    return decoded === '/' ? '/index.html' : decoded;
}

/** @param {string} root @param {(name: string) => Promise<{bytes: Uint8Array, type: string} | null>} [fontResource] */
async function createAssetHandler(root, fontResource) {
    /** @type {Map<string, {filename: string, root: string, type: string}>} */
    const files = new Map();
    /** @param {string} url @param {string} directory @param {string} filename @param {string} type */
    const add = (url, directory, filename, type) => files.set(url,
        { filename: path.join(directory, filename), root: directory, type });
    const emitted = path.join(root, 'dist/renderer');
    const types = new Map([
        ['.html', 'text/html; charset=utf-8'], ['.js', 'application/javascript; charset=utf-8'],
        ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
        ['.woff2', 'font/woff2'], ['.woff', 'font/woff'], ['.ttf', 'font/ttf'], ['.otf', 'font/otf'],
        ['.eot', 'application/vnd.ms-fontobject'], ['.svg', 'image/svg+xml'],
        ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.ico', 'image/x-icon']
    ]);
    // Browser and desktop consume the same Vite output, including hashed chunks.
    /** @param {string} directory */
    async function emittedFiles(directory) {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) await emittedFiles(filename);
            else if (entry.isFile() && types.has(path.extname(entry.name))) {
                const relative = path.relative(emitted, filename);
                add('/' + relative.split(path.sep).join('/'), emitted, relative, types.get(path.extname(entry.name)) || 'application/octet-stream');
            }
        }
    }
    await emittedFiles(emitted);
    /** @param {{url: string, method: string}} request */
    return async request => {
        const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' };
        if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers });
        let name;
        try { name = resourcePath(request.url); }
        catch { return new Response('Forbidden', { status: 403, headers }); }
        if (name.startsWith('/user-fonts/') && fontResource) {
            try {
                const font = await fontResource(name.slice('/user-fonts/'.length));
                if (font) return new Response(request.method === 'HEAD' ? null : new Uint8Array(font.bytes).buffer,
                    { headers: { ...headers, 'Content-Type': font.type } });
            } catch (error) { console.error('Desktop font resource failed:', error); }
            return new Response('Font unavailable', { status: 404, headers });
        }
        const resource = files.get(name);
        if (!resource) return new Response('Not found', { status: 404, headers });
        try {
            const [filename, directory] = await Promise.all([fs.realpath(resource.filename), fs.realpath(resource.root)]);
            const relative = path.relative(directory, filename);
            if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resource outside root');
            const bytes = await fs.readFile(filename);
            return new Response(request.method === 'HEAD' ? null : bytes,
                { headers: { ...headers, 'Content-Type': resource.type } });
        } catch (error) {
            if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') console.error('Desktop resource read failed:', error);
            return new Response('Resource unavailable', { status: 404, headers });
        }
    };
}

module.exports = { APP_URL, CSP, resourcePath, createAssetHandler };
