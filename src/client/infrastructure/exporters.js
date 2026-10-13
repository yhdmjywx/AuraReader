/* ==========================================================================
   Exporters - Document & Annotation Export / Backup Adapter (Infrastructure Layer)
   Provides Markdown, Chapter-by-Chapter ZIP, Standalone Offline HTML,
   and per-book .aurabackup export & import deserialization.
   ========================================================================== */

import { ensureTocHierarchy } from '../domain/readingLocation.js';
import { groupAnnotationsByRange, normalizeAnnotation } from '../domain/annotationEngine.js';
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
    const folderName = `${book.title}_分章节笔记包`;
    const folder = zip.folder(folderName);

    let indexMd = `# 《${book.title}》 导读书册与笔记全览\n\n`;
    indexMd += `- 格式：${book.format || 'EPUB'}\n`;
    indexMd += `- 总章节数：${book.pages.length}\n`;
    indexMd += `- 划线随笔数：${notes.length}\n`;
    indexMd += `- 导出时间：${new Date().toLocaleString()}\n\n`;
    indexMd += `## 目录结构\n`;

    book.pages.forEach((pageHtml, idx) => {
        const pageNum = idx + 1;
        const pageNotes = notes.filter(n => n.page === pageNum);

        let chapTitle = `第${pageNum}章`;
        if (book.toc && book.toc[idx]) {
            chapTitle = book.toc[idx].title || chapTitle;
        }
        chapTitle = chapTitle.replace(/[\\/:*?"<>|]/g, '_');

        indexMd += `${pageNum}. [${chapTitle}](./${String(pageNum).padStart(2, '0')}_${chapTitle}.md)\n`;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pageHtml;

        let chapMd = `# ${chapTitle}\n\n`;
        chapMd += `> 页码：P.${pageNum} | 本章划线数：${pageNotes.length}\n\n---\n\n`;

        const paragraphs = tempDiv.querySelectorAll('p, h1, h2, h3, blockquote, div');
        const groups = groupAnnotationsByRange(pageNotes);
        const processedGroupKeys = new Set();

        if (paragraphs.length > 0) {
            paragraphs.forEach(p => {
                if (p.children.length > 0 && p.querySelector('p, h1, h2, h3, blockquote')) return;

                const text = p.innerText.trim();
                if (!text) return;

                if (p.tagName.startsWith('H')) {
                    chapMd += `## ${text}\n\n`;
                } else if (p.tagName === 'BLOCKQUOTE') {
                    chapMd += `> ${text}\n\n`;
                } else {
                    let paragraphText = text;
                    const matchedComments = [];

                    groups.forEach((group, groupIndex) => {
                        if (!group.quote) return;
                        const cleanQuote = group.quote.trim();
                        const normP = paragraphText.replace(/[\s\u00a0]+/g, ' ');
                        const normQ = cleanQuote.replace(/[\s\u00a0]+/g, ' ');
                        if (!paragraphText.includes(cleanQuote) && !normP.includes(normQ)) return;

                        processedGroupKeys.add(groupIndex);
                        if (!paragraphText.includes(`==${cleanQuote}==`)) {
                            if (paragraphText.includes(cleanQuote)) {
                                paragraphText = paragraphText.replace(cleanQuote, `==${cleanQuote}==`);
                            } else {
                                const firstWords = cleanQuote.slice(0, Math.min(8, cleanQuote.length));
                                const lastWords = cleanQuote.slice(Math.max(0, cleanQuote.length - 8));
                                const startIdx = paragraphText.indexOf(firstWords);
                                const endIdx = paragraphText.indexOf(lastWords);
                                if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
                                    const matchedSegment = paragraphText.substring(startIdx, endIdx + lastWords.length);
                                    if (!paragraphText.includes(`==${matchedSegment}==`)) {
                                        paragraphText = paragraphText.replace(matchedSegment, `==${matchedSegment}==`);
                                    }
                                }
                            }
                        }
                        group.notes.forEach(note => {
                            if (note.comment && !matchedComments.includes(note.comment)) {
                                matchedComments.push(note.comment);
                            }
                        });
                    });

                    chapMd += `${paragraphText}\n\n`;

                    matchedComments.forEach(comment => {
                        chapMd += `> 💭 **[随笔思考 | P.${pageNum}]**：${comment}\n\n`;
                    });
                }
            });
        } else {
            chapMd += tempDiv.innerText.trim() + '\n\n';
        }

        groups.forEach((group, groupIndex) => {
            if (processedGroupKeys.has(groupIndex)) return;
            group.notes.forEach(note => {
                if (note.comment) {
                    chapMd += `> 💭 **[随笔思考 | P.${pageNum}]**：${note.comment}\n\n`;
                }
            });
        });

        const fileName = `${String(pageNum).padStart(2, '0')}_${chapTitle}.md`;
        folder.file(fileName, chapMd);
    });

    folder.file('00_目录概览.md', indexMd);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadFile(`${book.title}_分章节笔记包.zip`, blob, 'application/zip');
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
