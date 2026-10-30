import { countLabel } from '../../domain/format.js';
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
            if (this.callbacks.showToast) this.callbacks.showToast("No local books to back up.");
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
            if (this.callbacks.showToast) this.callbacks.showToast("Select at least one book to back up.");
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
                this.callbacks.showToast(`Saved ${saved}/${selectedBooks.length} ${selectedBooks.length === 1 ? 'book backup' : 'book backups'}` +
                    (failed ? `; save failed: ${failed.message}` : saved < selectedBooks.length ? "; remaining backups were not saved because the operation was canceled" : ''));
            } else this.callbacks.showToast(`Requested backups for ${countLabel(selectedBooks.length, 'book')}, containing ${countLabel(notesToExport.length, 'annotation')}`);
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
            console.error("Backup parsing failed:", err);
            if (this.callbacks.showToast) {
                this.callbacks.showToast("Backup restore failed: " + err.message, { kind: 'error' });
            }
        }
    }

    async exportMarkdown(bookTitle, notes) {
        try { this.exportFeedback(await adapterExportMarkdown(bookTitle, notes), "Markdown file"); }
        catch (error) { this.callbacks.showToast?.("Markdown export failed: " + error.message, { kind: 'error' }); }
    }

    exportFeedback(result, label) {
        this.callbacks.showToast?.(result?.status === 'canceled' ? "Save canceled" :
            result?.status === 'saved' ? `Saved ${label}` : `Requested download: ${label}`);
    }

    async exportChapters(book, notes, options) {
        try {
            const result = await adapterExportChapters(book, notes, options);
            this.exportFeedback(result, result.kind === 'folder' ? `chapter folder “${result.name}”` : "chapter Markdown file");
            return result;
        } catch (error) { this.callbacks.showToast?.("Chapter export failed: " + error.message, { kind: 'error' }); }
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements) return;

        if (elements.btnExportMarkdown) {
            elements.btnExportMarkdown.addEventListener('click', () => {
                const book = this.callbacks.getCurrentBook ? this.callbacks.getCurrentBook() : { title: "Book" };
                const notes = this.callbacks.getCurrentNotes ? this.callbacks.getCurrentNotes() : [];
                this.exportMarkdown(book ? book.title : "Book", notes);
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
                    catch (error) { this.callbacks.showToast?.("Could not read backup file: " + error.message, { kind: 'error' }); }
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
