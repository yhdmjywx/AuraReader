/* ==========================================================================
   Exporters - Document & Annotation Export / Backup Adapter (Infrastructure Layer)
   Provides Markdown, full-book or selected-chapter folder export,
   and per-book .aurabackup export & import deserialization.
   ========================================================================== */

import { groupAnnotationsByRange, normalizeAnnotation, isHighlight, isNote } from '../domain/annotationEngine.js';
import { compactWithMap, resolveAnnotationRange } from '../domain/annotationRangeEngine.js';
import { renderAnnotationTokens } from '../features/reader/annotationRenderer.js';
import { buildBookStructure, structureSummary } from './bookStructure.js';
import { unwrapDesktop } from './storageClient.js';
import { saveMarkdownFolder } from './folderExport.js';
import { countLabel, exportTimestamp } from '../domain/format.js';
import { withExportImages } from './epubExport.js';

export function downloadFile(filename, data, type) {
    if (typeof window === 'undefined') return;
    const blob = (data instanceof Blob) ? data : new Blob([data], { type });
    if (window.auraDesktop) {
        const files = window.auraDesktop.files;
        return blob.arrayBuffer().then(bytes => files.saveExport({ filename, bytes: new Uint8Array(bytes) })).then(unwrapDesktop);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    return { status: 'download-requested' };
}

export function exportMarkdown(bookTitle = "Book notes", notes = []) {
    return downloadFile(`${bookTitle}_notes.md`, buildNotesMarkdown(bookTitle, notes), 'text/markdown');
}

export function buildNotesMarkdown(bookTitle, notes) {
    const groups = groupAnnotationsByRange(notes);
    let md = `# Highlights and notes: “${bookTitle}”\n\n`;
    md += `> Exported: ${exportTimestamp()}\n\n`;
    md += `## Highlights and notes (${notes.length})

`;

    groups.forEach((group, idx) => {
        md += `### ${idx + 1}. P.${group.page} ${group.chapter || ''}\n`;
        if (group.quote) md += `${highlightMarkdown(group.quote)}\n\n`;
        group.notes.forEach(note => {
            if (note.comment) md += note.comment.split(/\r?\n/).map(line => `> ${line}`).join('\n') + '\n\n';
        });
        md += `---\n\n`;
    });

    return md;
}

export function buildChapterDocuments(book, notes = [], { selectedUnitIds, htmlDocument = globalThis.document } = {}) {
    if (!book || !Array.isArray(book.pages)) {
        throw new Error("This book has no content to export.");
    }

    const structure = buildBookStructure(book, htmlDocument);
    const selection = selectedUnitIds == null ? null : new Set(selectedUnitIds);
    const units = structure.units.filter(unit => !selection || selection.has(unit.id));
    if (!units.length) throw new Error("Select at least one chapter to export.");
    const selectedPages = new Set(units.flatMap(unit => unit.sourcePages));
    const isPartial = units.length < structure.units.length;
    const bookTitle = safeExportTitle(book.title || "Book");
    const folderName = `${bookTitle}_${isPartial ? "selected-chapter-notes" : "chapter-notes"}`;
    const files = [];
    const chapterFiles = [];
    const annotations = (Array.isArray(notes) ? notes : []).map(normalizeAnnotation).filter(Boolean)
        .filter(note => !book.id || !note.bookId || note.bookId === book.id)
        .filter(note => !isPartial || selectedPages.has(note.page))
        .map((note, idx) => ({ ...note, id: note.id || `export-${idx}` }));

    const filesByUnit = new Map(structure.units.map((unit, index) => [unit.id,
        `${String(index + 1).padStart(2, '0')}_${safeExportTitle(unit.title)}.md`]));
    let indexMd = `# “${book.title}” — Reading and notes overview

`;
    indexMd += `- Format: ${book.format || 'EPUB'}\n`;
    indexMd += `- ${isPartial ? "Full book structure" : "Content structure"}: ${structureSummary(structure)}\n`;
    indexMd += `- Export scope: ${isPartial ? "Selected chapters" : "Whole book"}\n`;
    indexMd += `- Content files: ${units.length}\n`;
    indexMd += `- Highlights: ${annotations.filter(isHighlight).length}\n`;
    indexMd += `- Notes: ${annotations.filter(isNote).length}\n`;
    indexMd += `- Exported: ${exportTimestamp()}\n\n`;
    indexMd += `## Contents
`;
    let unmatchedHighlights = 0;

    // Preserve TOC hierarchy, including multiple nodes/anchors sharing a file.
    // Structural volume nodes link to their first chapter, not an empty file.
    const includedNodes = new Set();
    for (const node of structure.nodes) {
        if (!selectedPages.has(node.page)) continue;
        for (let ancestor = node; ancestor; ancestor = ancestor.parent) includedNodes.add(ancestor.id);
    }
    for (const node of structure.nodes) {
        if (isPartial && !includedNodes.has(node.id)) continue;
        const unit = structure.pageToUnit.get(node.page);
        const label = escapeMarkdownText(node.title);
        const link = unit && selectedPages.has(node.page) ? `[${label}](./${encodeURIComponent(filesByUnit.get(unit.id))})` : label;
        indexMd += `${'  '.repeat(node.level)}- ${link}\n`;
    }
    const untitledUnits = units.filter(unit => !structure.nodes.some(node => unit.sourcePages.includes(node.page)));
    if (untitledUnits.length) {
        indexMd += "\n## Other retained content\n";
        untitledUnits.forEach(unit => { indexMd += `- [${escapeMarkdownText(unit.title)}](./${encodeURIComponent(filesByUnit.get(unit.id))})\n`; });
    }

    // Resolve every annotation within its original source before combining
    // rendered Markdown. Joining HTML first would shift existing note offsets.
    function sourceMarkdown(pageNum) {
        const pageNotes = annotations.filter(n => n.page === pageNum);
        const tempDiv = htmlDocument.createElement('div');
        tempDiv.innerHTML = book.pages[pageNum - 1];

        // Offsets are chapter-relative, as in the reader. Saved note ranges
        // recover the exact source quote; legacy notes fall back to quote search.
        const text = tempDiv.textContent;
        const exportNotes = pageNotes.map(note => {
            if (!isNote(note)) return note;
            const range = resolveNoteRange(text, note);
            if (!range) return note;
            const sourceQuote = text.slice(range.start, range.end);
            const savedQuote = compactWithMap(note.quote).compact;
            const resolvedQuote = compactWithMap(sourceQuote).compact;
            return savedQuote === resolvedQuote ? note : { ...note, quote: sourceQuote };
        });
        unmatchedHighlights += exportNotes.filter(isHighlight).filter(note => !resolveAnnotationRange(text, note)).length;
        renderAnnotationTokens(tempDiv, exportNotes, pageNum);

        const chapterBody = chapterBodyMarkdown(tempDiv, exportNotes.filter(isNote));
        return chapterBody.markdown + '\n\n' + chapterAnnotationMarkdown(chapterBody.unplacedNotes);
    }
    for (const unit of units) {
        const unitNotes = annotations.filter(note => unit.sourcePages.includes(note.page));
        let markdown = '';
        // A source heading already provides the title for prefixed units:
        // 第一卷 → 大堂. Do not add a second artificial “大堂” before 第一卷.
        if (!unit.prefixPages.length) markdown += `# ${escapeMarkdownText(unit.title)}\n\n`;
        markdown += `> Highlights: ${unitNotes.filter(isHighlight).length} | Notes: ${unitNotes.filter(isNote).length}

---

`;
        markdown += unit.sourcePages.map(sourceMarkdown).join('\n');
        const file = { filename: filesByUnit.get(unit.id), text: markdown };
        files.push(file);
        chapterFiles.push(file);
    }

    const invalidPage = note => !Number.isInteger(note.page) || note.page < 1 || note.page > book.pages.length;
    const unassigned = annotations.filter(isNote).filter(invalidPage);
    let unassignedDocument = null;
    if (unassigned.length) {
        unassignedDocument = { filename: "unassigned-notes.md", text: "# Unassigned notes\n\nThese notes have invalid chapter locations. Their quotes and text are preserved here.\n\n" + chapterAnnotationMarkdown(unassigned) };
        files.push(unassignedDocument);
        indexMd += `\n[Unassigned notes](./${encodeURIComponent(unassignedDocument.filename)})\n`;
    }
    unmatchedHighlights += annotations.filter(isHighlight).filter(invalidPage).length;
    if (unmatchedHighlights) indexMd += `
> ${countLabel(unmatchedHighlights, 'highlight')} could not be located in the text and were not marked. Original annotations remain in the library and book backups.
`;
    files.push({ filename: "00_contents.md", text: indexMd });
    return { bookTitle, folderName, chapterFiles, files, unmatchedHighlights, unassignedDocument };
}

function safeExportTitle(title) {
    let name = String(title).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120).replace(/[\uD800-\uDBFF]$/, '').replace(/[. ]+$/, '') || "Book";
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
    return name;
}

