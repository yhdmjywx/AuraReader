import { importEpubBytes } from './epubImport.js';
/* ==========================================================================
   EpubParser - EPUB & TXT Document Format Parsing Adapter (Infrastructure Layer)
   Extracts chapters, cleans styles, converts internal images to Base64 data URLs,
   parses NCX/NAV tables of contents, and produces standardized book objects.
   ========================================================================== */

import { resolveEpubUrl } from './epubPaths.js';
import { ensureTocHierarchy } from '../domain/readingLocation.js';

export function findZipFile(zip, targetPath) {
    if (!zip || !targetPath) return null;
    const resolved = resolveEpubUrl(targetPath);
    return resolved ? zip.file(resolved.path) : null;
}

const IMAGE_TYPES = { png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp' };

export async function processChapterImages(zip, chapterPath, chapDoc, manifest = []) {
    if (!chapDoc) return;
    for (const image of chapDoc.querySelectorAll('img, svg image')) {
        for (const attribute of ['src', 'href', 'xlink:href']) {
            const raw = image.getAttribute(attribute);
            if (!raw || raw.startsWith('#')) continue;
            const resolved = resolveEpubUrl(raw, chapterPath);
            const file = resolved && zip.file(resolved.path);
            if (!file) continue;
            const type = manifest.find(item => item.path === resolved.path)?.mediaType
                || IMAGE_TYPES[resolved.path.split('.').pop().toLowerCase()];
            if (!type?.startsWith('image/')) continue;
            const base64 = await file.async('base64');
            // Keep the export/backup projection self-contained and retain the source URL.
            image.setAttribute(`data-epub-${attribute.replace(':', '-')}`, raw);
            image.setAttribute(attribute, `data:${type};base64,${base64}`);
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
    return resolveEpubUrl(String(rel || '').trim(), `${baseDir || ''}__base__`)?.path || '';
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
    const map = hrefToPageMap || {};
    const page = map[resolved] || map[normalized] || map[path] || map[(opfDir || '') + normalized] || 1;
    return {
        page,
        href: normalized,
        anchor: resolveEpubUrl(`#${frag}`)?.fragment || frag || ''
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
        const navFile = href ? zip.file(resolveRelativePath(opfDir, href)) : null;
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
    const ncxPath = ncxItem ? resolveRelativePath(opfDir, ncxItem.getAttribute('href')) : null;
    let ncxFile = ncxPath ? zip.file(ncxPath) : null;
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
            console.warn("Could not parse NCX contents. Using fallback:", e);
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
            console.warn("Could not parse NAV contents:", e);
        }
    }

    return chooseHierarchicalToc(ncxItems, navItems);
}

/** @returns {Promise<import('../domain/book.js').Book>} */
export async function parseEpub(arrayBuffer, fileName, jszipLib, { signal } = {}) {
    const input = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : new Uint8Array(arrayBuffer).buffer;
    const result = await importEpubBytes(input, signal);
    const parser = new DOMParser();
    // Native HTML normalization preserves the existing annotation text coordinate system.
    // Binary resources stay in the original archive and load on demand.
    const pages = [];
    for (const [index, chapter] of result.chapters.entries()) {
        signal?.throwIfAborted();
        if (chapter.mediaType === 'image/svg+xml') {
            pages.push(chapter.text.replace(/<\?xml[^>]*\?>/i, ''));
        } else {
            const document = parser.parseFromString(chapter.text, 'text/html');
            document.querySelectorAll('script, style, link').forEach(element => element.remove());
            pages.push(document.body.innerHTML);
        }
        // Yield between native document projections so import remains interruptible.
        if (index % 8 === 7) await new Promise(resolve => setTimeout(resolve, 0));
    }
    let toc = result.toc;
    if (!toc.length) toc = pages.map((page, index) => {
        const document = parser.parseFromString(page, 'text/html');
        return { title: document.querySelector('h1, h2, h3, title')?.textContent.trim() || `Section ${index + 1}`, page: index + 1, level: 0 };
    });
    return { id: 'book_' + encodeURIComponent(fileName), title: result.title || fileName.replace(/\.(epub|equb)$/i, ''),
        format: 'EPUB', language: result.languages[0] || result.epub.documents.find(document => document.language)?.language || '',
        languages: result.languages, readerFlow: 'chapter', toc, pages, hrefToPageMap: result.hrefToPageMap,
        epub: result.epub, updatedAt: new Date().toISOString() };
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
        toc: [{ title: "Text", page: 1 }],
        pages: [formattedHtml],
        updatedAt: new Date().toISOString()
    };
}
