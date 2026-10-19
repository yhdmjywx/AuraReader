const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync, backup } = require('node:sqlite');

function verifyDatabase(filename) {
    const db = new DatabaseSync(filename, { readOnly: true });
    try {
        const integrity = db.prepare('PRAGMA integrity_check').all();
        const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
        if (integrity.some(row => row.integrity_check !== 'ok') || foreignKeys.length) throw new Error('SQLite 完整性校验失败');
        return { integrity: 'ok', books: db.prepare('SELECT count(*) AS n FROM books WHERE deleted=0').get().n, notes: db.prepare('SELECT count(*) AS n FROM annotations WHERE deleted=0').get().n };
    } finally { db.close(); }
}
async function backupDatabase(directory) {
    const source = path.join(directory, 'aurareader.sqlite');
    const dir = path.join(directory, 'backups'); fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID() + '.sqlite');
    const temporary = target + '.tmp';
    const db = new DatabaseSync(source, { readOnly: true });
    try { await backup(db, temporary); } finally { db.close(); }
    const verified = verifyDatabase(temporary);
    fs.renameSync(temporary, target);
    return { filename: target, ...verified };
}
if (require.main === module) {
    const directory = path.resolve(__dirname, '../../data');
    const action = process.argv[2];
    Promise.resolve().then(() => {
        if (action === 'verify') return verifyDatabase(path.join(directory, 'aurareader.sqlite'));
        if (action === 'backup') return backupDatabase(directory);
        throw new Error('用法: node src/server/storageMaintenance.js verify|backup');
    }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { verifyDatabase, backupDatabase };
