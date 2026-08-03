const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8095;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'aura_sync_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load or initialize DB
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("⚠️ 读取云端数据库失败，将自动重建初始化:", e);
    }
    return { users: {} };
}

// Atomic save DB
function saveDB(dbData) {
    try {
        const tmpFile = DB_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(dbData, null, 2), 'utf8');
        fs.renameSync(tmpFile, DB_FILE);
        return true;
    } catch (e) {
        console.error("❌ 保存云端数据库失败:", e);
        return false;
    }
}

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Secret');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // --------------------------------------------------------------------------
    // API Routes (/api/sync)
    // --------------------------------------------------------------------------
    if (pathname.startsWith('/api/')) {
        handleApiRequest(req, res, pathname, parsedUrl);
        return;
    }

    // --------------------------------------------------------------------------
    // Static Files Handler
    // --------------------------------------------------------------------------
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';

    const filePath = path.join(__dirname, safePath);

    // Prevent directory traversal outside root
    if (!filePath.startsWith(__dirname)) {
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

// Helper for parsing JSON request body
function parseJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 20 * 1024 * 1024) { // 20MB limit
            req.destroy();
        }
    });
    req.on('end', () => {
        try {
            const data = body ? JSON.parse(body) : {};
            callback(null, data);
        } catch (e) {
            callback(e, null);
        }
    });
}

function handleApiRequest(req, res, pathname, parsedUrl) {
    const secret = req.headers['x-sync-secret'] || parsedUrl.searchParams.get('secret');

    // Health Probe
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString(), uptime: process.uptime() }));
        return;
    }

    // Require secret key for sync API
    if (!secret || secret.trim().length < 3) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '缺少有效的同步密钥 (X-Sync-Secret / secret)' }));
        return;
    }

    const secretKey = secret.trim();

    // GET /api/sync/pull - 拉取云端数据
    if (req.method === 'GET' && pathname === '/api/sync/pull') {
        const db = loadDB();
        const userData = db.users[secretKey] || { notes: [], booksMeta: {}, lastUpdated: null };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            notes: userData.notes || [],
            booksMeta: userData.booksMeta || {},
            lastUpdated: userData.lastUpdated
        }));
        return;
    }

    // POST /api/sync/push - 推送更新划线/随笔至云端
    if (req.method === 'POST' && pathname === '/api/sync/push') {
        parseJsonBody(req, (err, data) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '请求数据格式有误 (Invalid JSON)' }));
                return;
            }

            const db = loadDB();
            if (!db.users[secretKey]) {
                db.users[secretKey] = { notes: [], booksMeta: {}, lastUpdated: null };
            }

            // Merge or update notes & metadata
            if (Array.isArray(data.notes)) {
                db.users[secretKey].notes = data.notes;
            }
            if (data.booksMeta && typeof data.booksMeta === 'object') {
                db.users[secretKey].booksMeta = Object.assign(db.users[secretKey].booksMeta || {}, data.booksMeta);
            }
            db.users[secretKey].lastUpdated = new Date().toISOString();

            const saved = saveDB(db);

            res.writeHead(saved ? 200 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: saved,
                count: (db.users[secretKey].notes || []).length,
                lastUpdated: db.users[secretKey].lastUpdated,
                error: saved ? null : '保存云端数据库失败'
            }));
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '未知 API 路径' }));
}

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 AuraReader Workstation Node.js Web Server Live!`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`☁️ SQLite Cloud Sync API 路由就绪: /api/sync`);
    console.log(`==================================================`);
});
