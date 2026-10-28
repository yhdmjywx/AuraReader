/* ==========================================================================
   LayoutController - UI Layout & Viewport Mode Feature Controller
   Owns the reading mode and fixed-column responsive downgrade state.
   Margin note geometry is shared by single, double and scroll modes.
   ========================================================================== */

import { applyMarginGeometry, DOUBLE_PAGE_MIN_WIDTH } from './marginNotesLayout.js';

export { DOUBLE_PAGE_MIN_WIDTH };

export class LayoutController {
    /** @param {import('../../app/contracts.js').LayoutCallbacks} callbacks */
    constructor(callbacks = {}) {
        const storage = (typeof localStorage !== 'undefined') ? localStorage : null;
        const storedMode = storage && storage.getItem('aura_layout_mode');
        this.layoutMode = (storedMode === 'scroll' || storedMode === 'double' || storedMode === 'single')
            ? storedMode
            : 'single';
        this.isAutoDowngraded = false;
        this.callbacks = callbacks;
        this.elements = null;
        this._uiInitialized = false;
    }

    isDoublePageEffective() {
        return this.layoutMode === 'double' && !this.isAutoDowngraded;
    }

    getEffectiveReaderMode() {
        if (this.layoutMode === 'scroll') return 'scroll';
        return this.isDoublePageEffective() ? 'double' : 'single';
    }

    getLayoutMode() {
        return this.layoutMode;
    }

    getIsAutoDowngraded() {
        return this.isAutoDowngraded;
    }

    setPageMode(mode, availableWidth = 1200) {
        if (this.callbacks.beforeGeometryChange) this.callbacks.beforeGeometryChange();
        const nextMode = (mode === 'scroll' || mode === 'double' || mode === 'single') ? mode : 'single';
        this.layoutMode = nextMode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aura_layout_mode', nextMode);
        }

        if (nextMode === 'double' && availableWidth < DOUBLE_PAGE_MIN_WIDTH) {
            this.isAutoDowngraded = true;
        } else {
            this.isAutoDowngraded = false;
        }

        const res = {
            layoutMode: this.layoutMode,
            isAutoDowngraded: this.isAutoDowngraded,
            isDoubleEffective: this.isDoublePageEffective()
        };

        if (this.callbacks.onLayoutChange) {
            this.callbacks.onLayoutChange(res);
        }

        return res;
    }

    togglePageMode(availableWidth) {
        const nextMode = (this.layoutMode === 'single') ? 'double' : 'single';
        const width = (availableWidth !== undefined && availableWidth > 0)
            ? availableWidth
            : ((this.elements && this.elements.readerPanel && this.elements.readerPanel.clientWidth > 0)
                ? this.elements.readerPanel.clientWidth
                : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200));
        return this.setPageMode(nextMode, width);
    }

    checkResponsiveLayout(availableWidth = 1200) {
        if (this.layoutMode !== 'double') {
            const hadDowngrade = this.isAutoDowngraded;
            this.isAutoDowngraded = false;
            return { changed: hadDowngrade, isAutoDowngraded: false, reason: 'not_double' };
        }

        const shouldDowngrade = availableWidth < DOUBLE_PAGE_MIN_WIDTH;
        if (shouldDowngrade !== this.isAutoDowngraded) {
            this.isAutoDowngraded = shouldDowngrade;
            const res = {
                changed: true,
                isAutoDowngraded: this.isAutoDowngraded,
                reason: shouldDowngrade ? 'downgraded' : 'restored'
            };
            if (this.callbacks.onResponsiveChange) {
                this.callbacks.onResponsiveChange(res);
            }
            return res;
        }

        return { changed: false, isAutoDowngraded: this.isAutoDowngraded };
    }

    updateLayoutClasses(elements) {
        const el = elements || this.elements;
        if (!el || !el.workspaceContainer) return;

        const isDouble = this.isDoublePageEffective();
        const isScroll = this.layoutMode === 'scroll';
        el.workspaceContainer.classList[isDouble ? 'add' : 'remove']('layout-double');
        el.workspaceContainer.classList[isScroll ? 'add' : 'remove']('layout-scroll');
        el.workspaceContainer.classList[!isDouble && !isScroll ? 'add' : 'remove']('layout-single');

        applyMarginGeometry(el, this.getEffectiveReaderMode());

        this.updatePageModeButtonUI(el);
    }

    updatePageModeButtonUI(elements) {
        const el = elements || this.elements;
        if (!el || !el.btnPageMode) return;

        if (el.btnModeScroll) {
            el.btnModeScroll.classList[this.layoutMode === 'scroll' ? 'add' : 'remove']('active');
        }

        if (this.layoutMode === 'scroll') {
            el.btnPageMode.classList.remove('active', 'auto-downgraded');
            if (el.textPageMode) el.textPageMode.textContent = '滚动';
            el.btnPageMode.title = '切换为单页模式 (快捷键: D)';
            if (el.iconPageMode) el.iconPageMode.className = 'ri-scroll-to-bottom-line';
        } else if (this.layoutMode === 'double') {
            el.btnPageMode.classList.add('active');
            if (this.isAutoDowngraded) {
                el.btnPageMode.classList.add('auto-downgraded');
                if (el.textPageMode) el.textPageMode.textContent = '双页(自适应)';
                el.btnPageMode.title = '当前窗口放不下双页及双侧笔记，扩大窗口后将自动恢复';
            } else {
                el.btnPageMode.classList.remove('auto-downgraded');
                if (el.textPageMode) el.textPageMode.textContent = '双页';
                el.btnPageMode.title = '切换为单页模式 (快捷键: D)';
            }
            if (el.iconPageMode) el.iconPageMode.className = 'ri-book-open-line';
        } else {
            el.btnPageMode.classList.remove('active', 'auto-downgraded');
            if (el.textPageMode) el.textPageMode.textContent = '单页';
            el.btnPageMode.title = '切换为双页模式 (快捷键: D)';
            if (el.iconPageMode) el.iconPageMode.className = 'ri-book-read-line';
        }
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements) return;
        if (this._uiInitialized) return;
        this._uiInitialized = true;

        this.updateLayoutClasses(elements);

        if (elements.btnPageMode) {
            elements.btnPageMode.addEventListener('click', (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
                    ? elements.readerPanel.clientWidth
                    : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
                this.togglePageMode(availWidth);
                if (!this.callbacks || !this.callbacks.onLayoutChange) {
                    this.updateLayoutClasses(elements);
                }
            });
        }

        if (elements.btnModeScroll) {
            elements.btnModeScroll.addEventListener('click', (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
                    ? elements.readerPanel.clientWidth
                    : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
                const next = this.layoutMode === 'scroll' ? 'single' : 'scroll';
                this.setPageMode(next, availWidth);
                if (!this.callbacks || !this.callbacks.onLayoutChange) {
                    this.updateLayoutClasses(elements);
                }
            });
        }
    }
}
