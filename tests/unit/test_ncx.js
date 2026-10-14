const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const assert = require('assert');

async function testNcxParser() {
    const epubPath = path.resolve(__dirname, '../fixtures/test.epub');
    const data = fs.readFileSync(epubPath);
    const zip = await JSZip.loadAsync(data);
    
    // Find toc.ncx
    const ncxEntry = Object.keys(zip.files).find(f => f.endsWith('.ncx'));
    assert.ok(ncxEntry, '测试书籍必须包含 NCX 目录');

    const ncxXmlText = await zip.files[ncxEntry].async("string");
    console.log("NCX Path:", ncxEntry);
    
    // Parse NCX navPoints
    const regex = /<navPoint[^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content[^>]*src="([^"]*)"/gi;
    let match;
    const tocItems = [];
    while ((match = regex.exec(ncxXmlText)) !== null) {
        const title = match[1].trim();
        const src = match[2].trim();
        tocItems.push({ title, src });
    }

    assert.strictEqual(tocItems.length, 16, 'Alice EPUB 应有 16 条目录');
    assert.strictEqual(tocItems.filter(item => item.title.startsWith('CHAPTER ')).length, 12);
    console.log(`Parsed ${tocItems.length} TOC items from NCX:`);
    console.log(tocItems.slice(0, 15));
}

testNcxParser().catch(err => {
    console.error(err);
    process.exit(1);
});
