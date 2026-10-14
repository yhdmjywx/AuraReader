const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost:8095/' });
    const keys = ['window', 'document', 'NodeFilter', 'DOMParser', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
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
        const { exportChapterZip, exportMarkdown } = await import('../../src/client/infrastructure/exporters.js');
        const { parseEpub } = await import('../../src/client/infrastructure/epubParser.js');
        const { setDB } = await import('../../src/client/infrastructure/bookRepository.js');
        setDB(null);
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
        await controller.saveQuickNote('无选区独立随笔', 1);
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
        assert.ok(body.includes('重复句。 ==重复句。=='), '有效选区应只标记第二处重复引用，跨内联标签不丢字');
        assert.ok(body.includes('==Alpha beta gamma=='), '空白差异与内联标签仍应匹配');
        assert.ok(body.includes('==跨段开头==\n\n==跨段结尾=='), '跨段高亮应保留两个段落的标记');
        assert.ok(body.includes('## ==第一章=='), '标题中的高亮也应导出');
        assert.equal(body.split('开场文字。').length - 1, 1, '嵌套容器的直接文本不可遗漏或重复');
        assert.ok(body.includes('> 引述内容'), '引用块正文仍应存在');
        assert.ok(first.includes('> **原文引用**\n> 重复句。'));
        assert.ok(appendix.includes('> 跨段开头\n> 跨段结尾'), '跨行原文必须逐行引用');
        assert.ok(!appendix.includes('旧版本缺失句') && !/### \d+\. 划线/.test(first), '纯高亮不能另列为独立条目');
        assert.equal(appendix.split('### ').length - 1, 4, '只独立列出四条笔记');
        assert.ok(!first.includes('随笔思考'), '直接展示笔记内容，不加随笔思考标签');
        assert.ok(appendix.includes('独立随笔（未绑定原文）'));
        for (const comment of ['同一处原文的独立笔记', '已编辑的跨段笔记', '引用段落的思考', '无选区独立随笔']) {
            assert.equal(first.split(comment).length - 1, 1, '笔记内容不应遗漏或重复');
        }
        assert.ok(!first.includes('旧笔记内容') && !first.includes('将被删除的笔记'));
        assert.ok(!first.includes('其他书籍的笔记') && !first.includes('第二章的笔记'));
        assert.ok(second.includes('第二章的笔记') && second.includes('> 本章原文'));
        assert.ok(second.split('## 本章笔记\n')[0].includes('==本章原文与章节==笔记。'), '重叠高亮应合并正文标记，不出现嵌套或重复标记');
        assert.ok(third.includes('==单独裸文本=='), '没有段落标签的正文也应导出高亮');
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
        await exportChapterZip(fixture, [
            { id: 'alice-hl', kind: 'highlight', page: String(pageIndex + 1), quote: 'Down, down, down.' },
            { id: 'alice-note', kind: 'note', page: pageIndex + 1, quote: 'Down, down, down.', comment: 'Alice 引用验证' }
        ], JSZip);
        const actualZip = await JSZip.loadAsync(await downloads[1].blob.arrayBuffer());
        const actualFile = Object.keys(actualZip.files).find(name => name.includes('CHAPTER I. Down the Rabbit-Hole.md'));
        assert.ok(actualFile, 'EPUB 的实际目录位置应正确映射到章节文件，而非按 toc 数组下标猜测');
        const actualChapter = await actualZip.file(actualFile).async('string');
        assert.ok(actualChapter.includes('==Down, down, down.=='));
        assert.ok(actualChapter.includes('> Down, down, down.'));
        assert.ok(actualChapter.includes('Alice 引用验证'));
        assert.equal(actualChapter.split('## 本章笔记\n')[1].split('### ').length - 1, 1, '真实 EPUB 只独立输出笔记，不重复列出高亮');

        await persisted.deleteHighlight(highlight.id);
        await backup.exportChapterZip(book, persisted.getNotes());
        const afterDeleteZip = await JSZip.loadAsync(await downloads[2].blob.arrayBuffer());
        const afterDelete = await afterDeleteZip.file(files.find(name => /01_第一章\.md$/.test(name))).async('string');
        assert.ok(!afterDelete.split('## 本章笔记\n')[0].includes('==重复句。=='), '删除高亮后，下一次导出不应出现旧高亮');
        assert.ok(afterDelete.includes('同一处原文的独立笔记') && afterDelete.includes('> 重复句。'), '删除高亮不应删除同位置笔记或引用');
        exportMarkdown(book.title, [{ id: 'summary-note', kind: 'note', quote: '引用', comment: '笔记正文\n第二行', page: 1 }]);
        const summary = await downloads[3].blob.text();
        assert.ok(!summary.includes('随笔思考') && summary.includes('> 笔记正文\n> 第二行'), '笔记摘要也应移除该标签，保留完整多行内容');
        console.log('✅ ZIP 实际下载与解压验证：创建、编辑、删除、持久化、引用、高亮、跨段、重叠位置、章节归属及真实 EPUB 全部通过');
    } finally {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
        dom.window.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
