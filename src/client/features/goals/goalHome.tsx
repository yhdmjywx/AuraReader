import type { Book } from '../../domain/book.js';
import type { GoalController } from './goalController.js';
import type { AppCoordinator } from '../../app/appCoordinator.js';
import { getAllBooksFromDB } from '../../infrastructure/bookRepository.js';
import { chooseDesktopFile } from '../../infrastructure/desktopFiles.js';
import { operationId } from '../../infrastructure/storageClient.js';
import { areaGoals, goalArea, goalAncestors, goalPath, type GoalArea, type GoalFilter } from '../../domain/goalLifecycle.js';
import { Button } from '../../components/ui/button.js';
import { Input, Textarea } from '../../components/ui/input.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { renderSurface } from '../../components/ui/renderSurface.js';

interface HomeDependencies {
    goals: GoalController; coordinator: AppCoordinator; finishAnnotations(): Promise<void>;
    currentBookId(): string; beforeOpen(): void;
}
const labels: Record<GoalArea, string> = { library: "Library", archive: "Archive", trash: "Recently Deleted" };
function HomeView({ home }: { home: GoalHome }) {
    const { goals, coordinator } = home.deps, state = goals.state;
    const selected = state.goals.find(g => g.id === home.chosen);
    const disabled = home.busy || goals.disabled || goals.lifecycleBusy;
    const readOnly = home.area !== 'library';
    const children = areaGoals(state, home.area, home.chosen, home.query, home.filter);
    const books = home.chosen ? (state.bookLinks || []).filter(l => l.goalId === home.chosen).map(link => ({ id: link.bookId, book: home.books.find(b => b.id === link.bookId) }))
        : home.books.map(book => ({ id: book.id, book }));
    const resume = home.books.find(b => b.id === home.deps.currentBookId());
    const firstUse = !state.goals.length && !home.books.length;
    const openBook = (id: string) => { void home.perform(async () => {
        const result = await coordinator.openBook(id, undefined, { goalId: home.chosen && !readOnly ? home.chosen : null });
        if (result.status === 'failed') throw new Error(result.message);
    }); };
    const menu = (id: string, title: string) => <Button className="home-icon" aria-label={`Actions for ${title}`} aria-haspopup="menu"
        disabled={disabled} onClick={event => goals.actions.open(id, event.currentTarget)}>⋯</Button>;
    return <div className="goal-home-inner" aria-busy={home.busy}>
        <header className="goal-home-top"><nav aria-label="Goal location">
            <Button id="home-root" className="home-icon" aria-label="Home" disabled={home.busy || home.creating} onClick={() => home.showArea('library')}><i className="ri-home-4-line" /></Button>
            <Button id="home-up" className="home-icon" aria-label="Up one level" disabled={!home.chosen || home.busy || home.creating}
                onClick={() => home.navigate(selected?.parentId || null)}>↑</Button>
            <div className="home-path">{home.chosen && goalAncestors(state, home.chosen).slice(1).reverse().filter(g => goalArea(state, g.id) === home.area).map(g =>
                <Button key={g.id} onClick={() => home.navigate(g.id)} disabled={home.creating}>{g.text}</Button>)}</div>
        </nav>
            {home.deps.currentBookId() && <Button id="home-continue" className="home-resume" disabled={home.busy} onClick={() => { void home.perform(async () => {
                const request = goals.navigation.begin(); await goals.assertWritesSaved(); await home.deps.finishAnnotations();
                goals.navigation.commit('reader', request);
            }); }}><i className="ri-play-line" />{resume?.title || "Continue reading"}</Button>}
        </header>
        <div className="home-heading"><h1 id="home-goal-title" tabIndex={-1}>{selected?.text || labels[home.area]}</h1>
            {selected && <div className="home-current-actions">{selected.completedAt && <span className="goal-completion">✓ Completed</span>}{menu(selected.id, selected.text)}</div>}
            {!readOnly && !home.creating && !firstUse && <div className="goal-home-actions">
                <Button id="home-new-goal" className="home-icon" aria-label="New goal" disabled={disabled} onClick={() => home.showCreate()}>＋</Button>
                <Button id="home-library-import" className="home-icon" aria-label="Import a book" disabled={home.busy} onClick={() => { void home.chooseImport(); }}><i className="ri-download-2-line" /></Button>
                {selected && <Button id="home-add-book" className="home-icon" aria-label="Add book" disabled={disabled} onClick={() => { home.picking = selected.id; home.render(); }}><i className="ri-book-2-line" />＋</Button>}
            </div>}
        </div>
        {!home.creating && <div className="home-goal-tools"><nav className="goal-collections" aria-label="Goal collections">
            {(['library', 'archive', 'trash'] as const).map(area => <Button key={area} id={`home-${area === 'library' ? 'active' : area}`}
                aria-current={home.area === area ? 'page' : undefined} disabled={home.busy} onClick={() => home.showArea(area)}>{labels[area]}</Button>)}
        </nav><div className="home-goal-filters">
            <Input id="home-goal-search" type="search" aria-label="Search goals" placeholder="Search goals" value={home.query}
                onChange={event => { home.query = event.currentTarget.value; home.render(); }} />
            <select id="home-goal-filter" className="goal-filter" aria-label="Filter goals by completion" value={home.filter}
                onChange={event => { home.filter = event.currentTarget.value as GoalFilter; home.render(); }}>
                <option value="all">All</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option>
            </select>
        </div></div>}
        {home.creating ? <form id="home-goal-form" onSubmit={event => { event.preventDefault(); void home.perform(() => home.finishDraft().then(() => {})); }}>
            <label htmlFor="home-goal-draft">New goal</label>
            <Textarea id="home-goal-draft" key={home.draftId} autoFocus rows={2} placeholder="What do you want to understand?" aria-label="New goal" defaultValue={home.draftText}
                disabled={disabled} onInput={event => home.updateDraft(event.currentTarget.value)}
                onKeyDown={event => {
                    event.stopPropagation(); if (event.nativeEvent.isComposing) return;
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
                    if (event.key === 'Escape') { event.preventDefault(); home.clearDraft(); home.render(); }
                }} />
            <div className="goal-home-actions"><Button variant="default" type="submit" disabled={disabled}>Create</Button>
                <Button id="home-cancel-goal" disabled={home.busy} onClick={() => { home.clearDraft(); home.render(); }}>Cancel</Button></div>
        </form> : <>
            {firstUse && home.area === 'library' && <section id="home-welcome"><p>Start with a book and a question.</p><div className="goal-home-actions">
                <Button id="home-start-goal" disabled={disabled} onClick={() => home.showCreate()}>Create goal</Button>
                <Button id="home-start-import" variant="default" disabled={home.busy} onClick={() => { void home.chooseImport(); }}>Import book</Button>
            </div></section>}
            <section id="home-work">
                <section id="home-folder-section"><h2>Goals</h2><div id="home-goal-folders" className="home-goal-folders">
                    {children.map(goal => <div className="home-goal-row" key={goal.id}>
                        <Button className="home-goal-folder" data-goal-id={goal.id} aria-label={`Open goal: ${goal.text}`} disabled={disabled}
                            onClick={() => home.navigate(goal.id)}><i className={goal.completedAt ? 'ri-checkbox-circle-line' : 'ri-folder-line'} />
                            <span>{goal.text}{(readOnly || home.query) && <small className="goal-original-path">{goalPath(state, goal.id)}</small>}</span><i className="ri-arrow-right-s-line" /></Button>
                        {menu(goal.id, goal.text)}
                    </div>)}
                    {!children.length && <p className="home-empty">{home.query ? "No matching goals" : "No goals here yet"}</p>}
                </div></section>
                {(!readOnly || selected) && <section id="home-book-section"><h2>Books</h2><ul id="home-books" className="home-book-grid" aria-label={selected ? 'Books added to this goal' : 'All books'}>
                    {books.map(({ id, book }) => <li className="home-book-card" key={id}>
                        <Button className="goal-home-book" aria-label={`Read: ${book?.title || 'Book unavailable'}`} disabled={home.busy || !book} onClick={() => openBook(id)}>
                            <span className="home-book-cover"><i className="ri-book-2-line" /></span><span className="home-book-title">{book?.title || "Book unavailable"}</span><span className="home-book-meta">{book?.format || ''}</span>
                        </Button>
                        {selected && !readOnly && <Button className="home-book-remove home-icon" aria-label={`Remove ${book?.title} from goal`} disabled={disabled}
                            onClick={() => { void home.perform(() => goals.removeBook(selected.id, id)); }}><i className="ri-link-unlink-m" /></Button>}
                    </li>)}
                </ul>{!books.length && <p className="home-empty" id="home-books-empty">{selected ? "Add a book to start reading toward this goal." : "Import a book to start reading."}</p>}</section>}
                {selected && <section id="home-materials"><h2>Linked notes and highlights</h2><div id="home-material-list">
                    {goals.materialEntries(selected.id).map(({ link, annotation, title }) => <div className="goal-item" key={`${link.bookId}:${link.annotationId}`}>
                        <Button className="goal-item-text" disabled={!annotation || home.busy} onClick={() => { void home.perform(() => goals.jumpMaterial(link)); }}>{annotation ? annotation.comment || annotation.quote : "Source unavailable"}</Button>
                        <small className="goal-item-source">{title}</small>
                    </div>)}
                </div></section>}
            </section>
        </>}
        <Dialog open={!!home.picking && home.active} onOpenChange={open => { if (!open && !home.busy) { home.picking = null; home.render(); } }}>
            <DialogContent finalFocus={() => home.host.querySelector<HTMLButtonElement>('#home-add-book')}>
                <DialogTitle>Add book</DialogTitle><DialogDescription>Choose an imported book, or import a new one.</DialogDescription>
                <ul className="ui-book-picker">{home.picking && home.candidatesFor(home.picking).map(book => {
                    const added = state.bookLinks?.some(link => link.goalId === home.picking && link.bookId === book.id);
                    return <li key={book.id}><span>{book.title}</span><Button disabled={disabled || added} onClick={() => { const id = home.picking!;
                        void home.perform(async () => { await goals.addBook(id, book.id); home.picking = null; });
                    }}>{added ? "Added" : "Add"}</Button></li>;
                })}</ul>
                <div className="ui-dialog-actions"><Button disabled={home.busy} onClick={() => { home.picking = null; home.render(); }}>Cancel</Button>
                    <Button variant="default" disabled={home.busy} onClick={() => { void home.chooseImport(home.picking || undefined); }}>Import book</Button></div>
            </DialogContent>
        </Dialog>
        <p id="home-status" role="status" aria-live="polite">{home.status || (goals.saveError instanceof Error ? goals.saveError.message : '')}</p>
        {(goals.disabled || home.status) && <Button id="home-retry" disabled={home.busy} onClick={() => { void home.perform(async () => {
            await goals.initialize(); await goals.assertWritesSaved(); await goals.recoverBookIntents(); await home.refresh();
        }); }}>Retry</Button>}
        <Input id="home-book-file" type="file" accept=".epub,.pdf,.txt" hidden onChange={event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
            if (file) void home.importFile(file, home.fileTarget);
        }} />
    </div>;
}

