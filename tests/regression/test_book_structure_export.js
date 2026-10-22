const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<body></body>');
    const keys = ['document', 'NodeFilter', 'window'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { buildBookStructure, readingUnitForPage, structureSummary } = await import('../../src/client/infrastructure/bookStructure.js');
        const { exportChapterZip } = await import('../../src/client/infrastructure/exporters.js');
        const { renderShelf } = await import('../../src/client/features/shelf/shelfUI.js');
        const { renderBackupBookList } = await import('../../src/client/features/backup/backupModalUI.js');
        const book = {
            id: 'structure', title: '结构测试', format: 'EPUB', readerFlow: 'chapter',
            pages: ['<h1>封面</h1><img src="cover.jpg">', '<h1>作者原序</h1><p>序文保留</p>',
                '<h1 id="same">第一部</h1>', '<h1 id="same">第一卷</h1>',
                '<h2 id="same">大堂</h2><p>重复句。重复句。😀</p><p>下一段。</p>',
                '<h2>第二章</h2><p>第二章原文。</p>',
                '<h1>第二卷</h1><p>卷前说明。</p>', '<h2>第三章</h2><p>第三章原文。</p>',
                '<h1>第三卷</h1><img src="data:image/png;base64,aW1hZ2U=">', '<h2>第四章</h2><p>第四章原文。</p>',
                '<h1>附录</h1><p>附录原文。</p>'],
            toc: [{ title: '作者原序', page: 2, level: 0 }, { title: '第一部', page: 3, level: 0 },
                { title: '第一卷', page: 4, level: 1 }, { title: '大堂', page: 5, level: 2 },
                { title: '第二章', page: 6, level: 2 }, { title: '第二卷', page: 7, level: 1 },
                { title: '第三章', page: 8, level: 2 }, { title: '第三卷', page: 9, level: 1 },
                { title: '第四章', page: 10, level: 2 }, { title: '附录', page: 11, level: 0 }],
            hrefToPageMap: { 'part.xhtml': 3, 'volume.xhtml': 4, 'chapter.xhtml': 5 }
        };
        const original = JSON.stringify(book);
        const structure = buildBookStructure(book);
        const unit = readingUnitForPage(structure, 3);
        assert.deepEqual(unit.sourcePages, [3, 4, 5]);
        assert.equal(readingUnitForPage(structure, 4), unit);
        assert.equal(readingUnitForPage(structure, 5), unit);
        assert.equal(unit.page, 5); assert.equal(unit.title, '大堂');
        assert.equal(structure.units.length, 9);
        assert.deepEqual(structure.units.flatMap(unit => unit.sourcePages), book.pages.map((_, i) => i + 1), '原始文件有且仅有一个输出归属');
        assert.deepEqual(structure.counts, { chapters: 4, frontmatter: 1, appendix: 1, volumeContent: 2, resources: 1, content: 0 });
        const notes = [
            { id: 'part', bookId: book.id, kind: 'highlight', page: 3, quote: '第一部' },
            { id: 'volume', bookId: book.id, kind: 'note', page: 4, quote: '第一卷', comment: '卷标题笔记' },
            { id: 'body', bookId: book.id, kind: 'note', page: 5, quote: '错误旧引用', comment: '第二处重复句笔记', location: { page: 5, start: 6, end: 10 } },
            { id: 'body-hl', bookId: book.id, kind: 'highlight', page: 5, quote: '重复句。😀', location: { page: 5, start: 6, end: 12 } },
            { id: 'preface', bookId: book.id, kind: 'note', page: 7, quote: '卷前说明。', comment: '卷前笔记' },
            { id: 'legacy', bookId: book.id, kind: 'note', page: 4, quote: '', comment: '历史独立随笔' },
            { id: 'other-book', bookId: 'other', kind: 'note', page: 4, quote: '第一卷', comment: '不允许跨书' }
        ];
        const savedNotes = JSON.stringify(notes);
        let blob;
        URL.createObjectURL = value => { blob = value; return 'blob:structure'; };
        URL.revokeObjectURL = () => {};
        dom.window.HTMLAnchorElement.prototype.click = function () {};
        await exportChapterZip(book, notes, JSZip);
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const files = Object.keys(zip.files).filter(name => name.endsWith('.md'));
        assert.equal(files.length, 10);
        assert.ok(!files.some(name => /_(第一卷|第一部)\.md$/.test(name)), '纯结构标题不单独导出');
        assert.ok(files.some(name => /_第二卷\.md$/.test(name)), '有说明的卷前内容单独保留');
        assert.ok(files.some(name => /_第三卷\.md$/.test(name)), '有插图的卷页单独保留');
        const index = await zip.file(files.find(name => name.endsWith('00_目录概览.md'))).async('string');
        assert.ok(!index.includes('总章节数：11'));
        assert.ok(index.includes(structureSummary(structure)));
        assert.ok(index.includes('- [第一部]') && index.includes('  - [第一卷]') && index.includes('    - [大堂]'));
        const chapterFile = files.find(name => name.endsWith('03_大堂.md'));
        for (const label of ['第一部', '第一卷', '大堂']) {
            assert.ok(index.includes(`[${label}](./${encodeURIComponent('03_大堂.md')})`));
        }
        const markdown = await zip.file(chapterFile).async('string');
        assert.ok(markdown.indexOf('第一部') < markdown.indexOf('第一卷') && markdown.indexOf('第一卷') < markdown.indexOf('大堂'));
        assert.equal(markdown.split('卷标题笔记').length - 1, 1);
        assert.equal(markdown.split('历史独立随笔').length - 1, 1);
        assert.ok(markdown.includes('重复句。<mark>重复句。😀</mark>'), '组合前在原文件解析重复文本偏移');
        assert.ok(markdown.includes('> **原文引用**\n> 重复句。\n>\n> 第二处重复句笔记'));
        assert.ok(!markdown.includes('错误旧引用') && !markdown.includes('不允许跨书'));
        assert.ok(markdown.includes('本章划线：2 条 | 笔记：3 条'));
        const illustrationFile = files.find(name => name.endsWith('_第三卷.md'));
        assert.ok((await zip.file(illustrationFile).async('string')).includes('<img src="data:image/png;base64,aW1hZ2U="'), '独立插图卷页的图片内容保留');
        const prefaceFile = files.find(name => name.endsWith('_第二卷.md'));
        assert.ok((await zip.file(prefaceFile).async('string')).includes('卷前笔记'));
        const list = document.createElement('ul');
        renderShelf({ elements: { shelfList: list }, books: [book] });
        assert.equal(list.querySelector('.shelf-book-meta').textContent, `EPUB · ${structureSummary(structure)}`);
        const backupList = document.createElement('div');
        renderBackupBookList({ backupBookCheckboxList: backupList }, [book], notes);
        assert.ok(backupList.textContent.includes(structureSummary(structure)), '备份选择列表复用同一统计');
        assert.equal(JSON.stringify(book), original); assert.equal(JSON.stringify(notes), savedNotes);
        const noToc = { ...book, toc: [] };
        assert.equal(buildBookStructure(noToc).units.length, book.pages.length, '缺失目录时不按卷名猜测删除文件');
        const ambiguous = { ...book, toc: [{ title: '第一卷', page: 4, level: 0 }, { title: '正文第一节', page: 5, anchor: 'a', level: 1 }, { title: '正文第二节', page: 5, anchor: 'b', level: 1 }] };
        const grouped = buildBookStructure(ambiguous);
        assert.deepEqual(readingUnitForPage(grouped, 4).sourcePages, [4, 5]);
        assert.equal(grouped.counts.chapters, 0, '一个文件多个目录节点不能谎报为一个实际章节');
        assert.equal(grouped.nodes.filter(node => node.page === 5).length, 2, '同文件多个锚点目录不丢失');
        const svgBook = { id: 'svg', title: '矢量插图', pages: ['<h1>第一卷</h1><svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>', '<p>正文</p>'],
            toc: [{ title: '第一卷', page: 1 }, { title: '第一章', page: 2 }] };
        await exportChapterZip(svgBook, [], JSZip);
        const svgZip = await JSZip.loadAsync(await blob.arrayBuffer());
        const svgMarkdown = await svgZip.file('矢量插图_分章节笔记包/01_第一卷.md').async('string');
        assert.ok(svgMarkdown.includes('<img src="data:image/svg+xml,'), '独立 SVG 卷页的矢量图不会在 Markdown 中消失');
        console.log('✅ 共享结构：嵌套卷/章、前置/附录/插图、无目录回退、真实 ZIP 解压、目录映射、统计、原文偏移与无损标注通过');
    } finally {
        URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL;
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
