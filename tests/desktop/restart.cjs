const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');

const output = path.resolve(process.argv[2]);
const timer = setTimeout(() => app.exit(1), 30000);
(async () => {
    const previous = JSON.parse(await fs.readFile(path.join(output, 'results.json'), 'utf8'));
    const window = await startDesktop({ profileDirectory: previous.profile });
    const result = await window.webContents.executeJavaScript(`(async () => {
        while (document.documentElement.dataset.desktopReady !== 'library') await new Promise(resolve => setTimeout(resolve, 20));
        return await auraDesktop.storage.queryNotes({ bookIds: ['desktop-ipc'] });
    })()`);
    assert.equal(result.ok, true);
    assert.equal(result.value.records.find(row => row.id === previous.closeNoteId).value.comment, '关闭前最后输入\n😀\n');
    await fs.writeFile(path.join(output, 'restart-results.json'), JSON.stringify({ passed: true, closeFlushPersisted: true }));
    clearTimeout(timer);
    window.close();
})().catch(error => { console.error(error); clearTimeout(timer); app.exit(1); });
