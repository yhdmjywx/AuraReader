import type { EpubImportResult } from './epubArchive.js';

export async function importEpubBytes(bytes: ArrayBuffer, signal?: AbortSignal): Promise<EpubImportResult> {
    signal?.throwIfAborted();
    if (typeof Worker === 'undefined') return (await import('./epubArchive.js')).readEpubArchive(new Uint8Array(bytes));
    const worker = new Worker(new URL('./epubImport.worker.ts', import.meta.url), { type: 'module', name: 'epub-import' });
    try {
        return await new Promise((resolve, reject) => {
            const abort = () => reject(new DOMException('EPUB import canceled.', 'AbortError'));
            const settle = (action: () => void) => { signal?.removeEventListener('abort', abort); action(); };
            signal?.addEventListener('abort', abort, { once: true });
            worker.onmessage = event => settle(() => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result));
            worker.onerror = event => settle(() => reject(new Error(event.message || 'EPUB import worker failed.')));
            worker.postMessage(bytes, [bytes]);
        });
    } finally { worker.terminate(); }
}
