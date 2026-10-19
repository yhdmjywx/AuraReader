/* Library popover presentation. Book operations remain controller callbacks. */
export function renderShelf({ elements, books = [], onOpenBook = null, onDeleteBook = null }) {
    if (!elements?.shelfList) return;
    if (elements.shelfBookCount) {
        elements.shelfBookCount.textContent = books.length;
        elements.shelfBookCount.hidden = !books.length;
    }
    const list = elements.shelfList;
    list.replaceChildren();
    if (!books.length) {
        const empty = document.createElement('li');
        empty.className = 'shelf-empty';
        empty.innerHTML = '<p>本地书库暂无图书</p><span>使用上方「导入书籍」添加 EPUB、PDF 或 TXT。</span>';
        list.appendChild(empty);
        return;
    }
    books.forEach(book => {
        const row = document.createElement('li');
        row.className = 'shelf-entry';
        row.innerHTML = `
            <button class="shelf-book-open" type="button">
                <span class="shelf-book-title"></span>
                <span class="shelf-book-meta"></span>
            </button>
            <button class="btn btn-icon-sm shelf-book-delete" type="button" title="从书库移除">
                <i class="ri-delete-bin-line" aria-hidden="true"></i>
            </button>`;
        const title = String(book.title || '未命名书籍');
        const open = row.querySelector('.shelf-book-open');
        open.title = title;
        open.setAttribute('aria-label', '打开阅读：《' + title + '》');
        row.querySelector('.shelf-book-title').textContent = title;
        row.querySelector('.shelf-book-meta').textContent = `${book.format || 'EPUB'} · ${book.pages ? book.pages.length : (book.toc ? book.toc.length : 1)} 章节`;
        open.addEventListener('click', () => {
            closeShelf(elements);
            onOpenBook?.(book.id);
        });
        const remove = row.querySelector('.shelf-book-delete');
        remove.setAttribute('aria-label', '从书库移除《' + title + '》');
        remove.addEventListener('click', () => onDeleteBook?.(book));
        list.appendChild(row);
    });
}

export function openShelf(elements) {
    if (!elements?.shelfPanel) return;
    elements.shelfPanel.classList.add('open');
    elements.shelfPanel.setAttribute('aria-hidden', 'false');
    elements.btnShelf?.setAttribute('aria-expanded', 'true');
}

export function closeShelf(elements) {
    if (!elements?.shelfPanel) return;
    elements.shelfPanel.classList.remove('open');
    elements.shelfPanel.setAttribute('aria-hidden', 'true');
    elements.btnShelf?.setAttribute('aria-expanded', 'false');
}
