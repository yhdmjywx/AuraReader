const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function testNcxParser() {
    const epubPath = path.resolve(__dirname, '../fixtures/test.epub');
    const data = fs.readFileSync(epubPath);
    const zip = await JSZip.loadAsync(data);
    
    // Find toc.ncx
    const ncxEntry = Object.keys(zip.files).find(f => f.endsWith('.ncx'));
    if (!ncxEntry) {
        console.log("No NCX file found!");
        return;
    }

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

    console.log(`Parsed ${tocItems.length} TOC items from NCX:`);
    console.log(tocItems.slice(0, 15));
}

testNcxParser();
