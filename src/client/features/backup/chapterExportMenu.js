import { buildBookStructure } from '../../infrastructure/bookStructure.js';

export class ChapterExportMenu {
    constructor(elements, callbacks) {
        this.elements = elements;
        this.callbacks = callbacks;
        this.busy = false;
        this.selectionBook = null;
        this.motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        this.motion?.addEventListener('change', () => {
            if (this.motion.matches) elements.chapterExportEntry.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
        });
        elements.btnExportChapters.addEventListener('click', () => {
            const book = callbacks.getCurrentBook?.();
            if (!book?.pages?.length) { callbacks.showToast?.('当前图书无可导出内容'); return; }
            this.expand(true);
            elements.btnExportCurrentChapter.focus({ preventScroll: true });
        });
        elements.btnCollapseChapterExport.addEventListener('click', () => { this.expand(false); elements.btnExportChapters.focus({ preventScroll: true }); });
        elements.btnSelectChapters.addEventListener('click', () => this.custom(elements.chapterExportCustom.hidden));
        elements.btnCancelChapterExport.addEventListener('click', () => { this.custom(false); elements.btnSelectChapters.focus({ preventScroll: true }); });
        elements.btnExportCurrentChapter.addEventListener('click', () => this.run('current'));
        elements.btnExportAllChapters.addEventListener('click', () => this.run('all'));
        elements.btnConfirmChapterExport.addEventListener('click', () => this.run('custom'));
        elements.chapterExportList.addEventListener('change', () => this.update());
        elements.exportPanel?.addEventListener('exportpanelclose', () => this.expand(false, false));
        elements.chapterExportEntry.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (!elements.chapterExportCustom.hidden) { this.custom(false); elements.btnSelectChapters.focus({ preventScroll: true }); }
            else if (!elements.chapterExportOptions.hidden) { this.expand(false); elements.btnExportChapters.focus({ preventScroll: true }); }
            else return;
            event.preventDefault(); event.stopPropagation();
        });
    }

    transition(change, entering, animate = true) {
        const entry = this.elements.chapterExportEntry;
        const before = entry.getBoundingClientRect().height;
        this.animation?.cancel();
        change();
        const after = entry.getBoundingClientRect().height;
        if (!animate || this.motion?.matches || !entry.animate) return;
        this.animation = entry.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
        entering?.animate?.([{ opacity: 0, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' });
    }

    expand(expanded, animate = true) {
        const e = this.elements;
        this.transition(() => {
            e.btnExportChapters.hidden = expanded;
            e.btnExportChapters.setAttribute('aria-expanded', String(expanded));
            e.chapterExportOptions.hidden = !expanded;
            e.chapterExportCustom.hidden = true;
            e.btnSelectChapters.setAttribute('aria-expanded', 'false');
        }, expanded ? e.chapterExportOptions : e.btnExportChapters, animate);
        if (!expanded) this.selectionBook = null;
    }

    custom(expanded) {
        if (this.busy) return;
        const e = this.elements;
        if (expanded) {
            const book = this.callbacks.getCurrentBook?.();
            if (book !== this.selectionBook) {
                const structure = buildBookStructure(book);
                if (!structure.units.length) { this.callbacks.showToast?.('当前图书无可导出内容'); return; }
                this.selectionBook = book;
                e.chapterExportList.replaceChildren();
                structure.units.forEach(unit => {
                    const label = document.createElement('label'); label.className = 'chapter-export-item';
                    const input = document.createElement('input'); input.type = 'checkbox'; input.value = unit.id;
                    const text = document.createElement('span'); text.textContent = unit.title;
                    label.append(input, text); e.chapterExportList.append(label);
                });
                e.chapterExportList.scrollTop = 0;
            }
        }
        this.transition(() => {
            e.chapterExportCustom.hidden = !expanded;
            e.btnSelectChapters.setAttribute('aria-expanded', String(expanded));
        }, expanded ? e.chapterExportCustom : null);
        this.update();
    }

    selectedIds() { return [...this.elements.chapterExportList.querySelectorAll('input:checked')].map(input => input.value); }

    update() {
        const e = this.elements;
        for (const button of [e.btnExportChapters, e.btnCollapseChapterExport, e.btnExportCurrentChapter, e.btnExportAllChapters, e.btnSelectChapters, e.btnCancelChapterExport]) button.disabled = this.busy;
        e.btnConfirmChapterExport.disabled = this.busy || !this.selectedIds().length;
        e.btnConfirmChapterExport.textContent = this.busy ? '正在导出…' : '导出';
        e.chapterExportList.querySelectorAll('input').forEach(input => { input.disabled = this.busy; });
        e.chapterExportEntry.setAttribute('aria-busy', String(this.busy));
    }

    async run(scope) {
        if (this.busy) return;
        const book = this.callbacks.getCurrentBook?.();
        const structure = buildBookStructure(book);
        let selectedUnitIds;
        if (scope === 'current') {
            const unit = structure.pageToUnit.get(this.callbacks.getCurrentPage?.() || 1);
            selectedUnitIds = unit ? [unit.id] : [];
        } else if (scope === 'all') selectedUnitIds = structure.units.map(unit => unit.id);
        else {
            if (book !== this.selectionBook) { this.custom(true); this.callbacks.showToast?.('当前书籍已切换，请重新选择章节'); return; }
            selectedUnitIds = this.selectedIds();
        }
        if (!selectedUnitIds.length) { this.callbacks.showToast?.('请至少选择一个要导出的章节'); return; }
        this.busy = true; this.update();
        let saved = false;
        try {
            const result = await this.callbacks.onExport(book, [...(this.callbacks.getCurrentNotes?.() || [])], { selectedUnitIds });
            saved = !!result && result.status !== 'canceled';
            if (saved) { this.callbacks.closeExportPanel?.(); this.elements.btnExportMenu?.focus({ preventScroll: true }); }
        } finally {
            this.busy = false; this.update();
            if (!saved && this.elements.exportPanel?.classList.contains('open')) {
                (scope === 'custom' ? this.elements.btnConfirmChapterExport : scope === 'all' ? this.elements.btnExportAllChapters : this.elements.btnExportCurrentChapter).focus({ preventScroll: true });
            }
        }
    }
}
