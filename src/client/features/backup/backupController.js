/* ==========================================================================
   BackupController - Exporters & Backup Feature Controller
   Authority owner of: availableBackupBooks, backup checkbox selection.
   Coordinates Exporters adapter, BackupModalUI, and cross-module backup restoration.
   ========================================================================== */

import {
    getAllBooksFromDB,
    demoBooks
} from '../../infrastructure/bookRepository.js';

import {
    getNotesForBooks as repoGetNotesForBooks
} from '../../infrastructure/annotationRepository.js';

import { normalizeAnnotation } from '../../domain/annotationEngine.js';
import { restoreRecords } from '../../infrastructure/storageClient.js';

import {
    exportMarkdown as adapterExportMarkdown,
    exportChapterZip as adapterExportChapterZip,
    exportStandaloneHtml as adapterExportStandaloneHtml,
    exportSelectiveBackup as adapterExportSelectiveBackup,
    parseBackupFile
} from '../../infrastructure/exporters.js';

import {
    renderBackupBookList,
    openBackupModal as domOpenBackupModal,
    closeBackupModal as domCloseBackupModal,
    toggleAllCheckboxes as domToggleAllCheckboxes,
    getSelectedBookIds,
    getIncludeOptions
} from './backupModalUI.js';

export class BackupController {
    /** @param {{callbacks?: import('../../app/contracts.js').BackupCallbacks}} options */
    constructor({
        callbacks = {}
    } = {}) {
        this.callbacks = callbacks; // getCurrentBook, getCurrentNotes, onRestoreBackup, showToast
        this.availableBackupBooks = [];
        this.elements = null;
    }

    async openBackupSelectModal() {
        const booksFromDB = await getAllBooksFromDB();
        const map = new Map();
        if (booksFromDB && booksFromDB.length > 0) {
            booksFromDB.forEach(b => map.set(b.id || b.title, b));
        }
        Object.keys(demoBooks).forEach(key => {
            const b = demoBooks[key];
            if (b && !map.has(b.id || key)) {
                map.set(b.id || key, Object.assign({ id: key }, b));
            }
        });

        this.availableBackupBooks = Array.from(map.values());

        if (this.availableBackupBooks.length === 0) {
            if (this.callbacks.showToast) this.callbacks.showToast('本地暂无可用于备份的图书');
            return;
        }

        const allBookIds = this.availableBackupBooks.map(b => b.id || b.title);
        const allNotes = await repoGetNotesForBooks(allBookIds);

        if (this.elements) {
            renderBackupBookList(this.elements, this.availableBackupBooks, allNotes);
            domOpenBackupModal(this.elements);
        }
    }

    closeBackupSelectModal() {
        if (this.elements) {
            domCloseBackupModal(this.elements);
        }
    }

    toggleAllBackupCheckboxes(checked) {
        if (this.elements) {
            domToggleAllCheckboxes(this.elements, checked);
        }
    }

    async executeSelectiveBackupExport() {
        if (!this.elements) return;
        const selectedIds = getSelectedBookIds(this.elements);
        if (selectedIds.length === 0) {
            if (this.callbacks.showToast) this.callbacks.showToast('请至少勾选一本要备份的图书');
            return;
        }

        const selectedBooks = this.availableBackupBooks.filter((b, idx) => selectedIds.includes(b.id || String(idx)));
        const { includeNotes } = getIncludeOptions(this.elements);

        let notesToExport = [];
        if (includeNotes) {
            notesToExport = await repoGetNotesForBooks(selectedIds);
        }

        adapterExportSelectiveBackup({
            selectedBooks,
            notes: notesToExport
        });

        this.closeBackupSelectModal();
        if (this.callbacks.showToast) {
            this.callbacks.showToast(`已为 ${selectedBooks.length} 本图书分别发起备份下载，包含 ${notesToExport.length} 条高亮与笔记`);
        }
    }

