const assert = require('assert');

(async () => {
    const { exportSelectiveBackup, parseBackupFile } = await import('../../src/client/infrastructure/exporters.js');
    const { BackupController } = await import('../../src/client/features/backup/backupController.js');
    const { getIncludeOptions } = await import('../../src/client/features/backup/backupModalUI.js');
    const { setDB, demoBooks } = await import('../../src/client/infrastructure/bookRepository.js');

    const downloads = [];
    const blobs = new Map();
    const localData = new Map();
    const originals = Object.fromEntries(
        ['window', 'document', 'FileReader', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
    );
    const originalCreateUrl = URL.createObjectURL;
    const originalRevokeUrl = URL.revokeObjectURL;
    const bookA = { id: 'backup-test-a', title: '书籍A:/测试', format: 'EPUB', pages: ['<p>书籍A正文</p>'], toc: [{ title: '第一章', page: 1 }] };
    const bookB = { id: 'backup-test-b', title: '书籍B', format: 'EPUB', pages: ['<p>书籍B正文</p>'], toc: [] };
    const notes = [
        { id: 'backup-test-highlight', bookId: bookA.id, quote: '书籍A', page: 1, location: { page: 1, start: 0, end: 3 } },
        { id: 'backup-test-note', bookId: bookB.id, kind: 'note', quote: '书籍B', comment: '我的笔记', page: 1 },
        { id: 'backup-test-other', bookId: 'another-book', quote: '其他书', page: 1 }
    ];
    const stores = { books: new Map([[bookB.id, bookB]]), notes: new Map(notes.map(note => [note.id, note])) };

    try {
        globalThis.window = {};
        globalThis.document = {
            body: { appendChild() {}, removeChild() {} },
            createElement(tag) {
                assert.strictEqual(tag, 'a');
                return { click() { downloads.push({ filename: this.download, blob: blobs.get(this.href) }); } };
            }
        };
        URL.createObjectURL = blob => {
            const url = `blob:backup-test-${blobs.size}`;
            blobs.set(url, blob);
            return url;
        };
        URL.revokeObjectURL = () => {};
        globalThis.FileReader = class {
            readAsText(file) {
                file.text().then(result => this.onload({ target: { result } }), error => this.onerror(error));
            }
        };
        globalThis.localStorage = {
            getItem: key => localData.get(key) ?? null,
            setItem: (key, value) => localData.set(key, String(value))
        };
        setDB({
            transaction() {
                const tx = {};
                tx.objectStore = name => ({
                    put(value) {
                        stores[name].set(value.id, structuredClone(value));
                        queueMicrotask(() => tx.oncomplete());
                    },
                    getAll() {
                        const request = {};
                        queueMicrotask(() => {
                            request.result = Array.from(stores[name].values());
                            request.onsuccess();
                        });
                        return request;
                    }
                });
                return tx;
            }
        });

        exportSelectiveBackup({ selectedBooks: [bookA, bookB], notes, settings: { fontSize: 24, appTheme: 'dark' } });
        assert.strictEqual(downloads.length, 2, '选中两本书必须下载两个独立文件');
        const payloads = await Promise.all(downloads.map(item => parseBackupFile(item.blob)));
        payloads.forEach((payload, index) => {
            const book = [bookA, bookB][index];
            assert.deepStrictEqual(payload.books, [book], '每个文件必须完整保留且只包含对应书籍');
            assert.deepStrictEqual(payload.notes.map(note => note.id), [notes[index].id], '每个文件只能包含对应书籍的标注');
            assert.ok(!Object.hasOwn(payload, 'settings'), '即使旧调用传入设置，也不得写入备份');
            assert.strictEqual(payload.type, 'aurareader_full_backup');
            assert.ok(downloads[index].filename.endsWith('.aurabackup'));
            assert.ok(!/[\\/:*?"<>|]/.test(downloads[index].filename), '书名中的非法文件名字符必须替换');
        });
        assert.strictEqual(payloads[0].notes[0].kind, 'highlight');
        assert.strictEqual(payloads[0].notes[0].location.start, 0);
        assert.strictEqual(payloads[0].notes[0].location.end, 3);
        assert.strictEqual(payloads[1].notes[0].comment, '我的笔记');

        exportSelectiveBackup({ selectedBooks: [bookA], notes: [] });
        assert.deepStrictEqual((await parseBackupFile(downloads[2].blob)).notes, [], '不包含笔记时仍应生成可恢复的书籍备份');
        exportSelectiveBackup({ selectedBooks: [], notes });
        assert.strictEqual(downloads.length, 3, '未选择书籍时不得下载文件');
        assert.deepStrictEqual(getIncludeOptions({ chkBackupIncludeNotes: { checked: false } }), { includeNotes: false });

        const restored = [];
        const messages = [];
        const controller = new BackupController({ callbacks: {
            onRestoreBackup: result => restored.push(result),
            showToast: message => messages.push(message)
        } });
        controller.availableBackupBooks = [bookA, bookB];
        controller.elements = {
            backupBookCheckboxList: {
                querySelectorAll: () => [bookA, bookB].map(book => ({ getAttribute: () => book.id }))
            },
            chkBackupIncludeNotes: { checked: true }
        };
        await controller.executeSelectiveBackupExport();
        assert.strictEqual(downloads.length, 5, '真实控制器批量导出也必须按书生成文件');
        const controllerPayloads = await Promise.all(downloads.slice(3).map(item => parseBackupFile(item.blob)));
        controllerPayloads.forEach((payload, index) => {
            assert.strictEqual(payload.books.length, 1);
            assert.deepStrictEqual(payload.notes.map(note => note.id), [notes[index].id]);
            assert.ok(!Object.hasOwn(payload, 'settings'));
        });

        stores.notes.set(notes[0].id, { ...notes[0], quote: '过时的标注' });
        await controller.importFullBackup(downloads[0].blob);
        assert.deepStrictEqual(stores.books.get(bookA.id), bookA, '新格式必须能通过真实恢复控制器写回书籍');
        assert.strictEqual(stores.notes.get(notes[0].id).quote, '书籍A', '相同 ID 的标注应恢复为备份内容');
        assert.deepStrictEqual(stores.books.get(bookB.id), bookB, '恢复一本书不得影响其他书籍');
        assert.strictEqual(stores.notes.get(notes[1].id).comment, '我的笔记');
        assert.strictEqual(restored[0].importedBooksCount, 1);
        assert.strictEqual(restored[0].importedNotesCount, 1);
        assert.strictEqual(JSON.parse(localData.get('aura_notes_' + bookA.id))[0].id, notes[0].id);

        localData.set('aura_font_size', '18');
        const legacyBackup = new Blob([JSON.stringify({
            version: '1.0', type: 'aurareader_full_backup', books: [bookA, bookB], notes,
            settings: { fontSize: 24, appTheme: 'dark' }
        })]);
        await controller.importFullBackup(legacyBackup);
        assert.strictEqual(restored[1].importedBooksCount, 2, '已有多本书备份仍须兼容恢复');
        assert.strictEqual(restored[1].importedNotesCount, 3);
        assert.strictEqual(localData.get('aura_font_size'), '18', '旧备份中的应用设置不得影响阅读器设置');
        assert.ok(!messages.some(message => message.includes('恢复失败')));
        console.log('PASS: 每书一文件、标注隔离、无应用设置、真实导出与恢复、旧备份兼容');
    } finally {
        setDB(null);
        delete demoBooks[bookA.id];
        delete demoBooks[bookB.id];
        URL.createObjectURL = originalCreateUrl;
        URL.revokeObjectURL = originalRevokeUrl;
        for (const [key, descriptor] of Object.entries(originals)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
