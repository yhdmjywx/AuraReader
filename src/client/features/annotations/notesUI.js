/* ==========================================================================
   NotesUI - Sidebar Notes & Annotations Presentation (Feature Layer)
   Pure UI presentation. Renders note cards, toggles pure-highlight visibility,
   handles inline inputs, and exposes interaction callbacks.
   Zero direct database persistence calls.
   ========================================================================== */

import { filterNotes, isHighlight, isNote } from '../../domain/annotationEngine.js';
import { isImmersiveNotes, positionMarginNotes, moveNoteCard } from '../layout/marginNotesLayout.js';

/** @param {import('../../app/contracts.js').NotesRenderOptions} options */
export function renderNotesList({
    elements,
    notes = [],
    notesScope = 'page',
    showHighlightsInSidebar = false,
    focusedNoteIds = [],
    focusedHighlightIds = [],
    onJump = null,
    onEdit = null,
    onDelete = null,
    editingNoteId = null,
    onInput = null,
    onFinish = null
}) {
    if (!elements || !elements.notesList) return;

    // Never detach the active textarea: autosave and reader refreshes must not
    // reset its caret, scroll position, or an ongoing IME composition.
    const { displayedNotes, pureCount } = filterNotes(notes, showHighlightsInSidebar);
    const focusedIds = new Set([...(focusedNoteIds || []), ...(focusedHighlightIds || [])]);
    const keys = new Map(displayedNotes.map(note => [String(note.id), JSON.stringify([note, focusedIds.has(note.id)])]));
    const retained = new Map();
    elements.notesList.querySelectorAll('.note-card').forEach(card => {
        const id = card.dataset.annotationId;
        const editor = card.querySelector('.note-editor');
        if (keys.has(id) && ((id === String(editingNoteId) && editor)
            || (card._noteRenderKey === keys.get(id) && !editor))) retained.set(id, card);
        else card.remove();
    });
    if (elements.emptyNotesState && !elements.notesList.contains(elements.emptyNotesState)) elements.notesList.appendChild(elements.emptyNotesState);

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
                const scope = notesScope === 'book' ? '全书' : '当前页';
                emptyText.textContent = showHighlightsInSidebar ? `${scope}暂无划线与笔记` : `${scope}暂无笔记`;
            }
        }
        positionMarginNotes(elements);
        return;
    }

    if (elements.emptyNotesState) {
        elements.emptyNotesState.style.display = 'none';
    }

    displayedNotes.forEach(note => {
        const existingCard = retained.get(String(note.id));
        if (existingCard) {
            if (note.id === editingNoteId && !existingCard.querySelector('.note-editor')) {
                startInlineEditor({ card: existingCard, note, elements, onInput, onFinish });
            }
            return;
        }
        const highlight = isHighlight(note);
        const noteKind = isNote(note);
        const card = document.createElement('div');
        card.className = `note-card${noteKind ? ' hl-green-card' : ''}${highlight ? ' pure-highlight-card' : ''}${focusedIds.has(note.id) ? ' is-focused' : ''}`;
        card.id = `card-${note.id}`;
        card.setAttribute('data-annotation-id', note.id);
        card._noteRenderKey = keys.get(String(note.id));

        const chapterLabel = note.chapter ? escapeHtml(note.chapter) : '章节选区';
        const typeBadge = highlight ?
            `<span class="note-loc-tag" style="background: rgba(245,158,11,0.1); color: #d97706; font-weight: 500;"><i class="ri-sparkling-line"></i> 划线</span>` :
            `<span class="note-loc-tag" style="background: rgba(16,185,129,0.1); color: var(--accent-color); font-weight: 500;"><i class="ri-chat-1-line"></i> 笔记</span>`;

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
            ${noteKind ? `<div class="note-comment-text">${escapeHtml(note.comment || '')}</div>` : ''}
            <div class="note-card-actions">
                <button class="btn btn-ghost-sm btn-delete-note" data-id="${note.id}" title="${highlight ? '删除高亮' : '删除这条笔记'}">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;

        if (isImmersiveNotes(elements)) {
            // References remain in the annotation/export; the margin presents
            // only the user's words, in both reading and editing states.
            card.querySelector('.note-card-header')?.remove();
            card.querySelector('.note-quote-text')?.remove();
            const comment = card.querySelector('.note-comment-text');
            if (comment) comment.textContent = note.comment;
            else if (highlight) {
                const label = document.createElement('span');
                label.className = 'margin-highlight-label';
                label.textContent = '划线';
                card.prepend(label);
            }
            card.setAttribute('role', 'group');
            card.setAttribute('aria-label', highlight ? '高亮操作' : '关联正文的笔记');
        }

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-note') || e.target.closest('.note-editor')) return;
            if (noteKind && typeof onEdit === 'function') onEdit(note);
            else if (typeof onJump === 'function') onJump(note);
        });
        if (noteKind) {
            card.tabIndex = 0;
            card.addEventListener('keydown', event => {
                if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onEdit?.(note);
                }
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
        if (note.id === editingNoteId) startInlineEditor({ card, note, elements, onInput, onFinish });
    });
    if (!isImmersiveNotes(elements)) {
        let before = null;
        for (const note of displayedNotes.slice().reverse()) {
            const card = [...elements.notesList.querySelectorAll('.note-card')].find(node => node.dataset.annotationId === String(note.id));
            moveNoteCard(card, elements.notesList, before);
            before = card;
        }
    }
    positionMarginNotes(elements);
}

export function highlightNoteCard(noteId) {
    const card = document.getElementById(`card-${noteId}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = '', 2000);
    }
}

export function focusInlineEditor(elements, noteId) {
    const card = [...(elements?.notesList?.querySelectorAll('.note-card') || [])]
        .find(node => node.dataset.annotationId === String(noteId));
    const editor = card?.querySelector('.note-editor');
    if (!editor?.isConnected) return;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(editor.value.length, editor.value.length);
    const lane = card.closest('.margin-notes-lane');
    if (lane && card.offsetTop + card.offsetHeight > lane.scrollTop + lane.clientHeight) {
        lane.scrollTop = Math.max(0, card.offsetTop + card.offsetHeight - lane.clientHeight);
    }
}

function startInlineEditor({ card, note, elements, onInput, onFinish }) {
    const text = card.querySelector('.note-comment-text');
    const editor = document.createElement('textarea');
    editor.className = 'note-editor';
    editor.setAttribute('aria-label', '笔记内容');
    editor.setAttribute('aria-keyshortcuts', 'Escape Control+Enter Meta+Enter');
    editor.rows = 1;
    editor.value = note.comment || '';
    text.replaceChildren(editor);
    card.querySelector('.note-card-actions').hidden = true;
    const resize = () => {
        editor.style.height = '0px';
        editor.style.height = `${Math.max(editor.scrollHeight, 25.2)}px`;
        positionMarginNotes(elements);
    };
    let composing = false;
    editor.addEventListener('compositionstart', () => { composing = true; });
    editor.addEventListener('compositionend', () => {
        composing = false;
        onInput?.(note.id, editor.value);
        resize();
    });
    editor.addEventListener('input', () => {
        onInput?.(note.id, editor.value);
        resize();
    });
    editor.addEventListener('keydown', event => {
        event.stopPropagation();
        if (composing || event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
            event.preventDefault();
            onFinish?.();
        }
    });
    editor.addEventListener('blur', () => {
        if (!editor.dataset.repositioning) onFinish?.();
    });
    resize();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
