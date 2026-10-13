const assert = require('assert');

console.log('=== AuraReader 章节纸条计算 ===');

(async () => {
    const {
        isChapterFlowBook,
        sentenceStartOffset,
        sentenceSlice,
        columnMetrics,
        countColumns,
        columnFromScroll,
        screenStep,
        screenStartForColumn
    } = await import('../../src/client/domain/chapterFlow.js');

    assert.strictEqual(isChapterFlowBook({ format: 'EPUB', readerFlow: 'chapter', pages: ['<p>a</p>'] }), true);
    assert.strictEqual(isChapterFlowBook({ format: 'EPUB', hrefToPageMap: { 'ch1.html': 1 } }), true);
    assert.strictEqual(isChapterFlowBook({ format: 'EPUB', title: '危机时代', pages: ['<p>a</p>'] }), false, '演示书没有 spine 映射，不走章节纸条');
    assert.strictEqual(isChapterFlowBook({ format: 'TXT', pages: ['<p>a</p>'] }), false);
    assert.strictEqual(isChapterFlowBook({ format: 'PDF', pages: ['<p>a</p>'] }), false);

    const sample = '历史的轮回而已。这才是真正的必然。';
    assert.strictEqual(sentenceStartOffset(sample, 0), 0);
    assert.strictEqual(sentenceStartOffset(sample, 4), 0);
    const second = sentenceStartOffset(sample, sample.indexOf('这才'));
    assert.strictEqual(sample[second], '这');
    assert.strictEqual(sentenceSlice(sample, sample.indexOf('必')), '这才是真正的必然。');
    assert.strictEqual(sentenceSlice('没有句号就到本段结束', 4), '没有句号就到本段结束');

    const single = columnMetrics(800, 'single');
    assert.strictEqual(single.columns, 1);
    assert.strictEqual(single.gap, 0);
    assert.strictEqual(single.colWidth, 800);
    assert.strictEqual(single.screenWidth, 800);

    const spread = columnMetrics(840, 'double');
    assert.strictEqual(spread.columns, 2);
    assert.strictEqual(spread.gap % 2, 0);
    assert.strictEqual(spread.screenWidth, spread.colWidth * 2 + spread.gap);
    assert.ok(spread.screenWidth <= 840);
    assert.strictEqual(screenStep(spread), spread.columns * spread.stride);
    assert.strictEqual(screenStep(spread), spread.screenWidth + spread.gap);
    assert.ok(screenStep(spread) > spread.screenWidth, '双页翻页步长必须比可见宽度多一个栏间距');
    assert.strictEqual(screenStartForColumn(1, spread), 0);
    assert.strictEqual(screenStartForColumn(2, spread), 0);
    assert.strictEqual(screenStartForColumn(9, spread), 4 * screenStep(spread));
    assert.strictEqual(screenStartForColumn(16, spread), 7 * screenStep(spread));
    assert.strictEqual(screenStep(single), single.screenWidth);

    const focusedSpread = columnMetrics(1192, 'double');
    assert.strictEqual(focusedSpread.colWidth, 560);
    assert.strictEqual(focusedSpread.gap, 72);
    assert.strictEqual(focusedSpread.screenWidth, 1192);
    assert.strictEqual(focusedSpread.stride, 632);
    assert.strictEqual(screenStep(focusedSpread), 1264);
    assert.strictEqual(screenStartForColumn(5, focusedSpread), 2528, '奇数末栏必须落在下一组双页左侧');
    assert.strictEqual(countColumns(5 * focusedSpread.stride - focusedSpread.gap, focusedSpread.stride), 5);

    const sidebarSpread = columnMetrics(1146, 'double');
    assert.strictEqual(sidebarSpread.colWidth, 537);
    assert.strictEqual(sidebarSpread.gap, 72);
    assert.strictEqual(sidebarSpread.screenWidth, 1146);
    assert.strictEqual(screenStep(sidebarSpread), 1218);
    const roundedSpread = columnMetrics(1145, 'double');
    assert.strictEqual(roundedSpread.colWidth, 536);
    assert.strictEqual(roundedSpread.screenWidth, 1144, '奇数容器宽度取整后不得溢出');

    const focusedSingle = columnMetrics(560, 'single');
    assert.strictEqual(focusedSingle.colWidth, 560);
    assert.strictEqual(focusedSingle.gap, 0);
    assert.strictEqual(screenStep(focusedSingle), 560);

    assert.strictEqual(countColumns(1600, 800), 2);
    assert.strictEqual(countColumns(0, 800), 1);
    assert.strictEqual(columnFromScroll(0, 400, 5), 1);
    assert.strictEqual(columnFromScroll(800, 400, 5), 3);
    assert.strictEqual(columnFromScroll(9999, 400, 5), 5);

    const { ReaderController } = await import('../../src/client/features/reader/readerController.js');
    let rendered = 0;
    const reader = new ReaderController({ callbacks: { onPageRendered: () => rendered++ } });
    reader.setBook('chapter-merge-test', { format: 'EPUB', readerFlow: 'chapter', pages: ['<p>章节原文</p>'], toc: [] });
    reader.paintChapter = () => {};
    reader.layoutAndPlace = () => {};
    reader.renderPage(1);
    assert.strictEqual(rendered, 1, '章节分页渲染后必须触发 UI 分支的标注恢复回调');

    const { AppCoordinator } = await import('../../src/client/app/appCoordinator.js');
    const activated = [];
    const shown = [];
    const focused = [];
    const notes = [
        { id: 'chapter-note', kind: 'note', page: 2, quote: '章节原文', comment: '思考' },
        { id: 'standalone-note', kind: 'note', page: 2, quote: '', comment: '独立笔记' }
    ];
    const coordinator = new AppCoordinator({
        readerController: { isChapterFlow: () => true, showQuote: (...args) => shown.push(args) },
        annotationController: { getNotes: () => notes, focusNotes: ids => focused.push(ids) },
        selectionController: { activateAnnotationId: (...args) => activated.push(args) }
    });
    coordinator.jumpToAnnotation('chapter-note', { showMenu: true });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepStrictEqual(shown[0], [2, '章节原文', notes], '标注跳转必须继续使用章节位置');
    assert.deepStrictEqual(activated[0], ['chapter-note', { notify: false, showMenu: true }], '章节跳转后必须保留 UI 标注操作菜单');
    coordinator.jumpToAnnotation('standalone-note');
    assert.deepStrictEqual(focused[0], ['standalone-note'], '无引文的独立笔记必须保留 UI 侧栏定位');
    assert.strictEqual(shown.length, 1, '独立笔记不得触发空引文的章节跳转');

    console.log('✅ 章节纸条计算、渲染回调与标注跳转兼容通过');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