    async importFullBackup(file) {
        if (!file) return;

        try {
            await this.callbacks.beforeRestore?.();
            const data = await parseBackupFile(file);
            let importedBooksCount = 0;
            let importedNotesCount = 0;

            const booksToRestore = [];
            const notesToRestore = [];
            // Validate/prepare everything before a single atomic restore.
            if (Array.isArray(data.books) && data.books.length > 0) {
                for (const b of data.books) {
                    if (b && (b.id || b.title)) {
                        const bId = b.id || ('custom_' + Date.now());
                        b.id = bId;
                        booksToRestore.push(b);
                        importedBooksCount++;
                    }
                }
            }

            // 2. Restore all annotations with isolation
            const defaultBookId = (data.books && data.books[0]) ? data.books[0].id : 'crisis-era';
            if (Array.isArray(data.notes) && data.notes.length > 0) {
                for (const n of data.notes) {
                    if (n && n.id) {
                        const normalized = normalizeAnnotation({
                            ...n,
                            bookId: n.bookId || defaultBookId
                        });
                        if (!normalized) continue;
                        notesToRestore.push(normalized);
                        importedNotesCount++;
                    }
                }
            }

            await restoreRecords(booksToRestore, notesToRestore);

            if (this.callbacks.onRestoreBackup) {
                await this.callbacks.onRestoreBackup({
                    data,
                    importedBooksCount,
                    importedNotesCount
                });
            }
        } catch (err) {
            console.error("备份解析失败:", err);
            if (this.callbacks.showToast) {
                this.callbacks.showToast("备份恢复失败: " + err.message);
            }
        }
    }

    exportMarkdown(bookTitle, notes) {
        adapterExportMarkdown(bookTitle, notes);
        if (this.callbacks.showToast) this.callbacks.showToast('已导出高亮与随笔 Markdown 文件');
    }

    async exportChapterZip(book, notes) {
        try {
            if (this.callbacks.showToast) this.callbacks.showToast('正在生成分章节 Zip 压缩包...');
            await adapterExportChapterZip(book, notes, window.JSZip);
            if (this.callbacks.showToast) this.callbacks.showToast('已成功导出分章节 Zip 压缩包！');
        } catch (err) {
            if (this.callbacks.showToast) this.callbacks.showToast('导出 Zip 失败: ' + err.message);
        }
    }

    exportStandaloneHtml(book, notes) {
        try {
            adapterExportStandaloneHtml(book, notes);
            if (this.callbacks.showToast) this.callbacks.showToast('已成功导出双栏带标注独立 HTML 电子书！');
        } catch (err) {
            if (this.callbacks.showToast) this.callbacks.showToast('导出 HTML 失败: ' + err.message);
        }
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements) return;

        if (elements.btnExportMarkdown) {
            elements.btnExportMarkdown.addEventListener('click', () => {
                const book = this.callbacks.getCurrentBook ? this.callbacks.getCurrentBook() : { title: '图书' };
                const notes = this.callbacks.getCurrentNotes ? this.callbacks.getCurrentNotes() : [];
                this.exportMarkdown(book ? book.title : '图书', notes);
            });
        }

        if (elements.btnExportChapterZip) {
            elements.btnExportChapterZip.addEventListener('click', async () => {
                const book = this.callbacks.getCurrentBook ? this.callbacks.getCurrentBook() : null;
                const notes = this.callbacks.getCurrentNotes ? this.callbacks.getCurrentNotes() : [];
                await this.exportChapterZip(book, notes);
            });
        }

        if (elements.btnExportStandaloneHtml) {
            elements.btnExportStandaloneHtml.addEventListener('click', () => {
                const book = this.callbacks.getCurrentBook ? this.callbacks.getCurrentBook() : null;
                const notes = this.callbacks.getCurrentNotes ? this.callbacks.getCurrentNotes() : [];
                this.exportStandaloneHtml(book, notes);
            });
        }

        if (elements.btnExportFullBackup) {
            elements.btnExportFullBackup.addEventListener('click', () => {
                this.openBackupSelectModal();
            });
        }

        if (elements.btnImportFullBackup) {
            elements.btnImportFullBackup.addEventListener('click', () => {
                if (elements.backupFileInput) elements.backupFileInput.click();
            });
        }

        if (elements.backupFileInput) {
            elements.backupFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.importFullBackup(file);
                e.target.value = '';
            });
        }

        if (elements.btnCloseBackupModal) {
            elements.btnCloseBackupModal.addEventListener('click', () => this.closeBackupSelectModal());
        }
        if (elements.btnCancelBackupModal) {
            elements.btnCancelBackupModal.addEventListener('click', () => this.closeBackupSelectModal());
        }
        if (elements.backupSelectModal) {
            elements.backupSelectModal.addEventListener('click', (e) => {
                if (e.target === elements.backupSelectModal) {
                    this.closeBackupSelectModal();
                }
            });
        }
        if (elements.btnSelectAllBackup) {
            elements.btnSelectAllBackup.addEventListener('click', () => this.toggleAllBackupCheckboxes(true));
        }
        if (elements.btnDeselectAllBackup) {
            elements.btnDeselectAllBackup.addEventListener('click', () => this.toggleAllBackupCheckboxes(false));
        }
        if (elements.btnConfirmExportBackup) {
            elements.btnConfirmExportBackup.addEventListener('click', () => this.executeSelectiveBackupExport());
        }
    }
}
