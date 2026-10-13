const assert = require('assert');

console.log('=== AuraReader 章节纸条计算 ===');

(async () => {
    const {
        isChapterFlowBook,
        sentenceStartOffset,
        sentenceSlice,
        columnMetrics,
        countColumns,
        columnFromScroll
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

    assert.strictEqual(countColumns(1600, 800), 2);
    assert.strictEqual(countColumns(0, 800), 1);
    assert.strictEqual(columnFromScroll(0, 400, 5), 1);
    assert.strictEqual(columnFromScroll(800, 400, 5), 3);
    assert.strictEqual(columnFromScroll(9999, 400, 5), 5);

    console.log('✅ 章节纸条计算通过');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
