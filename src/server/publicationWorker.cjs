const { parentPort } = require('node:worker_threads');
const { createHash } = require('node:crypto');
const { ZipReader, Uint8ArrayReader, Uint8ArrayWriter, configure } = require('@zip.js/zip.js/index-native.js');
configure({ useWebWorkers: false, useCompressionStream: true });
const archives = new Map();
let retainedBytes = 0;
const budget = 32 * 1024 * 1024;
const paths = import('../shared/epubPaths.mjs');

function decodeText(bytes) {
    const big = bytes[0] === 0xfe && bytes[1] === 0xff || bytes[0] === 0 && bytes[1] === 0x3c;
    const little = bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0x3c && bytes[1] === 0;
    return new TextDecoder(big ? 'utf-16be' : little ? 'utf-16le' : 'utf-8').decode(bytes);
}
function deobfuscate(bytes, algorithm, identifier) {
    let key, length;
    if (algorithm === 'http://www.idpf.org/2008/embedding') {
        key = createHash('sha1').update(identifier.replace(/[\x20\x09\x0a\x0d]/g, ''), 'utf8').digest(); length = 1040;
    } else if (algorithm === 'http://ns.adobe.com/pdf/enc#RC') {
        const uuid = identifier.replace(/^urn:uuid:/i, '').replace(/-/g, '');
        if (!/^[a-f0-9]{32}$/i.test(uuid)) throw new Error('The Adobe font identifier is invalid.');
        key = Buffer.from(uuid, 'hex'); length = 1024;
    } else throw new Error('Unsupported EPUB resource encryption.');
    for (let index = 0; index < Math.min(length, bytes.length); index++) bytes[index] ^= key[index % key.length];
    return bytes;
}
async function execute(message) {
    if (message.command === 'open') {
        if (!archives.has(message.key)) {
            const bytes = Buffer.from(message.archive, 'base64');
            const reader = new ZipReader(new Uint8ArrayReader(bytes));
            const entries = new Map((await reader.getEntries()).filter(entry => !entry.directory).map(entry => [entry.filename, entry]));
            while (archives.size && (archives.size >= 2 || retainedBytes + bytes.byteLength > budget)) {
                const oldest = archives.keys().next().value;
                const entry = archives.get(oldest); archives.delete(oldest); retainedBytes -= entry.size;
                await entry.reader.close();
            }
            // A large active publication can be read once without expanding its resources eagerly.
            archives.set(message.key, { reader, entries, size: bytes.byteLength, encryption: message.encryption || [], identifier: message.identifier || '' });
            retainedBytes += bytes.byteLength;
        }
        return true;
    }
    const archive = archives.get(message.key);
    if (!archive) throw new Error('PUBLICATION_EVICTED');
    archives.delete(message.key); archives.set(message.key, archive);
    const entry = archive.entries.get(message.path);
    if (!entry || entry.encrypted || ![0, 8].includes(entry.compressionMethod)) throw new Error('EPUB resource is missing or has unsupported ZIP encoding.');
    let bytes = await entry.getData(new Uint8ArrayWriter());
    const encrypted = archive.encryption.find(item => item.path === message.path);
    if (encrypted) bytes = deobfuscate(bytes, encrypted.algorithm, archive.identifier);
    if (message.mediaType === 'text/css') {
        const { rewriteEpubCss } = await paths;
        bytes = new TextEncoder().encode(rewriteEpubCss(decodeText(bytes).replace(/^\s*@charset\s+["'][^"']+["'];/i, ''), message.bookId, message.path));
    }
    return bytes;
}
parentPort.on('message', async message => {
    try {
        const result = await execute(message);
        parentPort.postMessage({ id: message.id, result }, result instanceof Uint8Array ? [result.buffer] : []);
    } catch (error) { parentPort.postMessage({ id: message.id, error: error instanceof Error ? error.message : String(error) }); }
});
