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

export function exportMarkdown(bookTitle = '图书笔记', notes = []) {
    const groups = groupAnnotationsByRange(notes);
    let md = `# 划线与随笔笔记：《${bookTitle}》\n\n`;
    md += `> 导出时间：${new Date().toLocaleString()}\n\n`;
    md += `## 划线与随笔精选 (${notes.length} 条)\n\n`;

    groups.forEach((group, idx) => {
        md += `### ${idx + 1}. P.${group.page} ${group.chapter || ''}\n`;
        if (group.quote) md += `${highlightMarkdown(group.quote)}\n\n`;
        group.notes.forEach(note => {
            if (note.comment) md += note.comment.split(/\r?\n/).map(line => `> ${line}`).join('\n') + '\n\n';
        });
        md += `---\n\n`;
    });

    return downloadFile(`${bookTitle}_划线随笔.md`, md, 'text/markdown');
}

export function buildChapterDocuments(book, notes = [], { selectedUnitIds } = {}) {
    if (!book || !Array.isArray(book.pages)) {
        throw new Error('当前图书无可导出内容');
    }

    const structure = buildBookStructure(book);
    const selection = selectedUnitIds == null ? null : new Set(selectedUnitIds);
    const units = structure.units.filter(unit => !selection || selection.has(unit.id));
    if (!units.length) throw new Error('请至少选择一个要导出的章节');
    const selectedPages = new Set(units.flatMap(unit => unit.sourcePages));
    const isPartial = units.length < structure.units.length;
    const bookTitle = safeExportTitle(book.title || '图书');
    const folderName = `${bookTitle}_${isPartial ? '所选章节笔记包' : '分章节笔记包'}`;
    const files = [];
    const chapterFiles = [];
    const annotations = (Array.isArray(notes) ? notes : []).map(normalizeAnnotation).filter(Boolean)
        .filter(note => !book.id || !note.bookId || note.bookId === book.id)
        .filter(note => !isPartial || selectedPages.has(note.page))
        .map((note, idx) => ({ ...note, id: note.id || `export-${idx}` }));

    const filesByUnit = new Map(structure.units.map((unit, index) => [unit.id,
        `${String(index + 1).padStart(2, '0')}_${safeExportTitle(unit.title)}.md`]));
    let indexMd = `# 《${book.title}》 导读书册与笔记全览\n\n`;
    indexMd += `- 格式：${book.format || 'EPUB'}\n`;
    indexMd += `- ${isPartial ? '全书内容结构' : '内容结构'}：${structureSummary(structure)}\n`;
    indexMd += `- 导出范围：${isPartial ? '所选章节' : '整本书'}\n`;
    indexMd += `- 导出内容文件：${units.length}\n`;
    indexMd += `- 划线数：${annotations.filter(isHighlight).length}\n`;
    indexMd += `- 笔记数：${annotations.filter(isNote).length}\n`;
    indexMd += `- 导出时间：${new Date().toLocaleString()}\n\n`;
    indexMd += `## 目录结构\n`;
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
        indexMd += '\n## 其他保留内容\n';
        untitledUnits.forEach(unit => { indexMd += `- [${escapeMarkdownText(unit.title)}](./${encodeURIComponent(filesByUnit.get(unit.id))})\n`; });
    }

    // Resolve every annotation within its original source before combining
    // rendered Markdown. Joining HTML first would shift existing note offsets.
    function sourceMarkdown(pageNum) {
        const pageNotes = annotations.filter(n => n.page === pageNum);
        const tempDiv = document.createElement('div');
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
        markdown += `> 本章划线：${unitNotes.filter(isHighlight).length} 条 | 笔记：${unitNotes.filter(isNote).length} 条\n\n---\n\n`;
        markdown += unit.sourcePages.map(sourceMarkdown).join('\n');
        const file = { filename: filesByUnit.get(unit.id), text: markdown };
        files.push(file);
        chapterFiles.push(file);
    }

    const invalidPage = note => !Number.isInteger(note.page) || note.page < 1 || note.page > book.pages.length;
    const unassigned = annotations.filter(isNote).filter(invalidPage);
    if (unassigned.length) {
        files.push({ filename: '未归属笔记.md', text: '# 未归属笔记\n\n以下笔记的章节位置无效，保留引用与笔记内容以避免遗漏。\n\n' + chapterAnnotationMarkdown(unassigned) });
        indexMd += '\n[未归属笔记](./未归属笔记.md)\n';
    }
    unmatchedHighlights += annotations.filter(isHighlight).filter(invalidPage).length;
    if (unmatchedHighlights) indexMd += `\n> 有 ${unmatchedHighlights} 条高亮未能定位到正文，未生成正文标记。原始标注仍保留在书库及书籍备份中。\n`;
    files.push({ filename: '00_目录概览.md', text: indexMd });
    return { bookTitle, folderName, chapterFiles, files, unmatchedHighlights };
}

