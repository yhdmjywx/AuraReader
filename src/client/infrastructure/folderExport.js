import { unwrapDesktop } from './storageClient.js';

export async function saveMarkdownFolder(folderName, files, destination) {
    if (window.auraDesktop) {
        const encoder = new TextEncoder();
        return unwrapDesktop(await window.auraDesktop.files.saveExportFolder({ folderName,
            files: files.map(file => ({ filename: file.filename, bytes: encoder.encode(file.text) })) }));
    }
    const parent = await destination;
    if (!parent) return { status: 'canceled' };
    // Never reuse an existing directory: keep previous exports intact.
    const names = new Set();
    for await (const name of parent.keys()) names.add(name.toLowerCase());
    let name = folderName;
    for (let suffix = 2; names.has(name.toLowerCase()); suffix++) name = `${folderName} (${suffix})`;
    const folder = await parent.getDirectoryHandle(name, { create: true });
    const created = [];
    try {
        for (const file of files) {
            const handle = await folder.getFileHandle(file.filename, { create: true });
            created.push(file.filename);
            const writable = await handle.createWritable();
            try { await writable.write(file.text); await writable.close(); }
            catch (error) { await writable.abort().catch(() => {}); throw error; }
        }
        return { status: 'saved', kind: 'folder', name };
    } catch (error) {
        for (const filename of created) await folder.removeEntry(filename).catch(() => {});
        await parent.removeEntry(name).catch(() => {});
        throw error;
    }
}

saveMarkdownFolder.pick = async () => {
    if (typeof window.showDirectoryPicker !== 'function') throw new Error('当前浏览器不支持文件夹导出，请使用桌面版或支持文件夹保存的浏览器');
    try { return await window.showDirectoryPicker({ mode: 'readwrite', id: 'aurareader-chapters' }); }
    catch (error) { if (error.name === 'AbortError') return null; throw error; }
};
