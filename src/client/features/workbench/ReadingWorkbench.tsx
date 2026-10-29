import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Annotation } from '../../domain/annotation.js';
import { positionMarginNotes } from '../layout/marginNotesLayout.js';
import { attachNoteCaret } from '../annotations/noteCaret.js';
import { WorkbenchStore, type ReadingApplication, type WorkbenchSnapshot } from './workbenchStore.js';

function NoteEditor({ note, store }: { note: Annotation; store: WorkbenchStore }) {
    const input = useRef<HTMLTextAreaElement>(null), shell = useRef<HTMLDivElement>(null);
    const composing = useRef(false);
    useLayoutEffect(() => {
        const editor = input.current!;
        const updateCaret = attachNoteCaret(editor, shell.current!);
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(editor.value.length, editor.value.length);
        updateCaret();
    }, []);
    useLayoutEffect(() => {
        const editor = input.current!;
        editor.style.height = '0px';
        editor.style.height = `${Math.max(editor.scrollHeight, 26)}px`;
    }, [note.comment]);
    return <div ref={shell} className="note-editor-shell">
        <textarea ref={input} className="note-editor" aria-label="笔记内容" rows={1} defaultValue={note.comment}
            aria-keyshortcuts="Escape Control+Enter Meta+Enter"
            onInput={event => store.updateNote(note.id, event.currentTarget.value)}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; store.updateNote(note.id, event.currentTarget.value); }}
            onKeyDown={event => {
                event.stopPropagation();
                if (composing.current || event.nativeEvent.isComposing) return;
                if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
                    event.preventDefault(); void store.run(() => store.finishNote());
                }
            }} onBlur={() => { void store.run(() => store.finishNote()); }} />
    </div>;
}

function Notes({ state, store }: { state: WorkbenchSnapshot; store: WorkbenchStore }) {
    useLayoutEffect(() => { positionMarginNotes(store.app.elements); }, [state, store]);
    return <div className="margin-notes-lane" data-margin-side="right" role="group" aria-label="当前可见正文的笔记">
        {state.notes.map(note => <div key={note.id} id={`card-${note.id}`} data-annotation-id={note.id}
            className={`note-card ${note.kind === 'note' ? 'hl-green-card' : 'pure-highlight-card'}${state.focusedIds.includes(note.id) ? ' is-focused' : ''}`}
            tabIndex={0} role="group" aria-label={note.kind === 'note' ? '关联正文的笔记' : '高亮操作'}
            onClick={event => {
                if ((event.target as HTMLElement).closest('button,textarea')) return;
                if (note.kind === 'note') store.editNote(note);
                else store.app.coordinator.jumpToAnnotation(note.id);
            }} onKeyDown={event => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    if (note.kind === 'note') store.editNote(note);
                    else store.app.coordinator.jumpToAnnotation(note.id);
                }
            }}>
            <div className="note-comment-text">
                {state.editingNoteId === note.id ? <NoteEditor note={note} store={store} />
                    : note.kind === 'note' ? note.comment : <span className="margin-highlight-label">划线</span>}
            </div>
            <div className="note-card-actions" hidden={state.editingNoteId === note.id}>
                <button type="button" className={`btn btn-ghost-sm btn-goal-link${state.linkedIds.includes(note.id) ? ' is-linked' : ''}`}
                    data-annotation-id={note.id} disabled={!state.selectedGoal || state.goalDisabled || !state.goalVisible || state.linkedIds.includes(note.id)}
                    aria-label={state.linkedIds.includes(note.id) ? 'Added to goal' : 'Add to goal'}
                    title={state.selectedGoal ? '关联到当前 Goal' : '先在左侧选择一个 Goal'}
                    onClick={() => { void store.linkNote(note.id); }}>
                    <i aria-hidden="true" className={state.linkedIds.includes(note.id) ? 'ri-check-line' : 'ri-links-line'} />
                    <span>{state.linkedIds.includes(note.id) ? 'Linked' : 'Goal'}</span>
                </button>
                <button type="button" className="btn btn-ghost-sm" aria-label="回到原文"
                    onClick={() => store.app.coordinator.jumpToAnnotation(note.id)}><i className="ri-focus-3-line" aria-hidden="true" /></button>
                <button type="button" className="btn btn-ghost-sm" aria-label={note.kind === 'note' ? '删除笔记' : '删除高亮'}
                    onClick={() => { void store.deleteNote(note.id); }}><i className="ri-delete-bin-line" aria-hidden="true" /></button>
            </div>
        </div>)}
    </div>;
}

