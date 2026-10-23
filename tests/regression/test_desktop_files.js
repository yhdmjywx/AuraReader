const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createFileService, readBounded, exportName } = require('../../src/desktop/files.cjs');

(async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-files-test-'));
    const data = path.join(directory, 'data');
    const opens = []; const saves = []; const options = [];
    const dialogs = {
        open: async value => { options.push(value); if (!opens.length) throw new Error('No queued open'); return await opens.shift(); },
        save: async value => { options.push(value); if (!saves.length) throw new Error('No queued save'); return await saves.shift(); }
    };
    const service = createFileService({ dataDirectory: data, protectedDirectories: [data], dialogs });
    const choose = filename => opens.push({ canceled: false, filePaths: [filename] });
    const destination = filename => saves.push({ canceled: false, filePath: filename });
    try {
        const book = path.join(directory, '测试.epub');
        await fs.copyFile(path.resolve('tests/fixtures/test.epub'), book);
        choose(book);
        const picked = await service.call('chooseBook');
        assert.equal(picked.file.name, '测试.epub');
        assert.deepEqual(Buffer.from(picked.file.bytes), await fs.readFile(book));
        assert.equal(Object.keys(picked.file).includes('path'), false);
        opens.push({ canceled: true, filePaths: [] });
        assert.deepEqual(await service.call('chooseBook'), { canceled: true });
        await assert.rejects(service.call('chooseBook', { path: book }), { status: 400 });
        choose(path.join(directory, 'bad.sqlite'));
        await assert.rejects(service.call('chooseBook'), { status: 400 });
        await assert.rejects(readBounded(book, 1), { status: 413 });
        const font = path.join(directory, '测试.woff2');
        await fs.copyFile(path.resolve('src/client/assets/fonts/literata.woff2'), font);
        choose(font);
        const imported = await service.call('importFont');
        assert.match(imported.font.url, /^aurareader:\/\/app\/user-fonts\/[a-f0-9]{64}\.woff2$/);
        assert.deepEqual((await service.call('listFonts')).fonts[0], imported.font);
        const name = new URL(imported.font.url).pathname.split('/').pop();
        assert.deepEqual((await service.fontResource(name)).bytes, await fs.readFile(font));
        assert.equal(await service.fontResource('../../secret'), null);
        assert.equal(await service.fontResource('0'.repeat(64) + '.woff2'), null);
        const reloaded = createFileService({ dataDirectory: data, protectedDirectories: [data], dialogs });
        assert.equal((await reloaded.call('listFonts')).fonts.length, 1);
        assert.ok(await reloaded.fontResource(name));
        const invalid = path.join(directory, '坏字体.ttf'); await fs.writeFile(invalid, 'not a font');
        choose(invalid); await assert.rejects(service.call('importFont'), { status: 400 });
        for (const extension of ['md', 'html', 'zip', 'aurabackup']) {
            const target = path.join(directory, '导出.' + extension);
            const bytes = new Uint8Array([0, 1, 10, 240, 159, 152, 128]);
            destination(target);
            assert.equal((await service.call('saveExport', { filename: '导出.' + extension, bytes })).status, 'saved');
            assert.deepEqual(await fs.readFile(target), Buffer.from(bytes));
        }
        const target = path.join(directory, '导出.md');
        const original = await fs.readFile(target);
        destination(target);
        assert.equal((await service.call('saveExport', { filename: 'x.md', bytes: new Uint8Array(original) })).status, 'saved');
        assert.deepEqual(await fs.readFile(target), original, 'existing ordinary file replaced successfully');
        saves.push({ canceled: true });
        assert.equal((await service.call('saveExport', { filename: 'x.md', bytes: new Uint8Array([1]) })).status, 'canceled');
        assert.deepEqual(await fs.readFile(target), original);
        destination(path.join(data, 'forbidden.md'));
        await assert.rejects(service.call('saveExport', { filename: 'x.md', bytes: new Uint8Array([1]) }), { status: 403 });
        destination(path.join(directory, 'wrong.exe'));
        await assert.rejects(service.call('saveExport', { filename: 'x.md', bytes: new Uint8Array([1]) }), { status: 400 });
        await assert.rejects(service.call('saveExport', { filename: 'x.exe', bytes: new Uint8Array([1]) }), { status: 400 });
        await assert.rejects(service.call('saveExport', { filename: 'x.md', bytes: new Uint8Array([1]), path: target }), { status: 400 });
        destination(path.join(directory, 'missing-parent', 'failure.md'));
        await assert.rejects(service.call('saveExport', { filename: 'x.md', bytes: new Uint8Array([1]) }), { status: 500 });
        assert.deepEqual(await fs.readFile(target), original);
        assert.ok(!(await fs.readdir(directory)).some(name => name.endsWith('.tmp')));
        assert.equal(exportName('C:\\folder\\CON.md'), '_CON.md');
        let release;
        opens.push(new Promise(resolve => { release = resolve; }));
        const pending = service.call('chooseBook');
        await assert.rejects(service.call('chooseBackup'), { status: 409 });
        let settled = false;
        const settling = service.settle().then(() => { settled = true; });
        await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
        release({ canceled: true, filePaths: [] }); await pending; await settling;
        assert.equal(settled, true);
        choose(book); let authorizations = 0;
        await assert.rejects(service.call('chooseBook', undefined, () => {
            if (++authorizations > 1) throw Object.assign(new Error('sender changed'), { status: 403 });
        }), { status: 403 });
        await fs.writeFile(path.join(data, 'fonts', name), 'tampered');
        await assert.rejects(service.fontResource(name), /完整性/);
        assert.ok(options.some(value => value.properties.includes('showOverwriteConfirmation')));
        console.log('PASS: bounded native-file service, cancellation, destination control, atomic bytes, font persistence/hash, concurrent dialog denial and shutdown waiting');
    } finally {
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-files-test-')) throw new Error('Unsafe cleanup');
        await fs.rm(target, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
