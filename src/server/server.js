const http = require('http');
const fs = require('fs');
const path = require('path');
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 24 || (nodeMajor === 24 && nodeMinor < 15)) throw new Error('AuraReader 需要 Node.js >= 24.15.0');
const { createDataStore } = require('./dataStore');
const { createStorageApi } = require('./storageApi');
const { createFontStore, listSystemFonts, MAX_FONT_BYTES } = require('./fontStore');
const fontStore = createFontStore(path.resolve(__dirname, '../../data/fonts'));

const PORT = process.env.PORT || 8095;

// MIME Types
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown; charset=utf-8',
    '.epub': 'application/epub+zip',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff2': 'font/woff2'
};

function createServer({ dataDirectory = path.resolve(__dirname, '../../data') } = {}) {
const store = createDataStore(dataDirectory);
const storageApi = createStorageApi(store);
const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/api/storage/')) {
        storageApi(req, res, parsedUrl);
        return;
    }

    // --------------------------------------------------------------------------
    // API Routes
    // --------------------------------------------------------------------------
    if (pathname.startsWith('/api/')) {
        handleApiRequest(req, res, pathname, parsedUrl);
        return;
    }

    // --------------------------------------------------------------------------
    // Static Files Handler
    // --------------------------------------------------------------------------
    // JavaScript is emitted from the mixed TS/JS graph; assets stay in source.
    const CLIENT_DIR = pathname.endsWith('.js')
        ? path.resolve(__dirname, '../../dist/client')
        : path.resolve(__dirname, '../client');
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('400 Bad Request');
        return;
    }

    let safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';

    const filePath = path.resolve(CLIENT_DIR, '.' + (safePath.startsWith('/') || safePath.startsWith('\\') ? safePath : '/' + safePath));
    const relativePath = path.relative(CLIENT_DIR, filePath);

    // Prevent directory traversal outside CLIENT_DIR
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});
server.on('close', () => store.close());
return server;
}

function handleApiRequest(req, res, pathname, parsedUrl) {
    if (pathname.startsWith('/api/fonts')) {
        handleFontRequest(req, res, pathname, parsedUrl).catch(error => {
            if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '字体资源暂时不可用' }));
            console.error('Font API:', error.message);
        });
        return;
    }
    // Health Probe (Docker & monitoring probe)
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString(), uptime: process.uptime() }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '未知 API 路径' }));
}

async function handleFontRequest(req, res, pathname, parsedUrl) {
    const origin = req.headers.origin;
    res.removeHeader('Access-Control-Allow-Origin');
    const reply = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(data));
    };
    // Other websites must not enumerate this PC's fonts or write font files.
    if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
        return reply(403, { error: '只允许从阅读器内访问字体资源' });
    }
    if (req.method === 'GET' && pathname === '/api/fonts') return reply(200, { fonts: await fontStore.list() });
    if (req.method === 'GET' && pathname === '/api/fonts/system') {
        const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        if (!loopback || !['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)) {
            return reply(200, { supported: false, fonts: [] });
        }
        try { return reply(200, await listSystemFonts()); }
        catch (_) { return reply(200, { supported: false, fonts: [] }); }
    }
    if (req.method === 'POST' && pathname === '/api/fonts/import') {
        const filename = parsedUrl.searchParams.get('name') || '';
        if (!/\.(ttf|otf|woff2)$/i.test(filename)) return reply(400, { error: '请选择 TTF、OTF 或 WOFF2 文件' });
        let length = 0;
        const chunks = [];
        for await (const chunk of req) {
            length += chunk.length;
            if (length > MAX_FONT_BYTES) return reply(413, { error: '字体文件超过 64MB' });
            chunks.push(chunk);
        }
        try { return reply(200, { font: await fontStore.import(Buffer.concat(chunks), filename) }); }
        catch (error) { return reply(400, { error: error.message }); }
    }
    if (req.method === 'GET' && pathname.startsWith('/api/fonts/files/')) {
        const file = fontStore.file(pathname.slice('/api/fonts/files/'.length));
        if (!file) return reply(404, { error: '字体不存在' });
        try {
            const bytes = await fs.promises.readFile(file.path);
            res.writeHead(200, { 'Content-Type': file.mime, 'Content-Length': bytes.length, 'Cache-Control': 'no-cache' });
            res.end(bytes);
        } catch (_) { reply(404, { error: '字体文件已缺失' }); }
        return;
    }
    reply(404, { error: '未知字体请求' });
}

if (require.main === module) createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`==================================================`);
    console.log(`🚀 AuraReader Workstation Node.js Web Server Live!`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
module.exports = { createServer };
