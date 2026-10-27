// Rebuild the local filming kit from the two preserved official EPUB files.
// This script never opens the user's AuraReader database or downloads files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');

const root = __dirname;
const project = path.resolve(root, '../../..');
const stamp = '2026-10-27T04:00:00.000Z';
const goalId = 'remotion-focused-reading-goal';
const initialGoal = 'Stop checking my phone while reading.';
const evolvedGoal = 'Put my phone away. Read for 20 minutes.';
const definitions = [
  {
    key: 'bennett', id: 'remotion-focus-bennett', pg: '2274',
    file: '01-how-to-live-on-24-hours-a-day.epub',
    title: 'How to Live on 24 Hours a Day', author: 'Arnold Bennett',
    authorDates: '1867–1931', chapter: 'VII · Controlling the Mind', tocMatch: /CONTROLLING THE MIND/i,
    highlight: 'Bring it back by the scruff of the neck.',
    noteAnchor: 'Do not despair. Continue. Keep it up.',
    note: 'When I drift, return to the next sentence.',
    noteZh: '走神时，就回到下一句。',
    takeawayZh: '第一本书给出阅读中的应对动作：注意力跑开后，重新回到眼前这一句。',
  },
  {
    key: 'james', id: 'remotion-focus-james', pg: '16287',
    file: '02-talks-to-teachers-on-psychology.epub',
    title: 'Talks to Teachers on Psychology', author: 'William James',
    fullTitle: "Talks To Teachers On Psychology; And To Students On Some Of Life's Ideals",
    authorDates: '1842–1910', chapter: 'VIII · The Laws of Habit', tocMatch: /THE LAWS OF HABIT/i,
    highlight: 'put yourself assiduously in conditions that encourage the new way',
    noteAnchor: 'make engagements incompatible with the old',
    note: 'Phone in another room before I start.',
    noteZh: '开始前，把手机放到另一个房间。',
    takeawayZh: '第二本书带来另一个角度：我可以先改变阅读条件，再开始这一次阅读。',
  },
];
const clean = text => text.replace(/\s+/g, ' ').trim();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function write(relative, data) {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', 'utf8');
}
function makeGoal(text) { return { id: goalId, parentId: null, text, origin: null, createdAt: stamp, updatedAt: stamp }; }
function backup(book, notes, goal, related) {
  return {
    version: '1.3', type: 'aurareader_full_backup', exportedAt: stamp,
    books: [book], notes,
    goalGraph: {
      goals: goal ? [goal] : [],
      links: goal ? related.map(note => ({ goalId, annotationId: note.id, bookId: book.id })) : [],
      bookLinks: goal ? [{ goalId, bookId: book.id }] : [],
    },
  };
}

