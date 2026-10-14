/* ==========================================================================
   ShelfUI - Book Shelf Drawer Presentation (Feature Layer)
   Pure UI presentation. Renders shelf book cards, displays count badge,
   and delegates book opening & deletion to coordinator callbacks.
   ========================================================================== */

export function renderShelf({
    elements,
    books = [],
    onOpenBook = null,
    onDeleteBook = null
}) {
    if (!elements || !elements.shelfGrid) return;

    if (elements.shelfBookCount) {
        elements.shelfBookCount.textContent = books.length;
        elements.shelfBookCount.hidden = !(books && books.length);
    }

    elements.shelfGrid.innerHTML = '';

    if (!books || books.length === 0) {
        elements.shelfGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px 0; color: var(--text-muted);">
                <i class="ri-book-shelf-line" style="font-size: 42px; color: var(--border-color);"></i>
                <p style="margin-top: 10px; font-weight: 500;">本地 IndexedDB 书库暂无离线图书</p>
                <small>使用上方「导入书籍」添加 EPUB、PDF 或 TXT，书籍会保存在这里</small>
            </div>
        `;
        return;
    }

    books.forEach(b => {
        const card = document.createElement('div');
        card.className = 'shelf-card';
        card.innerHTML = `
            <div class="shelf-card-title">
                <i class="ri-book-2-line" style="color: var(--primary);"></i>
                <span>${escapeHtml(b.title)}</span>
            </div>
            <div class="shelf-card-info">
                <span class="book-format-tag">${b.format || 'EPUB'}</span>
                <span>${b.pages ? b.pages.length : (b.toc ? b.toc.length : 1)} 章节</span>
            </div>
            <div class="shelf-card-footer">
                <button class="btn btn-outline-sm btn-open-shelf-book" data-id="${b.id}">
                    <i class="ri-book-open-line"></i> 打开阅读
                </button>
                <button class="btn btn-ghost-sm btn-del-shelf-book" data-id="${b.id}" title="从书库移除">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;

        const openBtn = card.querySelector('.btn-open-shelf-book');
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (elements.shelfOverlay) elements.shelfOverlay.classList.remove('active');
                if (typeof onOpenBook === 'function') onOpenBook(b.id);
            });
        }

        const delBtn = card.querySelector('.btn-del-shelf-book');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onDeleteBook === 'function') onDeleteBook(b);
            });
        }

        elements.shelfGrid.appendChild(card);
    });
}

export function openShelf(elements) {
    if (elements && elements.shelfOverlay) {
        elements.shelfOverlay.classList.add('active');
    }
}

export function closeShelf(elements) {
    if (elements && elements.shelfOverlay) {
        elements.shelfOverlay.classList.remove('active');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
