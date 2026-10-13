/* ==========================================================================
   NotesUI - Sidebar Notes & Annotations Presentation (Feature Layer)
   Pure UI presentation. Renders note cards, toggles pure-highlight visibility,
   handles modal inputs, and exposes interaction callbacks.
   Zero direct database persistence calls.
   ========================================================================== */

import { filterNotes, isHighlight, isNote } from '../../domain/annotationEngine.js';

export function renderNotesList({
    elements,
    notes = [],
    showHighlightsInSidebar = false,
    focusedNoteIds = [],
    focusedHighlightIds = [],
    onJump = null,
    onEdit = null,
    onDelete = null
}) {
    if (!elements || !elements.notesList) return;

    elements.notesList.innerHTML = '';

    const { displayedNotes, pureCount } = filterNotes(notes, showHighlightsInSidebar);

    // Update counts
    if (elements.countPureHighlights) {
        elements.countPureHighlights.textContent = pureCount;
    }
    if (elements.countHighlights) {
        elements.countHighlights.textContent = displayedNotes.length;
    }
    if (elements.notesTotalCount) {
        elements.notesTotalCount.textContent = displayedNotes.length;
    }

    // Update toggle button text & icon
    if (elements.btnToggleShowHighlights) {
        if (showHighlightsInSidebar) {
            elements.btnToggleShowHighlights.innerHTML = `<i class="ri-eye-off-line"></i> 隐藏划线 (${pureCount})`;
            elements.btnToggleShowHighlights.classList.add('active');
        } else {
            elements.btnToggleShowHighlights.innerHTML = `<i class="ri-eye-line"></i> 显示划线 (${pureCount})`;
            elements.btnToggleShowHighlights.classList.remove('active');
        }
    }

    if (displayedNotes.length === 0) {
        if (elements.emptyNotesState) {
            elements.emptyNotesState.style.display = 'block';
            const emptyText = elements.emptyNotesState.querySelector('p');
            if (emptyText) {
                emptyText.textContent = showHighlightsInSidebar ? '暂无划线与笔记' : '暂无笔记';
            }
        }
        return;
    }

    if (elements.emptyNotesState) {
        elements.emptyNotesState.style.display = 'none';
    }

    const focusedIds = new Set([...(focusedNoteIds || []), ...(focusedHighlightIds || [])]);

    displayedNotes.forEach(note => {
        const highlight = isHighlight(note);
        const noteKind = isNote(note);
        const card = document.createElement('div');
        card.className = `note-card${noteKind ? ' hl-green-card' : ''}${highlight ? ' pure-highlight-card' : ''}${focusedIds.has(note.id) ? ' is-focused' : ''}`;
        card.id = `card-${note.id}`;
        card.setAttribute('data-annotation-id', note.id);

        const chapterLabel = note.chapter ? escapeHtml(note.chapter) : '章节选区';
        const typeBadge = highlight ?
            `<span class="note-loc-tag" style="background: rgba(245,158,11,0.1); color: #d97706; font-weight: 500;"><i class="ri-sparkling-line"></i> 划线</span>` :
            `<span class="note-loc-tag" style="background: rgba(16,185,129,0.1); color: var(--accent-color); font-weight: 500;"><i class="ri-chat-1-line"></i> 笔记</span>`;
        const editButton = noteKind ? `
                <button class="btn btn-ghost-sm btn-edit-note" data-id="${note.id}" title="编辑这条笔记">
                    <i class="ri-edit-line"></i>
                </button>` : '';

        card.innerHTML = `
            <div class="note-card-header">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    ${typeBadge}
                    <span class="note-loc-tag" style="background: rgba(0,0,0,0.04);"><i class="ri-book-open-line"></i> ${chapterLabel}</span>
                    <span class="note-loc-tag"><i class="ri-bookmark-3-line"></i> P.${note.page}</span>
                </div>
                <span style="font-size: 0.76rem; color: var(--text-sub);">${note.timestamp || ''}</span>
            </div>
            ${note.quote ? `<div class="note-quote-text">“${escapeHtml(note.quote)}”</div>` : ''}
            ${note.comment ? `<div class="note-comment-text">💭 ${escapeHtml(note.comment)}</div>` : ''}
            <div class="note-card-actions">
                ${editButton}
                <button class="btn btn-ghost-sm btn-delete-note" data-id="${note.id}" title="${highlight ? '删除高亮' : '删除这条笔记'}">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-note') || e.target.closest('.btn-edit-note')) return;
            if (typeof onJump === 'function') onJump(note);
        });

        const editBtn = card.querySelector('.btn-edit-note');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onEdit === 'function') onEdit(note);
            });
        }

        const deleteBtn = card.querySelector('.btn-delete-note');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onDelete === 'function') onDelete(note);
            });
        }

        elements.notesList.appendChild(card);
    });
}

export function highlightNoteCard(noteId) {
    const card = document.getElementById(`card-${noteId}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = '', 2000);
    }
}

export function openNoteModal({ elements, quote = '', existingNote = null }) {
    if (!elements || !elements.noteModal) return;

    const modalTitle = elements.noteModal.querySelector('h3');
    const confirmBtn = elements.btnConfirmModal;

    if (existingNote) {
        if (elements.modalQuotePreview) elements.modalQuotePreview.textContent = `“${existingNote.quote || quote}”`;
        if (elements.modalNoteTextarea) elements.modalNoteTextarea.value = existingNote.comment || '';
        if (modalTitle) modalTitle.innerHTML = '<i class="ri-edit-line"></i> 编辑笔记';
        if (confirmBtn) confirmBtn.textContent = '更新笔记';
    } else {
        if (elements.modalQuotePreview) elements.modalQuotePreview.textContent = `“${quote}”`;
        if (elements.modalNoteTextarea) elements.modalNoteTextarea.value = '';
        if (modalTitle) modalTitle.innerHTML = '<i class="ri-sticky-note-add-line"></i> 添加笔记';
        if (confirmBtn) confirmBtn.textContent = '保存笔记';
    }

    elements.noteModal.classList.add('active');
    if (elements.modalNoteTextarea) elements.modalNoteTextarea.focus();
}

export function closeNoteModal(elements) {
    if (elements && elements.noteModal) {
        elements.noteModal.classList.remove('active');
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
