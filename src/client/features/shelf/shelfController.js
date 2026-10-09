/* ==========================================================================
   ShelfController - Book Shelf Drawer Feature Controller
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
                    if (confirm(`确定要从本地 IndexedDB 书库移除《${book.title}》及其划线笔记吗？`)) {
                        await deleteBookFromDB(book.id);
                        await this.refreshShelf();
                        if (this.callbacks.showToast) {
                            this.callbacks.showToast(`已从书库移除：《${book.title}》`);
                        }
                        if (this.callbacks.onDeleteBook) {
                            await this.callbacks.onDeleteBook(book.id);
                        }
                    }
                }
            });
        }
        return this.books;
    }

    openShelf() {
        if (this.elements) {
            this.refreshShelf();
            domOpenShelf(this.elements);
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
                this.openShelf();
            });
        }

        if (elements.btnCloseShelf) {
            elements.btnCloseShelf.addEventListener('click', () => {
                this.closeShelf();
            });
        }

        if (elements.shelfOverlay) {
            elements.shelfOverlay.addEventListener('click', (e) => {
                if (e.target === elements.shelfOverlay) {
                    this.closeShelf();
                }
            });
        }
    }
}
