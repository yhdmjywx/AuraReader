const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { app } = require('electron');
const { once } = require('node:events');
const { startDesktop } = require('../../src/desktop/main.cjs');
const { DatabaseSync } = require('node:sqlite');
const output = path.resolve(process.argv[2]);
const mode = process.argv[3] || 'renderer-close';
const timer = setTimeout(() => app.exit(1), 45000);
(async () => {
    const profile = path.join(output, 'close-' + mode);
    const window = await startDesktop({ profileDirectory: profile });
    const run = code => window.webContents.executeJavaScript(code, true);
    await run(`(async()=>{while(document.documentElement.dataset.desktopReady!=='setup') await new Promise(r=>setTimeout(r,20));
        document.getElementById('desktop-create-library').click(); while(document.documentElement.dataset.desktopReady!=='library')await new Promise(r=>setTimeout(r,20));
        const s=auraDesktop.storage;const b=await s.saveBook({opId:crypto.randomUUID(),expected:0,book:{id:'close-path',title:'关闭路径',pages:['<p>关闭原文😀</p>']}});
        const a=await import('./main.js');await a.coordinator.openBook('close-path'); await a.reader.fonts.prepareForBook();
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); a.annotations.setNotesScope('book');
        window.__closePathNote=a.annotations.createNote({quote:'关闭原文😀',page:1,location:{page:1,start:0,end:7}}).id;
        const editor=document.querySelector('.note-editor');editor.value='Renderer 关闭前最后输入\\n😀\\n';
    })()`);
    const noteId = await run('window.__closePathNote');
    let nativeCloseEvents = 0; window.on('close', () => nativeCloseEvents++);
    const closed = once(window, 'closed');
    const hold = event => event.preventDefault(); app.on('before-quit', hold);
    let queryPrevented = false;
    if (mode === 'crashed-close') {
        await run(`(async()=>{const a=await import('./main.js');document.querySelector('.note-editor').dispatchEvent(new Event('input',{bubbles:true}));await a.annotations.finishInlineEdit();await a.annotations.assertInlineWritesSaved();})()`);
        const gone = once(window.webContents, 'render-process-gone'); window.webContents.forcefullyCrashRenderer(); await gone;
        window.close();
    } else if (mode === 'session-end') {
        window.emit('query-session-end', { preventDefault() { queryPrevented = true; }, reasons: [] });
    } else await run('window.close(); true');
    await closed;
    const db = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
    let value;
    try { value = JSON.parse(db.prepare('SELECT payload FROM annotations WHERE id=?').get(noteId)?.payload || 'null'); }
    finally { db.close(); }
    assert.equal(value?.comment, 'Renderer 关闭前最后输入\n😀\n');
    assert.ok(nativeCloseEvents > 0);
    if (mode === 'session-end') assert.equal(queryPrevented, true);
    await fs.writeFile(path.join(output, 'close-' + mode + '.json'), JSON.stringify({ passed: true, mode, noteId, nativeCloseEvents, queryPrevented, value }, null, 2));
    clearTimeout(timer); app.removeListener('before-quit', hold); app.quit();
})().catch(error => { console.error(error); clearTimeout(timer); app.exit(1); });
