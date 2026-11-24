const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const JSZip = require('jszip');
const { createDesktopStorage } = require('../../src/desktop/storage.cjs');
const { verifyDatabase } = require('../../src/server/storageMaintenance.js');
const { connect, pkg } = require('./client.cjs');

async function main() {
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'AuraReader Connector test '));
    const data = path.join(profile, 'data');
    let storage = createDesktopStorage(data);
    const clients = [];
    try {
        await assert.rejects(connect(profile), /Create a local desktop library/);
        await assert.rejects(fs.stat(data), { code: 'ENOENT' });
        await storage.call('createLibrary');
        const control = new DatabaseSync(path.join(data, 'aurareader.sqlite'));
        try {
            control.exec('PRAGMA user_version=4');
            await assert.rejects(connect(profile), /compatible AuraReader version/);
            assert.equal(control.prepare('PRAGMA user_version').get().user_version, 4);
            control.exec('PRAGMA user_version=5');
        } finally { control.close(); }
        const first = await connect(profile); clients.push(first);
        const toolNames = (await first.listTools()).tools.map(tool => tool.name);
        assert.equal(toolNames.length, 25);
        const invoke = async (name, args = {}, client = first) => client.callTool({ name, arguments: args });
        const call = async (name, args = {}, client = first) => {
            const result = await invoke(name, args, client);
            assert.ok(!result.isError, name + ': ' + JSON.stringify(result));
            return result.structuredContent;
        };
        const reject = async (name, args, code = 'conflict') => {
            const result = await invoke(name, args);
            assert.equal(result.isError, true);
            assert.equal(result.structuredContent.error.code, code);
        };
        const firstWrite = async (name, args = {}) => call(name, { ...args, opId: randomUUID() });
        assert.deepEqual(await call('search_library'), { items: [], nextCursor: null });
        const { goalId } = await firstWrite('create_goal', { text: 'Friendship' });
        const duplicate = await firstWrite('create_goal', { text: 'Friendship' });
        const { goalId: child } = await firstWrite('create_goal', { text: 'Child', parentId: goalId });
        assert.deepEqual((await call('search_library', { kind: 'goal', query: 'friendship' })).items.map(item => item.goal.id).sort(),
            [goalId, duplicate.goalId].sort());
        assert.equal((await call('get_goal_context', { goalId: child })).goal.path.length, 2);

        storage.close(); // All interactions below use the independent MCP process.
        const filename = path.join(profile, 'Chapters with spaces.epub');
        const zip = new JSZip();
        zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>');
        zip.file('OPS/book.opf', '<package><metadata/><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="image" href="a.png" media-type="image/png"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>');
        zip.file('OPS/one.xhtml', '<html><body><h1>First</h1><p>One &amp; <em>two😀</em>. Repeat Repeat</p><img src="a.png"/></body></html>');
        zip.file('OPS/two.xhtml', '<html><body><h1>Second</h1><p>End of book.</p></body></html>');
        zip.file('OPS/a.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        await fs.writeFile(filename, await zip.generateAsync({ type: 'nodebuffer' }));
        const imported = await firstWrite('import_book', { path: filename });
        const bookId = imported.id;
        const contents = await call('get_book_contents', { bookId });
        assert.equal(contents.units.length, 2);
        const args = { bookId, sourcePage: 1, limit: 4 };
        let cursor, complete = '';
        do {
            const page = await call('read_passage', { ...args, ...(cursor ? { cursor } : {}) });
            complete += page.quote;
            cursor = page.nextCursor;
        } while (cursor);
        assert.equal(complete, 'FirstOne & two😀. Repeat Repeat');
        const repeated = await call('find_quote', { bookId, quote: 'Repeat' });
        assert.equal(repeated.items.length, 2);
        assert.notEqual(repeated.items[0].start, repeated.items[1].start);
        const quote = (await call('find_quote', { bookId, quote: 'One & two😀' })).items[0];
        const { bookTitle, chapter: chapterName, path: sourcePath, before, after, ...reference } = quote;
        const create = { ...reference, comment: 'Reader comment', opId: randomUUID() };
        const [note, input] = await Promise.all([call('create_note', create),
            firstWrite('add_goal_input', { goalId, text: 'Conversation saved to Goal' })]);
        assert.deepEqual(await call('create_note', create), note);
        await reject('create_note', { ...create, comment: 'different' }, 'operation_id_reused');
        assert.equal((await call('search_library', { kind: 'annotation', query: 'Reader comment' })).items[0].annotation.quote, quote.quote);
        for (const target of [goalId, duplicate.goalId]) await firstWrite('set_goal_material', {
            goalId: target, bookId, generation: note.generation, annotationId: note.id, linked: true });
        const readGoal = (id, client = first) => call('get_goal_context', { goalId: id }, client);
        let context = await readGoal(goalId);
        const { link } = context.content.find(item => item.kind === 'annotation');
        const target = { kind: 'annotation', goalId, bookId, generation: note.generation, annotationId: note.id, associationOrder: link.order };
        await firstWrite('set_goal_response', { target, marked: true });
        assert.ok((await readGoal(goalId)).content.find(item => item.link?.response));
        assert.ok(!(await readGoal(duplicate.goalId)).content.find(item => item.link?.response));
        await firstWrite('set_goal_material', { goalId, bookId, generation: note.generation, annotationId: note.id,
            associationOrder: link.order, linked: false });
        await firstWrite('set_goal_material', { goalId, bookId, generation: note.generation, annotationId: note.id, linked: true });
        await reject('set_goal_response', { target, marked: true, opId: randomUUID() });
        await firstWrite('set_goal_book', { goalId, bookId, generation: note.generation, linked: true });
        assert.equal((await readGoal(goalId)).books[0].bookId, bookId);
        assert.equal((await readGoal(child)).books.length, 0);
        context = await readGoal(goalId);
        const item = context.content.find(item => item.id === input.id);
        const standalone = path.join(profile, 'relocated plugin');
        await fs.cp(pkg, standalone, { recursive: true });
        const second = await connect(profile, standalone); clients.push(second);
        const parallel = await Promise.all([firstWrite('add_goal_input', { goalId, text: 'First connection' }),
            call('add_goal_input', { goalId, text: 'Second connection', opId: randomUUID() }, second)]);
        const concurrentContent = (await readGoal(goalId)).content;
        assert.ok(parallel.every(item => concurrentContent.some(saved => saved.id === item.id)));
        const edit = { goalId, id: item.id, version: item.version, text: 'Edited by another process', opId: randomUUID() };
        await call('edit_goal_input', edit, second);
        assert.equal((await readGoal(goalId)).content.find(item => item.id === input.id).text, edit.text);
        await reject('edit_goal_input', { ...edit, text: 'stale', opId: randomUUID() });
        const lifecycleGoal = await firstWrite('create_goal', { text: 'Lifecycle fixture' });
        for (const action of ['complete', 'reopen', 'archive', 'unarchive', 'delete', 'restore-root', 'delete', 'purge']) {
            const current = await readGoal(lifecycleGoal.goalId);
            await firstWrite('operate_goal', { goalId: lifecycleGoal.goalId, expected: current.revision, action });
        }
        await reject('get_goal_context', { goalId: lifecycleGoal.goalId }, 'not_found');
        await firstWrite('create_highlight', reference);

        const notePath = path.join(profile, 'notes.md');
        const exportNotes = { bookId, path: notePath, opId: randomUUID() };
        assert.deepEqual(await call('export_notes', exportNotes), await call('export_notes', exportNotes, second));
        assert.match(await fs.readFile(notePath, 'utf8'), /Reader comment/);
        await reject('export_notes', { ...exportNotes, opId: randomUUID() });
        const chapters = path.join(profile, 'chapters.zip');
        await firstWrite('export_chapters', { bookId, path: chapters });
        const chapterZip = await JSZip.loadAsync(await fs.readFile(chapters));
        const chapter = await chapterZip.file('01_First.md').async('string');
        assert.match(chapter, /data:image\/png;base64/);
        assert.match(chapter, /Reader comment/);
        const backup = path.join(profile, 'book.aurabackup');
        await firstWrite('backup_book', { bookId, path: backup });
        assert.equal(JSON.parse(await fs.readFile(backup)).notes.length, 2);
        const sqlite = path.join(profile, 'whole library.sqlite');
        await firstWrite('backup_library', { path: sqlite });
        assert.deepEqual(verifyDatabase(sqlite), { integrity: 'ok', books: 1, notes: 2 });

        const textPath = path.join(profile, 'Source.txt');
        await fs.writeFile(textPath, 'A & B\nText 😀');
        const txt = await firstWrite('import_book', { path: textPath });
        const initial = await call('read_passage', { bookId: txt.id, sourcePage: 1, limit: 4 });
        assert.ok(initial.nextCursor);
        await firstWrite('import_book', { path: textPath });
        await reject('read_passage', { bookId: txt.id, sourcePage: 1, cursor: initial.nextCursor }, 'stale_cursor');
        await firstWrite('delete_book', { id: bookId, expected: imported.revision, generation: imported.generation });
        await reject('read_passage', { bookId, sourcePage: 1 }, 'not_found');
        await firstWrite('restore_book_backup', { path: backup });
        assert.notEqual((await call('get_book_contents', { bookId })).generation, note.generation);
        await reject('create_note', { ...create, opId: randomUUID() }, 'book_changed');
        await first.close(); clients.shift();

        storage = createDesktopStorage(data);
        const graph = (await storage.call('queryGoalLibrary')).value;
        assert.equal(graph.inputs.find(item => item.id === input.id).text, edit.text);
        const stored = (await storage.call('queryNotes', { bookIds: [bookId] })).records.find(row => row.id === note.id);
        assert.equal(stored.value.location.end, quote.end);
        const db = new DatabaseSync(path.join(data, 'aurareader.sqlite'));
        try {
            db.exec('BEGIN IMMEDIATE');
            const blocked = await invoke('add_goal_input', { goalId, text: 'Busy', opId: randomUUID() }, second);
            assert.equal(blocked.structuredContent.error.code, 'storage_busy');
            db.exec('ROLLBACK');
        } finally { db.close(); }
        console.log('PASS: packaged stdio, versioned UTF-16 reads, Goal and note writes, independent Response, two processes, file round trips and busy errors');
    } finally {
        await Promise.all(clients.map(client => client.close()));
        storage.close();
        assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
        assert.ok(path.basename(profile).startsWith('AuraReader Connector test '));
        await fs.rm(profile, { recursive: true, force: true });
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
