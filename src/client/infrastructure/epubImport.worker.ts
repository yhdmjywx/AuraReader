import { readEpubArchive } from './epubArchive.js';

const scope = self as unknown as { onmessage: (event: MessageEvent<ArrayBuffer>) => void; postMessage: (message: unknown) => void };
scope.onmessage = async event => {
    try { scope.postMessage({ result: await readEpubArchive(new Uint8Array(event.data)) }); }
    catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
