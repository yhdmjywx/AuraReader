import { useState } from 'react';
import type { AppElements } from '../../app/elements.js';
import type { Book } from '../../domain/book.js';
import { buildBookStructure, structureSummary } from '../../infrastructure/bookStructure.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { renderSurface } from '../../components/ui/renderSurface.js';

interface ShelfProps {
    elements: AppElements; books: Book[];
    onOpenBook?: (id: string) => unknown; onDeleteBook?: (book: Book) => Promise<void>;
}
function ShelfBooks({ elements, books, onOpenBook, onDeleteBook }: ShelfProps) {
    const [query, setQuery] = useState(''), [removing, setRemoving] = useState<Book | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const visible = books.filter(book => book.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    return <>
        <li className="shelf-search"><Input type="search" aria-label="搜索书库" placeholder="搜索书籍" value={query} onChange={event => setQuery(event.currentTarget.value)} /></li>
        {!visible.length && <li className="shelf-empty"><p>{books.length ? '没有匹配的书籍' : '本地书库暂无图书'}</p><span>导入 EPUB、PDF 或 TXT 开始阅读。</span></li>}
        {visible.map(book => <li className="shelf-entry" key={book.id}>
            <Button className="shelf-book-open" aria-label={`打开阅读：《${book.title}》`} onClick={() => { closeShelf(elements); onOpenBook?.(book.id); }}>
                <span className="shelf-book-title">{book.title}</span>
                <span className="shelf-book-meta">{book.format || 'EPUB'} · {structureSummary(buildBookStructure(book))}</span>
            </Button>
            <Button className="btn btn-icon-sm shelf-book-delete" aria-label={`从书库移除《${book.title}》`}
                onClick={() => { setRemoving(book); setError(''); }}><i className="ri-delete-bin-line" aria-hidden="true" /></Button>
        </li>)}
        <Dialog open={!!removing} onOpenChange={open => { if (!open && !busy) setRemoving(null); }}>
            <DialogContent finalFocus={() => elements.btnShelf?.hidden ? elements.shelfPanel?.ownerDocument.getElementById('home-goal-title') : elements.btnShelf || null}>
                <DialogTitle>移除书籍？</DialogTitle><DialogDescription>《{removing?.title}》及其划线笔记将从本地书库移除。</DialogDescription>
                {error && <p role="alert">{error}</p>}
                <div className="ui-dialog-actions"><Button disabled={busy} onClick={() => setRemoving(null)}>取消</Button>
                    <Button variant="destructive" disabled={busy} onClick={() => {
                        if (!removing) return; setBusy(true);
                        void onDeleteBook?.(removing).then(() => setRemoving(null)).catch(error => setError(error.message)).finally(() => setBusy(false));
                    }}>{busy ? '移除中…' : '移除'}</Button></div>
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
    requestAnimationFrame(() => elements.shelfList?.querySelector<HTMLInputElement>('input')?.focus());
}
export function closeShelf(elements: AppElements) {
    elements.shelfPanel?.classList.remove('open'); elements.shelfPanel?.setAttribute('aria-hidden', 'true'); elements.btnShelf?.setAttribute('aria-expanded', 'false');
}
