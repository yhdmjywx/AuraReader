const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

(async () => {
    // Book samples and content-recognition regexes remain in their original languages.
    // Scan executable literals and JSX text, excluding comments and those regexes.
    const leftovers = [];
    function scan(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) { if (entry.name !== 'assets') scan(file); continue; }
            if (!/\.(?:tsx?|jsx?|cjs)$/.test(file) || file === path.join('src', 'client', 'infrastructure', 'demoData.js')) continue;
            const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
            function visit(node) {
                if ((ts.isStringLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node)
                    || ts.isTemplateTail(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node))
                    && /\p{Script=Han}/u.test(node.text)) {
                    leftovers.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${node.text}`);
                }
                ts.forEachChild(node, visit);
            }
            visit(source);
        }
    }
    scan('src');
    assert.deepEqual(leftovers, [], 'Product copy must be English; source book content is preserved separately');
    const html = fs.readFileSync('src/client/index.html', 'utf8');
    assert.match(html, /<html lang="en"/);
    assert.doesNotMatch(html, /\p{Script=Han}/u);

    const { countLabel, noteTimestamp, exportTimestamp } = await import('../../dist/client/domain/format.js');
    assert.equal(countLabel(0, 'linked item'), '0 linked items');
    assert.equal(countLabel(1, 'linked item'), '1 linked item');
    assert.equal(countLabel(2, 'appendix', 'appendices'), '2 appendices');
    const date = new Date(2026, 0, 2, 3, 4);
    assert.equal(noteTimestamp(date), '2026/1/2 03:04');
    assert.match(exportTimestamp(date), /Jan.*2026/);
    const { createAnnotationObject, normalizeAnnotation } = await import('../../dist/client/domain/annotationEngine.js');
    const input = { id: 'existing', bookId: 'book', kind: 'note', quote: '原文😀', comment: '中文笔记', chapter: '第一章', timestamp: '2025/2/3 14:05' };
    const original = JSON.stringify(input);
    for (const annotation of [normalizeAnnotation(input), createAnnotationObject(input)]) {
        assert.equal(annotation.quote, input.quote);
        assert.equal(annotation.comment, input.comment);
        assert.equal(annotation.chapter, input.chapter);
        assert.equal(annotation.timestamp, input.timestamp);
    }
    assert.equal(JSON.stringify(input), original);
    console.log('PASS: English product copy, document language, plural counts, deterministic dates and original user content');
})().catch(error => { console.error(error); process.exitCode = 1; });
