const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const { startDesktop } = require('../../src/desktop/main.cjs');
const { publicationFixture } = require('../helpers/epub.cjs');
const output = path.resolve(process.argv[2]);
const mode = process.argv[3] || 'save-guard';
assert.ok(['empty', 'save-guard'].includes(mode));
const profile = path.join(output, 'lifecycle-' + mode);
const finalText = 'Close-time input\n中文😀\n';
const timer = setTimeout(() => { console.error('Lifecycle regression timed out:', mode); app.exit(1); }, 45000);
BrowserWindow.prototype.show = function () {};
process.on('uncaughtExceptionMonitor', error => fs.writeFileSync(path.join(output, 'lifecycle-' + mode + '-uncaught.txt'), String(error.stack)));
let wikiStarted = false, wikiAborted = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
    if (new URL(url).hostname === 'en.wikipedia.org') return new Promise((_resolve, reject) => {
        wikiStarted = true;
        options.signal.addEventListener('abort', () => { wikiAborted = true; reject(new Error('canceled')); }, { once: true });
    });
    return originalFetch(url, options);
};

(async () => {
    const window = await startDesktop({ profileDirectory: profile });
    const run = source => window.webContents.executeJavaScript(source, true);
    const waitFor = expression => run(`(async () => { const end=Date.now()+15000; while(!(${expression})) {
        if(Date.now()>end)throw new Error('Lifecycle condition: '+${JSON.stringify(expression)}); await new Promise(r=>setTimeout(r,20)); } })()`);
    await waitFor(`document.documentElement.dataset.desktopReady === 'setup'`);
    const mainUrl = 'aurareader://app/assets/' + fs.readdirSync('dist/renderer/assets').find(file => /^main-.*\.js$/.test(file));
    let noteId;
    const checks = [];
    if (mode === 'save-guard') {
        await run(`document.getElementById('desktop-create-library').click()`);
        await waitFor(`document.documentElement.dataset.reactWorkbench === 'true'`);
        const archive = (await publicationFixture()).toString('base64');
        noteId = await run(`(async () => {
            const a=await import(${JSON.stringify(mainUrl)});
            await a.coordinator.importBook(new File([Uint8Array.from(atob(${JSON.stringify(archive)}), c=>c.charCodeAt(0))], 'Lifecycle.epub'));
            await a.coordinator.openBook('book_Lifecycle.epub');
            const note=a.annotations.createNote({quote:'Stable quotation',page:1});
            a.annotations.updateInlineNote(note.id,'Before close');
            await a.annotations.finishInlineEdit(); await a.annotations.assertInlineWritesSaved();
            a.annotations.openNoteModal(note.quote,note.id,1);
            window.__closeCanceled=null; auraDesktop.lifecycle.onCloseCancelled(message=>window.__closeCanceled=message);
            return note.id;
        })()`);
        await waitFor(`document.querySelector('.note-editor')`);
        const locker = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'));
        try {
            locker.exec('BEGIN IMMEDIATE');
            await run(`document.querySelector('.note-editor').value=${JSON.stringify(finalText)}; true`);
            window.close(); window.close();
            await waitFor(`window.__closeCanceled`);
            assert.equal(window.isDestroyed(), false);
            assert.equal(await run(`document.body.inert`), false);
            assert.ok(await run(`localStorage.getItem('aura_notes_pending_book_Lifecycle.epub')`));
        } finally { locker.exec('ROLLBACK'); locker.close(); }
        const recovered = await run(`(async () => {
            const a=await import(${JSON.stringify(mainUrl)});
            await a.annotations.loadNotesForBook('book_Lifecycle.epub'); await a.annotations.assertInlineWritesSaved();
            return a.annotations.getNotes().find(note=>note.id===${JSON.stringify(noteId)}).comment;
        })()`);
        assert.equal(recovered, finalText);
        checks.push('SQLite lock cancels repeated close; editor input and recovery journal survive; unlock replays once');
    }
    await run(`auraDesktop.wiki.read({id:'close-pending',kind:'article',site:'en',title:'Reader'}).then(result=>{window.__wikiCloseResult=result}); true`);
    for (let attempt = 0; !wikiStarted && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(wikiStarted, true);
    window.once('closed', () => {
        assert.equal(wikiAborted, true, 'window cleanup aborts its pending Wiki request');
        if (noteId) {
            const db = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
            try {
                assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
                assert.equal(JSON.parse(db.prepare('SELECT payload FROM annotations WHERE id=?').get(noteId).payload).comment, finalText);
            } finally { db.close(); }
        }
        clearTimeout(timer);
        checks.push('pending Wiki canceled; all window cleanup completes; durable note checked after storage closes');
        fs.writeFileSync(path.join(output, 'lifecycle-' + mode + '.json'), JSON.stringify({ passed: true, mode, profile, checks }, null, 2));
        console.log('PASS: native lifecycle', mode, checks);
    });
    window.close(); window.close();
})().catch(error => { console.error(error); clearTimeout(timer); app.exit(1); });
