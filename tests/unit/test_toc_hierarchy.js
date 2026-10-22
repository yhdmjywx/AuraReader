const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== AuraReader 目录层级解析与渲染测试 ===');

function elementStub(tag) {
    return {
        tag,
        className: '',
        innerHTML: '',
        attrs: {},
        style: {},
        children: [],
        setAttribute(name, value) { this.attrs[name] = String(value); },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(type, fn) {
            this.listeners = this.listeners || {};
            this.listeners[type] = fn;
        }
    };
}

(async () => {
    const {
        parseNcxNavPoints,
        parseNavTocDocument,
        chooseHierarchicalToc,
        locateTocTarget,
        resolveRelativePath
    } = await import('../../dist/client/infrastructure/epubParser.js');
    const { ensureTocHierarchy, findChapterForPage } = await import('../../dist/client/domain/readingLocation.js');

    const nestedNcx = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <docTitle><text>不应进入目录</text></docTitle>
  <navMap>
    <navPoint id="preface">
      <navLabel><text>作者原序</text></navLabel>
      <content src="preface.xhtml"/>
    </navPoint>
    <navPoint id="vol1">
      <navLabel><text>第一卷</text></navLabel>
      <content src="Text/vol1.xhtml"/>
      <navPoint id="hall">
        <navLabel><text>大堂</text></navLabel>
        <content src="Text/ch1.xhtml#hall"/>
      </navPoint>
      <navPoint id="pierre">
        <navLabel><text>彼埃尔·格兰古瓦</text></navLabel>
        <content src="Text/ch2.xhtml"/>
      </navPoint>
      <navPoint id="bishop">
        <navLabel><text>红衣主教大人</text></navLabel>
        <content src="Text/ch3.xhtml"/>
      </navPoint>
      <navPoint id="jacques">
        <navLabel><text>雅克·科坡诺勒老板</text></navLabel>
        <content src="Text/ch4.xhtml"/>
      </navPoint>
      <navPoint id="quasimodo">
        <navLabel><text>卡西莫多</text></navLabel>
        <content src="Text/ch5.xhtml"/>
      </navPoint>
      <navPoint id="esm">
        <navLabel><text>爱斯梅拉达姑娘</text></navLabel>
        <content src="Text/ch6.xhtml"/>
      </navPoint>
    </navPoint>
  </navMap>
</ncx>`;

    const nested = parseNcxNavPoints(nestedNcx);
    assert.deepStrictEqual(nested.map(item => item.title), [
        '作者原序', '第一卷', '大堂', '彼埃尔·格兰古瓦', '红衣主教大人', '雅克·科坡诺勒老板', '卡西莫多', '爱斯梅拉达姑娘'
    ]);
    assert.deepStrictEqual(nested.map(item => item.level), [0, 0, 1, 1, 1, 1, 1, 1]);
    assert.strictEqual(nested[1].hasChildren, true);
    assert.strictEqual(nested[0].hasChildren, false);
    assert.strictEqual(nested[2].href, 'Text/ch1.xhtml');
    assert.strictEqual(nested[2].anchor, 'hall');
    assert.strictEqual(nested.some(item => item.title === '不应进入目录'), false);
    console.log('✅ NCX 嵌套目录保持卷/章层级');

    const parentWithoutSrc = parseNcxNavPoints(`
      <navMap>
        <navPoint id="v"><navLabel><text>第一卷</text></navLabel>
          <navPoint id="c"><navLabel><text>大堂</text></navLabel><content src="hall.xhtml"/></navPoint>
        </navPoint>
      </navMap>`);
    assert.deepStrictEqual(parentWithoutSrc.map(item => [item.title, item.level]), [['第一卷', 0], ['大堂', 1]]);
    console.log('✅ 卷节点没有 content 时，子章节仍保留');

    const entityTitle = parseNcxNavPoints('<navMap><navPoint><navLabel><text>A &amp; B</text></navLabel><content src="a.xhtml"/></navPoint></navMap>');
    assert.strictEqual(entityTitle[0].title, 'A & B');

    const navHtml = `
      <nav epub:type="toc"><ol>
        <li><a href="preface.xhtml">作者原序</a></li>
        <li><a href="vol1.xhtml">第一卷</a>
          <ol>
            <li><a href="ch1.xhtml#hall"><span>大堂</span></a></li>
            <li><a href="ch2.xhtml">彼埃尔·格兰古瓦</a></li>
          </ol>
        </li>
      </ol></nav>
      <nav epub:type="landmarks"><ol><li><a href="start.xhtml">开始</a></li></ol></nav>`;
    const navItems = parseNavTocDocument(navHtml);
    assert.deepStrictEqual(navItems.map(item => [item.title, item.level, item.anchor]), [
        ['作者原序', 0, ''],
        ['第一卷', 0, ''],
        ['大堂', 1, 'hall'],
        ['彼埃尔·格兰古瓦', 1, '']
    ]);
    console.log('✅ EPUB3 nav 只取 toc，并保留嵌套');

    const flatLong = Array.from({ length: 12 }, (_, i) => ({ title: `条${i}`, level: 0 }));
    const chosen = chooseHierarchicalToc(flatLong, navItems);
    assert.strictEqual(chosen, navItems, '有层级的目录应优先于更长的扁平目录');
    const tied = chooseHierarchicalToc(nested, navItems);
    assert.strictEqual(tied.length, nested.length, '两者都有层级时保留条目更多的目录');

    assert.strictEqual(resolveRelativePath('OEBPS/', '../text/a.html'), 'text/a.html');
    const located = locateTocTarget('../text/a.html#x', '', 'OEBPS/', 'OEBPS/', { 'text/a.html': 4 });
    assert.strictEqual(located.page, 4);
    assert.strictEqual(located.href, 'text/a.html');
    assert.strictEqual(located.anchor, 'x');

    const flatBook = ensureTocHierarchy([
        { title: '作者原序', page: 1 },
        { title: '第一卷', page: 2 },
        { title: '大堂', page: 2 },
        { title: '彼埃尔·格兰古瓦', page: 4 },
        { title: '红衣主教大人', page: 6 },
        { title: '雅克·科坡诺勒老板', page: 8 },
        { title: '卡西莫多', page: 10 },
        { title: '爱斯梅拉达姑娘', page: 12 },
        { title: '第二卷', page: 14 },
        { title: '某章', page: 15 },
        { title: '译后记', page: 20 }
    ]);
    assert.deepStrictEqual(flatBook.map(item => item.level), [0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0]);
    assert.strictEqual(flatBook[1].hasChildren, true);
    assert.strictEqual(findChapterForPage(flatBook, 2), '大堂');
    assert.strictEqual(findChapterForPage(flatBook, 3), '大堂');
    assert.strictEqual(findChapterForPage(flatBook, 15), '某章');
    console.log('✅ 扁平的「第X卷」目录会补出章节缩进');

    const plain = ensureTocHierarchy([
        { title: '第一章', page: 1 },
        { title: '第二章', page: 2 }
    ]);
    assert.deepStrictEqual(plain.map(item => item.level), [0, 0]);

    const explicit = ensureTocHierarchy([
        { title: '第一卷', level: 2 },
        { title: '大堂', level: 3 }
    ]);
    assert.deepStrictEqual(explicit.map(item => item.level), [2, 3]);

    const JSZip = require('jszip');
    const epubPath = path.resolve(__dirname, '../fixtures/test.epub');
    const zip = await JSZip.loadAsync(fs.readFileSync(epubPath));
    const ncxKey = Object.keys(zip.files).find(file => file.toLowerCase().endsWith('.ncx'));
    const fixtureItems = parseNcxNavPoints(await zip.files[ncxKey].async('string'));
    assert.strictEqual(fixtureItems.length, 16, 'Alice EPUB 应解析出 16 条目录');
    assert.ok(fixtureItems.every(item => item.level === 0 && !item.hasChildren), '平级目录不应被误判为嵌套目录');
    const chapters = fixtureItems.filter(item => item.title.startsWith('CHAPTER '));
    assert.strictEqual(chapters.length, 12, '十二章正文都应出现在目录中');
    assert.strictEqual(chapters[0].title, 'CHAPTER I. Down the Rabbit-Hole');
    assert.strictEqual(chapters[11].title, 'CHAPTER XII. Alice’s Evidence');
    assert.strictEqual(chapters[0].anchor, 'pgepubid00003');
    assert.ok(fixtureItems[15].title.includes('PROJECT GUTENBERG'), '保留书内许可条目');
    const navItemsFromFixture = parseNavTocDocument(await zip.file('OEBPS/toc.xhtml').async('string'));
    assert.deepStrictEqual(navItemsFromFixture, fixtureItems, '同一书籍的 EPUB3 nav 和 NCX 目录应一致');
    console.log('✅ Alice EPUB 的 16 条目录、十二章正文及 EPUB3 nav / NCX 一致性');

    globalThis.document = { createElement: elementStub };
    const { renderTOC } = await import('../../dist/client/features/reader/tocUI.js');
    const tocList = elementStub('ul');
    const selected = [];
    renderTOC(flatBook, { tocList }, item => selected.push(item.title));
    assert.strictEqual(tocList.children.length, flatBook.length);
    assert.ok(tocList.children[0].className.includes('toc-level-0'));
    assert.ok(tocList.children[1].className.includes('toc-branch'));
    assert.ok(tocList.children[2].className.includes('toc-level-1'));
    assert.strictEqual(tocList.children[2].attrs['aria-level'], '2');
    assert.ok(tocList.children[2].innerHTML.includes('大堂'));
    assert.ok(!tocList.children[2].className.includes('toc-level-0'));
    tocList.children[2].listeners.click();
    assert.deepStrictEqual(selected, ['大堂']);
    console.log('✅ 目录抽屉按 level 缩进渲染');

    console.log('\n=== ALL TOC HIERARCHY CHECKS PASSED ===');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
