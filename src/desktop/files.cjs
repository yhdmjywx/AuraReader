const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { StorageError } = require('../server/dataStore.js');
const { createFontStore, listSystemFonts, MAX_FONT_BYTES } = require('../server/fontStore.js');

const MAX_FILE_BYTES = 256 * 1024 * 1024;
const EXPORTS = new Map([['.md', 'Markdown'], ['.zip', 'ZIP'], ['.aurabackup', 'AuraReader 书籍备份']]);
/** @param {string} filename @param {number} limit */
async function readBounded(filename, limit) {
    const handle = await fs.open(filename, 'r');
    try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw new StorageError('请选择普通文件');
        if (!stat.size || stat.size > limit) throw new StorageError('文件为空或超过大小上限', 413);
        const chunks = []; let size = 0;
        for await (const chunk of handle.createReadStream({ autoClose: false })) {
            size += chunk.length;
            if (size > limit) throw new StorageError('文件超过大小上限', 413);
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } finally { await handle.close(); }
}
/** @param {string} filename */
function exportName(filename) {
    const base = path.win32.basename(filename).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '');
    const ext = path.extname(base).toLowerCase();
    if (!EXPORTS.has(ext)) throw new StorageError('不支持的导出文件类型');
    let stem = base.slice(0, -ext.length).slice(0, 160).replace(/[. ]+$/, '') || 'AuraReader';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = '_' + stem;
    return stem + ext;
}
/** @param {string} candidate @param {string} root */
const inside = (candidate, root) => { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };
/** @param {string} filename @param {Uint8Array} bytes @param {string[]} protectedDirectories */
async function writeExport(filename, bytes, protectedDirectories) {
    if (!path.isAbsolute(filename)) throw new StorageError('保存位置无效');
    const directory = await fs.realpath(path.dirname(filename));
    const target = path.join(directory, path.basename(filename));
    for (const root of protectedDirectories) {
        let resolved;
        try { resolved = await fs.realpath(root); } catch (error) {
            if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
            resolved = path.resolve(root);
        }
        if (inside(target, resolved)) throw new StorageError('不能将导出文件保存到应用或书库内部目录', 403);
    }
    try {
        const existing = await fs.lstat(target);
        if (!existing.isFile() || existing.isSymbolicLink()) throw new StorageError('保存位置不是普通文件');
    } catch (error) { if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error; }
    const temporary = path.join(directory, '.aurareader-export-' + randomUUID() + '.tmp');
    try {
        const handle = await fs.open(temporary, 'wx');
        try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
        await fs.rename(temporary, target);
    } finally {
        try { await fs.unlink(temporary); } catch (error) {
            if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') console.error('Export temporary cleanup failed:', error);
        }
    }
}

/** @param {unknown} body */
function folderExportRequest(body) {
    if (!body || typeof body !== 'object') throw new StorageError('无效文件夹导出请求');
    const value = /** @type {{folderName?: unknown, files?: unknown}} */ (body);
    if (Object.keys(value).length !== 2 || typeof value.folderName !== 'string'
        || exportName(value.folderName + '.md') !== value.folderName + '.md'
        || !Array.isArray(value.files) || !value.files.length || value.files.length > 10000) throw new StorageError('无效文件夹导出字段');
    const names = new Set();
    let size = 0;
    const files = value.files.map(entry => {
        if (!entry || typeof entry !== 'object' || Object.keys(entry).length !== 2
            || typeof entry.filename !== 'string' || !entry.filename.endsWith('.md')
            || exportName(entry.filename) !== entry.filename || !(entry.bytes instanceof Uint8Array)
            || !entry.bytes.byteLength) throw new StorageError('无效章节文件');
        const name = entry.filename.toLowerCase();
        if (names.has(name)) throw new StorageError('章节文件名重复');
        names.add(name);
        size += entry.bytes.byteLength;
        if (size > MAX_FILE_BYTES) throw new StorageError('导出内容超过 256MB', 413);
        return { filename: entry.filename, bytes: entry.bytes };
    });
    return { folderName: value.folderName, files };
}

