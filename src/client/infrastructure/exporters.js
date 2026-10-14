/* ==========================================================================
   Exporters - Document & Annotation Export / Backup Adapter (Infrastructure Layer)
   Provides Markdown, Chapter-by-Chapter ZIP, Standalone Offline HTML,
   and per-book .aurabackup export & import deserialization.
   ========================================================================== */

import { ensureTocHierarchy } from '../domain/readingLocation.js';
import { groupAnnotationsByRange, normalizeAnnotation, isHighlight, isNote } from '../domain/annotationEngine.js';
import { resolveAnnotationRange } from '../domain/annotationRangeEngine.js';
import { renderAnnotationTokens } from '../features/reader/annotationRenderer.js';

export function downloadFile(filename, data, type) {
    if (typeof window === 'undefined') return;
    const blob = (data instanceof Blob) ? data : new Blob([data], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

export function exportMarkdown(bookTitle = '图书笔记', notes = []) {
    const groups = groupAnnotationsByRange(notes);
    let md = `# 划线与随笔笔记：《${bookTitle}》\n\n`;
    md += `> 导出时间：${new Date().toLocaleString()}\n\n`;
    md += `## 划线与随笔精选 (${notes.length} 条)\n\n`;

    groups.forEach((group, idx) => {
        md += `### ${idx + 1}. P.${group.page} ${group.chapter || ''}\n`;
        if (group.quote) md += `==${group.quote}==\n\n`;
        group.notes.forEach(note => {
            if (note.comment) md += `> 💭 **随笔思考**：${note.comment}\n\n`;
        });
        md += `---\n\n`;
    });

    downloadFile(`${bookTitle}_划线随笔.md`, md, 'text/markdown');
}

export async function exportChapterZip(book, notes = [], jszipLib) {
    if (!jszipLib) {
        throw new Error('JSZip 尚未就绪，请检查网络连接');
    }
    if (!book || !Array.isArray(book.pages)) {
        throw new Error('当前图书无可导出内容');
    }

    const zip = new jszipLib();
    const bookTitle = String(book.title || '图书').replace(/[\\/:*?"<>|\r\n]/g, '_');
    const folderName = `${bookTitle}_分章节笔记包`;
    const folder = zip.folder(folderName);
    const annotations = (Array.isArray(notes) ? notes : []).map(normalizeAnnotation).filter(Boolean)
        .filter(note => !book.id || !note.bookId || note.bookId === book.id)
        .map((note, idx) => ({ ...note, id: note.id || `export-${idx}` }));

    let indexMd = `# 《${book.title}》 导读书册与笔记全览\n\n`;
    indexMd += `- 格式：${book.format || 'EPUB'}\n`;
    indexMd += `- 总章节数：${book.pages.length}\n`;
    indexMd += `- 划线数：${annotations.filter(isHighlight).length}\n`;
    indexMd += `- 笔记数：${annotations.filter(isNote).length}\n`;
    indexMd += `- 导出时间：${new Date().toLocaleString()}\n\n`;
    indexMd += `## 目录结构\n`;

    book.pages.forEach((pageHtml, idx) => {
        const pageNum = idx + 1;
        const pageNotes = annotations.filter(n => n.page === pageNum);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pageHtml;

        let chapTitle = `第${pageNum}章`;
        const tocEntry = (book.toc || []).find(item => Number(item.page) === pageNum);
        const legacyEntry = book.toc && book.toc[idx];
        chapTitle = tocEntry?.title || (legacyEntry && legacyEntry.page == null ? legacyEntry.title : '')
            || tempDiv.querySelector('h1, h2, h3')?.textContent.trim() || chapTitle;
        chapTitle = chapTitle.replace(/[\\/:*?"<>|\r\n]/g, '_');
        const fileName = `${String(pageNum).padStart(2, '0')}_${chapTitle}.md`;

        indexMd += `${pageNum}. [${escapeMarkdownText(chapTitle)}](./${encodeURIComponent(fileName)})\n`;

        // Offsets are chapter-relative, as in the reader. Recover a quote only
        // when a record supplies a valid text range; quick notes have none.
        const text = tempDiv.textContent;
        const exportNotes = pageNotes.map(note => {
            if (note.quote.trim()) return note;
            const range = resolveAnnotationRange(text, note);
            return range ? { ...note, quote: text.slice(range.start, range.end) } : note;
        });
        renderAnnotationTokens(tempDiv, exportNotes, pageNum);

        let chapMd = `# ${escapeMarkdownText(chapTitle)}\n\n`;
        chapMd += `> 本章划线：${pageNotes.filter(isHighlight).length} 条 | 笔记：${pageNotes.filter(isNote).length} 条\n\n---\n\n`;
        chapMd += chapterBodyMarkdown(tempDiv) + '\n\n';
        chapMd += chapterAnnotationMarkdown(exportNotes);
        folder.file(fileName, chapMd);
    });

    const unassigned = annotations.filter(note => !Number.isInteger(note.page) || note.page < 1 || note.page > book.pages.length);
    if (unassigned.length) {
        folder.file('未归属标注.md', '# 未归属标注\n\n以下标注的章节位置无效，保留引用与笔记以避免遗漏。\n\n' + chapterAnnotationMarkdown(unassigned));
        indexMd += '\n[未归属标注](./未归属标注.md)\n';
    }
    folder.file('00_目录概览.md', indexMd);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadFile(`${bookTitle}_分章节笔记包.zip`, blob, 'application/zip');
}

function chapterAnnotationMarkdown(notes) {
    if (!notes.length) return '';
    let md = '## 本章笔记与划线\n\n';
    notes.forEach((note, idx) => {
        md += `### ${idx + 1}. ${isHighlight(note) ? '划线' : '笔记'} | P.${note.page}\n\n`;
        if (note.quote.trim()) {
            md += '> **原文引用**\n';
            md += note.quote.trim().split(/\r?\n/).map(line => `> ${escapeMarkdownText(line)}`).join('\n') + '\n\n';
        } else {
            md += '> 独立随笔（未绑定原文）\n\n';
        }
        if (isNote(note) && note.comment.trim()) md += `**随笔思考**\n\n${note.comment}\n\n`;
    });
    return md;
}

function escapeMarkdownText(text) {
    return String(text).replace(/[\\`*_{}\[\]<>]/g, '\\$&');
}

// Serialize annotated text in document order. Adjacent inline tokens share
// one marker; paragraph boundaries close it. No quote matching is repeated.
function chapterBodyMarkdown(root) {
    const blockSelector = 'p,h1,h2,h3,h4,h5,h6,blockquote,div,section,article,li,ul,ol,table,thead,tbody,tfoot,tr,td,th,pre,figure';
    function inline(nodes) {
        let result = '';
        let highlighted = false;
        function write(text, marked) {
            if (!text) return;
            if (highlighted !== marked) result += '==';
            highlighted = marked;
            result += escapeMarkdownText(text);
        }
        function visit(node, marked = false) {
            if (node.nodeType === 3) { write(node.textContent, marked); return; }
            if (node.nodeType !== 1 || node.matches('script,style')) return;
            if (node.tagName === 'BR') { write('\n', false); return; }
            const isMarked = marked || node.classList.contains('has-highlight');
            node.childNodes.forEach(child => visit(child, isMarked));
        }
        nodes.forEach(node => visit(node));
        if (highlighted) result += '==';
        return result.trim();
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
        if (/^H[1-6]$/.test(element.tagName)) return `${'#'.repeat(Math.min(Number(element.tagName[1]) + 1, 6))} ${inline([element])}\n\n`;
        if (element.tagName === 'BLOCKQUOTE') return children(element).trim().split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        if (element.querySelector(blockSelector)) return children(element);
        const text = inline([element]);
        return text ? text + '\n\n' : '';
    }
    return children(root).trim();
}

export function exportStandaloneHtml(book, notes = []) {
    if (!book || !Array.isArray(book.pages)) {
        throw new Error('当前图书无可导出内容');
    }

    const bookTitle = book.title;
    const allPages = book.pages;
    const allNotes = notes;
    const allToc = ensureTocHierarchy(book.toc || []);

    const standaloneHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>《${escapeHtml(bookTitle)}》 - 离线双栏带标注电子书</title>
    <style>
        :root {
            --primary: #4f46e5;
            --bg: #f8fafc;
            --paper-bg: #ffffff;
            --text: #1e293b;
            --border: #e2e8f0;
        }
        body {
            margin: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            height: 100vh;
            overflow: hidden;
        }
        .sidebar {
            width: 280px;
            background: #ffffff;
            border-right: 1px solid var(--border);
            padding: 16px;
            overflow-y: auto;
        }
        .sidebar h2 { font-size: 16px; margin-top: 0; color: var(--primary); }
        .toc-item { padding: 8px 12px; font-size: 13px; cursor: pointer; border-radius: 6px; }
        .toc-item:hover { background: #f1f5f9; color: var(--primary); }
        .main-workspace {
            flex: 1;
            display: flex;
            overflow: hidden;
        }
        .reader-col {
            flex: 3;
            padding: 32px 48px;
            overflow-y: auto;
            background: var(--paper-bg);
            line-height: 1.85;
            font-size: 18px;
        }
        .notes-col {
            flex: 1;
            min-width: 300px;
            background: #f8fafc;
            border-left: 1px solid var(--border);
            padding: 20px;
            overflow-y: auto;
        }
        .annotation-token { user-select: text; }
        .annotation-token.has-highlight { background: #fef08a; border-radius: 2px; }
        .annotation-token.has-note {
            text-decoration-line: underline;
            text-decoration-color: #ef4444;
            text-decoration-thickness: 2px;
            text-underline-offset: 3px;
        }
        .note-card {
            background: #ffffff;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 14px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            font-size: 13px;
        }
        .note-quote { color: #64748b; font-style: italic; margin-bottom: 6px; }
        .note-comment { font-weight: 600; color: #0f172a; }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2>《${escapeHtml(bookTitle)}》</h2>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 16px;">全书共有 ${allPages.length} 章节 | 标注 ${allNotes.length} 条</div>
        <div id="toc-list">
            ${allToc.map((t, idx) => {
                const level = Math.max(0, Math.min(Number(t.level) || 0, 6));
                return `<div class="toc-item" style="padding-left:${12 + level * 22}px" onclick="jumpPage(${t.page || idx + 1})">${idx + 1}. ${escapeHtml(t.title)}</div>`;
            }).join('')}
        </div>
    </div>
    <div class="main-workspace">
        <div class="reader-col" id="reader-canvas">
            ${allPages.map((p, idx) => `<div id="page-${idx+1}" style="margin-bottom: 60px;">${annotatePageHtml(p, allNotes.filter(n => Number(n.page) === idx + 1), idx + 1)}</div>`).join('')}
        </div>
        <div class="notes-col">
            <h3 style="font-size: 15px; margin-top: 0; color: var(--primary);">随笔标注卡片 (${allNotes.length})</h3>
            ${groupAnnotationsByRange(allNotes).map(group => `
                <div class="note-card">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">P.${group.page} | ${escapeHtml(group.chapter || '')}</div>
                    ${group.quote ? `<div class="note-quote">“${escapeHtml(group.quote)}”</div>` : ''}
                    ${group.notes.map(note => note.comment ? `<div class="note-comment">💭 ${escapeHtml(note.comment)}</div>` : '').join('')}
                </div>
            `).join('')}
        </div>
    </div>
    <script>
        function jumpPage(p) {
            const el = document.getElementById('page-' + p);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    </script>
</body>
</html>`;

    downloadFile(`${bookTitle}_带标注电子书.html`, standaloneHtml, 'text/html');
}

export function exportSelectiveBackup({ selectedBooks = [], notes = [] }) {
    const normalizedNotes = (notes || []).map(normalizeAnnotation).filter(Boolean);
    const exportedAt = new Date().toISOString();
    const yyyymmdd = exportedAt.slice(0, 10).replace(/-/g, '');

    selectedBooks.forEach(book => {
        const backupPayload = {
            version: "1.0",
            // Keep the existing envelope for compatibility with earlier readers.
            type: "aurareader_full_backup",
            exportedAt,
            books: [book],
            notes: normalizedNotes.filter(note => note.bookId === book.id)
        };
        const bookTitle = String(book.title || book.id || '图书')
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
        const fileName = `AuraReader_Backup_${bookTitle}_${yyyymmdd}.aurabackup`;

        downloadFile(fileName, JSON.stringify(backupPayload, null, 2), 'application/json;charset=utf-8');
    });
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

function annotatePageHtml(html, notes, page) {
    if (!html) return '';
    if (typeof document === 'undefined' || !notes || notes.length === 0) return html;
    const holder = document.createElement('div');
    holder.innerHTML = html;
    renderAnnotationTokens(holder, notes, page);
    return holder.innerHTML;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