export async function exportChapters(book, notes = [], options = {}) {
    const structure = buildBookStructure(book);
    const selection = options.selectedUnitIds == null ? null : new Set(options.selectedUnitIds);
    const count = structure.units.filter(unit => !selection || selection.has(unit.id)).length;
    if (!count) throw new Error("Select at least one chapter to export.");
    // Browser pickers must start during the click, before expensive conversion.
    const destination = count > 1 && !window.auraDesktop ? await saveMarkdownFolder.pick() : null;
    if (count > 1 && !window.auraDesktop && !destination) return { status: 'canceled' };
    const selectedPages = new Set(structure.units.filter(unit => !selection || selection.has(unit.id)).flatMap(unit => unit.sourcePages));
    const documents = buildChapterDocuments(await withExportImages(book, selectedPages), notes, options);
    if (documents.chapterFiles.length === 1) {
        const chapter = documents.chapterFiles[0];
        let text = chapter.text;
        const orphan = documents.unassignedDocument;
        if (orphan) text += '\n\n' + orphan.text;
        if (documents.unmatchedHighlights) text += `

> ${countLabel(documents.unmatchedHighlights, 'highlight')} could not be located in the text. Original annotations remain in the library and book backups.
`;
        const filename = safeExportTitle(`${documents.bookTitle}_${chapter.filename.slice(0, -3)}`) + '.md';
        return { ...await downloadFile(filename, text, 'text/markdown;charset=utf-8'), kind: 'file' };
    }
    return saveMarkdownFolder(`${documents.bookTitle}_chapters`, documents.files, destination);
}