/** @param {string} parent @param {ReturnType<typeof folderExportRequest>} request @param {string[]} protectedDirectories @param {() => void} authorize */
async function writeExportFolder(parent, request, protectedDirectories, authorize) {
    if (!path.isAbsolute(parent)) throw new StorageError('保存位置无效');
    const directory = await fs.realpath(parent);
    const protectedRoots = [];
    for (const root of protectedDirectories) {
        let resolved;
        try { resolved = await fs.realpath(root); }
        catch (error) { if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error; resolved = path.resolve(root); }
        if (inside(directory, resolved)) throw new StorageError('不能将导出文件夹保存到应用或书库内部目录', 403);
        protectedRoots.push(resolved);
    }
    let target = '';
    // mkdir is exclusive: existing folders, files and links are never reused.
    for (let suffix = 0; suffix < 10000; suffix++) {
        authorize();
        const name = request.folderName + (suffix ? ` (${suffix + 1})` : '');
        const candidate = path.join(directory, name);
        if (protectedRoots.some(root => inside(candidate, root))) throw new StorageError('不能将导出文件夹保存到应用或书库内部目录', 403);
        try { await fs.mkdir(candidate); target = candidate; break; }
        catch (error) { if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EEXIST') throw error; }
    }
    if (!target) throw new StorageError('同名文件夹过多，请选择其他位置');
    /** @type {string[]} */ const created = [];
    try {
        for (const file of request.files) {
            authorize();
            const filename = path.join(target, file.filename);
            const handle = await fs.open(filename, 'wx');
            created.push(filename);
            try { await handle.writeFile(file.bytes); await handle.sync(); } finally { await handle.close(); }
        }
        authorize();
        return { status: /** @type {const} */ ('saved'), kind: /** @type {const} */ ('folder'), name: path.basename(target) };
    } catch (error) {
        // Remove only entries created by this request; never recursively remove
        // a user-selected directory or an existing export.
        for (const filename of created) {
            try { await fs.unlink(filename); } catch (cleanup) { console.error('章节导出清理失败:', cleanup); }
        }
        try { await fs.rmdir(target); } catch (cleanup) { console.error('章节导出目录清理失败:', cleanup); }
        throw error;
    }
}

/** @param {{dataDirectory: string, protectedDirectories: string[], dialogs: import('./dialogs.js').DialogPort}} options */
function createFileService({ dataDirectory, protectedDirectories, dialogs }) {
    const fontDirectory = path.join(dataDirectory, 'fonts');
    const fontStore = createFontStore(fontDirectory);
    /** @type {Set<string>} */ const knownFonts = new Set();
    /** @type {Set<Promise<unknown>>} */ const active = new Set();
    let dialogOpen = false;
    /** @param {() => Promise<unknown>} task */
    async function withDialog(task) {
        if (dialogOpen) throw new StorageError('请先完成当前文件对话框', 409);
        dialogOpen = true;
        try { return await task(); } finally { dialogOpen = false; }
    }
    /** @param {import('../shared/desktop.js').DesktopFont} font */
    function mapFont(font) {
        const key = `${font.id}.${font.type}`;
        knownFonts.add(key);
        return { ...font, url: `aurareader://app/user-fonts/${key}` };
    }
    /** @param {'book' | 'backup' | 'font'} kind @param {() => void} authorize */
    async function choose(kind, authorize) {
        const extensions = kind === 'book' ? ['epub', 'txt'] : kind === 'backup' ? ['aurabackup'] : ['ttf', 'otf', 'woff2'];
        const selected = await dialogs.open({ title: kind === 'font' ? '导入阅读字体' : kind === 'book' ? '导入书籍' : '恢复书籍备份',
            filters: [{ name: kind === 'font' ? '字体文件' : kind === 'book' ? 'EPUB / TXT' : 'AuraReader 书籍备份', extensions }],
            properties: ['openFile', 'dontAddToRecent'] });
        authorize();
        if (selected.canceled) return null;
        if (selected.filePaths.length !== 1) throw new StorageError('请选择一个文件');
        const filename = selected.filePaths[0];
        if (!path.isAbsolute(filename) || !extensions.includes(path.extname(filename).slice(1).toLowerCase())) throw new StorageError('文件类型不受支持');
        const bytes = await readBounded(filename, kind === 'font' ? MAX_FONT_BYTES : MAX_FILE_BYTES);
        authorize();
        return { name: path.basename(filename), bytes };
    }
    return {
        /** @param {string} action @param {unknown} body @param {() => void} [authorize] */
        async call(action, body, authorize = () => {}) {
            const task = (async () => {
                authorize();
                if (!['saveExport', 'saveExportFolder'].includes(action) && body !== undefined) throw new StorageError('请求不接受参数');
                if (action === 'listFonts') return { fonts: (await fontStore.list()).map(mapFont) };
                if (action === 'systemFonts') return listSystemFonts();
                return withDialog(async () => {
                    if (action === 'chooseBook' || action === 'chooseBackup') {
                        const file = await choose(action === 'chooseBook' ? 'book' : 'backup', authorize);
                        return file ? { canceled: false, file: { name: file.name, bytes: new Uint8Array(file.bytes) } } : { canceled: true };
                    }
                    if (action === 'importFont') {
                        const file = await choose('font', authorize);
                        if (!file) return { canceled: true };
                        try { return { canceled: false, font: mapFont(await fontStore.import(file.bytes, file.name)) }; }
                        catch (error) {
                            if (/** @type {NodeJS.ErrnoException} */ (error).code) throw error;
                            throw new StorageError(error instanceof Error ? error.message : '字体文件无效', 400);
                        }
                    }
                    if (action === 'saveExportFolder') {
                        const request = folderExportRequest(body);
                        const destination = await dialogs.open({ title: '选择章节导出位置', properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'] });
                        authorize();
                        if (destination.canceled) return { status: 'canceled' };
                        if (destination.filePaths.length !== 1) throw new StorageError('请选择一个文件夹');
                        try { return await writeExportFolder(destination.filePaths[0], request, protectedDirectories, authorize); }
                        catch (error) {
                            if (error instanceof StorageError) throw error;
                            console.error('章节文件夹保存失败:', error);
                            throw new StorageError('章节文件夹保存失败，请检查目录权限和可用空间；未报告保存成功', 500);
                        }
                    }
                    if (action === 'saveExport') {
                        if (!body || typeof body !== 'object') throw new StorageError('无效导出请求');
                        const value = /** @type {{filename?: unknown, bytes?: unknown}} */ (body);
                        if (Object.keys(value).length !== 2 || typeof value.filename !== 'string' || value.filename.length > 1024
                            || !(value.bytes instanceof Uint8Array)) throw new StorageError('无效导出字段');
                        if (!value.bytes.byteLength || value.bytes.byteLength > MAX_FILE_BYTES) throw new StorageError('导出文件为空或超过 256MB', 413);
                        const name = exportName(value.filename);
                        const extension = path.extname(name);
                        const destination = await dialogs.save({ title: '保存导出文件', defaultPath: name,
                            filters: [{ name: EXPORTS.get(extension) || 'AuraReader', extensions: [extension.slice(1)] }],
                            properties: ['showOverwriteConfirmation', 'dontAddToRecent'] });
                        authorize();
                        if (destination.canceled || !destination.filePath) return { status: 'canceled' };
                        if (path.extname(destination.filePath).toLowerCase() !== extension) throw new StorageError('保存文件扩展名必须与导出格式一致');
                        try { await writeExport(destination.filePath, value.bytes, protectedDirectories); }
                        catch (error) {
                            if (error instanceof StorageError) throw error;
                            console.error('Export write failed:', error);
                            throw new StorageError('文件保存失败，请检查目录权限和可用空间；未报告保存成功', 500,
                                { code: /** @type {NodeJS.ErrnoException} */ (error).code });
                        }
                        return { status: 'saved', name: path.basename(destination.filePath) };
                    }
                    throw new StorageError('未知文件能力', 404);
                });
            })();
            active.add(task);
            try { return await task; } finally { active.delete(task); }
        },
        /** @param {string} name */
        async fontResource(name) {
            if (!/^[a-f0-9]{64}\.(ttf|otf|woff2)$/.test(name) || !knownFonts.has(name)) return null;
            const file = fontStore.file(name);
            if (!file) return null;
            const [filename, root] = await Promise.all([fs.realpath(file.path), fs.realpath(fontDirectory)]);
            if (!inside(filename, root)) throw new StorageError('字体位置无效', 403);
            const bytes = await readBounded(filename, MAX_FONT_BYTES);
            if (createHash('sha256').update(bytes).digest('hex') !== name.split('.')[0]) throw new StorageError('字体完整性校验失败');
            return { bytes, type: file.mime };
        },
        async settle() { await Promise.all([...active]); }
    };
}

module.exports = { createFileService, readBounded, writeExport, exportName, MAX_FILE_BYTES };
