/* ==========================================================================
   ShelfController - Library Popover Feature Controller
   Coordinates BookRepository and ShelfUI presentation.
   ========================================================================== */

import {
    getAllBooksFromDB,
    deleteBookFromDB
} from '../../infrastructure/bookRepository.js';

import {
    renderShelf as domRenderShelf,
    openShelf as domOpenShelf,
    closeShelf as domCloseShelf
} from './shelfUI.js';

export class ShelfController {
    constructor({
        callbacks = {}
    } = {}) {
        this.callbacks = callbacks; // onOpenBook, onDeleteBook, showToast
        this.elements = null;
        this.books = [];
    }

    async refreshShelf() {
        this.books = await getAllBooksFromDB();
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
                    if (confirm(`确定要从本地书库移除《${book.title}》及其划线笔记吗？`)) {
                        if (this.callbacks.onDeleteBook) await this.callbacks.onDeleteBook(book.id);
                        else await deleteBookFromDB(book.id);
                        await this.refreshShelf();
                        if (this.callbacks.showToast) {
                            this.callbacks.showToast(`已从书库移除：《${book.title}》`);
                        }
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
            this.refreshShelf().catch(error => this.callbacks.showToast?.(error.message || '书库读取失败'));
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
            if (event.key !== 'Escape' || !elements.shelfPanel?.classList.contains('open')) return;
            event.preventDefault();
            this.closeShelf();
            elements.btnShelf?.focus();
        });
        elements.btnImportBook?.addEventListener('click', () => elements.fileInput?.click());
        elements.fileInput?.addEventListener('change', () => {
            if (elements.fileInput.files?.length) this.closeShelf();
        });
        elements.btnSwitchDemo?.addEventListener('click', () => this.closeShelf());
    }
}