// Compatibility adapter for legacy consumers; the product UI exports .md/folders.
export async function exportChapterZip(book, notes = [], jszipLib, options = {}) {
    if (!jszipLib) throw new Error("JSZip is not ready. Check that application resources are available.");
    const { folderName, files } = buildChapterDocuments(await withExportImages(book), notes, options);
    const zip = new jszipLib();
    const folder = zip.folder(folderName);
    files.forEach(file => folder.file(file.filename, file.text));

    const blob = await zip.generateAsync({ type: 'blob' });
    return downloadFile(`${folderName}.zip`, blob, 'application/zip');
}

function resolveNoteRange(text, note) {
    const location = note.location || {};
    const start = Number(location.start);
    const end = Number(location.end);
    const locationPage = Number(location.page);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= text.length
        && (!locationPage || locationPage === Number(note.page))) {
        // A valid saved selection range is the strongest link to the source.
        // Use its text to repair stale or shortened quote strings before the
        // renderer locates the note in the chapter.
        return { start, end };
    }
    return resolveAnnotationRange(text, note);
}

function chapterAnnotationMarkdown(notes) {
    const thoughts = notes.filter(isNote);
    if (!thoughts.length) return '';
    let md = "## Chapter notes\n\n";
    thoughts.forEach((note, idx) => {
        md += `### ${idx + 1}. Note | p.${note.page}\n\n`;
        md += chapterNoteContent(note);
    });
    return md;
}

