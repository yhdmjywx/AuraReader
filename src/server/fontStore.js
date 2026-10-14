const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fontkit = require('fontkit');

const MAX_FONT_BYTES = 64 * 1024 * 1024;
const FONT_MIME = { ttf: 'font/ttf', otf: 'font/otf', woff2: 'font/woff2' };

function inspectFont(bytes, filename) {
    const extension = path.extname(filename).slice(1).toLowerCase();
    if (!FONT_MIME[extension]) throw new Error('请选择 TTF、OTF 或 WOFF2 字体文件');
    if (!bytes.length || bytes.length > MAX_FONT_BYTES) throw new Error('字体文件为空或超过 64MB');
    const signature = bytes.subarray(0, 4).toString('latin1');
    const type = signature === 'wOF2' ? 'woff2' : signature === 'OTTO' ? 'otf'
        : (bytes.length >= 4 && bytes.readUInt32BE(0) === 0x00010000) ? 'ttf' : '';
    if (type !== extension) throw new Error('文件内容不是所声明的字体格式');
    let font;
    try {
        font = fontkit.create(bytes);
        if (!font.familyName || !font.numGlyphs || !font.characterSet.length) throw new Error();
    } catch (_) { throw new Error('无法读取字体，文件可能损坏'); }
    const id = crypto.createHash('sha256').update(bytes).digest('hex');
    const weightAxis = font.variationAxes && font.variationAxes.wght;
    return {
        id, type, name: String(font.fullName || font.familyName).slice(0, 160),
        family: String(font.familyName).slice(0, 160),
        weight: weightAxis ? `${weightAxis.min} ${weightAxis.max}` : '400',
        size: bytes.length, filename: path.basename(filename),
        url: `/api/fonts/files/${id}.${type}`
    };
}

function createFontStore(directory) {
    const root = path.resolve(directory);
    return {
        async list() {
            let files;
            try { files = await fs.readdir(root); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
            const result = [];
            for (const name of files.filter(name => /^[a-f0-9]{64}\.json$/.test(name))) {
                try {
                    const item = JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
                    if (item.id !== name.slice(0, -5) || !FONT_MIME[item.type]) continue;
                    await fs.access(path.join(root, `${item.id}.${item.type}`));
                    result.push(item);
                } catch (_) { /* A missing or damaged font must not block the reader. */ }
            }
            return result.sort((a, b) => a.name.localeCompare(b.name));
        },
        async import(bytes, filename) {
            const item = inspectFont(bytes, filename);
            await fs.mkdir(root, { recursive: true });
            try { await fs.writeFile(path.join(root, `${item.id}.${item.type}`), bytes, { flag: 'wx' }); }
            catch (error) { if (error.code !== 'EEXIST') throw error; }
            const temporary = path.join(root, `${item.id}.${crypto.randomBytes(6).toString('hex')}.tmp`);
            await fs.writeFile(temporary, JSON.stringify(item));
            await fs.rename(temporary, path.join(root, `${item.id}.json`));
            return item;
        },
        file(name) {
            if (!/^[a-f0-9]{64}\.(ttf|otf|woff2)$/.test(name)) return null;
            return { path: path.join(root, name), mime: FONT_MIME[name.split('.').pop()] };
        }
    };
}

async function listSystemFonts() {
    if (process.platform !== 'win32') return { supported: false, fonts: [] };
    const script = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); Add-Type -AssemblyName System.Drawing; $fontCollection = [System.Drawing.Text.InstalledFontCollection]::new(); ConvertTo-Json -InputObject @($fontCollection.Families | ForEach-Object { $_.Name } | Sort-Object -Unique) -Compress';
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024
    });
    return { supported: true, fonts: JSON.parse(stdout.replace(/^\uFEFF/, '').trim()) };
}

module.exports = { createFontStore, inspectFont, listSystemFonts, MAX_FONT_BYTES };