/** Home state and commands; React owns every node of the home view. */
export class GoalHome {
    get active() { return this.deps.goals.navigation.surface === 'home'; }
    books: Book[] = []; chosen: string | null = null; picking: string | null = null;
    busy = false; creating = false; status = ''; fileTarget?: string;
    area: GoalArea = 'library'; filter: GoalFilter = 'all'; query = '';
    draftId = operationId(); draftText = ''; private draftParent: string | null = null;
    private running: Promise<void> | null = null; private request = 0;
    constructor(readonly host: HTMLElement, readonly deps: HomeDependencies) {
        try {
            const raw = localStorage.getItem('aura_goal_home_draft');
            if (raw) { const draft = JSON.parse(raw); this.draftId = draft.id; this.draftText = draft.text; this.draftParent = draft.parentId || null; this.creating = true; }
        } catch { this.status = "Could not read the saved goal draft."; }
        deps.goals.navigation.subscribe(() => { host.hidden = !this.active; if (!this.active) { this.request++; this.picking = null; } this.render(); });
    }
    showCreate() { if (this.area !== 'library') return; this.draftParent = this.chosen; this.creating = true; this.render(); }
    updateDraft(text: string) {
        this.draftText = text;
        try { localStorage.setItem('aura_goal_home_draft', JSON.stringify({ id: this.draftId, parentId: this.draftParent, text })); }
        catch { this.status = "The draft is not saved. Keep this window open."; this.render(); }
    }
    clearDraft() { localStorage.removeItem('aura_goal_home_draft'); this.creating = false; this.draftText = ''; this.draftId = operationId(); this.draftParent = null; }
    async finishDraft() {
        if (!this.creating || !this.draftText.trim()) return;
        const selected = this.deps.goals.selected;
        try { await this.deps.goals.createGoal(this.draftText, this.draftParent, this.draftId); }
        finally { if (selected) this.deps.goals.selectGoal(selected); else this.deps.goals.goHome(); }
        this.chosen = this.draftParent; this.clearDraft();
    }
    showArea(area: GoalArea) { if (this.creating) return; this.area = area; this.chosen = null; this.query = ''; this.filter = 'all'; this.picking = null; this.render(); this.host.scrollTop = 0; }
    navigate(id: string | null) { if (this.creating) return; this.chosen = id; if (id) this.area = goalArea(this.deps.goals.state, id); this.query = ''; this.render(); this.host.scrollTop = 0; }
    perform(run: () => Promise<void>): Promise<void> {
        if (this.busy) return this.running || Promise.resolve();
        this.busy = true; this.status = ''; this.render();
        return this.running = run().catch(error => { this.status = error instanceof Error ? error.message : "Please try again."; }).finally(() => { this.busy = false; this.render(); });
    }
    async chooseImport(target?: string) {
        if (this.busy) return;
        if (window.auraDesktop) {
            try { const file = await chooseDesktopFile('book'); if (file) await this.importFile(file, target); }
            catch (error) { this.status = error instanceof Error ? error.message : "Could not open file"; this.render(); }
        } else { this.fileTarget = target; this.host.querySelector<HTMLInputElement>('#home-book-file')?.click(); }
    }
    async importFile(file: File, target?: string) {
        await this.perform(async () => { const id = await this.deps.coordinator.importBook(file, target); if (!id) throw new Error("Book import failed"); this.picking = null; await this.refresh(); });
        if (this.active) await this.refresh();
    }
    async open() {
        const nav = this.deps.goals.navigation, request = nav.begin();
        await this.deps.goals.assertWritesSaved(); await this.deps.finishAnnotations(); await this.refresh();
        if (!nav.isCurrent(request)) return;
        this.deps.beforeOpen(); this.area = 'library'; this.query = ''; this.filter = 'all'; this.picking = null;
        this.chosen = this.creating ? this.draftParent : null; nav.commit('home', request);
        try { await this.deps.goals.recoverBookIntents(); } catch (error) { this.status = error instanceof Error ? error.message : "Please retry linking the book."; this.render(); }
    }
    leave() { if (this.active && this.deps.currentBookId()) this.deps.goals.navigation.show('reader'); }
    async refresh() {
        const request = ++this.request;
        const books = await getAllBooksFromDB(); if (request !== this.request) return;
        this.books = books; this.render();
    }
    changed() { if (this.active) this.render(); }
    async prepareClose() { await this.running; await this.finishDraft(); }
    candidatesFor(id: string) {
        const state = this.deps.goals.state, priority = [this.deps.currentBookId()];
        for (const goal of goalAncestors(state, id)) {
            priority.push(...(state.bookLinks || []).filter(l => l.goalId === goal.id).map(l => l.bookId));
            priority.push(...state.links.filter(l => l.goalId === goal.id).map(l => l.bookId));
            if (goal.origin?.bookId) priority.push(goal.origin.bookId);
        }
        return [...new Set([...priority, ...this.books.map(b => b.id)])].map(id => this.books.find(b => b.id === id)).filter((b): b is Book => !!b);
    }
    render() {
        if (this.chosen && (!this.deps.goals.state.goals.some(g => g.id === this.chosen) || goalArea(this.deps.goals.state, this.chosen) !== this.area)) this.chosen = null;
        if (this.picking && goalArea(this.deps.goals.state, this.picking) !== 'library') this.picking = null;
        renderSurface(this.host, <HomeView home={this} />);
    }
}
