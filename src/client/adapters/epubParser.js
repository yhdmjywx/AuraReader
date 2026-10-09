/* ==========================================================================
   EpubParser - EPUB & TXT Document Format Parsing Adapter
   Extracts chapters, cleans styles, converts internal images to Base64 data URLs,
   parses NCX/NAV tables of contents, and produces standardized book objects.
   ========================================================================== */

export function findZipFile(zip, targetPath) {
    if (!zip || !targetPath) return null;
    const normalized = targetPath.replace(/^\/+/, '').replace(/\/\//g, '/');
    let decoded = normalized;
    try {
        decoded = decodeURIComponent(normalized);
    } catch (e) {
        // ignore
    }

    if (zip.file(normalized)) return zip.file(normalized);
    if (zip.file(decoded)) return zip.file(decoded);

    // Fuzzy case-insensitive search
    const keys = Object.keys(zip.files);
    const matchedKey = keys.find(k => {
        const kLower = k.toLowerCase();
        const normLower = normalized.toLowerCase();
        const decLower = decoded.toLowerCase();
        return kLower === normLower || kLower === decLower || kLower.endsWith('/' + normLower) || kLower.endsWith('/' + decLower);
    });
    return matchedKey ? zip.file(matchedKey) : null;
}

export async function processChapterImages(zip, chapterPath, chapDoc) {
    if (!chapDoc) return;
    const images = chapDoc.querySelectorAll("img, image, [*|href]");
    if (images.length === 0) return;

    const chapDir = chapterPath.includes('/') ? chapterPath.substring(0, chapterPath.lastIndexOf('/') + 1) : '';

    for (const img of images) {
        const rawSrc = img.getAttribute("src") || img.getAttribute("xlink:href") || img.getAttribute("href");
        if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('http')) continue;

        let imgPath = chapDir + rawSrc;
        const parts = imgPath.split('/');
        const stack = [];
        for (const p of parts) {
            if (p === '..') stack.pop();
            else if (p !== '.' && p !== '') stack.push(p);
        }
        imgPath = stack.join('/');

        const imgFile = findZipFile(zip, imgPath) || findZipFile(zip, rawSrc) || findZipFile(zip, rawSrc.split('/').pop());
        if (imgFile) {
            try {
                const base64 = await imgFile.async("base64");
                const ext = rawSrc.split('.').pop().toLowerCase();
                const mime = (ext === 'png') ? 'image/png' : (ext === 'gif') ? 'image/gif' : (ext === 'svg') ? 'image/svg+xml' : 'image/jpeg';
                const dataUrl = `data:${mime};base64,${base64}`;

                if (img.hasAttribute("src")) img.setAttribute("src", dataUrl);
                if (img.hasAttribute("xlink:href")) img.setAttribute("xlink:href", dataUrl);
                if (img.hasAttribute("href")) img.setAttribute("href", dataUrl);
            } catch (e) {
                console.warn("未成功转换图片:", rawSrc, e);
            }
        }
    }
}

export async function extractEpubToc(zip, opfDoc, opfDir, hrefToPageMap) {
    const tocItems = [];

    // 1. Parse EPUB 2 NCX TOC
    const ncxItem = opfDoc.querySelector("manifest > item[media-type*='ncx']") || opfDoc.querySelector("manifest > item[id='ncx']");
    let ncxPath = ncxItem ? opfDir + ncxItem.getAttribute("href") : null;
    let ncxFile = ncxPath ? findZipFile(zip, ncxPath) : null;
    if (!ncxFile) {
        const ncxKey = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.ncx'));
        if (ncxKey) ncxFile = zip.file(ncxKey);
    }

    if (ncxFile) {
        try {
            const ncxXmlText = await ncxFile.async("string");
            const navRegex = /<navPoint[^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content[^>]*src="([^"]*)"/gi;
            let match;
            while ((match = navRegex.exec(ncxXmlText)) !== null) {
                const labelText = match[1].replace(/<[^>]+>/g, '').trim();
                const contentSrc = match[2].trim();
                const [srcPath, anchor] = contentSrc.split('#');
                const cleanPath = srcPath.replace(/^\/+/, '');
                const fullPath = opfDir + cleanPath;

                const pageNum = hrefToPageMap[cleanPath] || hrefToPageMap[fullPath] || hrefToPageMap[cleanPath.split('/').pop()] || 1;

                tocItems.push({
                    title: labelText,
                    page: pageNum,
                    href: cleanPath,
                    anchor: anchor || '',
                    level: 0
                });
            }
        } catch (e) {
            console.warn("NCX 目录解析失败，将降级处理:", e);
        }
    }

    // 2. Parse EPUB 3 NAV.xhtml TOC (as fallback)
    if (tocItems.length === 0) {
        const navKey = Object.keys(zip.files).find(f => f.toLowerCase().includes('nav') && (f.endsWith('.xhtml') || f.endsWith('.html')));
        if (navKey) {
            try {
                const navHtmlText = await zip.files[navKey].async("string");
                const parser = new DOMParser();
                const navDoc = parser.parseFromString(navHtmlText, "text/html");
                navDoc.querySelectorAll("a").forEach(a => {
                    const title = a.textContent.trim();
                    const href = a.getAttribute("href");
                    if (title && href) {
                        const [srcPath, anchor] = href.split('#');
                        const cleanPath = srcPath.replace(/^\/+/, '');
                        const pageNum = hrefToPageMap[cleanPath] || hrefToPageMap[cleanPath.split('/').pop()] || 1;
                        tocItems.push({
                            title,
                            page: pageNum,
                            href: cleanPath,
                            anchor: anchor || '',
                            level: 0
                        });
                    }
                });
            } catch (e) {
                console.warn("NAV 目录解析错误:", e);
            }
        }
    }

    return tocItems;
}

