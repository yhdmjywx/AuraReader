const path = require('node:path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { JSDOM } = require('jsdom');
const { z } = require('zod');
const { createDesktopStorage } = require('../src/desktop/storage.cjs');
const { desktopProfile } = require('../src/desktop/libraryPath.cjs');
const { StorageError } = require('../src/server/dataStore.js');
const { createQueries } = require('./queries.cjs');
const { commands } = require('./commands.cjs');
const { files } = require('./files.cjs');

const id = z.string().min(1).max(4096);
const text = z.string().max(262144).refine(value => !!value.trim(), 'Enter nonempty text.');
const revision = z.number().int().nonnegative();
const positive = z.number().int().positive();
const version = z.string().regex(/^[a-f0-9]{64}$/);
const opId = id.describe('Unique ID for one logical write. Reuse it with unchanged arguments when retrying.');
const book = { bookId: id };
const goal = { goalId: id };
const association = { ...goal, ...book, generation: id };
const annotation = { ...book, id, generation: id, expected: positive.describe('Annotation revision from the most recent read.') };
const cursor = z.string().max(512).optional();
const limit = positive.max(100).default(25);
const location = { ...book, generation: id, bookRevision: positive, sourcePage: positive, sectionId: id,
    start: revision, end: positive, quote: z.string().min(1).max(262144) };
const file = { path: id.describe('Absolute path on this computer.'), opId };
const color = z.string().min(1).max(64);
const responseTarget = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('input'), ...goal, id }),
    z.strictObject({ kind: z.literal('annotation'), ...association, annotationId: id, associationOrder: positive })
]);

function getProfile() {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--profile' || !args[1])) {
        throw new Error('Usage: node index.cjs [--profile ABSOLUTE_DESKTOP_PROFILE]');
    }
    if (!args.length && (process.platform !== 'win32' || !process.env.APPDATA)) {
        throw new Error('Specify the desktop library with --profile.');
    }
    return desktopProfile(process.env.APPDATA || '', args[1]);
}

function errorResult(error) {
    const sqliteBusy = error.code === 'ERR_SQLITE_ERROR' && [5, 6].includes(error.errcode & 255);
    const fileError = ['ENOENT', 'EPERM', 'EACCES', 'EEXIST', 'ENOTDIR', 'ENOSPC', 'EXDEV', 'ENOTSUP'].includes(error.code);
    const status = sqliteBusy ? 503 : error instanceof StorageError ? error.status : fileError ? 400 : 500;
    const codes = { 400: fileError ? 'file_error' : 'invalid_request', 404: 'not_found', 409: 'conflict',
        413: 'too_large', 423: 'library_unavailable', 503: 'storage_busy' };
    if (status === 500) console.error('Connector tool failed:', error);
    const message = sqliteBusy ? 'The desktop library is busy. Retry the request, keeping any operation ID unchanged.'
        : status === 500 ? 'The Connector could not complete this action.' : error.message;
    return { isError: true, content: [{ type: 'text', text: message }],
        structuredContent: { error: { code: error.details?.reason || codes[status] || 'internal_error', message, details: error.details } } };
}

