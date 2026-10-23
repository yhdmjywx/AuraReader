const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { DatabaseSync } = require('node:sqlite');
const { connect } = require('./packaged.cjs');
const { verifyPackage } = require('../../scripts/verify-package.cjs');
const { verifyDatabase } = require('../../src/server/storageMaintenance.js');
const root = path.resolve(__dirname, '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
    const parent = path.join(root, '.commandcode/packaged-stability'); await fs.mkdir(parent, { recursive: true });
    const output = await fs.mkdtemp(path.join(parent, 'run-')); console.log('Packaged stability artifacts:', output);
    const directory = path.resolve(process.argv[2] || 'release/win-unpacked');
    const contents = await verifyPackage(directory); const checks = [];
    const profile = path.join(output, 'profile'); let current;
    async function start(profilePath, phase) {
        console.log('START:', phase);
        const env = { ...process.env, PATH: [process.env.SystemRoot + '/System32', process.env.SystemRoot,
            process.env.SystemRoot + '/System32/WindowsPowerShell/v1.0'].join(';') }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_PATH;
        const child = spawn(path.join(directory, 'AuraReader.exe'), ['--user-data-dir=' + profilePath, '--remote-debugging-port=0'],
            { cwd: output, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
        const exited = once(child, 'exit'); let log = ''; let port;
        child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; const m=log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if(m)port=Number(m[1]); });
        const timer = setTimeout(() => child.kill(), 90000);
        current = { child, exited, timer, phase, log: () => log };
        for (let attempt = 0; attempt < 150 && !port && child.exitCode === null; attempt++) await delay(100);
        assert.ok(port, log); const client = await connect(port); current.client = client;
        // The exact URL can appear in /json/list before Chromium replaces its
        // initial execution context. Retry that navigation race only at boot.
        const bootDeadline = Date.now() + 15000;
        while (true) {
            try {
                if (await client.run(`['setup','library','error'].includes(document.documentElement.dataset.desktopReady)`)) break;
            } catch (error) {
                if (!String(error).includes('Execution context was destroyed')) throw error;
            }
            assert.ok(Date.now() < bootDeadline, 'Packaged stability boot timeout');
            await delay(50);
        }
        await client.call('Network.enable'); await client.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
        return client;
    }
    async function finish(kill = false, rendererClose = false) {
        if (kill) assert.equal(current.child.kill(), true);
        else if (!rendererClose) await current.client.call('Browser.close');
        const [code, signal] = await current.exited;
        if (kill) assert.ok(code !== 0 || signal); else assert.equal(code, 0);
        clearTimeout(current.timer); current.client.close();
        await fs.writeFile(path.join(output, current.phase + '.log'), current.log()); current = null;
    }
    try {
        let client = await start(profile, 'busy-kill');
        console.log('CREATE current library and note');
        await client.run(`(async()=>{document.getElementById('desktop-create-library').click();while(document.documentElement.dataset.desktopReady!=='library')await new Promise(r=>setTimeout(r,20));
            const b=await (await import('./infrastructure/bookRepository.js')).saveBookToDB({id:'package-stability',title:'打包稳定性',pages:['<p>打包原文😀</p>'],unknown:{keep:[null,true]}});
            const n=await auraDesktop.storage.saveNote({opId:crypto.randomUUID(),expected:0,generation:b.generation,
                note:{id:'package-note',bookId:'package-stability',kind:'note',quote:'打包原文😀',comment:'已确认值',page:1,location:{page:1,start:0,end:6},unknown:['字段保留',false]}});
            if(!n.ok)throw new Error(JSON.stringify(n));const a=await import('./main.js');await a.coordinator.openBook('package-stability');a.annotations.setNotesScope('book');
            window.__cancelled=null;auraDesktop.lifecycle.onCloseCancelled(m=>window.__cancelled=m);})()`);
        const locker = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'));
        console.log('VERIFY actual SQLite busy failure and recovery');
        try {
            locker.exec('BEGIN IMMEDIATE');
            const failure = await client.run(`(async()=>{const a=await import('./main.js');a.annotations.openNoteModal('打包原文😀','package-note',1);
                const e=document.querySelector('.note-editor');e.value='锁竞争期间输入\\n😀';e.dispatchEvent(new Event('input',{bubbles:true}));await a.annotations.finishInlineEdit();
                let blocked=false;try{await a.annotations.assertInlineWritesSaved();}catch{blocked=true;}return {blocked,pending:localStorage.getItem('aura_notes_pending_package-stability')};})()`);
            assert.equal(failure.blocked, true); assert.ok(failure.pending);
            await client.run('window.close();true');
            await client.run(`(async()=>{const end=Date.now()+10000;while(!window.__cancelled){if(Date.now()>end)throw new Error('Busy close not canceled');await new Promise(r=>setTimeout(r,20));}})()`);
            assert.equal(current.child.exitCode, null);
        } finally { locker.exec('ROLLBACK'); locker.close(); }
        const recovered = await client.run(`(async()=>{const r=await import('./infrastructure/annotationRepository.js');const notes=await r.loadNotesForBook('package-stability');
            const a=await import('./main.js');await a.annotations.assertInlineWritesSaved();return {note:notes.find(n=>n.id==='package-note'),pending:localStorage.getItem('aura_notes_pending_package-stability')};})()`);
        assert.equal(recovered.note.comment, '锁竞争期间输入\n😀'); assert.equal(recovered.pending, null);
        checks.push('actual packaged app + competing SQLite writer: error, journal preservation and refused close; unlock replays pending once');
        // Acknowledged writes are the crash-durability boundary.
        const acknowledged = await client.run(`(async()=>{const r=await import('./infrastructure/annotationRepository.js');let n=(await r.loadNotesForBook('package-stability'))[0];
            for(let i=0;i<40;i++){n={...n,comment:'已确认打包写入 '+i+'\\n😀'};await r.saveNoteToDB(n);}return (await r.loadNotesFromDB('package-stability'))[0];})()`);
        const image = await client.call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'busy-recovered.png'), Buffer.from(image.data, 'base64'));
        await finish(true);
        const db = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
        try {
            assert.deepEqual(JSON.parse(db.prepare('SELECT payload FROM annotations WHERE id=?').get('package-note').payload), acknowledged);
            assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        } finally { db.close(); }
        checks.push('40 acknowledged repository writes survive forced termination of hardened packaged main process; exact payload and integrity verified');

        client = await start(profile, 'reopen-page-close');
        const backup = await client.run(`(async()=>{const a=await import('./main.js');await a.coordinator.openBook('package-stability');await a.reader.fonts.prepareForBook();
            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return await auraDesktop.storage.backup();})()`);
        assert.equal(backup.ok, true); assert.equal(backup.value.integrity, 'ok');
        const backupPath = path.join(profile, 'data/backups', backup.value.name); assert.equal(verifyDatabase(backupPath).integrity, 'ok');
        await client.run(`(async()=>{const a=await import('./main.js');a.annotations.setNotesScope('book');a.annotations.openNoteModal('打包原文😀','package-note',1);
            document.querySelector('.note-editor').value='打包 Renderer 关闭末次输入\\n😀';window.close();return true;})()`);
        await finish(false, true);
        const finalDb = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
        try { assert.equal(JSON.parse(finalDb.prepare('SELECT payload FROM annotations WHERE id=?').get('package-note').payload).comment, '打包 Renderer 关闭末次输入\n😀'); }
        finally { finalDb.close(); }
        checks.push('packaged page-close API now passes native flush handshake and persists raw last editor input');

        // Restore a verified CURRENT SQLite backup into a new, separate profile.
        // No old database conversion and no replacement of the source library.
        const restored = path.join(output, 'restored-profile'); await fs.mkdir(path.join(restored, 'data'), { recursive: true });
        await fs.copyFile(backupPath, path.join(restored, 'data/aurareader.sqlite'));
        await fs.copyFile(path.join(profile, 'data/storage-installed.json'), path.join(restored, 'data/storage-installed.json'));
        client = await start(restored, 'backup-restore');
        assert.equal(await client.run(`document.documentElement.dataset.desktopReady`), 'library');
        const row = await client.run(`auraDesktop.storage.queryNotes({bookIds:['package-stability']})`);
        assert.deepEqual(row.value.records[0].value, acknowledged);
        await finish(); checks.push('verified current SQLite backup + marker opens in new packaged profile with exact notes and no migration/reset');

        const bad = path.join(output, 'bad-profile'); await fs.mkdir(path.join(bad, 'data'), { recursive: true });
        await fs.copyFile(path.join(profile, 'data/storage-installed.json'), path.join(bad, 'data/storage-installed.json'));
        await fs.writeFile(path.join(bad, 'data/aurareader.sqlite'), 'corrupted packaged specimen');
        client = await start(bad, 'corrupt-block');
        assert.equal(await client.run(`document.documentElement.dataset.desktopReady`), 'error');
        assert.equal((await fs.readFile(path.join(bad, 'data/aurareader.sqlite'))).toString(), 'corrupted packaged specimen');
        const failed = await client.run(`auraDesktop.storage.status()`); assert.equal(failed.ok, false); assert.equal(failed.error.status, 500);
        await finish(); checks.push('packaged corrupt current database blocks startup without changing its bytes or silently creating an empty library');
        await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: true, contents, checks, noNodeOnPath: true, offline: true,
            published: false, limitations: ['Debug launch only for external tests; not a native wizard or clean VM check', 'No physical disk-full or power-cut simulation'] }, null, 2));
        console.log('PACKAGED STABILITY PASSED:', output, checks);
    } finally { if (current) { clearTimeout(current.timer); current.client?.close(); if (current.child.exitCode === null) current.child.kill();
        await fs.writeFile(path.join(output, current.phase + '.log'), current.log()); } }
})().catch(error => { console.error(error); process.exitCode = 1; });
