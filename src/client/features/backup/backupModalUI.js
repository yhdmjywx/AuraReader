/* ==========================================================================
   BackupModalUI - Backup Dialog & Multi-Book Export Presentation (Feature Layer)
   Handles backup modal checkbox list rendering, all-select toggling, and dialog visibility.
   ========================================================================== */

export function renderBackupBookList(elements, books = [], allNotes = []) {
    if (!elements || !elements.backupBookCheckboxList) return;

    elements.backupBookCheckboxList.innerHTML = '';

    books.forEach((book, idx) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.04);';

        const bookId = book.id || String(idx);
        const noteCount = allNotes.filter(n => n.bookId === bookId || (n.chapter && n.chapter.includes(book.title))).length;

        item.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; font-weight: 500; font-size: 0.88rem;">
                <input type="checkbox" class="chk-backup-book" data-id="${bookId}" checked>
                <span>${escapeHtml(book.title)}</span>
            </label>
            <small style="color: var(--text-sub); font-size: 0.78rem;">${book.format || 'EPUB'} · ${book.pages ? book.pages.length : 1} 章节 · ${noteCount} 条划线</small>
        `;
        elements.backupBookCheckboxList.appendChild(item);
    });
}

export function openBackupModal(elements) {
    if (elements && elements.backupSelectModal) {
        elements.backupSelectModal.classList.add('active');
    }
}

export function closeBackupModal(elements) {
    if (elements && elements.backupSelectModal) {
        elements.backupSelectModal.classList.remove('active');
    }
}

export function toggleAllCheckboxes(elements, checked) {
    if (!elements || !elements.backupBookCheckboxList) return;
    elements.backupBookCheckboxList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.checked = checked;
    });
}

export function getSelectedBookIds(elements) {
    if (!elements || !elements.backupBookCheckboxList) return [];
    const selected = elements.backupBookCheckboxList.querySelectorAll('.chk-backup-book:checked');
    return Array.from(selected).map(chk => chk.getAttribute('data-id'));
}

export function getIncludeOptions(elements) {
    const includeNotes = elements && elements.chkBackupIncludeNotes ? elements.chkBackupIncludeNotes.checked : true;
    return { includeNotes };
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
