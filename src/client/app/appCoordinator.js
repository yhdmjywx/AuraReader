/* ==========================================================================
   AppCoordinator - Cross-Module Task Coordinator
   Coordinates cross-feature tasks across Reader, Annotations, Shelf,
   Layout, Selection, and Backup without embedding HTML/DB implementation details.
   ========================================================================== */

import {
    loadBookFromDB,
    saveBookToDB,
    deleteBookFromDB,
    demoBooks
} from '../infrastructure/bookRepository.js';

import { parseEpub, parseTxt } from '../infrastructure/epubParser.js';
import { loadNotesForBook } from '../infrastructure/annotationRepository.js';
import { isNote } from '../domain/annotationEngine.js';

export class AppCoordinator {
    constructor({
        session,
        readerController,
        annotationController,
        shelfController,
        layoutController,
        selectionController,
        backupController,
        appShell
    } = {}) {
        this.session = session;
        this.reader = readerController;
        this.annotations = annotationController;
        this.shelf = shelfController;
        this.layout = layoutController;
        this.selection = selectionController;
        this.backup = backupController;
        this.shell = appShell;
        this.openBookRequestId = 0;
    }

    async openBook(bookId) {
        if (!bookId) return;
        const requestId = ++this.openBookRequestId;
        this.shell?.setBookLoading?.(true);

        try {
            // Finish the old book's editor before reading, while it still owns
            // the session. Reads below must not replace any current UI state.
            await this.annotations.finishInlineEdit();
            if (requestId !== this.openBookRequestId) return;

            let book = await loadBookFromDB(bookId);
            if (requestId !== this.openBookRequestId) return;
            if (!book && demoBooks[bookId]) {
                book = { id: bookId, ...demoBooks[bookId] };
                await saveBookToDB(book);
                if (requestId !== this.openBookRequestId) return;
            }
            if (!book) {
                this.shell?.showToast('未能载入图书，请重新导入');
                return;
            }

            const notes = await loadNotesForBook(bookId);
            if (requestId !== this.openBookRequestId) return;

            // No await between installing the complete data and rendering it.
            // Session subscribers see the matching reader and annotations.
            this.annotations.setNotesForBook(notes);
            this.reader.setBook(bookId, book);
            this.session.setCurrentBookId(bookId);
            this.reader.renderPage(1, false, this.annotations.getNotes());
            this.annotations.refreshVisibleNotes();

            if (this.shelf) await this.shelf.refreshShelf();
            if (requestId === this.openBookRequestId) {
                this.shell?.showToast(`已成功加载图书：《${book.title}》`);
            }
        } catch (error) {
            // A superseded request may fail after the latest book has opened.
            if (requestId === this.openBookRequestId) {
                console.error('图书载入失败:', error);
                this.shell?.showToast(error.message || '图书载入失败，请重试');
            }
        } finally {
            if (requestId === this.openBookRequestId) this.shell?.setBookLoading?.(false);
        }
    }

    async importBook(file) {
        if (!file) return;

        if (this.shell) {
            this.shell.showToast(`正在导入图书: ${file.name}...`);
        }

        try {
            const ext = file.name.split('.').pop().toLowerCase();
            let bookObj = null;

            if (ext === 'epub' || ext === 'equb' || ext === 'zip') {
                const arrayBuffer = await file.arrayBuffer();
                bookObj = await parseEpub(arrayBuffer, file.name, window.JSZip);
            } else {
                const text = await file.text();
                if (text.startsWith('PK')) {
                    const arrayBuffer = await file.arrayBuffer();
                    bookObj = await parseEpub(arrayBuffer, file.name, window.JSZip);
                } else {
                    bookObj = parseTxt(text, file.name);
                }
            }

            if (!bookObj) throw new Error("无法解析该文件格式");

            await saveBookToDB(bookObj);
            await this.openBook(bookObj.id);

            if (this.shell) {
                this.shell.showToast(`成功解析并入库《${bookObj.title}》！`);
            }
        } catch (err) {
            console.error("书籍导入失败:", err);
            if (this.shell) {
                this.shell.showToast(`图书导入失败: ${err.message}`);
            }
        }
    }