function chapterNoteContent(note) {
    let md = '';
    if (note.quote.trim()) {
        md += "> **Source quote**\n";
        md += note.quote.trim().split(/\r?\n/).map(line => `> ${escapeMarkdownText(line)}`).join('\n') + '\n';
        md += '>\n';
    } else {
        md += "> Standalone note (no source link)\n";
        md += '>\n';
    }
    if (note.comment.trim()) {
        md += note.comment.split(/\r?\n/).map(line => `> ${line}`).join('\n') + '\n\n';
    } else {
        md += '\n';
    }
    return md;
}

function escapeMarkdownText(text) {
    return String(text).replace(/&/g, '&amp;').replace(/[\\`*_{}\[\]<>]/g, '\\$&');
}

function highlightMarkdown(text) {
    // Source HTML often contains soft-wrapped lines and indentation. Leave
    // whitespace outside marks and never emit a mark for a blank line.
    return String(text).split(/(\r\n|\r|\n)/).map(line => {
        const match = line.match(/^(\s*)([\s\S]*?\S)(\s*)$/);
        if (!match) return line;
        // Encode Markdown delimiters as well as HTML characters so the
        // highlighted source stays literal in both HTML and Markdown readers.
        const content = escapeHtml(match[2]).replace(/[\\`*_{}\[\]~=]/g, character => `&#${character.charCodeAt(0)};`);
        return `${match[1]}<mark>${content}</mark>${match[3]}`;
    }).join('');
}

// Serialize annotated text in document order. Adjacent inline tokens share
// one run; paragraph and line boundaries close marks. No quote matching is repeated.
function chapterBodyMarkdown(root, notes = []) {
    const blockSelector = 'p,h1,h2,h3,h4,h5,h6,blockquote,div,section,article,li,ul,ol,table,thead,tbody,tfoot,tr,td,th,pre,figure';
    const noteTokens = new Map();
    root.querySelectorAll('.annotation-token.has-note').forEach(token => {
        (token.getAttribute('data-note-ids') || '').split(/\s+/).filter(Boolean).forEach(id => noteTokens.set(id, token));
    });
    const notesAfterBlock = new Map();
    const unplacedNotes = [];
    notes.forEach(note => {
        const token = noteTokens.get(String(note.id));
        let paragraph = token?.closest('p,h1,h2,h3,h4,h5,h6,blockquote,li,pre,td,th,figure,div,section,article');
        if (paragraph?.tagName !== 'BLOCKQUOTE') {
            paragraph = token?.closest('blockquote') || paragraph;
        }
        if (!paragraph || paragraph === root || !root.contains(paragraph)) {
            unplacedNotes.push(note);
            return;
        }
        if (!notesAfterBlock.has(paragraph)) notesAfterBlock.set(paragraph, []);
        notesAfterBlock.get(paragraph).push(note);
    });

    function renderNotesAfter(element) {
        return (notesAfterBlock.get(element) || []).map(chapterNoteContent).join('');
    }
    function inline(nodes) {
        const runs = [];
        function write(text, marked) {
            if (!text) return;
            const previous = runs[runs.length - 1];
            if (previous && previous.marked === marked) previous.text += text;
            else runs.push({ text, marked });
        }
        function visit(node, marked = false) {
            if (node.nodeType === 3) { write(node.textContent, marked); return; }
            if (node.nodeType !== 1 || node.matches('script,style')) return;
            if (node.tagName === 'BR') { write('\n', false); return; }
            if (node.tagName.toLowerCase() === 'svg') {
                // Keep vector illustrations as images, rather than injecting
                // executable inline SVG into the Markdown document.
                runs.push({ image: `<img src="data:image/svg+xml,${encodeURIComponent(node.outerHTML)}" alt="">` });
                return;
            }
            if (node.tagName === 'IMG' || node.tagName.toLowerCase() === 'image') {
                const src = node.getAttribute('src') || node.getAttribute('href') || node.getAttribute('xlink:href') || '';
                // EPUB images are normally inlined by the parser. Keep them
                // when preserving illustrated dividers and other source pages.
                if (/^(?:data:image\/|https?:\/\/)/i.test(src)) {
                    runs.push({ image: `<img src="${escapeHtml(src)}" alt="${escapeHtml(node.getAttribute('alt') || '')}">` });
                }
                return;
            }
            const isMarked = marked || node.classList.contains('has-highlight');
            node.childNodes.forEach(child => visit(child, isMarked));
        }
        nodes.forEach(node => visit(node));
        return runs.map(run => run.image || (run.marked ? highlightMarkdown(run.text) : escapeMarkdownText(run.text))).join('').trim();
    }
    function children(element) {
        let result = '';
        let buffer = [];
        function flush() {
            const text = inline(buffer);
            if (text) result += text + '\n\n';
            buffer = [];
        }
        element.childNodes.forEach(node => {
            if (node.nodeType === 1 && (node.matches(blockSelector) || node.querySelector(blockSelector))) {
                flush();
                result += block(node);
            } else buffer.push(node);
        });
        flush();
        return result;
    }
    function block(element) {
        if (element.matches('script,style')) return '';
        let rendered = '';
        if (/^H[1-6]$/.test(element.tagName)) rendered = `${'#'.repeat(Math.min(Number(element.tagName[1]) + 1, 6))} ${inline([element])}\n\n`;
        else if (element.tagName === 'BLOCKQUOTE') rendered = children(element).trim().split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        else if (element.querySelector(blockSelector)) rendered = children(element);
        else {
            const text = inline([element]);
            rendered = text ? text + '\n\n' : '';
        }
        return rendered + renderNotesAfter(element);
    }
    return { markdown: children(root).trim(), unplacedNotes };
}

