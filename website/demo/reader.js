// A fixed reading surface using the original annotation/selection modules.
import { AnnotationController } from '../../src/client/features/annotations/annotationController.js';
import { SelectionController } from '../../src/client/features/annotations/selectionController.js';
import { renderAnnotationTokens } from '../../src/client/features/reader/annotationRenderer.js';
import { applyMarginGeometry, positionMarginNotes } from '../../src/client/features/layout/marginNotesLayout.js';
import { collectVisibleAnnotationIds } from '../../src/client/features/reader/visibleAnnotations.js';
import { aliceBook, ALICE_ID } from './alice.js';
import { readerTemplate } from './template.js';

export function createReader(host) {
  host.innerHTML = readerTemplate;
  host.classList.add('aura-showcase-reader');
  const get = id => host.querySelector(`#${id}`);
  get('current-book-title').textContent = aliceBook.title;
  const elements = {
    workspaceContainer: get('workspace-container'), readerPanel: get('reader-panel'),
    bookPaper: get('book-paper'), bookPaperRight: null, notesPanel: get('notes-panel'),
    notesList: get('notes-list'), emptyNotesState: get('empty-notes-state'),
    selectionTooltip: get('selection-tooltip'), highlightActionTooltip: get('highlight-action-tooltip'),
    btnAddNote: get('btn-add-note'), btnHlRemove: get('btn-hl-remove'), btnNoteRemove: get('btn-note-remove')
  };
  const viewport = get('reader-viewport');
  let selection;
  const annotations = new AnnotationController({ callbacks: {
    getCurrentBookId: () => ALICE_ID,
    getCurrentPage: () => 1,
    getCurrentChapter: () => 'CHAPTER I. Down the Rabbit-Hole',
    getPendingSelection: () => selection.getPendingSelection(),
    getVisibleAnnotationIds: () => collectVisibleAnnotationIds([elements.bookPaper], viewport),
    onNotesChanged: notes => render(notes),
    onFocusAnnotation: note => selection.activateAnnotationId(note.id, { notify: true, showMenu: true }),
    onJump: note => selection.activateAnnotationId(note.id, { notify: true, showMenu: true })
  } });
  selection = new SelectionController({ callbacks: {
    getReadingContext: () => ({ chapterFlow: true, currentPage: 1, sectionId: 'chapter-1' }),
    onCreateHighlight: (color, pending) => annotations.createHighlight({
      quote: pending.text, page: 1, chapter: 'CHAPTER I. Down the Rabbit-Hole', color, location: pending.location
    }),
    onCreateNote: draft => annotations.createNote({ ...draft, chapter: 'CHAPTER I. Down the Rabbit-Hole' }),
    onDeleteHighlight: ids => annotations.deleteHighlights(ids),
    onDeleteNotes: ids => Promise.all(ids.map(id => annotations.deleteNote(id))),
    onAnnotationActivated: context => context.noteIds.length ? annotations.focusNotes(context.noteIds) : annotations.clearFocusedAnnotations(),
    onClearFocus: () => annotations.clearFocusedAnnotations()
  } });
  function render(notes = annotations.getRenderingNotes()) {
    elements.bookPaper.innerHTML = aliceBook.pages[0];
    renderAnnotationTokens(elements.bookPaper, notes, 1);
    selection.restoreActiveTokens();
    annotations.refreshVisibleNotes();
    positionMarginNotes(elements);
  }
  function layout() {
    applyMarginGeometry(elements, 'single');
    annotations.refreshVisibleNotes();
    positionMarginNotes(elements);
  }
  annotations.initUI(elements);
  selection.initUI(elements);
  render(); layout();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(host);
  window.addEventListener('resize', layout);
  document.fonts?.ready.then(layout);
  return {
    root: host,
    app: { annotations, selection, elements, reader: { renderPage: () => render(), getCurrentPage: () => 1 }, layout }
  };
}
