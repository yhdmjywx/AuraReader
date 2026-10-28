import { goalGraphsForBooks } from '../../infrastructure/goalLibraryRepository.js';
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
import { chooseDesktopFile } from '../../infrastructure/desktopFiles.js';
import { ChapterExportMenu } from './chapterExportMenu.js';

import {
    exportMarkdown as adapterExportMarkdown,
    exportChapters as adapterExportChapters,
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

        await this.callbacks.beforeExport?.();
        const selectedBooks = this.availableBackupBooks.filter((b, idx) => selectedIds.includes(b.id || String(idx)));
        const { includeNotes } = getIncludeOptions(this.elements);

        let notesToExport = [];
        if (includeNotes) {
            notesToExport = await repoGetNotesForBooks(selectedIds);
        }

        const goalGraphs = await goalGraphsForBooks(selectedBooks.map(book => book.id));
        const results = await adapterExportSelectiveBackup({
            selectedBooks,
            notes: notesToExport,
            goalGraphs, includeNotes
        });

        this.closeBackupSelectModal();
        if (this.callbacks.showToast) {
            if (window.auraDesktop) {
                const saved = results.filter(result => result.status === 'saved').length;
                const failed = results.find(result => result.status === 'failed');
                this.callbacks.showToast(`已保存 ${saved}/${selectedBooks.length} 份书籍备份` +
                    (failed ? `；保存失败：${failed.message}` : saved < selectedBooks.length ? '；其余未保存，已取消后续操作' : ''));
            } else this.callbacks.showToast(`已为 ${selectedBooks.length} 本图书分别发起备份下载，包含 ${notesToExport.length} 条高亮与笔记`);
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

            await restoreRecords(booksToRestore, notesToRestore, undefined, data.goalGraph ? undefined : data.goalStates, data.goalGraph);

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

    async exportMarkdown(bookTitle, notes) {
        try { this.exportFeedback(await adapterExportMarkdown(bookTitle, notes), 'Markdown 文件'); }
        catch (error) { this.callbacks.showToast?.('导出 Markdown 失败: ' + error.message); }
    }

    exportFeedback(result, label) {
        this.callbacks.showToast?.(result?.status === 'canceled' ? '已取消保存' :
            result?.status === 'saved' ? `已保存${label}` : `已发起${label}下载`);
    }

    async exportChapters(book, notes, options) {
        try {
            const result = await adapterExportChapters(book, notes, options);
            this.exportFeedback(result, result.kind === 'folder' ? `章节文件夹「${result.name}」` : '章节 Markdown 文件');
            return result;
        } catch (error) { this.callbacks.showToast?.('章节导出失败: ' + error.message); }
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

        if (elements.chapterExportEntry) {
            this.chapterExportMenu = new ChapterExportMenu(elements, {
                ...this.callbacks,
                onExport: (book, notes, options) => this.exportChapters(book, notes, options)
            });
        }

        if (elements.btnExportFullBackup) {
            elements.btnExportFullBackup.addEventListener('click', () => {
                this.openBackupSelectModal();
            });
        }

        if (elements.btnImportFullBackup) {
            elements.btnImportFullBackup.addEventListener('click', async () => {
                if (window.auraDesktop) {
                    try { const file = await chooseDesktopFile('backup'); if (file) await this.importFullBackup(file); }
                    catch (error) { this.callbacks.showToast?.('备份文件读取失败: ' + error.message); }
                    return;
                }
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
