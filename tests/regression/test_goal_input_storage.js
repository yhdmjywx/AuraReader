const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createDataStore } = require('../../src/server/dataStore');
const { backupDatabase } = require('../../src/server/storageMaintenance');
(async () => {
    const directory = fs.mkdtempSync(path.resolve('.commandcode/goal-input-storage-'));
    let store = createDataStore(directory);
    try {
        const now = new Date().toISOString();
        const goal = id => ({ id, parentId: null, text: id, origin: null, createdAt: now, updatedAt: now });
        const version = store.saveBook({ opId: randomUUID(), expected: 0, book: { id: 'book', title: 'Book', pages: ['<p>Source</p>'] } });
        store.saveNote({ opId: randomUUID(), expected: 0, generation: version.generation, note: { id: 'n', bookId: 'book', quote: 'Source', comment: 'Comment' } });
        const old = { goals: [goal('g'), goal('other')], links: [{ goalId: 'g', annotationId: 'n', bookId: 'book', generation: version.generation }] };
        store.run('UPDATE goal_library SET payload=? WHERE id=1', JSON.stringify(old)); store.run('PRAGMA user_version=4');
        store.close(); store = createDataStore(directory);
        assert.equal(store.one('PRAGMA user_version').user_version, 5);
        assert.deepEqual(store.goalLibrary().value.goals, old.goals);
        assert.equal(store.goalLibrary().value.links[0].order, 1);
        assert.deepEqual(store.goalLibrary().value.inputs, []);
        let record = store.goalLibrary();
        const text = { id: 'text', goalId: 'g', text: 'Independent\n自己的理解', order: 2, createdAt: now, updatedAt: now };
        store.saveGoalLibrary({ opId: randomUUID(), expected: record.revision, state: { ...record.value, inputs: [text], contentSequence: 2 } });
        record = store.goalLibrary();
        const frozen = { opId: randomUUID(), expected: record.revision, state: old };
        const ack = store.saveGoalLibrary(frozen);
        assert.deepEqual(store.saveGoalLibrary(frozen), ack, 'old exact command identity is preserved');
        assert.deepEqual(store.goalLibrary().value.inputs, [text], 'old snapshot cannot erase new text');
        for (const bad of [
            [{ ...text, goalId: 'missing' }], [text, text], [{ ...text, text: ' ' }], [{ ...text, order: -1 }],
            [{ ...text, goalId: 'other' }], [{ ...text, response: { sequence: 2, markedAt: 'invalid' } }]
        ]) {
            record = store.goalLibrary();
            assert.throws(() => store.saveGoalLibrary({ opId: randomUUID(), expected: record.revision, state: { ...record.value, inputs: bad } }));
            assert.deepEqual(store.goalLibrary(), record, 'invalid update rolls back entirely');
        }
        record = store.goalLibrary();
        store.saveGoalLibrary({ opId: randomUUID(), expected: record.revision, state: { ...record.value, goals: record.value.goals.map(g => g.id === 'g' ? { ...g, archivedAt: now } : g) } });
        record = store.goalLibrary();
        assert.throws(() => store.saveGoalLibrary({ opId: randomUUID(), expected: record.revision, state: { ...record.value, inputs: [{ ...text, text: 'Cannot edit archive' }] } }));
        assert.throws(() => store.saveGoalLibrary({ opId: randomUUID(), expected: record.revision, state: { ...record.value,
            links: record.value.links.map(l => ({ ...l, response: { markedAt: now, sequence: 2 } })) } }), /Restore the goal before changing Response/);
        const restoredResponse = { markedAt: now, sequence: 2 };
        store.restore({ opId: randomUUID(), books: [store.books().find(b => b.id === 'book').value],
            notes: [{ id: 'n', bookId: 'book', quote: 'Source', comment: 'Comment' }],
            goalGraph: { goals: record.value.goals, links: record.value.links.map(l => ({ ...l, response: restoredResponse })) } });
        assert.deepEqual(store.goalLibrary().value.links[0].response, restoredResponse, 'trusted restore retains the archived association mark');
        record = store.goalLibrary();
        assert.throws(() => store.saveGoalLibrary({ opId: randomUUID(), expected: record.revision, state: { ...record.value,
            links: record.value.links.map(({ response, ...link }) => link) } }), /Restore the goal before changing Response/);
        store.deleteBook({ opId: randomUUID(), expected: store.books().find(b => b.id === 'book').revision, id: 'book' });
        assert.deepEqual(store.goalLibrary().value.inputs, [text], 'source deletion retains owned text even when archived');
        const backup = await backupDatabase(directory);
        const copy = new DatabaseSync(backup.filename, { readOnly: true });
        try { assert.deepEqual(JSON.parse(copy.prepare('SELECT payload FROM goal_library').get().payload).inputs, [text]); } finally { copy.close(); }
        store.close(); store = createDataStore(directory);
        assert.deepEqual(store.goalLibrary().value.inputs, [text]);
        console.log('PASS: transactional v4→v5 migration, old command replay, owned-record validation, archived guards, source deletion and whole-library backup');
    } finally { store.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
