const { Worker } = require('node:worker_threads');
const path = require('node:path');

/** A single ZIP worker with at most four active requests. */
function createPublicationWorker() {
    /** @type {Worker | null} */
    let worker = null;
    let closed = false;
    let sequence = 0;
    /** @type {Map<number, {resolve: (value: any) => void, reject: (error: Error) => void}>} */
    const pending = new Map();
    /** @type {Array<{start: () => void, reject: (error: Error) => void}>} */
    const queue = [];
    function drain() { while (!closed && pending.size < 4 && queue.length) queue.shift()?.start(); }
    function start() {
        if (worker) return worker;
        const current = new Worker(path.join(__dirname, 'publicationWorker.cjs'));
        worker = current;
        current.on('message', message => {
            if (worker !== current) return;
            const request = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) request?.reject(new Error(message.error)); else request?.resolve(message.result);
            drain();
        });
        /** @param {Error} error */
        const failed = error => {
            if (worker !== current) return;
            for (const request of pending.values()) request.reject(error);
            pending.clear(); worker = null; drain();
        };
        current.on('error', failed);
        current.on('exit', code => failed(new Error(`Publication resource worker exited (${code}).`)));
        return current;
    }
    return {
        /** @param {Record<string, unknown>} message @returns {Promise<any>} */
        request(message) {
            if (closed) return Promise.reject(new Error('Publication resource service closed.'));
            return new Promise((resolve, reject) => {
                queue.push({ start: () => {
                    const id = ++sequence;
                    try {
                        const current = start();
                        pending.set(id, { resolve, reject });
                        current.postMessage({ ...message, id });
                    } catch (error) {
                        pending.delete(id); reject(error);
                    }
                }, reject });
                drain();
            });
        },
        close() {
            if (closed) return;
            closed = true;
            const error = new Error('Publication resource service closed.');
            queue.splice(0).forEach(request => request.reject(error));
            for (const request of pending.values()) request.reject(error);
            pending.clear(); void worker?.terminate(); worker = null;
        }
    };
}
module.exports = { createPublicationWorker };
