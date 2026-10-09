const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function testFullNcx() {
    const epubPath = path.resolve(__dirname, '../fixtures/test.epub');
    const data = fs.readFileSync(epubPath);
    const zip = await JSZip.loadAsync(data);
    
    // Find container.xml
    const containerFile = Object.keys(zip.files).find(f => f.endsWith('container.xml'));
    const containerXmlText = await zip.files[containerFile].async("string");
    const rootfilePath = containerXmlText.match(/full-path="([^"]*)"/)[1];
    
    const opfXmlText = await zip.files[rootfilePath].async("string");
    const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';

    // Build hrefToPageMap from spine
    const manifestItems = {};
    const manifestRegex = /<item[^>]*id="([^"]*)"[^>]*href="([^"]*)"/gi;
    let match;
    while ((match = manifestRegex.exec(opfXmlText)) !== null) {
        manifestItems[match[1]] = match[2];
    }
    
    const spineRegex = /<itemref[^>]*idref="([^"]*)"/gi;
    const hrefToPageMap = {};
    let pageNum = 1;
    while ((match = spineRegex.exec(opfXmlText)) !== null) {
        const idref = match[1];
        const href = manifestItems[idref];
        if (href) {
            hrefToPageMap[href] = pageNum;
            hrefToPageMap[opfDir + href] = pageNum;
            hrefToPageMap[href.split('/').pop()] = pageNum;
            pageNum++;
        }
    }

    console.log(`Mapped ${Object.keys(hrefToPageMap).length} hrefs to ${pageNum - 1} pages.`);

    // Parse NCX
    const ncxKey = Object.keys(zip.files).find(f => f.endsWith('.ncx'));
    const ncxTxt = await zip.files[ncxKey].async("string");
    
    const tocItems = [];
    const navRegex = /<navPoint[^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content[^>]*src="([^"]*)"/gi;
    while ((match = navRegex.exec(ncxTxt)) !== null) {
        const labelText = match[1].replace(/<[^>]+>/g, '').trim();
        const contentSrc = match[2].trim();
        const [srcPath, anchor] = contentSrc.split('#');
        const cleanPath = srcPath.replace(/^\/+/, '');
        
        const mappedPage = hrefToPageMap[cleanPath] || hrefToPageMap[opfDir + cleanPath] || hrefToPageMap[cleanPath.split('/').pop()] || 1;
        
        tocItems.push({
            title: labelText,
            page: mappedPage,
            href: cleanPath,
            anchor: anchor || ''
        });
    }

    console.log(`Successfully parsed ${tocItems.length} TOC items from NCX.`);
    console.log("Sample items with page numbers & anchors:");
    console.log(tocItems.slice(0, 8));
}

testFullNcx().catch(err => console.error(err));
