const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const JSZip = require('jszip');
const { createFontStore, inspectFont } = require('../../src/server/fontStore');

(async () => {
    const { CURATED_FONTS, automaticFont, normalizeFontChoice, resolveFont } = await import('../../dist/client/domain/fontCatalog.js');
    assert.deepEqual(CURATED_FONTS.map(font => font.id), ['sarasa', 'literata']);
    const fontDirectory = path.resolve('src/client/assets/fonts');
    const css = await fs.readFile(path.join(fontDirectory, 'fonts.css'), 'utf8');
    const resources = [...new Set([...css.matchAll(/url\('\.\/([^']+)'\)/g)].map(match => match[1]))];
    const inventory = JSON.parse(await fs.readFile(path.join(fontDirectory, 'inventory.json'), 'utf8'));
    assert.equal(resources.length, 6, '保留更纱四种字形和 Literata 常规／斜体字库');
    assert.deepEqual(resources.slice().sort(), inventory.map(item => item.filename).sort());
    assert.deepEqual((await fs.readdir(fontDirectory)).filter(name => name.endsWith('.woff2')).sort(), resources.slice().sort(), '不得残留其他内置字库');
    const crypto = require('node:crypto');
    for (const resource of resources) {
        const bytes = await fs.readFile(path.join(fontDirectory, resource));
        const item = inventory.find(font => font.filename === resource);
        assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', `${resource} 必须为有效 WOFF2 资源`);
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item?.sha256, `${resource} 资源必须完整`);
    }
    assert.equal(automaticFont({ language: 'zh-Hans-CN' }), 'sarasa');
    assert.equal(automaticFont({ language: 'zh_CN' }), 'sarasa');
    assert.equal(automaticFont({ language: 'en-GB' }), 'literata');
    assert.equal(automaticFont({ language: 'zh-Hant-TW' }), null);
    assert.equal(automaticFont({ language: 'fr' }), null);
    assert.equal(automaticFont({}), null);
    assert.deepEqual(normalizeFontChoice({ kind: 'publisher' }), { kind: 'auto' });
    assert.deepEqual(normalizeFontChoice({ kind: 'builtin', id: 'missing' }), { kind: 'auto' });
    for (const id of ['source-han-serif', 'wenkai', 'source-serif']) {
        assert.deepEqual(normalizeFontChoice({ kind: 'builtin', id }), { kind: 'auto' });
        assert.match(resolveFont({ kind: 'builtin', id }, { language: 'en' }).family, /Literata/);
        assert.match(resolveFont({ kind: 'builtin', id }, { language: 'zh-CN' }).family, /Sarasa Gothic SC/);
    }
    const english = resolveFont({ kind: 'builtin', id: 'literata' }, {});
    assert.match(english.family, /Literata.*Sarasa Gothic SC/);
    assert.deepEqual(english.loadFamilies, ['Literata', 'Sarasa Gothic SC']);
    assert.match(resolveFont({ kind: 'auto' }, { language: 'zh-CN' }).family, /Sarasa Gothic SC/);
    assert.match(resolveFont({ kind: 'auto' }, { language: 'en' }).family, /Literata/);
    assert.match(resolveFont({ kind: 'auto' }, {}).family, /system-ui/);
    assert.match(resolveFont({ kind: 'system', family: 'Microsoft YaHei' }, {}).systemAlias, /^AuraSystem_[a-f0-9_]+$/, '含空格的本机字体也必须获得合法的字体别名');
    assert.match(resolveFont({ kind: 'system', family: 'Arial' }, {}).family, /Arial.*Sarasa Gothic SC/);
    const custom = { id: 'a'.repeat(64), name: 'My Font' };
    const importedChoice = { kind: 'imported', ...custom };
    assert.match(resolveFont(importedChoice, {}, [custom]).family, /AuraImported_.*Sarasa Gothic SC/);
    assert.deepEqual(resolveFont(importedChoice, {}, [custom]).loadFamilies, ['Sarasa Gothic SC']);

    const fontBytes = await fs.readFile(path.join(fontDirectory, 'literata.woff2'));
    const fontkit = require('fontkit');
    const latinFont = fontkit.create(fontBytes);
    const fallbackFont = fontkit.create(await fs.readFile(path.join(fontDirectory, 'sarasa-regular.woff2')));
    for (const character of '阅读笔记高亮') {
        assert.equal(latinFont.hasGlyphForCodePoint(character.codePointAt(0)), false);
        assert.equal(fallbackFont.hasGlyphForCodePoint(character.codePointAt(0)), true, '更纱黑体必须补齐 Literata 缺失的常用中文字形');
    }
    assert.equal(inspectFont(fontBytes, 'font.woff2').type, 'woff2');
    assert.throws(() => inspectFont(Buffer.from('not a font'), 'fake.ttf'));
    assert.throws(() => inspectFont(fontBytes, 'mismatch.ttf'));
    assert.throws(() => inspectFont(fontBytes, 'script.js'));
    const tempRoot = path.resolve('.commandcode/font-store-tests');
    await fs.mkdir(tempRoot, { recursive: true });
    const directory = await fs.mkdtemp(path.join(tempRoot, 'fonts-'));
    try {
        const store = createFontStore(directory);
        const imported = await store.import(fontBytes, 'test.woff2');
        const duplicate = await store.import(fontBytes, 'duplicate.woff2');
        assert.equal(imported.id, duplicate.id);
        const restarted = createFontStore(directory);
        assert.equal((await restarted.list()).length, 1, '导入字体必须在新实例中恢复且避免重复');
        assert.equal(store.file('../../secret'), null);
        assert.equal(store.file('x.ttf'), null);
        await fs.unlink(store.file(`${imported.id}.woff2`).path);
        assert.equal((await restarted.list()).length, 0, '丢失文件必须从可用字体列表中排除');
    } finally {
        if (!directory.startsWith(tempRoot + path.sep)) throw new Error('Unsafe test cleanup path');
        await fs.rm(directory, { recursive: true, force: true });
    }

    const html = await fs.readFile('src/client/index.html', 'utf8');
    const dom = new JSDOM(html, { url: 'http://localhost:8095/' });
    const saved = new Map();
    for (const key of ['window', 'document', 'localStorage', 'DOMParser', 'fetch']) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    }
    try {
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.localStorage = dom.window.localStorage;
        globalThis.DOMParser = dom.window.DOMParser;
        globalThis.fetch = async url => ({ ok: true, json: async () => url.endsWith('/system')
            ? { supported: true, fonts: ['Arial', 'Microsoft YaHei'] } : { fonts: [] } });
        const { FontController } = await import('../../dist/client/features/reader/fontController.js');
        const ids = {
            appearancePanel: 'appearance-panel', fontFamilySelect: 'font-family-select', fontPicker: 'font-picker',
            fontMenu: 'font-menu', fontChoiceLabel: 'font-choice-label', fontMainView: 'font-main-view',
            fontMoreView: 'font-more-view', btnMoreFonts: 'btn-more-fonts', btnFontBack: 'btn-font-back',
            fontSearch: 'font-search', btnReadSystemFonts: 'btn-read-system-fonts', btnImportFont: 'btn-import-font',
            fontFileInput: 'font-file-input', fontStatus: 'font-status', fontBrowserList: 'font-browser-list'
        };
        const elements = Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)]));
        const panel = elements.appearancePanel;
        assert.equal(panel.querySelectorAll('.appearance-row').length, 6, '字体功能不得增加设置行');
        assert.equal(elements.fontMenu.querySelectorAll('[data-font-choice]').length, 3, '一个自动选项与两款精选字体');
        assert.equal(elements.fontMenu.querySelectorAll('button:disabled').length, 1, '原书字体暂缓并标记未启用');
        let applied = 0;
        for (const id of ['source-han-serif', 'wenkai', 'source-serif']) {
            localStorage.setItem('aura_font_preference', JSON.stringify({ kind: 'builtin', id }));
            const migrated = new FontController({ getBook: () => ({ language: 'en' }) });
            assert.deepEqual(migrated.choice, { kind: 'auto' });
            assert.deepEqual(JSON.parse(localStorage.getItem('aura_font_preference')), { kind: 'auto' }, '移除字体后的自动选择必须持久化');
            assert.match(migrated.resolved().family, /Literata/);
        }
        const fonts = new FontController({ getBook: () => ({ language: 'en' }), onChange: () => applied++ });
        fonts.initUI(elements);
        await fonts.ready;
        assert.equal(elements.fontChoiceLabel.textContent, '自动选择');
        assert.equal(elements.fontMenu.querySelector('[data-font-choice="auto"]').getAttribute('aria-checked'), 'true');
        elements.fontFamilySelect.click();
        assert.equal(elements.fontMenu.hidden, false);
        await fonts.choose({ kind: 'builtin', id: 'literata' });
        assert.equal(elements.fontMenu.hidden, true);
        assert.equal(elements.fontChoiceLabel.textContent, 'Literata');
        assert.ok(applied > 0, '选择字体必须触发正文更新');
        elements.fontFamilySelect.click();
        assert.equal(elements.fontMenu.querySelector('[data-font-choice="literata"]').getAttribute('aria-checked'), 'true');
        elements.btnMoreFonts.click();
        assert.equal(elements.fontMainView.hidden, true);
        assert.equal(elements.fontMoreView.hidden, false);
        await fonts.readSystemFonts();
        elements.fontSearch.value = 'arial';
        elements.fontSearch.dispatchEvent(new dom.window.Event('input'));
        assert.equal(elements.fontBrowserList.querySelectorAll('button').length, 1);
        await fonts.choose({ kind: 'system', family: 'Arial' });
        const restored = new FontController();
        assert.equal(restored.choice.family, 'Arial', '全局字体偏好必须跨控制器实例恢复');
        assert.ok(restored.recent.includes('Arial'));
        const paper = document.createElement('article');
        fonts.apply(paper);
        assert.match(paper.style.getPropertyValue('--reader-font-family'), /Arial/);
        assert.ok(paper.classList.contains('reader-font-override'));
        fonts.ensure = async () => { throw new Error('missing file'); };
        await fonts.choose({ kind: 'builtin', id: 'sarasa' });
        assert.match(fonts.resolved().family, /system-ui/, '字体加载失败必须回退并继续阅读');
        assert.ok(applied > 0);

        const { parseEpub } = await import('../../dist/client/infrastructure/epubParser.js');
        async function epub(metaLanguage, bodyLanguage) {
            const zip = new JSZip();
            zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
            zip.file('book.opf', `<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata>${metaLanguage ? `<dc:language>${metaLanguage}</dc:language>` : ''}</metadata><manifest><item id="chapter" href="chapter.xhtml"/></manifest><spine><itemref idref="chapter"/></spine></package>`);
            zip.file('chapter.xhtml', `<html${bodyLanguage ? ` lang="${bodyLanguage}"` : ''}><body><h1>Chapter</h1><p>English 中文 <strong>Bold</strong> <em>Italic</em></p></body></html>`);
            return parseEpub(await zip.generateAsync({ type: 'arraybuffer' }), 'fonts.epub', JSZip);
        }
        assert.equal((await epub('en', 'zh-CN')).language, 'en', '元数据优先于正文语言标记');
        assert.equal((await epub('', 'zh-Hans')).language, 'zh-Hans');
        assert.equal((await epub('', '')).language, '');
        assert.match((await epub('en', '')).pages[0], /<strong>Bold<\/strong>.*<em>Italic<\/em>/);
        console.log('✅ 字体选择、回退、导入持久化、菜单与 EPUB 语言解析通过');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exit(1); });
