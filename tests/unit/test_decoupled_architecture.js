const assert = require('assert');
const path = require('path');

console.log("=== AuraReader 解耦架构核心模块单元测试 ===");

(async () => {
    // 1. 测试 ReadingLocation 模型与转换
    console.log("\n--- [测试 1: ReadingLocation 定位模型] ---");
    const { clampPage, calcSpreadPages, resolveTargetPage, findChapterForPage, createReadingLocation } = await import(
        '../../src/client/core/readingLocation.js'
    );

    const loc1 = createReadingLocation({ bookId: 'book-1', page: 2, totalPages: 5, sectionId: 'chapter-2', offset: 1250 });
    assert.strictEqual(loc1.sectionId, 'chapter-2', "ReadingLocation 必须保留独立 sectionId");
    assert.strictEqual(loc1.offset, 1250, "ReadingLocation 必须保留独立 offset");

    assert.strictEqual(clampPage(0, 10), 1, "clampPage 应该限制下界为 1");
    assert.strictEqual(clampPage(15, 10), 10, "clampPage 应该限制上界为 10");
    assert.strictEqual(clampPage(5, 10), 5, "clampPage 应该保留有效页码");

    const spread1 = calcSpreadPages(1, 10);
    assert.strictEqual(spread1.leftPage, 1, "第 1 页对开左页应为 1");
    assert.strictEqual(spread1.rightPage, 2, "第 1 页对开右页应为 2");
    assert.strictEqual(spread1.label, "1-2");

    const spreadLast = calcSpreadPages(10, 10);
    assert.strictEqual(spreadLast.leftPage, 9, "偶数页 10 左页应为 9");
    assert.strictEqual(spreadLast.rightPage, 10, "偶数页 10 右页应为 10");

    const spreadOddEnd = calcSpreadPages(5, 5);
    assert.strictEqual(spreadOddEnd.leftPage, 5);
    assert.strictEqual(spreadOddEnd.rightPage, null, "最后一页为奇数时右页应为 null");
    assert.strictEqual(spreadOddEnd.label, "5");

    const map = { 'chapter1.html': 3, 'chapter2.html': 7 };
    assert.strictEqual(resolveTargetPage('chapter1.html#sec1', map, 1), 3);
    assert.strictEqual(resolveTargetPage('/path/chapter2.html', map, 1), 7);
    assert.strictEqual(resolveTargetPage('unknown.html', map, 5), 5);

    const toc = [
        { title: '引言', page: 1 },
        { title: '第一章', page: 3 },
        { title: '第二章', page: 8 }
    ];
    assert.strictEqual(findChapterForPage(toc, 1), '引言');
    assert.strictEqual(findChapterForPage(toc, 5), '第一章');
    assert.strictEqual(findChapterForPage(toc, 9), '第二章');
    console.log("✅ ReadingLocation 定位模型测试全部通过！");

    // 2. 测试 ReaderEngine 阅读内核状态机
    console.log("\n--- [测试 2: ReaderEngine 纯阅读内核] ---");
    const { ReaderEngine } = await import('../../src/client/core/readerEngine.js');
    const engine = new ReaderEngine();

    const mockBook = {
        title: '测试图书',
        pages: ['<p>第1页</p>', '<p>第2页</p>', '<p>第3页</p>', '<p>第4页</p>', '<p>第5页</p>'],
        toc: [{ title: '第一章', page: 1 }, { title: '第二章', page: 3 }]
    };

    engine.setBook('test-book', mockBook);
    assert.strictEqual(engine.getCurrentPage(), 1);
    assert.strictEqual(engine.getTotalPages(), 5);

    // 单页翻页
    engine.nextPage(false);
    assert.strictEqual(engine.getCurrentPage(), 2);
    engine.prevPage(false);
    assert.strictEqual(engine.getCurrentPage(), 1);

    // 双页对开翻页
    engine.nextPage(true);
    assert.strictEqual(engine.getCurrentPage(), 3, "双页对开向前翻页应步进 2 页");
    engine.nextPage(true);
    assert.strictEqual(engine.getCurrentPage(), 5);
    engine.nextPage(true);
    assert.strictEqual(engine.getCurrentPage(), 5, "到达末页不应越界");
    engine.prevPage(true);
    assert.strictEqual(engine.getCurrentPage(), 3, "双页对开向后翻页应步退 2 页");

    assert.strictEqual(engine.getPageContent(1), '<p>第1页</p>');

    const locGo = engine.goToPage(3, 450);
    assert.strictEqual(locGo.page, 3);
    assert.strictEqual(locGo.offset, 450, "ReaderEngine 必须支持并保留偏移量 offset");
    assert.strictEqual(locGo.sectionId, 'chapter-3', "ReaderEngine 必须维护 sectionId");

    console.log("✅ ReaderEngine 阅读内核状态机测试全部通过！");

    // 3. 测试 AnnotationEngine 标注内核
    console.log("\n--- [测试 3: AnnotationEngine 标注算法内核] ---");
    const { filterNotes, findOverlappingNote, applyHighlightToHtml, createAnnotationObject } = await import(
        '../../src/client/core/annotationEngine.js'
    );

    const annot1 = createAnnotationObject({
        bookId: 'book-1',
        page: 2,
        offset: 1250,
        quote: '深度思考',
        comment: '思考笔记'
    });
    assert.strictEqual(annot1.location.sectionId, 'chapter-2', "Annotation 必须包含 location.sectionId");
    assert.strictEqual(annot1.location.offset, 1250, "Annotation 必须包含 location.offset");
    assert.strictEqual(annot1.location.page, 2, "Annotation 必须包含 location.page");

    const testNotes = [
        { id: 'n1', quote: '重要引文1', comment: '我的思考感悟', page: 1 },
        { id: 'n2', quote: '纯划线引文2', comment: '', page: 1 },
        { id: 'n3', quote: '纯划线引文3', comment: '   ', page: 2 }
    ];

    const defaultFiltered = filterNotes(testNotes, false);
    assert.strictEqual(defaultFiltered.displayedNotes.length, 1, "默认应仅展示带随笔思考的卡片");
    assert.strictEqual(defaultFiltered.pureCount, 2, "纯划线应有 2 条");

    const allFiltered = filterNotes(testNotes, true);
    assert.strictEqual(allFiltered.displayedNotes.length, 3, "开启显示划线时应展示全部卡片");

    // 重叠高亮检测
    const overlap1 = findOverlappingNote(testNotes, 1, '重要引文1');
    assert.strictEqual(overlap1.id, 'n1', "完全相同文本应匹配重叠");
    const overlap2 = findOverlappingNote(testNotes, 1, '重要引文');
    assert.strictEqual(overlap2.id, 'n1', "子串包含应匹配重叠");
    const overlapNone = findOverlappingNote(testNotes, 1, '无关文本');
    assert.strictEqual(overlapNone, null);

    // HTML 高亮替换 (含跨段落与换行)
    const rawHtml = '<p>第一段文字很长</p><p>第二段文字接续</p>';
    const crossQuote = '第一段文字很长\n第二段文字接续';
    const markedHtml = applyHighlightToHtml(rawHtml, { id: 'nh1', color: 'yellow', quote: crossQuote });
    assert.ok(markedHtml.includes('<mark class="hl-yellow" data-id="nh1">第一段文字很长</mark>'), "应成功拆分跨段落标记");
    assert.ok(markedHtml.includes('<mark class="hl-yellow" data-id="nh1">第二段文字接续</mark>'), "应成功拆分第二段标记");
    console.log("✅ AnnotationEngine 标注算法内核测试全部通过！");

    // 4. 测试 LayoutSystem 布局控制器与状态机
    console.log("\n--- [测试 4: LayoutSystem 布局控制器] ---");
    const { LayoutSystem, DOUBLE_PAGE_MIN_WIDTH } = await import('../../src/client/ui/layoutSystem.js');
    const layout = new LayoutSystem();

    layout.setPageMode('double', 1000);
    assert.strictEqual(layout.isDoublePageEffective(), true, "宽度 1000px 时双页模式生效");
    const lState = layout.getLayoutState();
    assert.strictEqual(lState.pageMode, 'double', "getLayoutState 应返回当前 pageMode");
    assert.strictEqual(typeof lState.sidebarOpen, 'boolean', "getLayoutState 应返回 sidebarOpen 状态");
    assert.strictEqual(typeof lState.splitRatio, 'number', "getLayoutState 应返回 splitRatio");

    // 模拟视口变窄降级
    const resp1 = layout.checkResponsiveLayout(600);
    assert.strictEqual(resp1.changed, true);
    assert.strictEqual(layout.isDoublePageEffective(), false, "宽度 600px < 760px 时应自适应降级为单页");
    assert.strictEqual(layout.getLayoutMode(), 'double', "基础偏好仍保持 double");

    // 模拟视口恢复
    const resp2 = layout.checkResponsiveLayout(900);
    assert.strictEqual(resp2.changed, true);
    assert.strictEqual(layout.isDoublePageEffective(), true, "宽度恢复后应自动恢复双页展开");

    console.log("✅ LayoutSystem 布局控制器测试全部通过！");

    // 5. 测试核心解耦缺陷排查（验证跨书隔离与多书备份可靠性）
    console.log("\n--- [测试 5: 数据边界隔离与跨书防串线验证] ---");
    const { loadNotesForBook, getNotesForBooks } = await import(
        '../../src/client/repositories/annotationRepository.js'
    );

    // 验证新书未保存笔记时返回空数组，而不是沿用上一本书的笔记
    const emptyBookNotes = await loadNotesForBook('non-existent-custom-book');
    assert.deepStrictEqual(emptyBookNotes, [], "未保存笔记的新书必须返回空数组，杜绝跨书笔记串线！");

    // 验证多书查询能正确获取 crisis-era 种子笔记
    const crisisNotes = await getNotesForBooks(['crisis-era']);
    assert.ok(crisisNotes.length > 0, "多书查询时 crisis-era 必须保留种子笔记");
    assert.strictEqual(crisisNotes[0].bookId, 'crisis-era');

    console.log("✅ 数据边界隔离与跨书防串线测试全部通过！");

    console.log("\n🎉 全部解耦架构单元测试 100% 成功！");
})();