function safeExportTitle(title) {
    let name = String(title).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120).replace(/[\uD800-\uDBFF]$/, '').replace(/[. ]+$/, '') || '图书';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
    return name;
}

export async function exportChapters(book, notes = [], options = {}) {
    const structure = buildBookStructure(book);
    const selection = options.selectedUnitIds == null ? null : new Set(options.selectedUnitIds);
    const count = structure.units.filter(unit => !selection || selection.has(unit.id)).length;
    if (!count) throw new Error('请至少选择一个要导出的章节');
    // Browser pickers must start during the click, before expensive conversion.
    const destination = count > 1 && !window.auraDesktop ? await saveMarkdownFolder.pick() : null;
    if (count > 1 && !window.auraDesktop && !destination) return { status: 'canceled' };
    const documents = buildChapterDocuments(book, notes, options);
    if (documents.chapterFiles.length === 1) {
        const chapter = documents.chapterFiles[0];
        let text = chapter.text;
        const orphan = documents.files.find(file => file.filename === '未归属笔记.md');
        if (orphan) text += '\n\n' + orphan.text;
        if (documents.unmatchedHighlights) text += `\n\n> 有 ${documents.unmatchedHighlights} 条高亮未能定位到正文，原始标注仍保留在书库及书籍备份中。\n`;
        const filename = safeExportTitle(`${documents.bookTitle}_${chapter.filename.slice(0, -3)}`) + '.md';
        return { ...await downloadFile(filename, text, 'text/markdown;charset=utf-8'), kind: 'file' };
    }
    return saveMarkdownFolder(`${documents.bookTitle}_章节导出`, documents.files, destination);
}

// Compatibility adapter for legacy consumers; the product UI exports .md/folders.
export async function exportChapterZip(book, notes = [], jszipLib, options = {}) {
    if (!jszipLib) throw new Error('JSZip 尚未就绪，请检查网络连接');
    const { folderName, files } = buildChapterDocuments(book, notes, options);
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
    let md = '## 本章笔记\n\n';
    thoughts.forEach((note, idx) => {
        md += `### ${idx + 1}. 笔记 | P.${note.page}\n\n`;
        md += chapterNoteContent(note);
    });
    return md;
}

function chapterNoteContent(note) {
    let md = '';
    if (note.quote.trim()) {
        md += '> **原文引用**\n';
        md += note.quote.trim().split(/\r?\n/).map(line => `> ${escapeMarkdownText(line)}`).join('\n') + '\n';
        md += '>\n';
    } else {
        md += '> 独立随笔（未绑定原文）\n';
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

export function exportSelectiveBackup({ selectedBooks = [], notes = [], goalStates = [], goalGraphs, includeNotes = true }) {
    const normalizedNotes = (notes || []).map(normalizeAnnotation).filter(Boolean);
    const exportedAt = new Date().toISOString();
    const yyyymmdd = exportedAt.slice(0, 10).replace(/-/g, '');

    const files = selectedBooks.map(book => {
        const backupPayload = {
            version: goalGraphs ? "1.3" : "1.1",
            // Keep the existing envelope for compatibility with earlier readers.
            type: "aurareader_full_backup",
            exportedAt,
            books: [book],
            notes: normalizedNotes.filter(note => note.bookId === book.id),
            goalStates: goalStates.filter(state => state.bookId === book.id).map(state => includeNotes
                ? state : { bookId: state.bookId, goals: state.goals })
        };
        if (goalGraphs) { const graph = goalGraphs.get(book.id) || { goals: [], links: [], bookLinks: [] }; delete backupPayload.goalStates; backupPayload.goalGraph = includeNotes ? graph : { goals: graph.goals, ...(graph.bookLinks !== undefined ? { bookLinks: graph.bookLinks } : {}) }; }
        const bookTitle = String(book.title || book.id || '图书')
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
        const fileName = `AuraReader_Backup_${bookTitle}_${yyyymmdd}.aurabackup`;

        return { filename: fileName, data: JSON.stringify(backupPayload, null, 2) };
    });
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
        if (!file) return reject(new Error('未提供备份文件'));
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data || (data.type !== 'aurareader_full_backup' && !Array.isArray(data.notes) && !Array.isArray(data.books))) {
                    return reject(new Error('未识别的备份包格式'));
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