async function main() {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 24 || (major === 24 && minor < 15)) throw new Error('The Connector requires Node.js 24.15.0 or newer.');
    const storage = createDesktopStorage(path.join(getProfile(), 'data'), { attachOnly: true });
    const active = new Set();
    let closing = false;
    const html = new JSDOM('');
    const server = new McpServer({ name: 'aurareader', version: '0.1.0' });
    const transport = new StdioServerTransport();
    async function close() {
        if (closing) return;
        closing = true;
        process.stdin.pause();
        try {
            await Promise.allSettled(active);
            await storage.settle();
            await server.close();
        } finally { storage.close(); html.window.close(); }
    }
    try {
        const store = storage.library();
        const mod = await import('../modules/connector/modules.js');
        const queries = createQueries(mod, html.window.document);
        const writes = commands(mod, queries);
        const fileTools = files(mod, html.window.document, new html.window.DOMParser());

        function tool(name, description, shape, run, mode = 'read') {
            server.registerTool(name, { description, inputSchema: z.strictObject(shape),
                annotations: { readOnlyHint: mode === 'read', destructiveHint: mode === 'destructive',
                    idempotentHint: true, openWorldHint: false } }, async input => {
                if (closing) return errorResult(new StorageError('The Connector is closing.', 503));
                const operation = Promise.resolve().then(() => run(input));
                active.add(operation);
                try {
                    const result = await operation;
                    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
                } catch (error) { return errorResult(error); }
                finally { active.delete(operation); }
            });
        }
        const read = (method) => input => store.snapshot(current => queries[method](current, input));
        const write = (method) => input => writes[method](store, input);
        const fileWrite = (method) => input => fileTools[method](store, input);

        tool('search_library', 'Find books by title, Goals by text, and annotations by quote or comment, including unlinked annotations. IDs and Goal paths distinguish duplicate matches.',
            { query: z.string().max(4096).default(''), kind: z.enum(['all', 'book', 'goal', 'annotation']).default('all'),
                bookId: id.optional().describe('Scope books and annotations to this book.'), cursor, limit }, read('search'));
        tool('get_goal_context', 'Read a Goal and its path, child Goals, directly added books, and ordered reader text and linked annotations with Goal-specific Response state.',
            { ...goal, cursor, limit }, read('goal'));
        tool('get_book_contents', 'Read a book’s table of contents and reading units with their source document numbers.',
            { ...book, cursor, limit }, read('contents'));
        tool('read_passage', 'Read a source document in contiguous UTF-16 slices. Use nextCursor to continue the same document. The result identifies the exact text and revision for annotation creation.',
            { ...book, sourcePage: positive, offset: revision.default(0), cursor, limit: positive.max(16000).default(4000) }, read('read'));
        tool('find_quote', 'Find every exact occurrence of a quote, optionally within one source document. Returns candidate positions and context.',
            { ...book, quote: z.string().min(1).max(16000), sourcePage: positive.optional(), cursor, limit }, read('find'));

        tool('create_goal', 'Create a root or child Goal.', { parentId: id.nullable().default(null), text, opId }, write('createGoal'), 'add');
        tool('edit_goal', 'Replace the text of a Goal using its previously read version token.',
            { ...goal, text, version, opId }, write('editGoal'), 'destructive');
        tool('operate_goal', 'Complete, reopen, archive, unarchive, move to Recently deleted, restore, restore as root, or permanently purge a Goal branch.',
            { ...goal, action: z.enum(['complete', 'reopen', 'archive', 'unarchive', 'delete', 'restore', 'restore-root', 'purge']),
                expected: revision.describe('Goal library revision returned by get_goal_context.'), opId }, write('operateGoal'), 'destructive');
        tool('add_goal_input', 'Add reader-authored text owned by a Goal.', { ...goal, text, opId }, write('addInput'), 'add');
        tool('edit_goal_input', 'Replace a Goal’s reader-authored text using its previously read version token.',
            { ...goal, id, text, version, opId }, write('editInput'), 'destructive');
        tool('delete_goal_input', 'Delete one reader-authored text item using its previously read version token.',
            { ...goal, id, version, opId }, write('deleteInput'), 'destructive');
        tool('set_goal_book', 'Add or remove a book on a Goal’s explicit book list.',
            { ...association, linked: z.boolean(), opId }, write('bookLink'), 'destructive');
        tool('set_goal_material', 'Link or unlink an existing annotation. For unlinking, pass the order of the association returned by get_goal_context.',
            { ...association, annotationId: id, linked: z.boolean(), associationOrder: positive.optional(), opId }, write('annotationLink'), 'destructive');
        tool('set_goal_response', 'Mark or unmark reader text or an exact material association as Response in one Goal.',
            { target: responseTarget, marked: z.boolean(), opId }, write('response'), 'destructive');

        tool('create_note', 'Write a margin note at the exact source interval returned by read_passage or find_quote.',
            { ...location, comment: text, color: color.optional(), opId }, input => writes.createAnnotation(store, input, 'note'), 'add');
        tool('create_highlight', 'Highlight the exact source interval returned by read_passage or find_quote.',
            { ...location, color: color.optional(), opId }, input => writes.createAnnotation(store, input, 'highlight'), 'add');
        tool('edit_annotation', 'Edit a note comment or change an annotation color using its previously read revision.',
            { ...annotation, comment: z.string().max(262144).optional(), color: color.optional(), opId }, write('editAnnotation'), 'destructive');
        tool('delete_annotation', 'Delete an annotation and remove its Goal associations.',
            { ...annotation, opId }, write('deleteAnnotation'), 'destructive');
        tool('delete_book', 'Delete a book, its annotations, and their associations.',
            { id, generation: id, expected: positive.describe('Book revision returned by search_library or get_book_contents.'), opId }, write('deleteBook'), 'destructive');

        tool('import_book', 'Import an EPUB or TXT from an absolute path. Reimporting the same filename can update its book.',
            file, fileWrite('importPublication'), 'destructive');
        tool('export_notes', 'Write highlights and notes to a new Markdown file.',
            { ...book, ...file }, fileWrite('notes'), 'add');
        tool('export_chapters', 'Write a ZIP of chapter Markdown and annotations. Omit unitIds to export the whole book.',
            { ...book, ...file, unitIds: z.array(id).min(1).max(4096).optional() }, fileWrite('chapters'), 'add');
        tool('backup_book', 'Write a new AuraReader per-book backup, optionally including annotations.',
            { ...book, ...file, includeAnnotations: z.boolean().default(true) }, fileWrite('bookBackup'), 'add');
        tool('restore_book_backup', 'Atomically restore an AuraReader JSON backup, including its book, annotations and Goal associations.',
            file, input => fileTools.restore(storage, input), 'destructive');
        tool('backup_library', 'Write a new consistency-checked SQLite backup while AuraReader is running.',
            file, fileWrite('libraryBackup'), 'add');

        await server.connect(transport);
        const shutdown = () => close().catch(error => { console.error(error); process.exitCode = 1; });
        process.stdin.once('end', shutdown);
        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    } catch (error) { await close(); throw error; }
}

main().catch(error => { console.error('AuraReader Connector:', error.message); process.exitCode = 1; });
