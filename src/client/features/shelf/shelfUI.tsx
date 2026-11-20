import { useState } from 'react';
import type { AppElements } from '../../app/elements.js';
import type { BookSummary } from '../../domain/book.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { renderSurface } from '../../components/ui/renderSurface.js';

interface ShelfProps {
    elements: AppElements; books: BookSummary[];
    onOpenBook?: (id: string) => unknown; onDeleteBook?: (book: BookSummary) => Promise<void>;
}
function ShelfBooks({ elements, books, onOpenBook, onDeleteBook }: ShelfProps) {
    const [query, setQuery] = useState(''), [removing, setRemoving] = useState<BookSummary | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const visible = books.filter(book => book.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    return <>
        <li className="shelf-search"><Input type="search" aria-label="Search library" placeholder="Search books" value={query} onChange={event => setQuery(event.currentTarget.value)} /></li>
        {!visible.length && <li className="shelf-empty"><p>{books.length ? "No matching books" : "No local books yet"}</p><span>Import EPUB, PDF, or TXT to start reading.</span></li>}
        {visible.map(book => <li className="shelf-entry" key={book.id}>
            <Button className="shelf-book-open" aria-label={`Open: “${book.title}”`} onClick={() => { closeShelf(elements); onOpenBook?.(book.id); }}>
                <span className="shelf-book-title">{book.title}</span>
            </Button>
            <Button className="btn btn-icon-sm shelf-book-delete" aria-label={`Remove from library: “${book.title}”`}
                onClick={() => { setRemoving(book); setError(''); }}><i className="ri-delete-bin-line" aria-hidden="true" /></Button>
        </li>)}
        <Dialog open={!!removing} onOpenChange={open => { if (!open && !busy) setRemoving(null); }}>
            <DialogContent finalFocus={() => elements.btnShelf?.hidden ? elements.shelfPanel?.ownerDocument.getElementById('home-goal-title') : elements.btnShelf || null}>
                <DialogTitle>Remove book?</DialogTitle><DialogDescription>“{removing?.title}” and its highlights and notes will be removed from the local library.</DialogDescription>
                {error && <p role="alert">{error}</p>}
                <div className="ui-dialog-actions"><Button disabled={busy} onClick={() => setRemoving(null)}>Cancel</Button>
                    <Button variant="destructive" disabled={busy} onClick={() => {
                        if (!removing) return; setBusy(true);
                        void onDeleteBook?.(removing).then(() => setRemoving(null)).catch(error => setError(error.message)).finally(() => setBusy(false));
                    }}>{busy ? "Removing…" : "Remove"}</Button></div>
            </DialogContent>
        </Dialog>
    </>;
}
export function renderShelf(props: ShelfProps) {
    const { elements, books } = props;
    if (elements.shelfBookCount) { elements.shelfBookCount.textContent = String(books.length); elements.shelfBookCount.hidden = !books.length; }
    if (elements.shelfList) renderSurface(elements.shelfList, <ShelfBooks {...props} />);
}
export function openShelf(elements: AppElements) {
    elements.shelfPanel?.classList.add('open'); elements.shelfPanel?.setAttribute('aria-hidden', 'false'); elements.btnShelf?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
        if (elements.shelfPanel?.classList.contains('open')) elements.shelfList?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    });
}
export function closeShelf(elements: AppElements) {
    if (elements.shelfPanel?.contains(elements.shelfPanel.ownerDocument.activeElement)) elements.btnShelf?.focus({ preventScroll: true });
    elements.shelfPanel?.classList.remove('open'); elements.shelfPanel?.setAttribute('aria-hidden', 'true'); elements.btnShelf?.setAttribute('aria-expanded', 'false');
}
