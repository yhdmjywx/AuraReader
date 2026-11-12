const JSZip = require('jszip');

async function publicationFixture() {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file('OPS/package.opf', `<package version="3.0" unique-identifier="id" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:aura:p0-fixture</dc:identifier><dc:title>P0 publication</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-11-12T00:00:00Z</meta></metadata>
        <manifest><item id="one" href="./Text/first.xhtml" media-type="application/xhtml+xml"/><item id="two" href="Other/first.xhtml" media-type="application/xhtml+xml"/>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="picture" href="Images/green%20%23.svg" media-type="image/svg+xml"/><item id="wrong" href="Other/green.svg" media-type="image/svg+xml"/>
        <item id="css" href="Styles/book.css" media-type="text/css"/></manifest>
        <spine><itemref idref="one"/><itemref idref="two"/></spine></package>`);
    zip.file('OPS/Text/first.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>First source</title><link rel="stylesheet" href="../Styles/book.css"/></head><body>
        <h1>EPUB P0 source one</h1><p id="quote">Stable quotation for highlights and margin notes.</p>
        <p><a id="cross" href="../Other/./first.xhtml?edition=1#%E7%9B%AE%E6%A0%87">Continue to source two</a></p>
        <img id="picture" src="../Images/./green%20%23.svg?size=small#image" alt="Green resource" width="120" height="60"/>
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><image href="../Images/green%20%23.svg" width="120" height="60"/></svg>
        ${Array.from({ length: 30 }, (_, index) => `<p>Reading paragraph ${index}. Stable page locations connect quotations, highlights, notes and Goals.</p>`).join('')}
        </body></html>`);
    zip.file('OPS/Other/first.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><body><h1 id="目标">EPUB P0 source two</h1><p>Second source has the same filename in a different directory.</p><p><a href="../Text/first.xhtml#quote">Return to source one</a></p></body></html>');
    zip.file('OPS/nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="Text/first.xhtml">First source</a></li><li><a href="Other/first.xhtml#目标">Second source</a></li></ol></nav></body></html>');
    zip.file('OPS/Images/green #.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#208542"/></svg>');
    zip.file('OPS/Other/green.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="120" height="60" fill="red"/></svg>');
    zip.file('OPS/Styles/book.css', 'body { color: #123456 }');
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { publicationFixture };