(async () => {
  const shell = new JSDOM('');
  global.DOMParser = shell.window.DOMParser;
  global.document = shell.window.document;
  const load = file => import(pathToFileURL(path.join(project, 'dist/client', file)).href);
  const { parseEpub } = await load('infrastructure/epubParser.js');
  const { findQuoteRange, resolveAnnotationRange } = await load('domain/annotationRangeEngine.js');
  const books = [], annotations = [], materials = [], rights = [];
  for (const def of definitions) {
    const bytes = fs.readFileSync(path.join(root, 'sources', def.file));
    const book = await parseEpub(bytes, def.title + '.epub', JSZip);
    Object.assign(book, { id: def.id, title: def.title, fullTitle: def.fullTitle || def.title, author: def.author, updatedAt: stamp });
    const section = book.toc.find(item => def.tocMatch.test(item.title));
    assert.ok(section, 'Expected source chapter is present: ' + def.key);
    const pageDom = new JSDOM(book.pages[section.page - 1]);
    const body = pageDom.window.document.body;
    const text = body.textContent;
    const chapterHeading = section.anchor ? pageDom.window.document.getElementById(section.anchor) : null;
    assert.ok(chapterHeading, 'The chapter has an actual EPUB anchor');
    let paragraph;
    const records = [];
    for (const [kind, selected, comment] of [
      ['highlight', def.highlight, ''], ['note', def.noteAnchor, def.note],
    ]) {
      const range = findQuoteRange(text, selected);
      assert.ok(range, 'Verified original quotation: ' + selected);
      const record = {
        id: 'remotion-focus-' + def.key + '-' + kind,
        bookId: book.id, kind, quote: text.slice(range.start, range.end), comment,
        color: kind === 'note' ? 'green' : 'yellow', page: section.page,
        chapter: def.chapter, timestamp: stamp,
        location: { sectionId: 'chapter-' + section.page, page: section.page, offset: range.start, ...range },
      };
      assert.deepEqual(resolveAnnotationRange(text, record), range);
      assert.equal(clean(record.quote), selected);
      paragraph = [...body.querySelectorAll('p')].find(p => clean(p.textContent).includes(selected));
      assert.ok(paragraph, 'Quotation is inside a real source paragraph');
      records.push(record);
    }
    assert.ok(records[0].location.end <= records[1].location.start || records[1].location.end <= records[0].location.start,
      'The highlight and note must not overlap');
    books.push(book); annotations.push(...records);
    materials.push({
      bookId: book.id, title: def.title, fullTitle: def.fullTitle || def.title, author: def.author,
      chapter: def.chapter, sourcePage: section.page, chapterAnchor: section.anchor,
      sourceUrl: 'https://www.gutenberg.org/cache/epub/' + def.pg + '/pg' + def.pg + '-images.html',
      highlight: { annotationId: records[0].id, exactText: def.highlight, linkToGoal: false },
      note: { annotationId: records[1].id, exactAnchor: def.noteAnchor, text: def.note, textZh: def.noteZh, linkToGoal: true },
      contextParagraph: clean(paragraph.textContent), takeawayZh: def.takeawayZh,
      location: records[1].location,
    });
    rights.push({
      title: def.fullTitle || def.title, author: def.author, authorDates: def.authorDates,
      catalogUrl: 'https://www.gutenberg.org/ebooks/' + def.pg,
      epubUrl: 'https://www.gutenberg.org/ebooks/' + def.pg + '.epub3.images',
      copyrightStatement: 'Public domain in the USA.', language: 'English',
      termsUrl: 'https://www.gutenberg.org/policy/license.html',
      localEpub: 'sources/' + def.file, sha256: hash(bytes), bytes: bytes.length,
      sourceNote: 'Unmodified official EPUB preserved with its original notices. No modern translation or third-party cover added.',
    });
    pageDom.window.close();
  }

  write('books.json', books);
  write('annotations.json', annotations);
  write('source-manifest.json', { preparedOn: '2026-10-27', books: rights });
  write('demo-content.json', {
    initialGoal, evolvedGoal, goalId, durationSeconds: 39,
    notesAre: 'Original fictional reader notes written for this product demonstration, not quotations from the books or evidence of a real user outcome.',
    durationIs: '20 minutes is the fictional reader’s own choice. Neither book prescribes this exact phone-reading routine.',
    materials,
    goalMaterials: annotations.filter(a => a.kind === 'note').map(a => ({ goalId, annotationId: a.id, bookId: a.bookId })),
    timeline: [
      { from: 0, to: 3, action: 'Idea appears' },
      { from: 3, to: 7, action: 'Create the initial Goal; enter it explicitly' },
      { from: 7, to: 12, action: 'Add Book A; explicitly open its card; move to the verified passage' },
      { from: 12, to: 18, action: 'Highlight A; create the separate margin note; finish editing; explicitly link the note to the Goal' },
      { from: 18, to: 29, action: 'Read Book B under the same Goal; highlight and add its note; explicitly link the note; rewrite the same Goal as evolvedGoal' },
      { from: 29, to: 35, action: 'Present Achieve / Archive / Delete as three alternatives from the same unchanged starting state' },
      { from: 35, to: 39, action: 'AuraReader / Your reading. Your direction.' },
    ],
  });

  const initial = makeGoal(initialGoal), evolved = makeGoal(evolvedGoal);
  books.forEach((book, i) => {
    const def = definitions[i];
    write('imports/00-clean-library/' + def.key + '.aurabackup', backup(book, [], null, []));
    const own = annotations.filter(a => a.bookId === book.id);
    write('imports/02-cross-book/' + def.key + '.aurabackup', backup(book, own, evolved, own.filter(a => a.kind === 'note')));
    if (i === 0) write('imports/01-after-book-a/bennett.aurabackup', backup(book, own, initial, own.filter(a => a.kind === 'note')));
  });

  // Exercise the real restore implementation in a fresh, isolated database.
  // This uses no user database and needs no HTTP listener.
  const { createDataStore } = require(path.join(project, 'src/server/dataStore.js'));
  const databaseName = 'aurareader.sqlite';
  // createDataStore is directory-based; use a clearly scoped workspace fixture.
  const checks = [];
  const checkDirectory = path.join(root, '.validation-db');
  fs.mkdirSync(checkDirectory, { recursive: true });
  assert.equal(fs.readdirSync(checkDirectory).length, 0, 'Validation directory must start empty');
  let store;
  try {
    store = createDataStore(checkDirectory);
    for (const def of definitions) {
      const data = JSON.parse(fs.readFileSync(path.join(root, 'imports/02-cross-book', def.key + '.aurabackup'), 'utf8'));
      store.restore({ opId: crypto.randomUUID(), books: data.books, notes: data.notes, goalGraph: data.goalGraph });
    }
    const state = store.goalLibrary().value;
    assert.equal(state.goals.length, 1); assert.equal(state.goals[0].text, evolvedGoal);
    assert.equal(state.bookLinks.length, 2); assert.equal(state.links.length, 2);
    assert.ok(state.links.every(link => link.generation));
    assert.ok(state.bookLinks.every(link => link.generation));
    assert.deepEqual(store.check(), { integrity: 'ok', foreignKeys: 0 });
    checks.push('Both final per-book backups restore into one Goal, two explicit book links and two cross-book notes; generation values are rebound by the real importer.');
    checks.push('The real SQLite integrity and Goal relationship validation passes.');
    store.close(); store = null;
  } finally {
    if (store) store.close();
    // Remove only the three exact generated SQLite filenames, never recursively.
    for (const name of [databaseName, databaseName + '-wal', databaseName + '-shm']) {
      const file = path.join(checkDirectory, name); if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    if (fs.readdirSync(checkDirectory).length === 0) fs.rmdirSync(checkDirectory);
  }
  write('validation.json', {
    status: 'passed', books: books.length, exactSourceSelections: annotations.length,
    highlights: annotations.filter(a => a.kind === 'highlight').length,
    notes: annotations.filter(a => a.kind === 'note').length, goalLinkedNotes: 2,
    checks: ['Both official EPUBs parse with AuraReader’s existing importer and retain their complete contents.',
      'All four selections resolve to exact source ranges and real TOC chapter anchors.',
      'Highlight and note ranges do not overlap within either book.', ...checks],
    limitation: 'This validates parsing, source offsets and storage restore. No fresh visual desktop playback or Remotion render was performed.',
  });
  shell.window.close();
  console.log('Prepared: 2 full books, 2 highlights, 2 original notes, 1 continuing Goal and 5 importable scene backups. All source and SQLite restore checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
