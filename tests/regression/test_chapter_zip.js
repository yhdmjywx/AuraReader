const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost:8095/' });
    const keys = ['window', 'document', 'NodeFilter', 'DOMParser', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let storage;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const blobs = new Map();
    const downloads = [];
    try {
        for (const key of keys) globalThis[key] = dom.window[key];
        URL.createObjectURL = blob => {
            const url = `blob:zip-${blobs.size}`;
            blobs.set(url, blob);
            return url;
        };
        URL.revokeObjectURL = () => {};
        dom.window.HTMLAnchorElement.prototype.click = function () {
            downloads.push({ filename: this.download, blob: blobs.get(this.href) });
        };
        const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');
        const { BackupController } = await import('../../src/client/features/backup/backupController.js');
        const { exportChapterZip, exportMarkdown, exportStandaloneHtml } = await import('../../src/client/infrastructure/exporters.js');
        const { parseEpub } = await import('../../src/client/infrastructure/epubParser.js');
        const { saveBookToDB } = await import('../../src/client/infrastructure/bookRepository.js');
        const { saveNoteToDB } = await import('../../src/client/infrastructure/annotationRepository.js');
        storage = await require('../helpers/sqlite').clientStorage();
        const book = {
            id: 'zip-integration', title: '导出验证', format: 'EPUB',
            pages: [
                '<h1>第一章</h1><div>开场文字。<p>重<span>复</span>句。 重复句。</p><p>Alpha <em>beta</em> gamma</p><p>跨段开头</p><p>跨段结尾</p><blockquote><p>引述内容</p></blockquote><p>普通结尾。</p></div>',
                '<h1>第二章</h1><p>本章原文与章节笔记。</p>',
                '单独裸文本'
            ],
            toc: [{ title: '第一章', page: 1 }, { title: '同章锚点', page: 1 }, { title: '第二章', page: 2 }]
        };
        const holder = document.createElement('div');
        await saveBookToDB(book);
        holder.innerHTML = book.pages[0];
        const source = holder.textContent;
        const start = source.lastIndexOf('重复句。');
        const location = { page: 1, sectionId: 'chapter-1', start, end: start + 4 };
        const controller = new AnnotationController({ callbacks: { getCurrentBookId: () => book.id } });
        const highlight = await controller.createHighlight({ quote: '重复句。', page: 1, location });
        await controller.saveModalNote({ quote: '重复句。', comment: '同一处原文的独立笔记', page: 1, location });
        await controller.createHighlight({ quote: 'Alpha \nbeta gamma', page: 1 });
        await controller.createHighlight({ quote: '跨段开头\n跨段结尾', page: 1 });
        await controller.createHighlight({ quote: '第一章', page: 1 });
        await controller.createHighlight({ quote: '旧版本缺失句', page: 1 });
        await controller.saveModalNote({ quote: '跨段开头\n跨段结尾', comment: '旧笔记内容', page: 1 });
        const edited = controller.getNotes().find(note => note.comment === '旧笔记内容');
        controller.openNoteModal(edited.quote, edited.id, 1);
        await controller.saveModalNote({ comment: '已编辑的跨段笔记\n第二行思考' });
        await controller.saveModalNote({ quote: '引述内容', comment: '引用段落的思考', page: 1 });
        // Old backups may contain unquoted notes. Keep them exportable without
        // re-enabling the now-disabled user action for creating these records.
        controller.notes.unshift({ id: 'legacy-quick', kind: 'note', bookId: book.id, quote: '', comment: '无选区独立随笔', page: 1 });
        await saveNoteToDB(controller.notes[0]);
        await controller.saveModalNote({ quote: '重复句。', comment: '将被删除的笔记', page: 1, location });
        await controller.deleteNote(controller.getNotes().find(note => note.comment === '将被删除的笔记').id);
        assert.ok(controller.getNotes().some(note => note.id === highlight.id), '删除同位置笔记不应删除高亮');
        await controller.saveModalNote({ quote: '本章原文', comment: '第二章的笔记', page: 2 });
        await controller.createHighlight({ quote: '本章原文', page: 2 });
        await controller.createHighlight({ quote: '原文与章节', page: 2 });
        await controller.createHighlight({ quote: '单独裸文本', page: 3 });
        const persisted = new AnnotationController({ callbacks: { getCurrentBookId: () => book.id } });
        await persisted.loadNotesForBook(book.id);
        assert.equal(persisted.getNotes().length, controller.getNotes().length, '持久化后恢复全部笔记和高亮');
        assert.equal(persisted.getShowHighlightsInSidebar(), false, '侧栏默认隐藏纯高亮');
        window.JSZip = JSZip;
        const backup = new BackupController();
        const notes = persisted.getNotes().map(note => ({ ...note, page: String(note.page) }));
        notes.push({ id: 'foreign', bookId: 'other-book', page: 1, quote: '重复句。', comment: '其他书籍的笔记' });
        notes.push({ id: 'unassigned', bookId: book.id, kind: 'highlight', page: 99, quote: '章节已不存在的引用' });
        notes.push({ id: 'unassigned-note', bookId: book.id, kind: 'note', page: 99, quote: '旧章节笔记原文', comment: '旧章节笔记内容' });
        await backup.exportChapterZip(book, notes);
        assert.equal(downloads.length, 1, '实际控制器应触发 ZIP 下载');
        const zip = await JSZip.loadAsync(await downloads[0].blob.arrayBuffer());
        const files = Object.keys(zip.files).filter(name => name.endsWith('.md'));
        const first = await zip.file(files.find(name => /01_第一章\.md$/.test(name))).async('string');
        const second = await zip.file(files.find(name => /02_第二章\.md$/.test(name))).async('string');
        const third = await zip.file(files.find(name => /03_第3章\.md$/.test(name))).async('string');
        const body = first.split('## 本章笔记\n')[0];
        const appendix = first.slice(body.length);
        assert.ok(body.includes('重复句。 <mark>重复句。</mark>'), '有效选区应只标记第二处重复引用，跨内联标签不丢字');
        assert.ok(body.includes('<mark>Alpha beta gamma</mark>'), '空白差异与内联标签仍应匹配');
        assert.ok(body.includes('<mark>跨段开头</mark>\n\n<mark>跨段结尾</mark>'), '跨段高亮应保留两个段落的标记');
        assert.ok(body.includes('## <mark>第一章</mark>'), '标题中的高亮也应导出');
        assert.equal(body.split('开场文字。').length - 1, 1, '嵌套容器的直接文本不可遗漏或重复');
        assert.ok(body.includes('> 引述内容'), '引用块正文仍应存在');
        assert.ok(body.includes('<mark>重复句。</mark>\n\n> **原文引用**\n> 重复句。\n>\n> 同一处原文的独立笔记'), '笔记应在原文段落后保留引用与评论');
        assert.ok(body.includes('<mark>跨段结尾</mark>\n\n> **原文引用**\n> 跨段开头\n> 跨段结尾\n>\n> 已编辑的跨段笔记\n> 第二行思考'), '跨段笔记跟随引用结束的段落，并保留引用换行');
        assert.ok(body.includes('> 引述内容\n\n> **原文引用**\n> 引述内容\n>\n> 引用段落的思考'), '引用块内的笔记接在引用块之后');
        assert.ok(appendix.includes('> 独立随笔（未绑定原文）'), '无原文位置的快速笔记留在章节末尾');
        assert.ok(!appendix.includes('旧版本缺失句') && !/### \d+\. 划线/.test(first), '纯高亮不能另列为独立条目');
        assert.equal(appendix.split('### ').length - 1, 1, '只有无原文位置的快速笔记留在章节末尾');
        assert.ok(!first.includes('随笔思考'), '直接展示笔记内容，不加随笔思考标签');
        assert.ok(appendix.includes('独立随笔（未绑定原文）'));
        for (const comment of ['同一处原文的独立笔记', '已编辑的跨段笔记', '引用段落的思考', '无选区独立随笔']) {
            assert.equal(first.split(comment).length - 1, 1, '笔记内容不应遗漏或重复');
        }
        assert.ok(!first.includes('旧笔记内容') && !first.includes('将被删除的笔记'));
        assert.ok(!first.includes('其他书籍的笔记') && !first.includes('第二章的笔记'));
        assert.ok(second.includes('<mark>本章原文与章节</mark>笔记。\n\n> **原文引用**\n> 本章原文\n>\n> 第二章的笔记'), '章节笔记应跟在对应正文段落后');
        assert.ok(!second.includes('## 本章笔记'), '已定位笔记不再放在章节末尾');
        assert.ok(third.includes('<mark>单独裸文本</mark>'), '没有段落标签的正文也应导出高亮');
        assert.ok(!third.includes('## 本章笔记'), '只有高亮的章节不得生成独立条目区域');
        const unassigned = await zip.file(files.find(name => name.endsWith('/未归属笔记.md'))).async('string');
        assert.ok(unassigned.includes('旧章节笔记内容') && unassigned.includes('旧章节笔记原文'));
        assert.ok(!unassigned.includes('章节已不存在的引用'), '无效章节的高亮也不得另列成引用条目');
        const index = await zip.file(files.find(name => name.endsWith('/00_目录概览.md'))).async('string');
        assert.ok(index.includes('有 2 条高亮未能定位到正文'), '失配高亮只汇总定位数量，不冒充正文或笔记');
        assert.ok(first.includes('本章划线：5 条 | 笔记：4 条'), '纯高亮和笔记计数应分别准确');
        if (process.env.AURA_ZIP_SAMPLE) fs.writeFileSync(process.env.AURA_ZIP_SAMPLE, Buffer.from(await downloads[0].blob.arrayBuffer()));

        const fixture = await parseEpub(fs.readFileSync(path.join(__dirname, '../fixtures/test.epub')), 'Alice.epub', JSZip);
        const pageIndex = fixture.pages.findIndex(html => {
            holder.innerHTML = html;
            return holder.textContent.includes('Down, down, down.');
        });
        assert.ok(pageIndex >= 0);
        holder.innerHTML = fixture.pages[pageIndex];
        const actualPageText = holder.textContent;
        const actualQuote = 'Down, down, down. Would the fall never come to an end?';
        const actualQuoteStart = actualPageText.indexOf(actualQuote);
        assert.ok(actualQuoteStart >= 0, '真实 EPUB 中应找到笔记对应的原文范围');
        const crossStart = actualPageText.indexOf('somebody underneath') + 5;
        const crossEnd = actualPageText.indexOf('nothing of tumbling') + 'nothing of tumbling'.length;
        assert.ok(crossStart >= 5 && crossEnd > crossStart, '真实 EPUB 中应找到用户报告的跨段范围');
        await exportChapterZip(fixture, [
            { id: 'alice-hl', kind: 'highlight', page: String(pageIndex + 1), quote: 'Down, down, down.' },
            {
                id: 'alice-cross', kind: 'highlight', page: pageIndex + 1,
                quote: actualPageText.slice(crossStart, crossEnd),
                location: { page: pageIndex + 1, start: crossStart, end: crossEnd }
            },
            {
                id: 'alice-note', kind: 'note', page: pageIndex + 1, quote: '错误旧引用', comment: 'Alice 引用验证',
                location: { page: pageIndex + 1, start: actualQuoteStart, end: actualQuoteStart + actualQuote.length }
            }
        ], JSZip);
        const actualZip = await JSZip.loadAsync(await downloads[1].blob.arrayBuffer());
        const actualFile = Object.keys(actualZip.files).find(name => name.includes('CHAPTER I. Down the Rabbit-Hole.md'));
        assert.ok(actualFile, 'EPUB 的实际目录位置应正确映射到章节文件，而非按 toc 数组下标猜测');
        const actualChapter = await actualZip.file(actualFile).async('string');
        assert.ok(actualChapter.includes('<mark>Down, down, down.</mark>'));
        assert.ok(actualChapter.includes('someb<mark>ody underneath'), '保留跨段选区的实际起点，包括词内选区');
        assert.ok(actualChapter.includes('nothing of tumbling</mark> down stairs!'), '保留跨段选区的实际终点');
        assert.ok(!actualChapter.includes('=='), '真实 EPUB 不再输出扩展高亮语法');
        const actualMarks = [...actualChapter.matchAll(/<mark>([\s\S]*?)<\/mark>/g)];
        assert.ok(actualMarks.length > 2, '真实 EPUB 的跨段和软换行高亮应分段输出');
        assert.ok(actualMarks.every(match => match[1].trim() && !/[\r\n]/.test(match[1]) && match[1] === match[1].trim()), '不生成空白高亮，标记不跨换行或包含边界空白');
        assert.equal(actualChapter.split('<mark>').length, actualChapter.split('</mark>').length, '所有高亮标签必须配对');
        assert.ok(actualChapter.includes(`> **原文引用**\n> ${actualQuote}\n>\n> Alice 引用验证`), '有效选区位置应提供准确的 EPUB 原文，修正旧引用文本');
        assert.ok(!actualChapter.includes('## 本章笔记'), '已定位的真实 EPUB 笔记跟随正文段落');
        if (process.env.AURA_EPUB_ZIP_SAMPLE) fs.writeFileSync(process.env.AURA_EPUB_ZIP_SAMPLE, Buffer.from(await downloads[1].blob.arrayBuffer()));

        await persisted.deleteHighlight(highlight.id);
        await backup.exportChapterZip(book, persisted.getNotes());
        const afterDeleteZip = await JSZip.loadAsync(await downloads[2].blob.arrayBuffer());
        const afterDelete = await afterDeleteZip.file(files.find(name => /01_第一章\.md$/.test(name))).async('string');
        assert.ok(!afterDelete.split('## 本章笔记\n')[0].includes('<mark>重复句。</mark>'), '删除高亮后，下一次导出不应出现旧高亮');
        assert.ok(afterDelete.includes('重复句。 重复句。\n\n> **原文引用**\n> 重复句。\n>\n> 同一处原文的独立笔记'), '删除高亮不应删除同位置笔记或引用');
        exportMarkdown(book.title, [{ id: 'summary-note', kind: 'note', quote: '引用', comment: '笔记正文\n第二行', page: 1 }]);
        const summary = await downloads[3].blob.text();
        assert.ok(!summary.includes('随笔思考') && summary.includes('> 笔记正文\n> 第二行'), '笔记摘要也应移除该标签，保留完整多行内容');
        assert.ok(summary.includes('<mark>引用</mark>') && !summary.includes('=='), '笔记摘要与分章正文统一采用 mark');

        const edgeBook = {
            id: 'mark-edges', title: '高亮边界',
            pages: [
                '<div>\n<p>Before someb<span>ody</span> underneath,\nso she fell past it.\n</p>\n \n<p>\n </p>\n<p>\n“Well!” nothing of tumbling down stairs.</p>\n</div>',
                '<p>first<br>second</p>',
                '<blockquote><p>quote one</p>\n\n<p>quote two</p></blockquote>',
                '<ul>\n<li>item one\n</li>\n<li>\nitem two</li>\n</ul>',
                '<p>A &lt; B &amp; C &gt; D; literal &amp;copy; *stars* [link](url) \\ ~~strike~~ ==equals== &lt;img src=x&gt; end.</p>'
            ],
            toc: []
        };
        const edgeNotes = edgeBook.pages.map((html, i) => {
            holder.innerHTML = html;
            const text = holder.textContent;
            const start = i === 0 ? text.indexOf('somebody underneath') + 5 : 0;
            const end = i === 0 ? text.indexOf('nothing of tumbling') + 'nothing of tumbling'.length : text.length;
            return { id: `edge-${i}`, kind: 'highlight', page: i + 1, quote: text.slice(start, end), location: { page: i + 1, start, end } };
        });
        await exportChapterZip(edgeBook, edgeNotes, JSZip);
        const edgeZip = await JSZip.loadAsync(await downloads[4].blob.arrayBuffer());
        const edgeChapters = await Promise.all(Object.keys(edgeZip.files).filter(name => /\/\d+_第\d+章\.md$/.test(name)).sort().map(name => edgeZip.file(name).async('string')));
        assert.equal(edgeChapters.length, 5);
        assert.ok(edgeChapters[0].includes('someb<mark>ody underneath,</mark>\n<mark>so she fell past it.</mark>\n\n<mark>“Well!” nothing of tumbling</mark> down stairs.'), '格式化 HTML、空段和跨内联节点不得产生空白高亮或打断选区');
        assert.ok(edgeChapters[1].includes('<mark>first</mark>\n<mark>second</mark>'), '显式换行两边都应保留高亮');
        assert.ok(edgeChapters[2].includes('> <mark>quote one</mark>\n> \n> <mark>quote two</mark>'), '跨引用段落保持引用结构');
        assert.ok(edgeChapters[3].includes('<mark>item one</mark>\n\n<mark>item two</mark>'), '列表项之间的缩进空白不生成高亮');
        edgeChapters.forEach(chapter => {
            holder.innerHTML = chapter;
            const marks = [...holder.querySelectorAll('mark')];
            assert.ok(marks.length && marks.every(mark => mark.textContent.trim() && !mark.querySelector('mark') && !/[\r\n]/.test(mark.textContent)), '高亮非空、不嵌套且不跨换行');
            assert.equal(chapter.split('<mark>').length, chapter.split('</mark>').length);
        });
        holder.innerHTML = edgeBook.pages[4];
        const literalSource = holder.textContent;
        holder.innerHTML = edgeChapters[4];
        assert.equal(holder.querySelector('mark').textContent, literalSource, 'HTML 字符、实体和 Markdown 分隔符必须保留为原文字面值');
        assert.ok(!holder.querySelector('script, img, a'), '原文中的特殊字符不能变成标签或链接');

        exportMarkdown('跨行摘要', [{ kind: 'highlight', page: 1, quote: '  first\n\n second  ' }]);
        const multilineSummary = await downloads[5].blob.text();
        assert.ok(multilineSummary.includes('  <mark>first</mark>\n\n <mark>second</mark>  '), '摘要中的空行和边界空白也不得被高亮');
        exportStandaloneHtml(book, await persisted.loadNotesForBook(book.id));
        const standalone = new JSDOM(await downloads.at(-1).blob.text());
        try {
            assert.equal(standalone.window.document.querySelectorAll('[id^="page-"]').length, book.pages.length);
            assert.ok(standalone.window.document.querySelector('[data-highlight-ids]'), 'HTML 导出包含恢复后的正文高亮');
            assert.ok(standalone.window.document.querySelector('[data-note-ids]'), 'HTML 导出包含恢复后的笔记关联');
            assert.ok(standalone.window.document.body.textContent.includes('已编辑的跨段笔记'));
            assert.ok(!standalone.window.document.body.textContent.includes('将被删除的笔记'));
        } finally { standalone.window.close(); }
        console.log('✅ ZIP 实际下载与解压验证：创建、编辑、删除、持久化、引用、高亮、跨段、重叠位置、章节归属及真实 EPUB 全部通过');
    } finally {
        await storage?.drain();
        await storage?.close();
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
        dom.window.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
