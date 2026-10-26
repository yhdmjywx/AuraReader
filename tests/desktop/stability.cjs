const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const JSZip = require('jszip');
const { app } = require('electron');
// Fault controls stay in this external test process, never in production IPC.
const dataStore = require('../../src/server/dataStore.js');
const originalCreate = dataStore.createDataStore; let live;
dataStore.createDataStore = directory => (live = originalCreate(directory));
const { startDesktop } = require('../../src/desktop/main.cjs');
const output = path.resolve(process.argv[2]); const mode = process.argv[3];
const seconds = Number(process.argv[4] || 300);
const checks = []; const expectedErrors = []; const metrics = [];
const timer = setTimeout(() => { console.error('Stability child timed out:', mode); app.exit(1); }, (seconds + 180) * 1000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
    const profile = path.join(output, mode === 'corrupt' ? 'bad-profile' : 'profile');
    const opens = [], saves = [];
    const window = await startDesktop({ profileDirectory: profile, dialogs: {
        open: async () => { assert.ok(opens.length); return opens.shift(); },
        save: async () => { assert.ok(saves.length); return saves.shift(); }
    } });
    const wc = window.webContents;
    wc.on('console-message', details => { if (details.level === 'error') expectedErrors.push(details.message); });
    const run = code => wc.executeJavaScript(code, true);
    const wait = expression => run(`(async()=>{const end=Date.now()+20000;while(!(${expression})){if(Date.now()>end)throw new Error('Stability state timeout');await new Promise(r=>setTimeout(r,20));}})()`);
    if (mode === 'corrupt') {
        await wait(`document.documentElement.dataset.desktopReady==='error'`);
        assert.match(await run(`document.getElementById('desktop-status').textContent`), /本地书库操作失败，原数据未清除/);
        assert.equal((await run('auraDesktop.storage.status()')).error.status, 500);
        assert.equal((await fs.readFile(path.join(profile, 'data/aurareader.sqlite'))).toString(), 'corrupted test specimen');
        await fs.writeFile(path.join(output, 'corrupt.json'), JSON.stringify({ passed: true, noSilentReset: true }));
        clearTimeout(timer); app.exit(0); return;
    }
    await wait(`['setup','library'].includes(document.documentElement.dataset.desktopReady)`);
    if (await run(`document.documentElement.dataset.desktopReady==='setup'`)) {
        await run(`document.getElementById('desktop-create-library').click()`); await wait(`document.documentElement.dataset.desktopReady==='library'`);
    }
    await wc.session.enableNetworkEmulation({ offline: true });
    if (mode === 'kill') {
        const confirmed = live.notes(['stability'])[0]; const operations = live.one('SELECT count(*) AS n FROM operations').n;
        live.db.exec('PRAGMA cache_size=-64; BEGIN IMMEDIATE');
        live.run('UPDATE annotations SET payload=?,revision=revision+1 WHERE id=?', JSON.stringify({ ...confirmed.value, comment: 'UNCOMMITTED' + 'x'.repeat(5 * 1024 * 1024) }), confirmed.id);
        live.run('INSERT INTO operations VALUES(?,?,?)', 'must-rollback', 'uncommitted', '{}');
        await fs.writeFile(path.join(output, 'kill-ready.json'), JSON.stringify({ confirmed, operations, goals: live.goalLibrary(),
            walBytes: (await fs.stat(live.filename + '-wal')).size, pid: process.pid }));
        console.log('KILL READY with real uncommitted WAL transaction');
        return; // Parent terminates this process, without finally/close/checkpoint.
    }
    if (mode === 'recover') {
        const previous = JSON.parse(await fs.readFile(path.join(output, 'kill-ready.json'), 'utf8'));
        assert.deepEqual(live.notes(['stability'])[0], previous.confirmed);
        assert.deepEqual(live.goalLibrary(), previous.goals, 'Goal tree and links survive forced main termination');
        assert.equal(live.one('SELECT count(*) AS n FROM operations').n, previous.operations);
        assert.equal(live.one('SELECT * FROM operations WHERE id=?', 'must-rollback'), undefined);
        assert.deepEqual(live.check(), { integrity: 'ok', foreignKeys: 0 });
        await run(`(async()=>{const a=await import('./main.js');await a.coordinator.openBook('stability');})()`);
        const backup = await run(`auraDesktop.storage.backup()`); assert.equal(backup.value.integrity, 'ok');
        checks.push('new Electron process recovers real uncommitted WAL, keeps exact acknowledged note/revision and op count; online backup passes');
    } else {
        await run(`(async()=>{
            const b=await (await import('./infrastructure/bookRepository.js')).saveBookToDB({id:'stability',title:'稳定性书籍',pages:['<p>稳定性原文😀</p>'],unknown:{intact:[null,false]}});
            const saved=await auraDesktop.storage.saveNote({opId:crypto.randomUUID(),expected:0,generation:b.generation,
                note:{id:'primary-note',bookId:'stability',kind:'note',quote:'稳定性原文😀',comment:'已确认笔记',page:1,location:{page:1,start:0,end:8},unknown:[false,'保留字段']}});
            if(!saved.ok)throw new Error(JSON.stringify(saved));const a=await import('./main.js');await a.coordinator.openBook('stability');a.annotations.setNotesScope('book');
            window.__closeCancelled=null;auraDesktop.lifecycle.onCloseCancelled(message=>window.__closeCancelled=message);
        })()`);
        await run(`(async()=>{const a=await import('./main.js');a.goals.beginEdit('root');a.goals.ui.editor.value='Why am I reading?';a.goals.updateDraft(a.goals.ui.editor.value);await a.goals.finishInlineEdit();await a.goals.linkAnnotation('primary-note');})()`);
        const baseline = live.notes(['stability'])[0];
        live.db.exec('PRAGMA query_only=ON');
        const failed = await run(`(async()=>{const a=await import('./main.js');a.annotations.openNoteModal('稳定性原文😀','primary-note',1);
            const e=document.querySelector('.note-editor');e.value='只读期间保留输入\\n😀';e.dispatchEvent(new Event('input',{bubbles:true}));await a.annotations.finishInlineEdit();
            let blocked=false;try{await a.annotations.assertInlineWritesSaved();}catch{blocked=true;}
            return {blocked,pending:JSON.parse(localStorage.getItem('aura_notes_pending_stability'))};})()`);
        assert.equal(failed.blocked, true); assert.equal(failed.pending[0].note.comment, '只读期间保留输入\n😀');
        assert.deepEqual(live.notes(['stability'])[0], baseline);
        await run('window.close(); true'); await wait('window.__closeCancelled');
        assert.equal(window.isDestroyed(), false); assert.equal(await run('document.body.inert'), false);
        live.db.exec('PRAGMA query_only=OFF');
        await run(`(async()=>{await (await import('./infrastructure/annotationRepository.js')).loadNotesForBook('stability');
            const a=await import('./main.js');await a.annotations.assertInlineWritesSaved();await a.coordinator.openBook('stability');})()`);
        assert.equal(live.notes(['stability'])[0].value.comment, '只读期间保留输入\n😀');
        assert.equal(live.notes(['stability'])[0].revision, baseline.revision + 1);
        assert.equal(await run(`localStorage.getItem('aura_notes_pending_stability')`), null);
        checks.push('actual SQLite read-only -> renderer input failure -> journal retained and close refused -> exact pending command recovered once');

        const confirmedGoal = live.goalLibrary();
        live.db.exec('PRAGMA query_only=ON');
        const goalBlocked = await run(`(async()=>{const a=await import('./main.js');a.goals.beginEdit('edit');a.goals.ui.editor.value='Goal retained during failure';a.goals.updateDraft(a.goals.ui.editor.value);try{await a.goals.finishInlineEdit();return false;}catch{return true;}})()`);
        assert.equal(goalBlocked,true); assert.deepEqual(live.goalLibrary(),confirmedGoal);
        live.db.exec('PRAGMA query_only=OFF'); await run(`(async()=>{await (await import('./main.js')).goals.assertWritesSaved();})()`);
        assert.equal(live.goalLibrary().value.goals[0].text,'Goal retained during failure');
        checks.push('Goal: actual read-only failure retains intent and exact command; retry commits once without changing links');
        const max = live.one('PRAGMA max_page_count').max_page_count;
        live.db.exec('PRAGMA max_page_count=' + live.one('PRAGMA page_count').page_count);
        const full = await run(`(async()=>{window.__fullCommand={opId:crypto.randomUUID(),expected:0,book:{id:'full-test',pages:['x'.repeat(2*1024*1024)]}};
            return await auraDesktop.storage.saveBook(window.__fullCommand);})()`);
        assert.equal(full.ok, false); assert.equal(full.error.status, 500);
        assert.ok(!live.books().some(b => b.id === 'full-test'));
        assert.deepEqual(live.check(), { integrity: 'ok', foreignKeys: 0 });
        live.db.exec('PRAGMA max_page_count=' + max);
        const retry = await run(`(async()=>{const a=await auraDesktop.storage.saveBook(window.__fullCommand);const b=await auraDesktop.storage.saveBook(window.__fullCommand);return {a,b};})()`);
        assert.equal(retry.a.ok, true); assert.deepEqual(retry.a, retry.b);
        await run(`auraDesktop.storage.deleteBook({opId:crypto.randomUUID(),expected:1,id:'full-test'})`);
        checks.push('real SQLITE_FULL through IPC does not create partial book or op; original error retained; retry of identical op succeeds once');

        live.db.exec('PRAGMA query_only=ON');
        await run(`(async()=>{const a=await import('./main.js');a.annotations.setNotesScope('book');a.annotations.openNoteModal('稳定性原文😀','primary-note',1);
            const e=document.querySelector('.note-editor');e.value='Renderer 崩溃恢复\\n😀';e.dispatchEvent(new Event('input',{bubbles:true}));await a.annotations.finishInlineEdit();})()`);
        await run(`(async()=>{const a=await import('./main.js');a.goals.beginEdit('edit');a.goals.ui.editor.value='Goal after Renderer crash';a.goals.updateDraft(a.goals.ui.editor.value);try{await a.goals.finishInlineEdit();}catch{}})()`);
        const pending = await run(`localStorage.getItem('aura_notes_pending_stability')`); assert.ok(pending);
        assert.ok(await run(`localStorage.getItem('aura_goal_library_pending')`));
        wc.session.flushStorageData(); await sleep(250);
        live.db.exec('PRAGMA query_only=OFF');
        const gone = once(wc, 'render-process-gone'); wc.forcefullyCrashRenderer(); await gone;
        const loaded = once(wc, 'did-finish-load'); wc.reload(); await loaded; await wait(`document.documentElement.dataset.desktopReady==='library'`);
        await run(`(async()=>{const a=await import('./main.js');await a.coordinator.openBook('stability');})()`);
        assert.equal(live.notes(['stability'])[0].value.comment, 'Renderer 崩溃恢复\n😀');
        assert.equal(await run(`localStorage.getItem('aura_notes_pending_stability')`), null);
        assert.equal(live.goalLibrary().value.goals[0].text,'Goal after Renderer crash');
        assert.equal(live.goalLibrary().value.links[0].annotationId,'primary-note');
        assert.equal(await run(`localStorage.getItem('aura_goal_library_pending')`),null);
        checks.push('forced Renderer process termination; explicit reload preserves current SQLite and replays previously flushed recovery journal without reset');

        const zip = new JSZip(); const chapters = 128; let decodedBytes = 0;
        zip.file('mimetype', 'application/epub+zip');
        zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
        const manifest = [], spine = [], nav = [];
        const paragraph = '<p>稳定性原文😀 ' + 'reading '.repeat(88) + '</p>';
        for (let i = 0; i < chapters; i++) {
            const body = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>章${i+1}</title></head><body><h2>第${i+1}章</h2>${paragraph.repeat(96)}</body></html>`;
            decodedBytes += Buffer.byteLength(body); zip.file(`OEBPS/c${i}.xhtml`, body);
            manifest.push(`<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`); spine.push(`<itemref idref="c${i}"/>`);
            nav.push(`<navPoint id="n${i}" playOrder="${i+1}"><navLabel><text>章${i+1}</text></navLabel><content src="c${i}.xhtml"/></navPoint>`);
        }
        assert.ok(decodedBytes >= 8 * 1024 * 1024);
        zip.file('OEBPS/content.opf', `<package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>large</dc:title><dc:language>zh</dc:language></metadata><manifest>${manifest.join('')}<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx">${spine.join('')}</spine></package>`);
        zip.file('OEBPS/toc.ncx', `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>${nav.join('')}</navMap></ncx>`);
        const filename = path.join(output, 'large.epub'); await fs.writeFile(filename, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
        opens.push({ canceled: false, filePaths: [filename] });
        const importStart = Date.now();
        const imported = await run(`(async()=>{window.__heartbeat={ticks:0,maxGap:0,last:performance.now()};setInterval(()=>{const h=window.__heartbeat;const now=performance.now();h.maxGap=Math.max(h.maxGap,now-h.last);h.last=now;h.ticks++;},50);
            const a=await import('./main.js');const f=await import('./infrastructure/desktopFiles.js');await a.coordinator.importBook(await f.chooseDesktopFile('book'));
            const b=a.reader.getCurrentBook();return {id:b.id,pages:b.pages.length,toc:b.toc.length};})()`);
        assert.equal(imported.id, 'book_large.epub'); assert.equal(imported.pages, chapters); assert.equal(imported.toc, chapters);
        const importMs = Date.now() - importStart;
        opens.push({ canceled: false, filePaths: [output] });
        await run(`(async()=>{const a=await import('./main.js');await a.backup.exportChapters(a.reader.getCurrentBook(),[]);})()`);
        const exported = await fs.readdir(path.join(output, 'large_章节导出'));
        assert.equal(exported.filter(name => name.endsWith('.md')).length, chapters + 1);
        checks.push(`offline generated EPUB: ${chapters} chapters, ${decodedBytes} decoded bytes; original parser, SQLite, reader and real chapter folder verified (${importMs}ms import)`);

        const start = Date.now(); let iteration = 0;
        while (Date.now() - start < seconds * 1000) {
            const requestStart = Date.now();
            const result = await run(`(async()=>{const r=await import('./infrastructure/annotationRepository.js');const notes=await r.loadNotesForBook('stability');
                const note={...notes.find(n=>n.id==='primary-note'),comment:'持续读写 ${iteration}\\n😀'};await r.saveNoteToDB(note);
                const saved=(await r.loadNotesFromDB('stability')).find(n=>n.id===note.id);const a=await import('./main.js');const sc=await import('./infrastructure/storageClient.js');const gl=await sc.storageRequest('goals/library',undefined);await sc.storageRequest('goals/library/save',{opId:crypto.randomUUID(),expected:gl.revision,state:{...gl.value,goals:gl.value.goals.map((g,i)=>i?g:{...g,text:'Continuing purpose ${iteration}'})}});
                if(${iteration}%5===0){await a.coordinator.openBook(${iteration}%10===0?'stability':'book_large.epub');if(a.reader.getCurrentBook().id==='book_large.epub')a.reader.goToPage((${iteration}%128)+1,0,[]);a.appShell.toggleAppTheme();}
                return {comment:saved.comment,unknown:saved.unknown,heartbeat:window.__heartbeat,visibility:document.visibilityState};})()`);
            assert.equal(result.comment, `持续读写 ${iteration}\n😀`); assert.deepEqual(result.unknown, [false, '保留字段']);
            metrics.push({ elapsedMs: Date.now() - start, requestMs: Date.now() - requestStart, heapUsed: process.memoryUsage().heapUsed,
                processes: app.getAppMetrics().map(p => ({ type: p.type, workingSetKB: p.memory.workingSetSize })),
                visibility: result.visibility, focused: window.isFocused(), heartbeat: result.heartbeat });
            if (iteration % 15 === 0) console.log(`SOAK ${Math.round((Date.now()-start)/1000)}s / ${seconds}s, writes=${iteration+1}`);
            iteration++; await sleep(2000);
        }
        assert.ok(iteration >= Math.floor(seconds / 10));
        assert.ok(metrics.at(-1).heartbeat.ticks > seconds);
        assert.deepEqual(live.check(), { integrity: 'ok', foreignKeys: 0 });
        checks.push(`${seconds}s bounded soak: ${iteration} acknowledged note writes, repeated readback/book/chapter/theme changes; request latency, visibility, timer gaps and memory recorded; no claim of foreground frame latency or all-day leak proof`);
        await fs.writeFile(path.join(output, 'metrics.json'), JSON.stringify({ seconds, iteration, decodedBytes, importMs, metrics }, null, 2));
    }
    await fs.writeFile(path.join(output, mode + '.json'), JSON.stringify({ passed: true, checks, expectedErrors }, null, 2));
    console.log(mode + ' PASSED:', checks);
    clearTimeout(timer); window.close();
})().catch(async error => {
    console.error(error); await fs.writeFile(path.join(output, mode + '-failure.json'), JSON.stringify({ error: String(error), stack: error.stack, checks }, null, 2));
    clearTimeout(timer); app.exit(1);
});
