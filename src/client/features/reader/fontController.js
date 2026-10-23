import { SYSTEM_FALLBACK, normalizeFontChoice, quoteFamily, resolveFont } from '../../domain/fontCatalog.js';
import { unwrapDesktop } from '../../infrastructure/storageClient.js';

const PREFERENCE_KEY = 'aura_font_preference';
const SEARCH_KEY = 'aura_font_search';
const RECENT_KEY = 'aura_font_recent_system';

function readStored(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
}
function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Reading still works without storage. */ }
}

export class FontController {
    /** @param {import('../../app/contracts.js').FontCallbacks} callbacks */
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        const savedChoice = readStored(PREFERENCE_KEY, null);
        this.choice = normalizeFontChoice(savedChoice);
        if (savedChoice?.kind === 'builtin' && this.choice.kind === 'auto') store(PREFERENCE_KEY, this.choice);
        this.imported = [];
        this.systemFamilies = [];
        this.recent = readStored(RECENT_KEY, []).filter?.(name => typeof name === 'string') || [];
        this.loadedFaces = new Map();
        this.revision = 0;
        this.ready = Promise.resolve();
        this.elements = null;
        this.failed = false;
    }

    resolved() {
        const font = resolveFont(this.choice, this.callbacks.getBook?.(), this.imported);
        return this.failed ? { ...font, family: SYSTEM_FALLBACK, loadFamilies: [] } : font;
    }

    apply(paper) {
        if (!paper) return;
        paper.classList.add('reader-font-override');
        const font = this.resolved();
        paper.style.setProperty('--reader-font-family', font.family);
        paper.style.fontFamily = font.family;
    }

    async ensure(font) {
        if (typeof document === 'undefined' || !document.fonts) return;
        if (font.missing) throw new Error('已导入字体的文件已缺失');
        if (font.systemFamily) {
            const key = `system:${font.systemFamily}`;
            if (!this.loadedFaces.has(key)) {
                const promise = (async () => {
                    const face = new FontFace(font.systemAlias, `local(${quoteFamily(font.systemFamily)})`);
                    await face.load(); document.fonts.add(face); return face;
                })();
                this.loadedFaces.set(key, promise);
                promise.catch(() => this.loadedFaces.delete(key));
            }
            try { await this.loadedFaces.get(key); }
            catch (_) { /* Some local fonts only expose a full face name; the native family stack still works. */ }
        }
        if (font.importedFont) {
            const item = font.importedFont;
            if (!this.loadedFaces.has(item.id)) {
                const promise = (async () => {
                    const face = new FontFace(`AuraImported_${item.id}`, `url("${item.url}")`, { weight: item.weight || '400' });
                    await face.load();
                    document.fonts.add(face);
                    return face;
                })();
                this.loadedFaces.set(item.id, promise);
                promise.catch(() => this.loadedFaces.delete(item.id));
            }
            await this.loadedFaces.get(item.id);
        }
        await Promise.all(font.loadFamilies.flatMap(family => [
            document.fonts.load(`18px "${family}"`),
            document.fonts.load(`bold 18px "${family}"`),
            document.fonts.load(`italic 18px "${family}"`)
        ]));
    }

    async prepareForBook() {
        const revision = ++this.revision;
        this.failed = false;
        const font = resolveFont(this.choice, this.callbacks.getBook?.(), this.imported);
        try { await this.ensure(font); }
        catch (_) {
            if (revision !== this.revision) return;
            this.failed = true;
            this.callbacks.notify?.('字体暂不可用，已使用系统字体回退');
        }
        if (revision === this.revision) this.callbacks.onReady?.();
    }

    async choose(choice) {
        this.callbacks.beforeChange?.();
        this.choice = normalizeFontChoice(choice);
        this.failed = false;
        store(PREFERENCE_KEY, this.choice);
        if (this.choice.kind === 'system') {
            this.recent = [this.choice.family, ...this.recent.filter(name => name !== this.choice.family)].slice(0, 8);
            store(RECENT_KEY, this.recent);
        }
        this.close();
        this.renderLabel();
        const revision = ++this.revision;
        this.callbacks.onChange?.();
        try { await this.ensure(resolveFont(this.choice, this.callbacks.getBook?.(), this.imported)); }
        catch (_) {
            if (revision !== this.revision) return;
            this.failed = true;
            this.callbacks.notify?.('字体暂不可用，已使用系统字体回退');
        }
        if (revision === this.revision) this.callbacks.onChange?.();
    }

    initUI(elements) {
        const trigger = elements.fontFamilySelect;
        if (!trigger || !elements.fontMenu) return;
        this.elements = elements;
        const menu = elements.fontMenu;
        trigger.addEventListener('click', () => {
            if (!menu.hidden) this.close();
            else {
                menu.hidden = false;
                trigger.setAttribute('aria-expanded', 'true');
                this.showMain();
                const selected = menu.querySelector('[aria-checked="true"]');
                (selected || menu.querySelector('[data-font-choice]'))?.focus();
            }
        });
        menu.addEventListener('click', event => {
            const option = event.target.closest('[data-font-choice]');
            if (option) {
                const id = option.dataset.fontChoice;
                this.choose(id === 'auto' ? { kind: 'auto' } : { kind: 'builtin', id });
            }
            const system = event.target.closest('[data-system-family]');
            if (system) this.choose({ kind: 'system', family: system.dataset.systemFamily });
            const imported = event.target.closest('[data-imported-font]');
            if (imported) {
                const font = this.imported.find(font => font.id === imported.dataset.importedFont);
                if (font) this.choose({ kind: 'imported', id: font.id, name: font.name });
            }
        });
        elements.btnMoreFonts.addEventListener('click', () => this.showMore());
        elements.btnFontBack.addEventListener('click', () => this.showMain());
        elements.fontSearch.value = String(readStored(SEARCH_KEY, '')).slice(0, 160);
        elements.fontSearch.addEventListener('input', () => {
            store(SEARCH_KEY, elements.fontSearch.value);
            this.renderBrowser();
        });
        elements.btnReadSystemFonts.addEventListener('click', () => this.readSystemFonts());
        elements.btnImportFont.addEventListener('click', () => window.auraDesktop ? this.importFile() : elements.fontFileInput.click());
        elements.fontFileInput.addEventListener('change', async () => {
            const file = elements.fontFileInput.files[0];
            elements.fontFileInput.value = '';
            if (file) await this.importFile(file);
        });
        document.addEventListener('click', event => {
            if (!menu.hidden && !event.composedPath().includes(elements.fontPicker)) this.close(false);
        }, true);
        document.addEventListener('keydown', event => {
            if (menu.hidden) return;
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopImmediatePropagation(); this.close();
            }
        }, true);
        menu.addEventListener('keydown', event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || event.target === elements.fontSearch) return;
            const buttons = [...menu.querySelectorAll('button:not(:disabled)')].filter(button => !button.closest('[hidden]'));
            const index = buttons.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            event.preventDefault(); buttons[next]?.focus();
        });
        this.renderLabel();
        this.ready = this.loadImports().then(() => {
            this.renderLabel();
            return this.prepareForBook();
        });
    }

    close(focus = true) {
        if (!this.elements) return;
        this.elements.fontMenu.hidden = true;
        this.elements.fontFamilySelect.setAttribute('aria-expanded', 'false');
        if (focus) this.elements.fontFamilySelect.focus();
    }

    renderLabel() {
        if (!this.elements) return;
        const font = resolveFont(this.choice, this.callbacks.getBook?.(), this.imported);
        this.elements.fontChoiceLabel.textContent = font.name;
        this.elements.fontFamilySelect.title = `字体：${font.name}`;
        this.elements.fontFamilySelect.setAttribute('aria-label', `字体：${font.name}`);
        const current = this.elements.fontMenu.querySelector('#font-current-custom');
        if (current) {
            current.replaceChildren();
            current.hidden = !['system', 'imported'].includes(this.choice.kind);
            if (!current.hidden) {
                const heading = document.createElement('p'); heading.className = 'font-group-label'; heading.textContent = '当前字体';
                const button = document.createElement('button'); button.type = 'button'; button.className = 'font-option';
                button.setAttribute('role', 'menuitemradio'); button.setAttribute('aria-checked', 'true'); button.textContent = font.name;
                if (this.choice.kind === 'system') button.dataset.systemFamily = this.choice.family;
                else button.dataset.importedFont = this.choice.id;
                current.append(heading, button);
            }
        }
        this.elements.fontMenu.querySelectorAll('[data-font-choice]').forEach(button => {
            const selected = button.dataset.fontChoice === (this.choice.kind === 'auto' ? 'auto' : this.choice.kind === 'builtin' ? this.choice.id : '');
            button.setAttribute('aria-checked', String(selected));
        });
    }

    showMain() {
        this.elements.fontMainView.hidden = false;
        this.elements.fontMoreView.hidden = true;
        this.renderLabel();
    }

    showMore() {
        this.elements.fontMainView.hidden = true;
        this.elements.fontMoreView.hidden = false;
        this.renderBrowser();
        this.elements.fontSearch.focus();
    }

    status(message) {
        if (this.elements) this.elements.fontStatus.textContent = message;
    }

    async loadImports() {
        if (typeof window !== 'undefined' && window.auraDesktop) {
            const data = unwrapDesktop(await window.auraDesktop.fonts.list());
            this.imported = data.fonts.filter(font => /^aurareader:\/\/app\/user-fonts\/[a-f0-9]{64}\.(ttf|otf|woff2)$/.test(font.url));
            return;
        }
        try {
            const response = await fetch('/api/fonts');
            if (!response.ok) throw new Error();
            const data = await response.json();
            this.imported = (data.fonts || []).filter(font => /^[a-f0-9]{64}$/.test(font.id)
                && /^\/api\/fonts\/files\/[a-f0-9]{64}\.(ttf|otf|woff2)$/.test(font.url));
        } catch (_) { this.imported = []; }
    }

    async readSystemFonts() {
        this.elements.btnReadSystemFonts.disabled = true;
        this.status('正在读取本机字体…');
        try {
            let data;
            if (window.auraDesktop) data = unwrapDesktop(await window.auraDesktop.fonts.system());
            else {
                const response = await fetch('/api/fonts/system');
                data = response.ok ? await response.json() : { supported: false };
            }
            if (data.supported) {
                this.systemFamilies = data.fonts;
            } else if (!window.auraDesktop && typeof window.queryLocalFonts === 'function') {
                const fonts = await window.queryLocalFonts();
                this.systemFamilies = [...new Set(fonts.map(font => font.family))];
            } else {
                throw new Error('此环境无法读取本机字体，可导入字体文件');
            }
            this.status(`已读取 ${this.systemFamilies.length} 款本机字体`);
            this.renderBrowser();
        } catch (error) {
            this.status(error.name === 'NotAllowedError' ? '未获字体读取权限，可导入字体文件' : (error.message || '本机字体读取失败'));
        } finally { this.elements.btnReadSystemFonts.disabled = false; }
    }

    /** @param {File} [file] */
    async importFile(file) {
        this.elements.btnImportFont.disabled = true;
        this.status('正在导入字体…');
        try {
            let data;
            if (window.auraDesktop) {
                const result = unwrapDesktop(await window.auraDesktop.fonts.importFont());
                if (result.canceled) { this.status('已取消导入字体'); return; }
                data = { font: result.font };
            } else {
                if (!file) throw new Error('请选择字体文件');
                if (!/\.(ttf|otf|woff2)$/i.test(file.name)) throw new Error('请选择 TTF、OTF 或 WOFF2 文件');
                if (!file.size || file.size > 64 * 1024 * 1024) throw new Error('字体文件为空或超过 64MB');
                const response = await fetch(`/api/fonts/import?name=${encodeURIComponent(file.name)}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file
                });
                data = await response.json();
                if (!response.ok) throw new Error(data.error || '字体导入失败');
            }
            await this.loadImports();
            this.renderBrowser();
            this.status(`已导入 ${data.font.name}`);
            await this.choose({ kind: 'imported', id: data.font.id, name: data.font.name });
        } catch (error) { this.status(error.message || '字体导入失败'); }
        finally { this.elements.btnImportFont.disabled = false; }
    }

    renderBrowser() {
        const list = this.elements.fontBrowserList;
        list.replaceChildren();
        const query = this.elements.fontSearch.value.trim().toLocaleLowerCase();
        const addGroup = (title, fonts, kind) => {
            if (!fonts.length) return;
            const heading = document.createElement('p'); heading.className = 'font-group-label'; heading.textContent = title;
            list.append(heading);
            for (const font of fonts) {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'font-option'; button.setAttribute('role', 'menuitemradio');
                button.textContent = font.name;
                if (kind === 'imported') button.dataset.importedFont = font.id;
                else button.dataset.systemFamily = font.name;
                button.setAttribute('aria-checked', String(kind === 'imported' ? this.choice.kind === kind && this.choice.id === font.id
                    : this.choice.kind === 'system' && this.choice.family === font.name));
                list.append(button);
            }
        };
        addGroup('已导入', this.imported.filter(font => font.name.toLocaleLowerCase().includes(query)), 'imported');
        const families = [...new Set([...this.recent, ...this.systemFamilies])].sort((a, b) => a.localeCompare(b));
        addGroup('本机字体', families.filter(name => name.toLocaleLowerCase().includes(query)).map(name => ({ name })), 'system');
        if (!list.childNodes.length) {
            const empty = document.createElement('p'); empty.className = 'font-empty';
            empty.textContent = query ? '没有匹配的字体' : '读取本机字体，或导入字体文件'; list.append(empty);
        }
    }
}