function Goals({ state, store }: { state: WorkbenchSnapshot; store: WorkbenchStore }) {
    const [draft, setDraft] = useState('');
    if (state.surface !== 'reader' || !state.goalVisible) return null;
    const selected = state.selectedGoal;
    return <>
        <nav className="goal-navigation" aria-label="Goal 导航">
            <button type="button" className="goal-action" onClick={() => { void store.selectGoal(null); }}>全部 Goal</button>
            {selected && <button type="button" className="goal-icon" aria-label="上一级 Goal" onClick={() => { void store.selectGoal(selected.parentId); }}>↑</button>}
            <button type="button" className="goal-icon" aria-label="打开完整 Goal 页面"
                onClick={() => { void store.run(() => store.app.goals.openPage()); }}>⤢</button>
        </nav>
        {selected && <div className="goal-heading"><h2 className="react-goal-title">{selected.text}</h2>
            <button type="button" className="goal-icon" aria-label={`Actions for ${selected.text}`}
                onClick={event => store.app.goals.actions.open(selected.id, event.currentTarget)}>⋯</button></div>}
        <div className="goal-children">{state.children.map(goal => <div className="goal-row" key={goal.id}>
            <button type="button" className="goal-child" disabled={state.goalDisabled}
                onClick={() => { void store.selectGoal(goal.id); }}>{goal.text}{goal.completedAt ? ' ✓' : ''}</button>
        </div>)}</div>
        <form className="react-goal-create" onSubmit={event => {
            event.preventDefault(); if (!draft.trim()) return;
            void store.createGoal(draft).then(() => { if (!store.getSnapshot().error) setDraft(''); });
        }}>
            <input aria-label={selected ? '新建子 Goal' : '新建 Goal'} placeholder={selected ? '新建子 Goal' : '新建 Goal'}
                value={draft} onChange={event => setDraft(event.currentTarget.value)} disabled={state.goalDisabled} />
            <button type="submit" className="goal-icon" aria-label="创建 Goal" disabled={state.goalDisabled || !draft.trim()}>＋</button>
        </form>
        {selected && <section aria-label="Goal 关联材料">
            <p className="react-material-count">{state.materials.length} 条关联材料</p>
            {state.materials.map(({ link, annotation, title }) => <div className="goal-item" key={`${link.bookId}:${link.annotationId}`}>
                <i aria-hidden="true" className={annotation?.kind === 'note' ? 'ri-sticky-note-line' : 'ri-mark-pen-line'} />
                <div className="goal-item-detail">
                    <button type="button" className="goal-item-text" data-annotation-id={link.annotationId} disabled={!annotation}
                        onClick={() => { void store.jumpToSource(link); }}>{annotation ? annotation.comment || annotation.quote : '来源不可用'}</button>
                    {link.bookId !== state.reader.location.bookId && <div className="goal-item-source">{title}</div>}
                </div>
            </div>)}
        </section>}
    </>;
}

export function ReadingWorkbench({ application }: { application: ReadingApplication }) {
    const store = useMemo(() => new WorkbenchStore(application), [application]);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const [ready, setReady] = useState(false);
    const doc = application.elements.bookPaper!.ownerDocument;
    useLayoutEffect(() => {
        const notes = application.elements.notesList!;
        const host = doc.getElementById('react-notes')!;
        application.annotations.useReactView(true);
        if (notes.dataset.renderer !== 'react') {
            for (const child of [...notes.children]) if (child !== host) child.remove();
        }
        notes.dataset.renderer = 'react';
        doc.documentElement.dataset.reactWorkbench = 'true';
        const disconnect = store.connect();
        setReady(true);
        return () => {
            disconnect();
            delete doc.documentElement.dataset.reactWorkbench;
            queueMicrotask(() => {
                if (doc.documentElement.dataset.reactWorkbench === 'true') return;
                delete notes.dataset.renderer;
                application.annotations.useReactView(false);
            });
        };
    }, [application, doc, store]);
    if (!ready) return null;
    return <>
        {createPortal(<Notes state={state} store={store} />, doc.getElementById('react-notes')!)}
        {createPortal(<Goals state={state} store={store} />, doc.getElementById('react-reading-goals')!)}
        {createPortal(<>
            <button type="button" className="tooltip-btn" onMouseDown={event => event.preventDefault()}
                onClick={() => { void store.createFromSelection('highlight'); }}><i className="ri-mark-pen-line" aria-hidden="true" />高亮</button>
            <button type="button" className="tooltip-btn" aria-label="添加笔记" onMouseDown={event => event.preventDefault()}
                onClick={() => { void store.createFromSelection('note'); }}><i className="ri-sticky-note-line" aria-hidden="true" />笔记</button>
        </>, doc.getElementById('react-selection-actions')!)}
        {createPortal(<>
            <select aria-label="阅读书籍" value={state.reader.location.bookId} onChange={event => { void store.openBook(event.currentTarget.value); }}>
                <option value="" disabled>选择书籍</option>
                {state.books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
            </select>
            <span className="react-save-status" role="status">{state.saveState === 'saving' ? '保存中…' : state.saveState === 'error' ? '保存未完成' : '自动保存'}</span>
            {state.error && <span role="alert" className="react-workbench-error">{state.error}</span>}
        </>, doc.getElementById('react-reading-book')!)}
    </>;
}
