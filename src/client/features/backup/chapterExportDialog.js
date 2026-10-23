import { buildBookStructure } from '../../infrastructure/bookStructure.js';

export class ChapterExportDialog {
    constructor(elements, { getCurrentBook, getCurrentNotes, showToast, onExport }) {
        this.elements = elements;
        this.callbacks = { getCurrentBook, getCurrentNotes, showToast, onExport };
        this.book = null;
        this.busy = false;
        elements.btnExportSelectedChapters?.addEventListener('click', () => this.open());
        elements.btnCloseChapterExport?.addEventListener('click', () => this.close());
        elements.btnCancelChapterExport?.addEventListener('click', () => this.close());
        elements.btnSelectAllChapters?.addEventListener('click', () => this.selectAll(true));
        elements.btnDeselectAllChapters?.addEventListener('click', () => this.selectAll(false));
        elements.chapterExportList?.addEventListener('change', () => this.update());
        elements.btnConfirmChapterExport?.addEventListener('click', () => this.confirm());
        elements.chapterExportModal?.addEventListener('click', event => {
            if (event.target === elements.chapterExportModal) this.close();
        });
        elements.chapterExportModal?.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            }
            if (event.key === 'Tab') {
                const focusable = [...elements.chapterExportModal.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
                const first = focusable[0], last = focusable.at(-1);
                if (!focusable.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
                else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        });
    }

    open() {
        if (this.busy) return;
        const book = this.callbacks.getCurrentBook?.();
        const structure = buildBookStructure(book);
        if (!structure.units.length) {
            this.callbacks.showToast?.('当前图书无可导出内容');
            return;
        }
        this.book = book;
        this.notes = [...(this.callbacks.getCurrentNotes?.() || [])];
        const { elements } = this;
        elements.chapterExportBookTitle.textContent = book.title || '图书';
        elements.chapterExportList.replaceChildren();
        structure.units.forEach((unit, index) => {
            const label = document.createElement('label');
            label.className = 'chapter-export-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = unit.id;
            checkbox.checked = true;
            const text = document.createElement('span');
            text.textContent = `${index + 1}. ${unit.title}`;
            const node = structure.nodes.find(node => node.page === unit.page);
            const ancestors = [];
            for (let parent = node?.parent; parent; parent = parent.parent) ancestors.unshift(parent.title);
            const sharedTitles = structure.nodes.filter(node => node.page === unit.page).map(node => node.title);
            if (ancestors.length || sharedTitles.length > 1) {
                const context = document.createElement('small');
                context.textContent = [ancestors.join(' / '), sharedTitles.length > 1 ? `同篇内容一并导出：${sharedTitles.join('、')}` : ''].filter(Boolean).join(' · ');
                text.appendChild(context);
            }
            label.append(checkbox, text);
            elements.chapterExportList.appendChild(label);
        });
        elements.chapterExportList.scrollTop = 0;
        this.update();
        elements.chapterExportModal.classList.add('active');
        elements.btnCloseChapterExport.focus();
    }

    close() {
        if (this.busy) return;
        this.elements.chapterExportModal.classList.remove('active');
        this.book = null;
        this.notes = [];
        this.elements.btnExportMenu?.focus();
    }

    selectedIds() {
        return [...this.elements.chapterExportList.querySelectorAll('input:checked')].map(input => input.value);
    }

    selectAll(checked) {
        if (this.busy) return;
        this.elements.chapterExportList.querySelectorAll('input').forEach(input => { input.checked = checked; });
        this.update();
    }

    update() {
        const { elements, busy } = this;
        const count = this.selectedIds().length;
        const total = elements.chapterExportList.querySelectorAll('input').length;
        elements.chapterExportCount.textContent = `已选 ${count} / ${total} 项`;
        elements.btnConfirmChapterExport.disabled = busy || !count;
        elements.btnConfirmChapterExport.textContent = busy ? '正在导出…' : `导出所选章节 (.zip)`;
        for (const button of [elements.btnCloseChapterExport, elements.btnCancelChapterExport, elements.btnSelectAllChapters, elements.btnDeselectAllChapters]) {
            button.disabled = busy;
        }
        elements.chapterExportList.querySelectorAll('input').forEach(input => { input.disabled = busy; });
        elements.chapterExportModal.setAttribute('aria-busy', String(busy));
    }

    async confirm() {
        const selectedUnitIds = this.selectedIds();
        if (!this.book || this.busy || !selectedUnitIds.length) return;
        this.busy = true;
        this.update();
        this.elements.chapterExportModal.querySelector('[role="dialog"]').focus();
        try {
            const result = await this.callbacks.onExport(this.book, this.notes, { selectedUnitIds });
            if (result && result.status !== 'canceled') {
                this.busy = false;
                this.close();
            }
        } finally {
            this.busy = false;
            this.update();
            if (this.elements.chapterExportModal.classList.contains('active')) this.elements.btnConfirmChapterExport.focus();
        }
    }
}