export async function parseEpub(arrayBuffer, fileName, jszipLib) {
    if (!jszipLib) {
        throw new Error("JSZip 解压库未加载，请刷新页面后重试");
    }

    const zip = await jszipLib.loadAsync(arrayBuffer);

    // 1. Read container.xml to locate rootfile full-path
    const containerFile = findZipFile(zip, "META-INF/container.xml");
    if (!containerFile) throw new Error("无效的 EPUB 格式：未找到 container.xml");

    const containerXmlText = await containerFile.async("string");
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXmlText, "text/xml");
    const rootfilePath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");

    if (!rootfilePath) throw new Error("无法获取 EPUB 资源元数据路径 (rootfile)");

    // 2. Read OPF file
    const opfFile = findZipFile(zip, rootfilePath);
    if (!opfFile) throw new Error("未找到 OPF 配置文件: " + rootfilePath);

    const opfXmlText = await opfFile.async("string");
    const opfDoc = parser.parseFromString(opfXmlText, "text/xml");
    const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';

    // 3. Build href to page mapping
    const manifestItems = {};
    opfDoc.querySelectorAll("manifest > item").forEach(item => {
        manifestItems[item.getAttribute("id")] = item.getAttribute("href");
    });

    const spineItemrefs = opfDoc.querySelectorAll("spine > itemref");
    const pages = [];
    const hrefToPageMap = {};
    let pageNum = 1;

    for (const itemref of spineItemrefs) {
        const idref = itemref.getAttribute("idref");
        const href = manifestItems[idref];
        if (!href) continue;

        const htmlPath = opfDir + href;
        const chapterFile = findZipFile(zip, htmlPath);
        if (chapterFile) {
            const chapterHtmlText = await chapterFile.async("string");
            const chapDoc = parser.parseFromString(chapterHtmlText, "text/html");

            chapDoc.querySelectorAll("script, style, link").forEach(el => el.remove());
            chapDoc.querySelectorAll("[style]").forEach(el => el.removeAttribute("style"));

            await processChapterImages(zip, htmlPath, chapDoc);

            const bodyContent = chapDoc.body ? chapDoc.body.innerHTML : chapterHtmlText;
            pages.push(bodyContent);

            const cleanHref = href.replace(/^\/+/, '');
            hrefToPageMap[cleanHref] = pageNum;
            hrefToPageMap[opfDir + cleanHref] = pageNum;
            hrefToPageMap[cleanHref.split('/').pop()] = pageNum;

            pageNum++;
        }
    }

    if (pages.length === 0) throw new Error("未能解析提取出有效的章节正文文本");

    // 4. Extract TOC
    let toc = await extractEpubToc(zip, opfDoc, opfDir, hrefToPageMap);

    // Fallback headings extraction if TOC empty
    if (toc.length === 0) {
        pages.forEach((pageHtml, idx) => {
            const pDoc = parser.parseFromString(pageHtml, "text/html");
            const title = pDoc.querySelector("h1, h2, h3, title")?.textContent.trim() || `第 ${idx + 1} 节`;
            toc.push({ title, page: idx + 1 });
        });
    }

    const bookId = 'book_' + encodeURIComponent(fileName);
    return {
        id: bookId,
        title: fileName.replace(/\.(epub|equb)$/i, ''),
        format: 'EPUB',
        toc,
        pages,
        hrefToPageMap,
        updatedAt: new Date().toISOString()
    };
}

export function parseTxt(text, fileName) {
    const paragraphs = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const formattedHtml = `<h1>${escape(fileName)}</h1>` + paragraphs.map(p => `<p>${escape(p)}</p>`).join('');

    const bookId = 'book_' + encodeURIComponent(fileName);
    return {
        id: bookId,
        title: fileName,
        format: fileName.split('.').pop().toUpperCase(),
        toc: [{ title: '正文', page: 1 }],
        pages: [formattedHtml],
        updatedAt: new Date().toISOString()
    };
}
