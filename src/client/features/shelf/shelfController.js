/* ==========================================================================
   ShelfController - Library Popover Feature Controller
   Coordinates BookRepository and ShelfUI presentation.
   ========================================================================== */

import {
    getBookSummariesFromDB,
    deleteBookFromDB
} from '../../infrastructure/bookRepository.js';

import {
    renderShelf as domRenderShelf,
    openShelf as domOpenShelf,
    closeShelf as domCloseShelf
} from './shelfUI.js';
import { chooseDesktopFile } from '../../infrastructure/desktopFiles.js';

export class ShelfController {
    /** @param {{callbacks?: import('../../app/contracts.js').ShelfCallbacks}} options */
    constructor({
        callbacks = {}
    } = {}) {
        this.callbacks = callbacks; // onOpenBook, onDeleteBook, showToast
        this.elements = null;
        this.books = [];
    }

    async refreshShelf() {
        this.books = await getBookSummariesFromDB();
        if (this.elements) {
            domRenderShelf({
                elements: this.elements,
                books: this.books,
                onOpenBook: async (bookId) => {
                    this.closeShelf();
                    if (this.callbacks.onOpenBook) {
                        await this.callbacks.onOpenBook(bookId);
                    }
                },
                onDeleteBook: async (book) => {
                        if (this.callbacks.onDeleteBook) await this.callbacks.onDeleteBook(book.id);
                        else await deleteBookFromDB(book.id);
                        await this.refreshShelf();
                        if (this.callbacks.showToast) {
                            this.callbacks.showToast(`Removed from library: “${book.title}”`);
                        }
                }
            });
        }
        return this.books;
    }

    openShelf() {
        if (this.elements) {
            this.callbacks.onOpen?.();
            domOpenShelf(this.elements);
            this.refreshShelf().catch(error => this.callbacks.showToast?.(error.message || "Could not load library", { kind: 'error' }));
        }
    }

    closeShelf() {
        if (this.elements) {
            domCloseShelf(this.elements);
        }
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements) return;

        if (elements.btnShelf) {
            elements.btnShelf.addEventListener('click', () => {
                if (elements.shelfPanel?.classList.contains('open')) this.closeShelf();
                else this.openShelf();
            });
        }

        if (elements.btnCloseShelf) {
            elements.btnCloseShelf.addEventListener('click', () => {
                this.closeShelf();
            });
        }

        document.addEventListener('click', event => {
            if (!elements.shelfPanel?.classList.contains('open')) return;
            const path = event.composedPath();
            if (!path.includes(elements.shelfPanel) && !path.includes(elements.btnShelf)) this.closeShelf();
        }, true);
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || !elements.shelfPanel?.classList.contains('open')) return;
            if (elements.shelfPanel.ownerDocument.querySelector('.ui-dialog[data-open]')) return;
            event.preventDefault();
            this.closeShelf();
            elements.btnShelf?.focus();
        });
        elements.btnImportBook?.addEventListener('click', async () => {
            if (!window.auraDesktop) { elements.fileInput?.click(); return; }
            try {
                const file = await chooseDesktopFile('book');
                if (file) { this.closeShelf(); await this.callbacks.onImportFile?.(file); }
            } catch (error) { this.callbacks.showToast?.("File import failed: " + error.message, { kind: 'error' }); }
        });
        elements.fileInput?.addEventListener('change', () => {
            if (elements.fileInput.files?.length) this.closeShelf();
        });
        elements.btnSwitchDemo?.addEventListener('click', () => this.closeShelf());
    }
}
