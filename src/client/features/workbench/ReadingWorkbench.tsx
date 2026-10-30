import { Button } from '../../components/ui/button.js';
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
        <textarea ref={input} className="note-editor" aria-label="Note text" rows={1} defaultValue={note.comment}
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
    return <div className="margin-notes-lane" data-margin-side="right" role="group" aria-label="Notes for visible text">
        {state.notes.map(note => <div key={note.id} id={`card-${note.id}`} data-annotation-id={note.id}
            className={`note-card ${note.kind === 'note' ? 'hl-green-card' : 'pure-highlight-card'}${state.focusedIds.includes(note.id) ? ' is-focused' : ''}`}
            tabIndex={0} role="group" aria-label={note.kind === 'note' ? "Note linked to source text" : "Highlight actions"}
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
                    : note.kind === 'note' ? note.comment : <span className="margin-highlight-label">Highlight</span>}
            </div>
            <div className="note-card-actions" hidden={state.editingNoteId === note.id}>
                <Button type="button" className={`btn btn-ghost-sm btn-goal-link${state.linkedIds.includes(note.id) ? ' is-linked' : ''}`}
                    data-annotation-id={note.id} disabled={!state.selectedGoal || state.goalDisabled || !state.goalVisible || state.linkedIds.includes(note.id)}
                    aria-label={state.linkedIds.includes(note.id) ? 'Added to goal' : 'Add to goal'}
                    title={state.selectedGoal ? "Add to current goal" : "Select a goal on the left first"}
                    onClick={() => { void store.linkNote(note.id); }}>
                    <i aria-hidden="true" className={state.linkedIds.includes(note.id) ? 'ri-check-line' : 'ri-links-line'} />
                    <span>{state.linkedIds.includes(note.id) ? 'Linked' : 'Goal'}</span>
                </Button>
                <Button type="button" className="btn btn-ghost-sm" aria-label="Back to source"
                    onClick={() => store.app.coordinator.jumpToAnnotation(note.id)}><i className="ri-focus-3-line" aria-hidden="true" /></Button>
                <Button type="button" className="btn btn-ghost-sm" aria-label={note.kind === 'note' ? "Delete note" : "Delete highlight"}
                    onClick={() => { void store.deleteNote(note.id); }}><i className="ri-delete-bin-line" aria-hidden="true" /></Button>
            </div>
        </div>)}
    </div>;
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
        {createPortal(<>
            <Button type="button" className="tooltip-btn" onMouseDown={event => event.preventDefault()}
                onClick={() => { void store.createFromSelection('highlight'); }}><i className="ri-mark-pen-line" aria-hidden="true" />Highlight</Button>
            <Button type="button" className="tooltip-btn" aria-label="Add note" onMouseDown={event => event.preventDefault()}
                onClick={() => { void store.createFromSelection('note'); }}><i className="ri-sticky-note-line" aria-hidden="true" />Note</Button>
        </>, doc.getElementById('react-selection-actions')!)}
        {createPortal(<>
            {state.saveState !== 'saved' && <span className="react-save-status" role="status">{state.saveState === 'saving' ? "Saving…" : "Save incomplete"}</span>}
            {state.error && <span role="alert" className="react-workbench-error">{state.error}</span>}
        </>, doc.getElementById('react-reading-book')!)}
    </>;
}
