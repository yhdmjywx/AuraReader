const { createWikiService } = require('./wikiService.js');
const wiki = createWikiService();

async function handleWikiRequest(req, res, url) {
    res.removeHeader('Access-Control-Allow-Origin');
    const reply = (status, body) => {
        if (res.destroyed) return;
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(body));
    };
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
        return reply(403, { error: 'Wikipedia may only be queried from the reader.' });
    }
    if (req.method !== 'GET' || url.pathname !== '/api/wiki') return reply(405, { error: 'Invalid Wikipedia request.' });
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
        reply(200, await wiki.read(Object.fromEntries(url.searchParams), controller.signal));
    } catch (error) { reply(502, { error: error.message || 'Wikipedia is unavailable. Please try again.' }); }
    finally { res.off('close', cancel); }
}
module.exports = { handleWikiRequest };
