/** EPUB URLs are case-sensitive URLs rooted at the OCF container. */
/** @param {string} reference @param {string} [documentPath] */
export function resolveEpubUrl(reference, documentPath = '') {
    if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(reference) || /[\\\u0000]/.test(reference)) return null;
    const hash = reference.indexOf('#');
    const fragment = hash < 0 ? '' : reference.slice(hash + 1);
    const beforeHash = hash < 0 ? reference : reference.slice(0, hash);
    const queryIndex = beforeHash.indexOf('?');
    const query = queryIndex < 0 ? '' : beforeHash.slice(queryIndex);
    const encodedPath = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex);
    let decoded;
    let anchor;
    try { decoded = decodeURIComponent(encodedPath); anchor = decodeURIComponent(fragment); }
    catch { return null; }
    if (/[\\\u0000]/.test(decoded)) return null;
    const base = documentPath.slice(0, documentPath.lastIndexOf('/') + 1);
    const path = decoded ? (decoded.startsWith('/') ? decoded.slice(1) : base + decoded) : documentPath;
    const parts = [];
    for (const part of path.split('/')) {
        if (part === '..') { if (!parts.length) return null; parts.pop(); }
        else if (part && part !== '.') parts.push(part);
    }
    return { path: parts.join('/'), query, fragment: anchor };
}

/** @param {string} bookId @param {string} path */
export function publicationResourceUrl(bookId, path) {
    const key = bytesToBase64(new TextEncoder().encode(bookId)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `/api/publications/${key}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** @param {Uint8Array} bytes */
export function bytesToBase64(bytes) {
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 16384) {
        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 16384)));
    }
    return btoa(chunks.join(''));
}

/** Resolve CSS URLs and quoted imports in their own stylesheet's document base.
 * @param {string} css @param {string} bookId @param {string} sourcePath */
export function rewriteEpubCss(css, bookId, sourcePath) {
    /** @param {string} value */
    const resource = value => {
        const decoded = value.trim().replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_match, hex, character) => hex ? String.fromCodePoint(parseInt(hex, 16)) : character);
        if (decoded.startsWith('#')) return value;
        const resolved = resolveEpubUrl(decoded, sourcePath);
        return resolved ? publicationResourceUrl(bookId, resolved.path) + resolved.query
            + (resolved.fragment ? '#' + encodeURIComponent(resolved.fragment) : '') : value;
    };
    return css.replace(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)|(@import\s+)(["'])((?:\\.|[^"'\\])*)\5/gi,
        (_match, doubleQuoted, singleQuoted, unquoted, importPrefix, quote, imported) => importPrefix
            ? `${importPrefix}${quote}${resource(imported)}${quote}`
            : `url("${resource(doubleQuoted ?? singleQuoted ?? unquoted).replace(/"/g, '%22')}")`);
}