    async addAnnotation(data) {
        if (!data) return;

        const page = data.page || this.reader.getCurrentPage();
        const chapter = data.chapter || (this.reader.getLocation() ? this.reader.getLocation().chapter : '章节选区');

        if (data.type === 'note') {
            this.annotations.createNote({
                quote: data.quote,
                page,
                chapter,
                location: data.location || null
            });
        } else if (data.type === 'highlight' || (data.quote && !data.comment)) {
            await this.annotations.createHighlight({
                quote: data.quote,
                page,
                chapter,
                color: data.color || 'yellow',
                location: data.location || null
            });
        } else {
            await this.annotations.saveModalNote({
                quote: data.quote,
                comment: data.comment,
                page,
                chapter,
                location: data.location || null
            });
        }

        // Reader updates highlights on paper (only if onNotesChanged callback is not already handling it)
        const hasOnNotesChanged = this.annotations && this.annotations.callbacks && typeof this.annotations.callbacks.onNotesChanged === 'function';
        if (!hasOnNotesChanged && this.reader) {
            this.reader.renderPage(this.reader.getCurrentPage(), true, this.annotations ? this.annotations.getNotes() : []);
        }
    }

    jumpToAnnotation(annotationId, options = {}) {
        if (!this.annotations) return;
        const notes = this.annotations.getNotes();
        const note = notes.find(n => n.id === annotationId);
        if (!note) return;

        const quote = (note.quote || '').trim();
        if (!quote) {
            if (isNote(note)) this.annotations.focusNotes([note.id]);
            else this.annotations.focusHighlights([note.id]);
            if (this.shell) this.shell.showToast('已定位到这条笔记');
            return;
        }

        const showMenu = !!options.showMenu;
        if (this.reader && this.reader.isChapterFlow && this.reader.isChapterFlow()) {
            this.reader.showQuote(note.page, quote, notes);
            if (this.selection && typeof this.selection.activateAnnotationId === 'function') {
                setTimeout(() => this.selection.activateAnnotationId(note.id, { notify: false, showMenu }), 30);
            }
            if (this.shell) this.shell.showToast(`跳转至第 ${note.page} 章原文所在位置`);
            return;
        }

        const isDouble = this.layout ? this.layout.isDoublePageEffective() : false;
        let needsRender = false;

        if (this.reader) {
            if (isDouble) {
                const currentLeft = this.reader.getCurrentLeftPage() || 1;
                const currentRight = this.reader.getCurrentRightPage() || 2;
                if (note.page !== currentLeft && note.page !== currentRight) {
                    needsRender = true;
                }
            } else {
                if (this.reader.getCurrentPage() !== note.page) {
                    needsRender = true;
                }
            }

            if (needsRender) {
                this.reader.renderPage(note.page, false, notes);
            }

            const scroll = this.reader.scrollToAnnotation || this.reader.scrollToHighlight;
            if (typeof scroll === 'function') {
                setTimeout(() => {
                    scroll.call(this.reader, note.id);
                    if (this.selection && typeof this.selection.activateAnnotationId === 'function') {
                        this.selection.activateAnnotationId(note.id, { notify: false, showMenu });
                    }
                }, needsRender ? 120 : 30);
            }
        }

        if (this.shell) {
            this.shell.showToast(`跳转至 P.${note.page} 原文所在位置`);
        }
    }

    async deleteBook(bookId) {
        if (!bookId) return;
        if (this.session.getCurrentBookId() === bookId) await this.annotations.finishInlineEdit?.();
        await deleteBookFromDB(bookId);
        if (this.shelf) {
            await this.shelf.refreshShelf();
        }

        if (this.session.getCurrentBookId() === bookId) {
            await this.openBook('crisis-era');
        }
    }

    async restoreBackup(file) {
        if (!file || !this.backup) return;
        await this.backup.importFullBackup(file);
    }

    changeReadingLayout(mode) {
        if (!this.layout) return;
        const width = (typeof document !== 'undefined' && document.getElementById('reader-panel'))
            ? document.getElementById('reader-panel').clientWidth
            : ((typeof window !== 'undefined') ? window.innerWidth : 1200);
        const res = this.layout.setPageMode(mode, width);

        if (this.shell) {
            if (mode === 'double' && res.isAutoDowngraded) {
                this.shell.showToast('已开启双页模式（当前可用宽度受限，临时以单页呈现）');
            } else {
                this.shell.showToast(mode === 'double' ? '已开启双页展开模式' : '已切换为单页阅读模式');
            }
        }

        this.reader.renderPage(this.reader.getCurrentPage(), true, this.annotations.getNotes());
    }
}
