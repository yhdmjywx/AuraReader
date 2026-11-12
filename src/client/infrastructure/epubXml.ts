import { DOMParser as XmlParser } from '@xmldom/xmldom';
import type { EpubDocument, EpubPackage, TocEntry } from '../domain/book.js';
import { resolveEpubUrl } from './epubPaths.js';

export function decodeEpubText(bytes: Uint8Array) {
    const bigEndian = bytes[0] === 0xfe && bytes[1] === 0xff || bytes[0] === 0 && bytes[1] === 0x3c;
    const littleEndian = bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0x3c && bytes[1] === 0;
    return new TextDecoder(bigEndian ? 'utf-16be' : littleEndian ? 'utf-16le' : 'utf-8', { fatal: true }).decode(bytes);
}
export function xml(source: string, html = false): Document {
    return new XmlParser({ onError(level, message) { if (level === 'fatalError') throw new Error(message); } })
        .parseFromString(source, html ? 'text/html' : 'application/xml') as unknown as Document;
}
export function descendants(root: Document | Element, name: string): Element[] {
    return Array.from(root.getElementsByTagName('*')).filter(element => element.localName?.toLowerCase() === name);
}
export function children(root: Element, name?: string) {
    return Array.from(root.childNodes).filter((node): node is Element => node.nodeType === 1 && (!name || (node as Element).localName?.toLowerCase() === name));
}
export function attributes(element?: Element | null): Record<string, string> {
    return Object.fromEntries(Array.from(element?.attributes || []).map(attribute => [attribute.name, attribute.value]));
}
const tokens = (value: string | null) => (value || '').split(/\s+/).filter(Boolean);
const text = (element?: Element | null) => element?.textContent?.trim() || '';
export function packageModel(source: string, packagePath: string): EpubPackage {
    const document = xml(source);
    const root = document.documentElement;
    if (root.localName !== 'package') throw new Error('The EPUB package document is invalid.');
    const metadataElement = descendants(root, 'metadata')[0];
    const metadata = metadataElement ? children(metadataElement).map(element => ({ name: element.localName,
        namespace: element.namespaceURI || '', value: text(element), attributes: attributes(element) })) : [];
    const identifier = metadata.find(item => item.name === 'identifier' && item.attributes.id === root.getAttribute('unique-identifier'))
        || metadata.find(item => item.name === 'identifier');
    const value = (property: string, fallback: string) => metadata.find(item => item.name === 'meta' && !item.attributes.refines
        && (item.attributes.property === property || item.attributes.name === property))?.value || fallback;
    const spine = descendants(root, 'spine')[0];
    return { version: 1, archive: '', packagePath, identifier: identifier?.value || '', attributes: attributes(root), metadata,
        spineAttributes: attributes(spine), rendition: { layout: value('rendition:layout', 'reflowable'), spread: value('rendition:spread', 'auto'),
            orientation: value('rendition:orientation', 'auto'), flow: value('rendition:flow', 'auto') },
        manifest: descendants(descendants(root, 'manifest')[0] || root, 'item').map(item => {
            const href = item.getAttribute('href') || '';
            return { id: item.getAttribute('id') || '', href, path: resolveEpubUrl(href, packagePath)?.path || '',
                mediaType: item.getAttribute('media-type') || (/\.x?html?(?:[#?]|$)/i.test(href) ? 'application/xhtml+xml' : ''),
                properties: tokens(item.getAttribute('properties')), fallback: item.getAttribute('fallback') || '', attributes: attributes(item) };
        }),
        spine: spine ? children(spine, 'itemref').map(item => ({ idref: item.getAttribute('idref') || '', linear: item.getAttribute('linear') || 'yes',
            properties: tokens(item.getAttribute('properties')), attributes: attributes(item) })) : [], documents: [], textModel: 'legacy-body-v1', diagnostics: [] };
}
export function publicationTitle(model: EpubPackage, fallback: string) {
    const titles = model.metadata?.filter(item => item.name === 'title') || [];
    const main = titles.filter(title => model.metadata?.some(item => item.attributes.refines === `#${title.attributes.id}`
        && item.attributes.property === 'title-type' && item.value === 'main'));
    const sequence = (id: string) => Number(model.metadata?.find(item => item.attributes.refines === `#${id}` && item.attributes.property === 'display-seq')?.value || 1);
    return (main.length ? main : titles).sort((a, b) => sequence(a.attributes.id!) - sequence(b.attributes.id!))[0]?.value || fallback;
}
export function spineResource(model: EpubPackage, idref: string, exists: (path: string) => boolean) {
    const seen = new Set<string>();
    let item = model.manifest.find(item => item.id === idref);
    while (item && !seen.has(item.id)) {
        seen.add(item.id);
        if (['application/xhtml+xml', 'image/svg+xml'].includes(item.mediaType) && exists(item.path)) return { item, chain: [...seen] };
        item = model.manifest.find(candidate => candidate.id === item!.fallback);
    }
    throw new Error(`No readable content in the EPUB fallback chain for ${idref}${item ? ' (circular reference)' : ''}.`);
}
export function documentModel(source: string, model: EpubPackage, spineIndex: number, page: number, id: string): EpubDocument {
    const document = xml(source, model.manifest.find(item => item.id === id)?.mediaType !== 'image/svg+xml');
    const root = document.documentElement;
    const body = descendants(document, 'body')[0];
    const head = descendants(document, 'head')[0];
    const itemref = model.spine[spineIndex]!;
    const item = model.manifest.find(item => item.id === id)!;
    const override = (name: string, fallback: string) => itemref.properties.find(property => property.startsWith(`rendition:${name}-`))?.slice(`rendition:${name}-`.length) || fallback;
    const viewport = descendants(document, 'meta').find(element => element.getAttribute('name')?.toLowerCase() === 'viewport')?.getAttribute('content') || '';
    const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    const intrinsic = (value: string | null, fallback?: number) => value && /^[\d.]+(?:px)?$/i.test(value) ? parseFloat(value) : fallback;
    const width = Number(viewport.match(/width\s*=\s*([\d.]+)/i)?.[1] || intrinsic(root.getAttribute('width'), viewBox?.[2]));
    const height = Number(viewport.match(/height\s*=\s*([\d.]+)/i)?.[1] || intrinsic(root.getAttribute('height'), viewBox?.[3]));
    const styles = head ? children(head).flatMap<NonNullable<EpubDocument['styles']>[number]>(element => {
        if (element.localName === 'style') return [{ text: element.textContent || '', media: element.getAttribute('media') || '' }];
        if (element.localName === 'link' && tokens(element.getAttribute('rel')).includes('stylesheet')) return [{ href: element.getAttribute('href') || '', media: element.getAttribute('media') || '' }];
        return [];
    }) : [];
    if (body) styles.push(...descendants(body, 'style').map(element => ({ text: element.textContent || '', media: element.getAttribute('media') || '' })));
    return { page, path: item.path, spineIndex, sectionId: `chapter-${page}`, idref: itemref.idref, renderedIdref: id,
        language: body?.getAttribute('lang') || body?.getAttribute('xml:lang') || root.getAttribute('lang') || root.getAttribute('xml:lang') || model.metadata?.find(item => item.name === 'language')?.value || '',
        direction: body?.getAttribute('dir') || root.getAttribute('dir') || '', linear: itemref.linear !== 'no',
        layout: override('layout', item.mediaType === 'image/svg+xml' ? 'pre-paginated' : model.rendition?.layout || 'reflowable'), spread: override('spread', model.rendition?.spread || 'auto'),
        orientation: override('orientation', model.rendition?.orientation || 'auto'),
        pageSpread: itemref.properties.find(property => /^(?:rendition:)?page-spread-(?:left|right|center)$/.test(property))?.split('-').pop() || '',
        viewport: width > 0 && height > 0 && Number.isFinite(width + height) ? { width, height } : undefined,
        attributes: { html: attributes(root), body: attributes(body) }, styles };
}
export function navigation(source: string, ncx = false): TocEntry[] {
    const document = xml(source, !ncx);
    const root = ncx ? descendants(document, 'navmap')[0] : descendants(document, 'nav').find(element =>
        tokens(element.getAttribute('epub:type') || element.getAttribute('type')).includes('toc') || element.getAttribute('role') === 'doc-toc');
    if (!root) return [];
    const result: TocEntry[] = [];
    const walk = (parent: Element, level: number) => {
        const entries = children(parent, ncx ? 'navpoint' : 'li');
        for (const entry of entries) {
            const label = ncx ? descendants(children(entry, 'navlabel')[0] || entry, 'text')[0] : children(entry).find(element => ['a', 'span'].includes(element.localName));
            const href = ncx ? children(entry, 'content')[0]?.getAttribute('src') : label?.getAttribute('href');
            const title = text(label);
            const nested = ncx ? entry : children(entry, 'ol')[0];
            const hasChildren = !!nested && children(nested, ncx ? 'navpoint' : 'li').length > 0;
            if (title) result.push({ title, href: href || '', level, hasChildren, navigable: !!href });
            if (hasChildren) walk(nested!, title ? level + 1 : level);
        }
    };
    const list = ncx ? root : children(root, 'ol')[0];
    if (list) walk(list, 0);
    return result;
}
export function fontEncryption(source: string) {
    return descendants(xml(source), 'encrypteddata').map(element => ({
        path: resolveEpubUrl(descendants(element, 'cipherreference')[0]?.getAttribute('URI') || '')?.path || '',
        algorithm: descendants(element, 'encryptionmethod')[0]?.getAttribute('Algorithm') || '' }));
}
