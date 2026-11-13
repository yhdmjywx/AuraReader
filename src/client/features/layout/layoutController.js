import { applyMarginGeometry } from './marginNotesLayout.js';

/** Single-page and scrolling preferences; resizing only recalculates geometry. */
export class LayoutController {
    /** @param {import('../../app/contracts.js').LayoutCallbacks} callbacks */
    constructor(callbacks = {}) {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('aura_layout_mode') : null;
        this.layoutMode = stored === 'scroll' ? 'scroll' : 'single';
        if (stored === 'double') localStorage.setItem('aura_layout_mode', 'single');
        this.callbacks = callbacks;
        this.elements = null;
        // Session-only preference; publication geometry remains authoritative for fixed layout.
        this.readingWidth = 560;
    }
    getLayoutMode() { return this.layoutMode; }
    setPageMode(mode) {
        this.callbacks.beforeGeometryChange?.();
        this.layoutMode = mode === 'scroll' ? 'scroll' : 'single';
        if (typeof localStorage !== 'undefined') localStorage.setItem('aura_layout_mode', this.layoutMode);
        const result = { layoutMode: this.layoutMode };
        this.updateLayoutClasses();
        this.callbacks.onLayoutChange?.(result);
        return result;
    }
    updateLayoutClasses(elements = this.elements) {
        const el = elements;
        if (!el?.workspaceContainer) return;
        const scroll = this.layoutMode === 'scroll';
        el.workspaceContainer.classList.toggle('layout-scroll', scroll);
        el.workspaceContainer.classList.toggle('layout-single', !scroll);
        applyMarginGeometry(el, this.readingWidth);
        for (const [button, active] of [[el.btnModeSingle, !scroll], [el.btnModeScroll, scroll]]) {
            button?.classList.toggle('active', active);
            button?.setAttribute('aria-pressed', String(active));
        }
    }
    initUI(elements) {
        if (this.elements) return;
        this.elements = elements;
        this.updateLayoutClasses();
        elements?.btnModeSingle?.addEventListener('click', () => this.setPageMode('single'));
        elements?.btnModeScroll?.addEventListener('click', () => this.setPageMode('scroll'));
    }
}
