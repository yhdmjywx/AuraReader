const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { verifyInstalled } = require('../tests/desktop/packaged.cjs');
const root = path.resolve(__dirname, '..');
const powershell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
async function execute(file, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(file, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
        let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
        const timer = setTimeout(() => { child.kill(); reject(new Error('Process timed out: ' + file)); }, 180000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error(`${file}: exit=${code}\n${output}`)); else resolve(output.trim()); });
    });
}
async function registrations() {
    const json = await execute(powershell, ['-NoProfile', '-NonInteractive', '-Command',
        String.raw`$ErrorActionPreference='Stop'; ConvertTo-Json -Compress -InputObject @(foreach ($auraHive in @('HKCU','HKLM')) {
            $auraEntry=Get-ItemProperty -LiteralPath ($auraHive+':\Software\Microsoft\Windows\CurrentVersion\Uninstall\be620d11-ff67-531f-b413-3ef724a19193') -ErrorAction SilentlyContinue;
            if ($auraEntry) { $auraLocation=Get-ItemProperty -LiteralPath ($auraHive+':\Software\be620d11-ff67-531f-b413-3ef724a19193');
            $auraEntry | Select-Object DisplayName,DisplayVersion,@{Name='InstallLocation';Expression={$auraLocation.InstallLocation}},@{Name='Scope';Expression={$auraHive}} }
        })`]);
    return JSON.parse(json);
}
async function dataHashes(directory) {
    const hashes = {};
    async function walk(folder) {
        for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
            const filename = path.join(folder, entry.name);
            if (entry.isDirectory()) await walk(filename);
            else hashes[path.relative(directory, filename)] = createHash('sha256').update(await fs.readFile(filename)).digest('hex');
        }
    }
    await walk(directory); return hashes;
}
(async () => {
    assert.deepEqual(await registrations(), [], 'Existing AuraReader install: stop instead of replacing user installation');
    const parent = path.join(root, '.commandcode/install-tests'); await fs.mkdir(parent, { recursive: true });
    const output = await fs.mkdtemp(path.join(parent, 'run-'));
    const install = path.join(output, 'AuraReader');
    const installer = path.join(root, 'release/AuraReader-Setup-1.0.0-x64.exe');
    const upgrade = path.join(root, '.commandcode/upgrade-package/AuraReader-Setup-1.0.1-x64.exe');
    await fs.access(upgrade); console.log('Install acceptance artifacts:', output);
    const installPackage = async (filename, version) => {
        await execute(filename, ['/S', '/currentuser', '/D=' + install]);
        const registered = await registrations(); assert.equal(registered.length, 1);
        assert.equal(path.resolve(registered[0].InstallLocation), install); assert.equal(registered[0].DisplayVersion, version);
        assert.equal(registered[0].Scope, 'HKCU');
        const links = JSON.parse(await execute(powershell, ['-NoProfile', '-NonInteractive', '-Command', String.raw`$ErrorActionPreference='Stop'; $auraShell=New-Object -ComObject WScript.Shell;
            ConvertTo-Json -Compress -InputObject @(foreach ($auraFolder in @('Programs','DesktopDirectory')) { $auraLink=Join-Path ([Environment]::GetFolderPath($auraFolder)) 'AuraReader.lnk';
            if (!(Test-Path -LiteralPath $auraLink)) { throw 'Missing AuraReader shortcut' }; $auraShell.CreateShortcut($auraLink).TargetPath })`]));
        assert.equal(links.length, 2); links.forEach(target => assert.equal(path.resolve(target), path.join(install, 'AuraReader.exe')));
    };
    const removePackage = async () => {
        // The NSIS uninstaller recursively removes its own install directory.
        // Verify that exact absolute target before executing it, never use a
        // registry-derived or user-owned path for test deletion.
        assert.equal(path.dirname(path.resolve(install)), path.resolve(output));
        assert.ok(path.resolve(output).startsWith(path.resolve(parent) + path.sep));
        const registered = await registrations(); assert.equal(path.resolve(registered[0].InstallLocation), path.resolve(install));
        await execute(path.join(install, 'Uninstall AuraReader.exe'), ['/S', '_?=' + install]);
        assert.deepEqual(await registrations(), []);
        await assert.rejects(fs.access(path.join(install, 'AuraReader.exe')));
    };
    await installPackage(installer, '1.0.0'); console.log('Installed 1.0.0');
    await verifyInstalled(install, output, 'fresh', '1.0.0');
    await verifyInstalled(install, output, 'reopen', '1.0.0'); console.log('Current SQLite, fonts, preferences and final editor input persisted across process restart');
    await installPackage(upgrade, '1.0.1');
    await verifyInstalled(install, output, 'upgrade', '1.0.1'); console.log('Upgraded 1.0.0 -> 1.0.1 with current data preserved');
    const data = path.join(output, 'profile/data'); const before = await dataHashes(data);
    await removePackage(); assert.deepEqual(await dataHashes(data), before); console.log('Uninstall preserved all current data files byte-for-byte');
    await installPackage(installer, '1.0.0');
    await verifyInstalled(install, output, 'reinstall', '1.0.0');
    const final = await dataHashes(data); await removePackage(); assert.deepEqual(await dataHashes(data), final);
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: true, install, profile: path.join(output, 'profile'),
        actualNsis: true, installed: '1.0.0', upgrade: '1.0.1', reinstalled: '1.0.0', uninstalled: true,
        currentDataRetained: true, noNodeOnPath: true, checks: ['current-user registration', 'installed ASAR/resources/fuses',
            'real packaged renderer/IPC/SQLite with offline emulation', 'CAS/idempotency/backup/editor close flush',
            'process restart, version upgrade and reinstall retain full notes/books/fonts/preferences', 'uninstall leaves current data bytes intact'],
        limitations: ['Silent NSIS lifecycle; installer wizard clicks and a clean Windows VM without Node installed remain unverified',
            'Renderer CDP used only via explicit test launch switch; normal product starts no HTTP service'] }, null, 2));
    console.log('INSTALL PASSED:', output);
})().catch(error => { console.error(error); process.exitCode = 1; });
