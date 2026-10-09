const http = require('http');
const fs = require('fs');
const path = require('path');

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
    '.epub': 'application/epub+zip'
};

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
    const CLIENT_DIR = path.resolve(__dirname, '../client');
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';

    const filePath = path.join(CLIENT_DIR, safePath);

    // Prevent directory traversal outside CLIENT_DIR
    if (!filePath.startsWith(CLIENT_DIR)) {
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

function handleApiRequest(req, res, pathname, parsedUrl) {
    // Health Probe (Docker & monitoring probe)
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString(), uptime: process.uptime() }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '未知 API 路径' }));
}

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 AuraReader Workstation Node.js Web Server Live!`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
