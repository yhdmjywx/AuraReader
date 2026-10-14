const assert = require('assert');
const fs = require('fs');
const path = require('path');

(async () => {
    const { AppShell } = await import('../../src/client/app/appShell.js');
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const documentListeners = new Map();
    function element(id, tagName = 'BUTTON') {
        const classes = new Set();
        const attributes = new Map();
        const listeners = new Map();
        return {
            id, tagName, textContent: '', isContentEditable: false,
            classList: {
                contains: name => classes.has(name),
                toggle(name, open) { if (open) classes.add(name); else classes.delete(name); }
            },
            setAttribute: (name, value) => attributes.set(name, value),
            getAttribute: name => attributes.get(name),
            addEventListener: (name, callback) => listeners.set(name, callback),
            focus() { document.activeElement = this; },
            fire(name, details = {}) {
                const event = { target: this, stopPropagation() {}, preventDefault() {}, ...details };
                listeners.get(name)(event);
            }
        };
    }
    try {
        globalThis.document = {
            activeElement: element('body', 'BODY'),
            addEventListener(name, callback) {
                if (!documentListeners.has(name)) documentListeners.set(name, []);
                documentListeners.get(name).push(callback);
            }
        };
        globalThis.window = { addEventListener() {} };
        function fireDocument(name, details) {
            const event = { preventDefault() {}, ...details };
            for (const listener of documentListeners.get(name) || []) listener(event);
        }
        const elements = {
            btnExportMenu: element('btn-export-menu'),
            exportPanel: element('export-panel', 'SECTION'),
            exportBookTitle: element('export-book-title', 'SPAN'),
            currentBookTitle: { textContent: '第一本书' },
            btnAppearance: element('btn-appearance'),
            appearancePanel: element('appearance-panel', 'DIV')
        };
        const shell = new AppShell();
        shell.init(elements);
        elements.btnExportMenu.fire('click');
        assert.ok(elements.exportPanel.classList.contains('open'));
        assert.strictEqual(elements.btnExportMenu.getAttribute('aria-expanded'), 'true');
        assert.strictEqual(elements.exportPanel.getAttribute('aria-hidden'), 'false');
        assert.strictEqual(elements.exportBookTitle.textContent, '第一本书');
        elements.btnExportMenu.fire('click');
        assert.ok(!elements.exportPanel.classList.contains('open'), '再次点击图标必须收起面板');

        elements.btnAppearance.fire('click');
        elements.btnExportMenu.fire('click');
        assert.ok(!elements.appearancePanel.classList.contains('open'), '打开导出面板必须关闭视觉偏好');
        elements.btnAppearance.fire('click');
        assert.ok(!elements.exportPanel.classList.contains('open'), '打开视觉偏好必须关闭导出面板');

        elements.currentBookTitle.textContent = '第二本书';
        elements.btnExportMenu.fire('click');
        assert.strictEqual(elements.exportBookTitle.textContent, '第二本书', '面板必须显示当前书名');
        fireDocument('click', { composedPath: () => [elements.exportPanel] });
        assert.ok(elements.exportPanel.classList.contains('open'), '面板内部点击不得作为外部点击处理');
        fireDocument('click', { composedPath: () => [document.activeElement] });
        assert.ok(!elements.exportPanel.classList.contains('open'), '外部点击必须收起面板');

        elements.btnExportMenu.fire('click');
        elements.exportPanel.fire('click', { target: { closest: () => null } });
        assert.ok(elements.exportPanel.classList.contains('open'), '点击面板标题不得关闭面板');
        elements.exportPanel.fire('click', { target: { closest: () => ({ id: 'btn-export-markdown' }) } });
        assert.ok(!elements.exportPanel.classList.contains('open'), '选择导出操作后必须关闭面板');
        elements.btnExportMenu.fire('click');
        document.activeElement = element('editor', 'INPUT');
        fireDocument('keydown', { key: 'Escape' });
        assert.ok(!elements.exportPanel.classList.contains('open'));
        assert.strictEqual(document.activeElement, elements.btnExportMenu, 'Esc 关闭后焦点必须返回导出图标');
        assert.strictEqual(elements.btnExportMenu.getAttribute('aria-expanded'), 'false');
        assert.strictEqual(elements.exportPanel.getAttribute('aria-hidden'), 'true');

        const html = fs.readFileSync(path.resolve(__dirname, '../../src/client/index.html'), 'utf8');
        const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
        assert.ok(header.indexOf('id="btn-appearance"') < header.indexOf('id="btn-export-menu"'));
        assert.ok(header.indexOf('id="btn-export-menu"') < header.indexOf('id="btn-fullscreen"'));
        const panel = html.slice(html.indexOf('<section id="export-panel"'), html.indexOf('<!-- Main Workspace'));
        for (const id of ['btn-export-markdown', 'btn-export-chapter-zip', 'btn-export-standalone-html', 'btn-export-full-backup', 'btn-import-full-backup', 'backup-file-input']) {
            assert.strictEqual(html.split(`id="${id}"`).length - 1, 1, `${id} 必须保持唯一，避免重复绑定`);
            assert.ok(panel.includes(`id="${id}"`), `${id} 必须迁入顶栏面板`);
        }
        assert.ok(!html.includes('tab-settings'), '右侧不得残留重复导出页');
        console.log('PASS: 顶栏导出位置、现有入口迁移、面板关闭、偏好互斥和键盘焦点');
    } finally {
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
        else delete globalThis.document;
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else delete globalThis.window;
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
