const fs = require('node:fs/promises');
const path = require('node:path');
const { createReadStream } = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const JSZip = require('jszip');
const { StorageError, digest } = require('../src/server/dataStore.js');
const { MAX_JSON_BYTES } = require('../src/desktop/storage.cjs');
const { backupDatabase } = require('../src/server/storageMaintenance.js');
const { found, conflict } = require('./queries.cjs');

function absolute(filename) {
    if (!path.isAbsolute(filename)) throw new StorageError('Use an absolute file path.');
    return path.resolve(filename);
}
async function inputFile(filename) {
    const handle = await fs.open(absolute(filename), 'r');
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_JSON_BYTES) throw new StorageError('Use a regular file smaller than 256 MB.', 413);
        const bytes = await handle.readFile();
        if (bytes.length > MAX_JSON_BYTES) throw new StorageError('The file exceeds 256 MB.', 413);
        return bytes;
    } finally { await handle.close(); }
}
async function hashFile(filename) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filename)) hash.update(chunk);
    return hash.digest('hex');
}

function files(mod, document, parser) {
    function bookSnapshot(store, bookId) {
        return store.snapshot(current => {
            const row = found(current.book(bookId), 'Book');
            const notes = current.notes([bookId]).filter(note => !note.deleted).map(note => mod.normalizeAnnotation(note.value));
            return { book: row.value, notes, graph: current.goalLibrary().value };
        });
    }
    async function publish(receipt) {
        const { temporary, contentHash, ...result } = receipt;
        try { await fs.link(temporary, result.path); }
        catch (error) {
            if (!['EEXIST', 'ENOENT'].includes(error.code)) throw error;
        }
        let actual;
        try { actual = await hashFile(result.path); }
        catch (error) {
            if (error.code !== 'ENOENT') throw error;
            conflict('The original export file is missing. Use a new operation ID to create it again.');
        }
        if (actual !== contentHash) conflict('The destination contains a different file. Use a new operation ID and destination.');
        try { await fs.unlink(temporary); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        return result;
    }
    async function exportFile(store, capability, input, prepare) {
        const request = { capability, ...input };
        const previous = store.replay(request);
        if (previous) return publish(previous);
        const requested = absolute(input.path);
        const parent = await fs.realpath(path.dirname(requested));
        const filename = path.join(parent, path.basename(requested));
        const root = await fs.realpath(store.root);
        const relative = path.relative(root, filename);
        if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) {
            throw new StorageError('Choose an export destination outside the active library directory.');
        }
        try { await fs.lstat(filename); conflict('The destination already exists. Choose a new file.'); }
        catch (error) {
            if (error.code !== 'ENOENT') {
                const concurrent = store.replay(request);
                if (concurrent) return publish(concurrent);
                throw error;
            }
        }
        const temporary = path.join(parent, '.aurareader-' + randomUUID() + '.tmp');
        let retained = false;
        try {
            const metadata = await prepare(temporary);
            const contentHash = await hashFile(temporary);
            const receipt = store.recordFile(request, { ...metadata, path: filename, temporary, contentHash });
            retained = receipt.temporary === temporary;
            return await publish(receipt);
        } finally {
            if (!retained) await fs.rm(temporary, { force: true });
        }
    }
    async function importPublication(store, input) {
        const filename = path.basename(absolute(input.path));
        const extension = path.extname(filename).toLowerCase();
        if (!['.epub', '.txt'].includes(extension)) throw new StorageError('Only EPUB and TXT files can be imported.');
        const bytes = await inputFile(input.path);
        const id = 'book_' + encodeURIComponent(filename);
        const command = { capability: 'import_book', opId: input.opId, path: input.path, id,
            bytes: createHash('sha256').update(bytes).digest('hex') };
        const prior = store.replay(command);
        if (prior) return prior;
        const book = extension === '.epub' ? await mod.projectEpubBook(await mod.readEpubArchive(bytes), filename, parser)
            : mod.parseTxt(new TextDecoder().decode(bytes), filename);
        if (Buffer.byteLength(JSON.stringify(book)) > MAX_JSON_BYTES) throw new StorageError('The imported book exceeds the library request limit.', 413);
        return store.importBook(command, previous => {
            try { return { ...mod.retainEpubLocations(book, previous, parser), updatedAt: new Date().toISOString() }; }
            catch (error) { conflict(error.message); }
        });
    }
    return {
        importPublication,
        async restore(storage, input) {
            const bytes = await inputFile(input.path);
            let data;
            try { data = JSON.parse(new TextDecoder().decode(bytes)); }
            catch { throw new StorageError('Unrecognized backup format.'); }
            if (!data || (!Array.isArray(data.books) && !Array.isArray(data.notes))) throw new StorageError('Unrecognized backup format.');
            const books = (data.books || []).map((book, index) => book?.id || !book?.title ? book : {
                ...book, id: 'custom_' + digest([input.opId, index])
            });
            const defaultBookId = books[0]?.id || 'crisis-era';
            const notes = (data.notes || []).map(note => mod.normalizeAnnotation({ ...note, bookId: note?.bookId || defaultBookId }));
            return storage.call('restore', { opId: input.opId, books, notes,
                ...(data.goalGraph !== undefined ? { goalGraph: data.goalGraph } :
                    data.goalStates !== undefined ? { goalStates: data.goalStates } : {}) });
        },
        notes(store, input) {
            return exportFile(store, 'export_notes', input, async temporary => {
                const { book, notes } = bookSnapshot(store, input.bookId);
                await fs.writeFile(temporary, mod.buildNotesMarkdown(book.title, notes), { flag: 'wx' });
                return { bookId: book.id, annotations: notes.length };
            });
        },
        chapters(store, input) {
            return exportFile(store, 'export_chapters', input, async temporary => {
                const { book, notes } = bookSnapshot(store, input.bookId);
                const structure = mod.buildBookStructure(book, document);
                const selected = input.unitIds && new Set(input.unitIds);
                if (selected && [...selected].some(id => !structure.units.some(unit => unit.id === id))) {
                    throw new StorageError('A selected reading unit was not found.', 404);
                }
                const pages = new Set(structure.units.filter(unit => !selected || selected.has(unit.id)).flatMap(unit => unit.sourcePages));
                // The export uses bytes from the same snapshot as its text and annotations.
                let archive;
                const resource = async url => {
                    archive ||= JSZip.loadAsync(Buffer.from(book.epub.archive, 'base64'));
                    const segments = new URL(url, 'https://aurareader.invalid').pathname.split('/').slice(4);
                    const name = segments.map(decodeURIComponent).join('/');
                    const entry = (await archive).file(name);
                    const type = book.epub.manifest.find(item => item.path === name)?.mediaType;
                    return entry ? new Response(await entry.async('uint8array'), { headers: { 'Content-Type': type || 'application/octet-stream' } })
                        : new Response(null, { status: 404 });
                };
                const renderBook = await mod.withExportImages(book, pages, parser, resource);
                const documents = mod.buildChapterDocuments(renderBook, notes, { selectedUnitIds: input.unitIds, htmlDocument: document });
                const zip = new JSZip();
                for (const file of documents.files) zip.file(file.filename, file.text);
                await fs.writeFile(temporary, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), { flag: 'wx' });
                return { bookId: book.id, chapters: documents.chapterFiles.length, unmatchedHighlights: documents.unmatchedHighlights };
            });
        },
        bookBackup(store, input) {
            return exportFile(store, 'backup_book', input, async temporary => {
                const { book, notes, graph } = bookSnapshot(store, input.bookId);
                const [file] = mod.buildSelectiveBackup({ selectedBooks: [book], notes, includeNotes: input.includeAnnotations,
                    goalGraphs: mod.buildGoalGraphsForBooks(graph, [book.id]) });
                await fs.writeFile(temporary, file.data, { flag: 'wx' });
                return { bookId: book.id };
            });
        },
        libraryBackup(store, input) {
            return exportFile(store, 'backup_library', input, async temporary => {
                const { filename, ...verified } = await backupDatabase(store.root, temporary);
                return verified;
            });
        }
    };
}

module.exports = { files };
