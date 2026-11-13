const assert = require('node:assert/strict');
const { createPublicationWorker } = require('../../src/server/publicationWorkerClient.js');
const { publicationFixture } = require('../helpers/epub.cjs');

(async () => {
    const service = createPublicationWorker();
    try {
        await service.request({ command: 'open', key: 'lifecycle', archive: (await publicationFixture()).toString('base64') });
        const request = { command: 'read', key: 'lifecycle', path: 'OPS/Text/first.xhtml', mediaType: 'application/xhtml+xml', bookId: 'lifecycle' };
        assert.match(Buffer.from(await service.request(request)).toString(), /Stable quotation/);
        const pending = Promise.allSettled(Array.from({ length: 8 }, () => service.request(request)));
        service.close(); service.close();
        assert.ok((await pending).every(result => result.status === 'rejected' && /service closed/.test(result.reason.message)),
            'both active and queued requests must settle when the service closes');
        await assert.rejects(service.request(request), /service closed/, 'a closed service cannot recreate its worker');
        console.log('PASS: real ZIP worker reads, settles active/queued requests, closes idempotently and rejects reuse');
    } finally { service.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
