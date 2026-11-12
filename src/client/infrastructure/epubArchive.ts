import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter, configure, type FileEntry } from '@zip.js/zip.js/index-native.js';
import type { EpubPackage, TocEntry } from '../domain/book.js';
import { decodeEpubText, descendants, documentModel, fontEncryption, navigation, packageModel, publicationTitle, spineResource, xml } from './epubXml.js';
import { bytesToBase64, resolveEpubUrl } from './epubPaths.js';

configure({ useWebWorkers: false, useCompressionStream: true });
export interface EpubImportResult {
    epub: EpubPackage; title: string; languages: string[]; toc: TocEntry[];
    chapters: { text: string; mediaType: string }[]; hrefToPageMap: Record<string, number>;
}
/** ZIP, text decoding and package/navigation parsing run in the import worker. */
export async function readEpubArchive(bytes: Uint8Array): Promise<EpubImportResult> {
    const reader = new ZipReader(new Uint8ArrayReader(bytes));
    try {
        const entries = new Map((await reader.getEntries()).filter((entry): entry is FileEntry => !entry.directory).map(entry => [entry.filename, entry]));
        const texts = new Map<string, Promise<string>>();
        const read = (path: string): Promise<string> => {
            const cached = texts.get(path);
            if (cached) return cached;
            const entry = entries.get(path);
            if (!entry) throw new Error(`EPUB resource missing: ${path}`);
            if (entry.encrypted || ![0, 8].includes(entry.compressionMethod)) throw new Error(`Unsupported EPUB ZIP encoding: ${path}`);
            const result = entry.getData(new Uint8ArrayWriter()).then(decodeEpubText);
            texts.set(path, result); return result;
        };
        const container = xml(await read('META-INF/container.xml'));
        const rootfile = descendants(container, 'rootfile').find(element => element.getAttribute('media-type') === 'application/oebps-package+xml') || descendants(container, 'rootfile')[0];
        const packagePath = resolveEpubUrl(rootfile?.getAttribute('full-path') || '')?.path;
        if (!packagePath) throw new Error('Could not locate EPUB package metadata.');
        const epub = packageModel(await read(packagePath), packagePath);
        epub.archive = bytesToBase64(bytes);
        epub.encryption = entries.has('META-INF/encryption.xml') ? fontEncryption(await read('META-INF/encryption.xml')) : [];
        const hrefToPageMap: Record<string, number> = Object.create(null);
        const chapters: EpubImportResult['chapters'] = [];
        for (const [spineIndex, reference] of epub.spine.entries()) {
            const { item, chain } = spineResource(epub, reference.idref, path => entries.has(path));
            const source = await read(item.path);
            const page = chapters.length + 1;
            epub.documents.push(documentModel(source, epub, spineIndex, page, item.id));
            chapters.push({ text: source, mediaType: item.mediaType });
            for (const id of chain) {
                const resource = epub.manifest.find(candidate => candidate.id === id);
                if (resource?.path) hrefToPageMap[resource.path] ??= page;
            }
        }
        if (!chapters.length) throw new Error('The EPUB contains no readable spine documents.');
        const nav = epub.manifest.find(item => item.properties.includes('nav'));
        const ncx = epub.manifest.find(item => item.id === epub.spineAttributes?.toc) || epub.manifest.find(item => item.mediaType === 'application/x-dtbncx+xml');
        const navigationItem = nav && entries.has(nav.path) ? nav : ncx;
        const toc = navigationItem && entries.has(navigationItem.path) ? navigation(await read(navigationItem.path), navigationItem === ncx).map(entry => {
            if (entry.navigable === false) return entry;
            const target = resolveEpubUrl(entry.href || '', navigationItem.path);
            const page = target && hrefToPageMap[target.path];
            if (!page) epub.diagnostics!.push(`Navigation target is outside the readable spine: ${entry.href}`);
            return { ...entry, page: page || undefined, anchor: target?.fragment || '', href: target?.path || entry.href, navigable: !!page };
        }) : [];
        const languages = epub.metadata?.filter(item => item.name === 'language').map(item => item.value).filter(Boolean) || [];
        return { epub, title: publicationTitle(epub, ''), languages, toc, chapters, hrefToPageMap };
    } finally { await reader.close(); }
}
