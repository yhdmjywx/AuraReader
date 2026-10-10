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
    assert.strictEqual(annot1.color, 'green', "含随笔思考的标注应自动赋予 green 颜色");

    const pureAnnot = createAnnotationObject({
        bookId: 'book-1',
        quote: '纯划线文字',
        comment: ''
    });
    assert.strictEqual(pureAnnot.color, 'yellow', "纯划线标注应自动赋予 yellow 颜色");

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

    // 测试 LayoutSystem.initUI 事件监听与按钮点击响应
    function createMockElement(id) {
        const listeners = {};
        const classes = new Set();
        return {
            id,
            classList: {
                add: (...cls) => cls.forEach(c => classes.add(c)),
                remove: (...cls) => cls.forEach(c => classes.delete(c)),
                contains: (c) => classes.has(c)
            },
            style: {},
            textContent: '',
            title: '',
            className: '',
            addEventListener: (event, cb) => {
                listeners[event] = listeners[event] || [];
                listeners[event].push(cb);
            },
            click: () => {
                if (listeners['click']) {
                    listeners['click'].forEach(cb => cb({ preventDefault: () => {} }));
                }
            }
        };
    }

    const mockElements = {
        workspaceContainer: createMockElement('workspace-container'),
        readerPanel: { ...createMockElement('reader-panel'), clientWidth: 1000 },
        notesPanel: createMockElement('notes-panel'),
        resizerHandle: createMockElement('resizer-handle'),
        btnPageMode: createMockElement('btn-page-mode'),
        textPageMode: createMockElement('text-page-mode'),
        iconPageMode: createMockElement('icon-page-mode'),
        btnToggleSidebar: createMockElement('btn-toggle-sidebar'),
        btnCollapseSidebar: createMockElement('btn-collapse-sidebar'),
        btnSidebarRecall: createMockElement('btn-sidebar-recall'),
        textToggleSidebar: createMockElement('text-toggle-sidebar'),
        iconToggleSidebar: createMockElement('icon-toggle-sidebar')
    };

    layout.initUI(mockElements);

    // 4.1 点击 btnPageMode 切换单/双页
    assert.strictEqual(layout.getLayoutMode(), 'double');
    mockElements.btnPageMode.click();
    assert.strictEqual(layout.getLayoutMode(), 'single', "点击 btnPageMode 应从 double 切换为 single");
    assert.strictEqual(mockElements.textPageMode.textContent, '单页');

    mockElements.btnPageMode.click();
    assert.strictEqual(layout.getLayoutMode(), 'double', "再次点击 btnPageMode 应恢复为 double");
    assert.strictEqual(mockElements.textPageMode.textContent, '双页');

    // 4.2 点击 btnToggleSidebar 收起/展开笔记侧边栏
    assert.strictEqual(layout.getIsCollapsed(), false);
    mockElements.btnToggleSidebar.click();
    assert.strictEqual(layout.getIsCollapsed(), true, "点击 btnToggleSidebar 应收起笔记侧边栏");
    assert.strictEqual(mockElements.workspaceContainer.classList.contains('sidebar-collapsed'), true);

    mockElements.btnToggleSidebar.click();
    assert.strictEqual(layout.getIsCollapsed(), false, "再次点击 btnToggleSidebar 应展开笔记侧边栏");
    assert.strictEqual(mockElements.workspaceContainer.classList.contains('sidebar-collapsed'), false);

    // 4.3 点击 btnCollapseSidebar 收起侧边栏
    mockElements.btnCollapseSidebar.click();
    assert.strictEqual(layout.getIsCollapsed(), true, "点击 btnCollapseSidebar 应收起侧边栏");

    // 4.4 点击 btnSidebarRecall 展开侧边栏
    mockElements.btnSidebarRecall.click();
    assert.strictEqual(layout.getIsCollapsed(), false, "点击 btnSidebarRecall 应展开侧边栏");

    // 4.5 测试宽度为 0 时的安全回退防误降级
    const zeroWidthLayout = new LayoutSystem();
    zeroWidthLayout.initUI({
        ...mockElements,
        readerPanel: { ...mockElements.readerPanel, clientWidth: 0 }
    });
    // 初始为 single，切换为 double 时，clientWidth 虽为 0，但不应误判为狭窄降级，而应回退至 1200px 正常展开
    const zeroRes = zeroWidthLayout.togglePageMode();
    assert.strictEqual(zeroRes.layoutMode, 'double');
    assert.strictEqual(zeroRes.isAutoDowngraded, false, "clientWidth 为 0 时应回退兜底宽度，不应误触发 autoDowngraded");

    console.log("✅ LayoutSystem 布局控制器与 initUI 按钮交互测试全部通过！");

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

    // 6. 测试 Session 最小共享上下文与权威状态隔离
    console.log("\n--- [测试 6: Session 最小共享上下文与权威状态隔离] ---");
    const { Session } = await import('../../src/client/app/session.js');
    const sess = new Session('initial-book');
    assert.strictEqual(sess.getCurrentBookId(), 'initial-book', "Session 初始书籍 ID 正确");

    let notificationReceived = null;
    const unsubscribe = sess.subscribe(evt => {
        notificationReceived = evt;
    });

    sess.setCurrentBookId('switched-book');
    assert.strictEqual(sess.getCurrentBookId(), 'switched-book', "Session 书籍 ID 切换成功");
    assert.deepStrictEqual(notificationReceived, { currentBookId: 'switched-book', previousBookId: 'initial-book' });

    unsubscribe();
    sess.setCurrentBookId('another-book');
    assert.strictEqual(notificationReceived.currentBookId, 'switched-book', "退订后不再触发通知");
    console.log("✅ Session 最小共享上下文测试全部通过！");

    // 7. 测试 AppCoordinator 跨模块协作与独立 Feature Controllers
    console.log("\n--- [测试 7: AppCoordinator 跨模块协调与 Feature Controllers 隔离] ---");
    const { AppCoordinator } = await import('../../src/client/app/appCoordinator.js');
    const { ReaderController } = await import('../../src/client/features/reader/readerController.js');
    const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');
    const { LayoutController } = await import('../../src/client/features/layout/layoutController.js');

    const testEngine = new ReaderEngine();
    testEngine.setBook('book-abc', mockBook);
    const testLayout = new LayoutController();
    const testReader = new ReaderController({
        readerEngine: testEngine,
        layoutController: testLayout
    });
    testReader.setBook('book-abc', mockBook);

    const testAnnotations = new AnnotationController({
        callbacks: { getCurrentBookId: () => sess.getCurrentBookId() }
    });

    let toastMessage = '';
    const mockShell = {
        showToast: (msg) => { toastMessage = msg; }
    };

    const coord = new AppCoordinator({
        session: sess,
        readerController: testReader,
        annotationController: testAnnotations,
        layoutController: testLayout,
        appShell: mockShell
    });

    // 协调添加标注
    await coord.addAnnotation({
        type: 'highlight',
        quote: '第2页核心引文',
        page: 2,
        color: 'yellow'
    });

    const notesInAnnot = testAnnotations.getNotes();
    assert.strictEqual(notesInAnnot.length, 1, "Coordinator 协调添加高亮成功");
    assert.strictEqual(notesInAnnot[0].quote, '第2页核心引文');
    assert.strictEqual(notesInAnnot[0].color, 'yellow');

    // 协调单双页布局切换
    coord.changeReadingLayout('double');
    assert.strictEqual(testLayout.getLayoutMode(), 'double', "Coordinator 切换阅读布局至 double");
    assert.ok(toastMessage.includes('双页'), "AppShell 收到对应布局提示通知");

    coord.changeReadingLayout('single');
    assert.strictEqual(testLayout.getLayoutMode(), 'single', "Coordinator 切换阅读布局至 single");

    console.log("✅ AppCoordinator 跨模块协调机制测试全部通过！");

    // 8. 测试 ReaderController 封装高亮滚动与 Coordinator 委托
    console.log("\n--- [测试 8: ReaderController 封装高亮跳转与 DOM 隔离] ---");
    assert.strictEqual(typeof testReader.scrollToHighlight, 'function', "ReaderController 必须封装 scrollToHighlight");
    // 在无 DOM 或 elements 为空环境下调用应静默且不崩溃
    testReader.scrollToHighlight('note-123');

    // 验证 Coordinator.jumpToAnnotation 委托至 ReaderController 而无 DOM 依赖侵入
    coord.jumpToAnnotation(notesInAnnot[0].id);
    assert.ok(toastMessage.includes('跳转至 P.2'), "jumpToAnnotation 提示通知正确触发");
    console.log("✅ ReaderController 封装高亮跳转测试全部通过！");

    // 9. 测试 app.js 薄门面与 main.js 权威控制器单例统一（无裂脑状态）
    console.log("\n--- [测试 9: app.js 门面与 main.js 架构实例统一性] ---");
    const mainModule = await import('../../src/client/main.js');
    const appModule = await import('../../src/client/app.js');

    assert.strictEqual(appModule.readerController, mainModule.reader, "app.js 与 main.js 共享唯一的 ReaderController 实例");
    assert.strictEqual(appModule.annotationController, mainModule.annotations, "app.js 与 main.js 共享唯一的 AnnotationController 实例");
    assert.strictEqual(appModule.appCoordinator, mainModule.coordinator, "app.js 与 main.js 共享唯一的 AppCoordinator 实例");
    assert.strictEqual(appModule.session, mainModule.session, "app.js 与 main.js 共享唯一的 Session 实例");

    // 测试状态同步性
    mainModule.reader.currentPage = 4;
    assert.strictEqual(appModule.state.currentPage, 4, "main.js 修改当前页时 app.js state 实时权威同步");
    mainModule.reader.currentPage = 1; // 恢复初始状态

    console.log("✅ app.js 与 main.js 架构实例统一性测试全部通过！");

    console.log("\n🎉 全部解耦架构单元测试 100% 成功！");
})();

