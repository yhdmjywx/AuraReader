import type { FontChoice } from '../../src/client/domain/font.js';
import type { SaveNoteCommand, DeleteNoteCommand, NoteRecord } from '../../src/shared/storage.js';
import { createAnnotationObject } from '../../src/client/domain/annotationEngine.js';
import { storageRequest } from '../../src/client/infrastructure/storageClient.js';
import type { NoteWriteInput } from '../../src/client/infrastructure/annotationRecovery.js';

// These are compiler tests, never executed. Unused @ts-expect-error directives
// fail the build if an API accidentally becomes permissive.
const font: FontChoice = { kind: 'system', family: 'Example' };
// @ts-expect-error System fonts require a family, not an imported font id.
const invalidFont: FontChoice = { kind: 'system', id: 'example' };
const note = createAnnotationObject({ bookId: 'book', quote: 'source', comment: 'thought' });
const save: SaveNoteCommand = { opId: 'op', expected: 0, generation: 'g', note };
// @ts-expect-error Saving a note requires the note payload.
const missingPayload: SaveNoteCommand = { opId: 'op', expected: 0, generation: 'g' };
// @ts-expect-error A delete command cannot be sent as a save command.
const wrongOperation: SaveNoteCommand = {} as DeleteNoteCommand;
// @ts-expect-error Deleted records cannot expose a live payload.
const deleted: NoteRecord = { id: note.id, bookId: 'book', revision: 1, deleted: true, value: note };
void [font, invalidFont, save, missingPayload, wrongOperation, deleted];

function storageCalls() {
    storageRequest('notes/save', save);
    // @ts-expect-error Route determines the payload; a save cannot be deleted.
    storageRequest('notes/delete', save);
    // @ts-expect-error Save requests require a payload.
    storageRequest('notes/save');
    // @ts-expect-error A pending save must contain its original note.
    const pending: NoteWriteInput = { id: 'n', bookId: 'b', operation: 'save' };
    void pending;
}
void storageCalls;

import type { ReaderCallbacks, SelectionCallbacks } from '../../src/client/app/contracts.js';
import type { AppElements } from '../../src/client/app/elements.js';
import { AppCoordinator } from '../../src/client/app/appCoordinator.js';
function controllerContracts() {
    const reader: ReaderCallbacks = { getNotes: () => [note] };
    // @ts-expect-error Rendering callbacks must return normalized annotations.
    reader.getNotes = () => [{ id: 'n', page: 'first' }];
    const selection: SelectionCallbacks = {};
    // @ts-expect-error Selection context must provide a numeric current page.
    selection.getReadingContext = () => ({ currentPage: 'first' });
    // @ts-expect-error The coordinator needs its session, reader and annotations.
    new AppCoordinator({});
    const elements: AppElements = {};
    // @ts-expect-error The file input must expose files, not just general DOM methods.
    elements.fileInput = document.createElement('div');
}
void controllerContracts;
