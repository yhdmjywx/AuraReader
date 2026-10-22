import type { FontChoice } from '../../src/client/domain/font.js';
import type { SaveNoteCommand, DeleteNoteCommand, NoteRecord } from '../../src/shared/storage.js';
import { createAnnotationObject } from '../../src/client/domain/annotationEngine.js';

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
