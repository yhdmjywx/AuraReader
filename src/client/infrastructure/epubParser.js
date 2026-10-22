/* ==========================================================================
   EpubParser - EPUB & TXT Document Format Parsing Adapter (Infrastructure Layer)
   Extracts chapters, cleans styles, converts internal images to Base64 data URLs,
   parses NCX/NAV tables of contents, and produces standardized book objects.
   ========================================================================== */

import { ensureTocHierarchy } from '../domain/readingLocation.js';

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

function decodeCodePoint(num) {
    if (!Number.isFinite(num) || num < 0 || num > 0x10FFFF) return '';
    try {
        return String.fromCodePoint(num);
    } catch (e) {
        return '';
    }
}

function decodeXml(value) {
    const raw = String(value || '');
    const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    const source = cdata ? cdata[1] : raw.replace(/<[^>]+>/g, '');
    return source
        .replace(/&#(\d+);/g, (_, num) => decodeCodePoint(Number(num)))
        .replace(/&#x([0-9a-f]+);/gi, (_, num) => decodeCodePoint(parseInt(num, 16)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function dirOf(filePath) {
    if (!filePath) return '';
    const norm = String(filePath).replace(/\\/g, '/');
    const index = norm.lastIndexOf('/');
    return index >= 0 ? norm.slice(0, index + 1) : '';
}

export function resolveRelativePath(baseDir, rel) {
    if (!rel) return '';
    const raw = String(rel).trim().replace(/\\/g, '/');
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
    const rooted = raw.startsWith('/') ? raw.slice(1) : `${baseDir || ''}${raw}`;
    const stack = [];
    for (const part of rooted.split('/')) {
        if (part === '..') stack.pop();
        else if (part !== '.' && part !== '') stack.push(part);
    }
    return stack.join('/');
}

export function locateTocTarget(href, anchor, baseDir, opfDir, hrefToPageMap) {
    const raw = String(href || '').trim();
    const hash = raw.indexOf('#');
    let path = raw;
    let frag = anchor || '';
    if (hash >= 0) {
        path = raw.slice(0, hash);
        if (!frag) frag = raw.slice(hash + 1);
    }
    path = decodeXml(path);
    const resolved = resolveRelativePath(baseDir, path);
    let normalized = resolved || path.replace(/^\/+/, '');
    if (opfDir && normalized.startsWith(opfDir)) normalized = normalized.slice(opfDir.length);
    const baseName = normalized.split('/').pop();
    const map = hrefToPageMap || {};
    const page = map[resolved] || map[normalized] || map[path] || map[(opfDir || '') + normalized] || map[baseName] || 1;
    return {
        page,
        href: normalized,
        anchor: frag || ''
    };
}

function markTocParents(items) {
    for (let i = 0; i < items.length; i++) {
        const next = items[i + 1];
        items[i].hasChildren = !!(next && (Number(next.level) || 0) > (Number(items[i].level) || 0));
    }
    return items;
}

export function parseNcxNavPoints(xmlText) {
    const xml = String(xmlText || '');
    const navMap = xml.match(/<(?:[\w.-]+:)?navMap\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?navMap>/i);
    const source = navMap ? navMap[1] : xml;
    const root = { children: [] };
    const stack = [root];
    const tagRe = /<(\/)?([\w.-]+:)?(navPoint|text|content)\b([^>]*)>/gi;
    let match;

    while ((match = tagRe.exec(source)) !== null) {
        const closing = Boolean(match[1]);
        const name = match[3].toLowerCase();
        const attrs = match[4] || '';
        const selfClosing = /\/\s*$/.test(attrs);

        if (name === 'text' && !closing) {
            const closeRe = /<\/(?:[\w.-]+:)?text\s*>/gi;
            closeRe.lastIndex = tagRe.lastIndex;
            const closeMatch = closeRe.exec(source);
            if (closeMatch && stack.length > 1) {
                const node = stack[stack.length - 1];
                if (!node.title) node.title = decodeXml(source.slice(tagRe.lastIndex, closeMatch.index));
                tagRe.lastIndex = closeMatch.index + closeMatch[0].length;
            }
            continue;
        }

        if (name === 'navpoint' && !closing && !selfClosing) {
            const node = { title: '', href: '', anchor: '', children: [] };
            stack[stack.length - 1].children.push(node);
            stack.push(node);
            continue;
        }

        if (name === 'navpoint' && closing) {
            if (stack.length > 1) stack.pop();
            continue;
        }

        if (name === 'content' && !closing && stack.length > 1) {
            const srcMatch = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
            const src = srcMatch ? (srcMatch[1] != null ? srcMatch[1] : srcMatch[2]) : '';
            const node = stack[stack.length - 1];
            if (src && !node.href) {
                const decoded = decodeXml(src);
                const hash = decoded.indexOf('#');
                if (hash >= 0) {
                    node.href = decoded.slice(0, hash);
                    node.anchor = decoded.slice(hash + 1);
                } else {
                    node.href = decoded;
                }
            }
        }
    }

    const items = [];
    const walk = (nodes, level) => {
        for (const node of nodes) {
            const title = (node.title || '').trim();
            if (!title) {
                walk(node.children || [], level);
                continue;
            }
            items.push({
                title,
                href: node.href || '',
                anchor: node.anchor || '',
                level
            });
            if (node.children && node.children.length) walk(node.children, level + 1);
        }
    };
    walk(root.children, 0);
    return markTocParents(items);
}

function extractTocNavHtml(html) {
    const source = String(html || '');
    const navRe = /<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi;
    let match;
    let fallback = '';
    while ((match = navRe.exec(source)) !== null) {
        const attrs = match[1] || '';
        const body = match[2] || '';
        const typeMatch = attrs.match(/\b(?:epub:type|type|role)\s*=\s*["']([^"']+)["']/i);
        const typeValue = typeMatch ? typeMatch[1] : '';
        if (/\btoc\b/i.test(typeValue) || /doc-toc/i.test(typeValue)) return body;
        if (!fallback && /<a\b/i.test(body)) fallback = body;
    }
    return fallback;
}

export function parseNavTocDocument(html) {
    const source = extractTocNavHtml(html);
    if (!source) return [];
    const items = [];
    const tokenRe = /<(ol|ul)\b[^>]*>|<\/(ol|ul)>|<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
    let depth = 0;
    let match;
    while ((match = tokenRe.exec(source)) !== null) {
        if (match[1]) {
            depth += 1;
            continue;
        }
        if (match[2]) {
            depth = Math.max(0, depth - 1);
            continue;
        }
        const href = decodeXml(match[3] != null ? match[3] : match[4]);
        const title = decodeXml(match[5] || '');
        if (!title || !href) continue;
        const hash = href.indexOf('#');
        items.push({
            title,
            href: hash >= 0 ? href.slice(0, hash) : href,
            anchor: hash >= 0 ? href.slice(hash + 1) : '',
            level: Math.max(0, depth - 1)
        });
    }
    return markTocParents(items);
}

export function chooseHierarchicalToc(primary, secondary) {
    const lists = [primary, secondary].filter(list => Array.isArray(list) && list.length);
    if (!lists.length) return [];
    const score = (list) => {
        const maxLevel = list.reduce((max, item) => Math.max(max, Number(item.level) || 0), 0);
        return (maxLevel > 0 ? 1000000000 : 0) + list.length * 1000 + maxLevel;
    };
    return lists.slice().sort((a, b) => score(b) - score(a))[0];
}

export function bindTocPages(items, { baseDir = '', opfDir = '', hrefToPageMap = {} } = {}) {
    return (items || []).map(item => {
        const located = locateTocTarget(item.href, item.anchor, baseDir, opfDir, hrefToPageMap);
        return {
            title: item.title,
            page: located.page,
            href: located.href,
            anchor: located.anchor,
            level: Number(item.level) || 0,
            hasChildren: !!item.hasChildren
        };
    });
}

function findNavZipFile(zip, opfDoc, opfDir) {
    const manifestItems = opfDoc ? Array.from(opfDoc.querySelectorAll('manifest > item')) : [];
    const navItem = manifestItems.find(item => {
        const props = (item.getAttribute('properties') || '').toLowerCase().split(/\s+/);
        return props.includes('nav');
    });
    if (navItem) {
        const href = navItem.getAttribute('href');
        const navFile = href ? findZipFile(zip, opfDir + href) || findZipFile(zip, href) : null;
        if (navFile) return navFile;
    }
    const navKey = Object.keys(zip.files).find(file => {
        const lower = file.toLowerCase();
        return lower.includes('nav') && (lower.endsWith('.xhtml') || lower.endsWith('.html') || lower.endsWith('.htm'));
    });
    return navKey ? zip.file(navKey) : null;
}

export async function extractEpubToc(zip, opfDoc, opfDir, hrefToPageMap) {
    let ncxItems = [];
    let navItems = [];

    const ncxItem = opfDoc.querySelector("manifest > item[media-type*='ncx']") || opfDoc.querySelector("manifest > item[id='ncx']");
    const ncxPath = ncxItem ? opfDir + ncxItem.getAttribute('href') : null;
    let ncxFile = ncxPath ? findZipFile(zip, ncxPath) : null;
    if (!ncxFile) {
        const ncxKey = Object.keys(zip.files).find(file => file.toLowerCase().endsWith('.ncx') && !zip.files[file].dir);
        if (ncxKey) ncxFile = zip.file(ncxKey);
    }

    if (ncxFile) {
        try {
            const ncxXmlText = await ncxFile.async('string');
            ncxItems = bindTocPages(parseNcxNavPoints(ncxXmlText), {
                baseDir: dirOf(ncxFile.name),
                opfDir,
                hrefToPageMap
            });
        } catch (e) {
            console.warn('NCX 目录解析失败，将降级处理:', e);
        }
    }

    const navFile = findNavZipFile(zip, opfDoc, opfDir);
    if (navFile) {
        try {
            const navHtmlText = await navFile.async('string');
            navItems = bindTocPages(parseNavTocDocument(navHtmlText), {
                baseDir: dirOf(navFile.name),
                opfDir,
                hrefToPageMap
            });
        } catch (e) {
            console.warn('NAV 目录解析错误:', e);
        }
    }

    return chooseHierarchicalToc(ncxItems, navItems);
}

/** @returns {Promise<import('../domain/book.js').Book>} */
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
    let language = opfDoc.getElementsByTagNameNS('*', 'language')[0]?.textContent.trim() || '';

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
            if (!language) {
                const tagged = chapDoc.querySelector('[lang], [xml\\:lang]');
                language = tagged?.getAttribute('lang') || tagged?.getAttribute('xml:lang') || '';
            }

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
            const heading = pDoc.querySelector("h1, h2, h3, title");
            const title = heading?.textContent.trim() || `第 ${idx + 1} 节`;
            const tag = heading ? heading.tagName.toLowerCase() : '';
            const level = tag === 'h2' ? 1 : tag === 'h3' ? 2 : 0;
            toc.push({ title, page: idx + 1, level });
        });
    }
    toc = ensureTocHierarchy(toc);

    const bookId = 'book_' + encodeURIComponent(fileName);
    return {
        id: bookId,
        title: fileName.replace(/\.(epub|equb)$/i, ''),
        format: 'EPUB',
        language,
        readerFlow: 'chapter',
        toc,
        pages,
        hrefToPageMap,
        updatedAt: new Date().toISOString()
    };
}

/** @returns {import('../domain/book.js').Book} */
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
