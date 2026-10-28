const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<body></body>');
    const keys = ['window', 'document', 'NodeFilter'];
    const old = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
    try {
        for (const key of keys) globalThis[key] = dom.window[key];
        const { exportChapters, buildChapterDocuments } = await import('../../dist/client/infrastructure/exporters.js');
        const directories = new Map();
        let fail = false, picks = 0;
        const parent = {
            async *keys() { yield* directories.keys(); },
            async getDirectoryHandle(name) {
                if (!directories.has(name)) directories.set(name, new Map());
                const files = directories.get(name);
                return {
                    async getFileHandle(filename) {
                        files.set(filename, '');
                        return { async createWritable() { return {
                            async write(text) { if (fail && filename === '02_第二章.md') throw new Error('write denied'); files.set(filename, text); },
                            async close() {}, async abort() {}
                        }; } };
                    },
                    async removeEntry(filename) { files.delete(filename); }
                };
            },
            async removeEntry(name) { assert.equal(directories.get(name).size, 0); directories.delete(name); }
        };
        window.showDirectoryPicker = async options => { picks++; assert.equal(options.mode, 'readwrite'); return parent; };
        const book = { id: 'browser', title: '浏览器导出', pages: ['<h1>第一章</h1><p>第一章正文😀</p>', '<h1>第二章</h1><p>第二章正文</p>'],
            toc: [{ title: '第一章', page: 1 }, { title: '第二章', page: 2 }] };
        const notes = [{ id: 'n', kind: 'note', bookId: book.id, page: 2, quote: '第二章正文', comment: '章节笔记' }];
        const saved = await exportChapters(book, notes);
        assert.deepEqual(saved, { status: 'saved', kind: 'folder', name: '浏览器导出_章节导出' });
        const files = directories.get(saved.name);
        assert.equal(files.size, 3);
        assert.match(files.get('02_第二章.md'), /章节笔记/);
        const again = await exportChapters(book, notes);
        assert.equal(again.name, '浏览器导出_章节导出 (2)');
        assert.equal(directories.get(saved.name), files);
        window.showDirectoryPicker = async () => { throw new dom.window.DOMException('cancel', 'AbortError'); };
        assert.equal((await exportChapters(book, notes)).status, 'canceled');
        assert.equal(directories.size, 2);
        window.showDirectoryPicker = async () => parent;
        fail = true;
        await assert.rejects(exportChapters(book, notes), /write denied/);
        assert.equal(directories.size, 2, '写入失败移除本次创建的文件和空文件夹');
        let blob, filename;
        URL.createObjectURL = value => { blob = value; return 'blob:single'; }; URL.revokeObjectURL = () => {};
        dom.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
        const single = await exportChapters(book, notes, { selectedUnitIds: ['source-2'] });
        assert.equal(single.status, 'download-requested'); assert.equal(single.kind, 'file');
        assert.match(filename, /\.md$/); assert.match(await blob.text(), /章节笔记/);
        assert.ok(!(await blob.text()).includes('第一章正文'));
        delete window.showDirectoryPicker;
        await assert.rejects(exportChapters(book, notes), /当前浏览器不支持文件夹导出/);
        assert.equal(picks, 2);
        const long = buildChapterDocuments({ ...book, title: 'A' + '😀'.repeat(80), toc: [{ title: 'B' + '😀'.repeat(80), page: 1 }] });
        assert.doesNotThrow(() => long.files.forEach(file => encodeURIComponent(file.filename)), '长标题截断不拆开 Unicode 代理对，目录链接仍可编码');
        console.log('PASS: browser folder permission, Markdown and notes, collision suffix, cancel, rollback, single .md, unsupported browser feedback');
    } finally {
        URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
        dom.window.close();
        for (const [key, descriptor] of old) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
