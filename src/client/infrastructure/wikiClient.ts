import type { WikiRequest, WikiResponse } from '../../shared/wiki.js';
import { unwrapDesktop } from './storageClient.js';

export async function readWiki(input: Omit<WikiRequest, 'id'>, signal: AbortSignal): Promise<WikiResponse> {
    const id = crypto.randomUUID();
    const request = { ...input, id };
    signal.throwIfAborted();
    const bridge = window.auraDesktop?.wiki;
    if (bridge) {
        const cancel = () => { void bridge.cancel(id).catch(() => {}); };
        signal.addEventListener('abort', cancel, { once: true });
        try {
            const result = unwrapDesktop(await bridge.read(request));
            signal.throwIfAborted();
            return result;
        } finally { signal.removeEventListener('abort', cancel); }
    }
    const response = await fetch('/api/wiki?' + new URLSearchParams(request), { signal, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Wikipedia is unavailable. Please try again.');
    return result as WikiResponse;
}

export async function openWikiExternal(url: string) {
    if (window.auraDesktop?.wiki) unwrapDesktop(await window.auraDesktop.wiki.openExternal(url));
    else window.open(url, '_blank', 'noopener,noreferrer');
}
