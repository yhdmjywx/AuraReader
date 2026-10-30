import type { Book } from '../../domain/book.js';
import type { Annotation } from '../../domain/annotation.js';
import { buildBookStructure, structureSummary } from '../../infrastructure/bookStructure.js';
import { Input } from '../../components/ui/input.js';
import { renderSurface } from '../../components/ui/renderSurface.js';
import { countLabel } from '../../domain/format.js';

let revision = 0;
export function renderBackupChoices(host: HTMLElement, books: Book[], notes: Annotation[]) {
    renderSurface(host, <div key={++revision}>{books.map(book => <div className="ui-backup-choice" key={book.id}>
        <label><Input type="checkbox" className="chk-backup-book" data-id={book.id} defaultChecked /><span>{book.title}</span></label>
        <small>{book.format || 'EPUB'} · {structureSummary(buildBookStructure(book))} · {countLabel(notes.filter(note => note.bookId === book.id).length, 'annotation')}</small>
    </div>)}</div>);
}
export function renderChapterChoices(host: HTMLElement, units: { id: string; title: string }[]) {
    renderSurface(host, <div key={++revision}>{units.map(unit => <label className="chapter-export-item" key={unit.id}>
        <Input type="checkbox" value={unit.id} /><span>{unit.title}</span>
    </label>)}</div>);
}