export function buildSelectiveBackup({ selectedBooks = [], notes = [], goalStates = [], goalGraphs, includeNotes = true }) {
    const normalizedNotes = (notes || []).map(normalizeAnnotation).filter(Boolean);
    const exportedAt = new Date().toISOString();
    const yyyymmdd = exportedAt.slice(0, 10).replace(/-/g, '');

    return selectedBooks.map(book => {
        const backupPayload = {
            version: goalGraphs ? "1.3" : "1.1",
            // Keep the existing envelope for compatibility with earlier readers.
            type: "aurareader_full_backup",
            exportedAt,
            books: [book],
            notes: includeNotes ? normalizedNotes.filter(note => note.bookId === book.id) : [],
            goalStates: goalStates.filter(state => state.bookId === book.id).map(state => includeNotes
                ? state : { bookId: state.bookId, goals: state.goals })
        };
        if (goalGraphs) { const graph = goalGraphs.get(book.id) || { goals: [], links: [], bookLinks: [] }; delete backupPayload.goalStates; backupPayload.goalGraph = includeNotes ? graph : { goals: graph.goals, ...(graph.bookLinks !== undefined ? { bookLinks: graph.bookLinks } : {}) }; }
        const bookTitle = String(book.title || book.id || "Book")
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
        const fileName = `AuraReader_Backup_${bookTitle}_${yyyymmdd}.aurabackup`;

        return { filename: fileName, data: JSON.stringify(backupPayload, null, 2) };
    });
}

export function exportSelectiveBackup(options) {
    const files = buildSelectiveBackup(options);
    if (typeof window !== 'undefined' && window.auraDesktop) {
        return (async () => {
            const results = []; let stopped = false;
            for (const file of files) {
                if (stopped) { results.push({ name: file.filename, status: 'not-saved' }); continue; }
                try {
                    const result = await downloadFile(file.filename, file.data, 'application/json;charset=utf-8');
                    results.push({ name: file.filename, ...result });
                    if (result.status === 'canceled') stopped = true;
                } catch (error) {
                    results.push({ name: file.filename, status: 'failed', message: error.message });
                    stopped = true;
                }
            }
            return results;
        })();
    }
    return files.map(file => downloadFile(file.filename, file.data, 'application/json;charset=utf-8'));
}

export function parseBackupFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error("No backup file provided."));
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data || (data.type !== 'aurareader_full_backup' && !Array.isArray(data.notes) && !Array.isArray(data.books))) {
                    return reject(new Error("Unrecognized backup format."));
                }
                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
