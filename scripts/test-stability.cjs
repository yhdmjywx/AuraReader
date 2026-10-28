const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const root = path.resolve(__dirname, '..'); const seconds = Number(process.argv[2] || 300);
if (!Number.isSafeInteger(seconds) || seconds < 30 || seconds > 3600) throw new Error('Soak seconds must be 30..3600');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
    const parent = path.join(root, '.commandcode/stability'); await fs.mkdir(parent, { recursive: true });
    const output = await fs.mkdtemp(path.join(parent, 'run-')); console.log('Stability artifacts:', output);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    async function run(entry, mode, kill = false) {
        const child = spawn(require('electron'), [path.join(root, 'tests/desktop', entry), output, mode, String(seconds)], { cwd: root, env, stdio: 'inherit', windowsHide: false });
        const exited = once(child, 'exit'); const timer = setTimeout(() => child.kill(), (seconds + 210) * 1000);
        try {
            if (kill) {
                const end = Date.now() + 30000;
                while (true) { try { await fs.access(path.join(output, 'kill-ready.json')); break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
                    if (Date.now() > end || child.exitCode !== null) throw new Error('Kill specimen not ready'); await delay(100); }
                const ready = JSON.parse(await fs.readFile(path.join(output, 'kill-ready.json'), 'utf8'));
                assert.equal(ready.pid, child.pid); assert.ok(ready.walBytes > 0);
                assert.equal(child.kill(), true); const [code, signal] = await exited;
                assert.ok(code !== 0 || signal); console.log('FORCED MAIN TERMINATION: uncommitted transaction');
            } else { const [code, signal] = await exited; assert.equal(code, 0, entry + ' ' + mode); assert.equal(signal, null); }
        } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
    }
    for (const mode of ['renderer-close', 'session-end', 'crashed-close']) await run('close-path.cjs', mode);
    await run('stability.cjs', 'exercise'); await run('stability.cjs', 'kill', true); await run('stability.cjs', 'recover');
    await fs.cp(path.join(output, 'profile/data'), path.join(output, 'bad-profile/data'), { recursive: true });
    await fs.writeFile(path.join(output, 'bad-profile/data/aurareader.sqlite'), 'corrupted test specimen');
    await run('stability.cjs', 'corrupt');
    const results = await Promise.all(['exercise', 'recover', 'corrupt'].map(async mode => JSON.parse(await fs.readFile(path.join(output, mode + '.json'), 'utf8'))));
    assert.ok(results.every(r => r.passed));
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: true, seconds, actualElectron: true, isolatedDataOnly: true, results,
        limitations: ['SQLITE_FULL uses actual SQLite page limit, read-only uses PRAGMA query_only; no physical disk exhaustion or Windows ACL changes',
            'Renderer journal explicitly flushed before crash; no guarantee for unflushed keystrokes', 'Bounded soak, not multi-day test; no real OS shutdown or power loss'] }, null, 2));
    console.log('STABILITY PASSED:', output);
})().catch(error => { console.error(error); process.exitCode = 1; });
