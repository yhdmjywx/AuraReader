const fs = require('node:fs/promises');
const path = require('node:path');

const APP_URL = 'aurareader://app/index.html';
const CSP = [
    "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
    "object-src 'none'", "frame-src 'none'", "frame-ancestors 'none'",
    "base-uri 'none'", "form-action 'none'", "worker-src 'none'"
].join('; ');

/** @param {string} html */
function desktopHtml(html) {
    // Keep the browser source intact. No remote resources execute in desktop.
    const entry = /<script type="module" src="main\.js(?:\?[^\"]*)?"><\/script>/;
    if (!entry.test(html) || !html.includes('</head>')) throw new Error('Browser entry changed; desktop mapping must be reviewed');
    return html.replace(/<link\b[^>]*\bhref="https?:\/\/[^>]*>/gi, '')
        .replace(/<script\b[^>]*\bsrc="https?:\/\/[^>]*><\/script>/gi, '')
        .replace('</head>', '<link rel="stylesheet" href="vendor/remixicon.css">\n' +
            '<link rel="stylesheet" href="desktop-shell.css">\n<script src="vendor/jszip.min.js"></script>\n</head>')
        .replace(entry,
            '<script type="module" src="desktop-shell.js"></script>');
}

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
    const client = path.join(root, 'src/client');
    const emitted = path.join(root, 'dist/client');
    const renderer = path.join(root, 'src/desktop/renderer');
    const icons = path.join(root, 'node_modules/remixicon/fonts');
    add('/index.html', client, 'index.html', 'text/html; charset=utf-8');
    add('/styles.css', client, 'styles.css', 'text/css; charset=utf-8');
    add('/desktop-shell.js', renderer, 'shell.js', 'application/javascript; charset=utf-8');
    add('/desktop-shell.css', renderer, 'shell.css', 'text/css; charset=utf-8');
    add('/vendor/remixicon.css', icons, 'remixicon.css', 'text/css; charset=utf-8');
    add('/vendor/jszip.min.js', path.join(root, 'node_modules/jszip/dist'), 'jszip.min.js', 'application/javascript; charset=utf-8');
    for (const ext of ['woff2', 'woff', 'ttf', 'eot', 'svg']) {
        const type = ({ woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf',
            eot: 'application/vnd.ms-fontobject', svg: 'image/svg+xml' })[ext];
        add(`/vendor/remixicon.${ext}`, icons, `remixicon.${ext}`, type || 'application/octet-stream');
    }
    const fonts = path.join(client, 'assets/fonts');
    for (const entry of await fs.readdir(fonts, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const type = entry.name.endsWith('.woff2') ? 'font/woff2'
            : entry.name === 'fonts.css' ? 'text/css; charset=utf-8'
            : entry.name === 'inventory.json' ? 'application/json; charset=utf-8' : null;
        if (type) add('/assets/fonts/' + entry.name, fonts, entry.name, type);
    }
    // Only emitted JS is exposed, never TS source, package files, data or server modules.
    /** @param {string} directory */
    async function emittedFiles(directory) {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) await emittedFiles(filename);
            else if (entry.isFile() && entry.name.endsWith('.js')) {
                const relative = path.relative(emitted, filename);
                add('/' + relative.split(path.sep).join('/'), emitted, relative, 'application/javascript; charset=utf-8');
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
            const body = name === '/index.html' ? desktopHtml(bytes.toString('utf8')) : bytes;
            return new Response(request.method === 'HEAD' ? null : body,
                { headers: { ...headers, 'Content-Type': resource.type } });
        } catch (error) {
            if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') console.error('Desktop resource read failed:', error);
            return new Response('Resource unavailable', { status: 404, headers });
        }
    };
}

module.exports = { APP_URL, CSP, desktopHtml, resourcePath, createAssetHandler };
