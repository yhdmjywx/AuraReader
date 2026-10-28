import type { Book } from '../../domain/book.js';
import type { GoalController } from './goalController.js';
import type { AppCoordinator } from '../../app/appCoordinator.js';
import { getAllBooksFromDB } from '../../infrastructure/bookRepository.js';
import { chooseDesktopFile } from '../../infrastructure/desktopFiles.js';
import { operationId } from '../../infrastructure/storageClient.js';
import { areaGoals, goalArea, goalPath, type GoalArea, type GoalFilter } from '../../domain/goalLifecycle.js';

interface HomeDependencies {
    goals: GoalController;
    coordinator: AppCoordinator;
    finishAnnotations(): Promise<void>;
    currentBookId(): string;
    beforeOpen(): void;
}
const element = <T extends keyof HTMLElementTagNameMap>(tag: T, text = '', className = '') => {
    const e = document.createElement(tag); e.textContent = text; e.className = className; return e;
};
function action(text: string, run: () => void, className = '') {
    const e = element('button', text, className); e.type = 'button'; e.addEventListener('click', run); return e;
}
function glyph(name: string) { const e = element('i', '', `ri-${name}`); e.setAttribute('aria-hidden','true'); return e; }

/** A separate reading-start surface. Existing GoalUI and reader DOM stay intact. */
export class GoalHome {
    active = false;
    private books: Book[] = [];
    private chosen: string | null = null;
    private picking: string | null = null;
    private busy = false;
    private running: Promise<void> | null = null;
    private request = 0;
    private readonly welcome: HTMLElement;
    private readonly work: HTMLElement;
    private readonly form: HTMLFormElement;
    private readonly draft: HTMLTextAreaElement;
    private readonly title: HTMLElement;
    private readonly folders: HTMLElement;
    private readonly folderSection: HTMLElement;
    private readonly bookSection: HTMLElement;
    private readonly path: HTMLElement;
    private readonly emptyBooks: HTMLElement;
    private readonly bookList: HTMLElement;
    private readonly candidates: HTMLElement;
    private readonly picker: HTMLElement;
    private readonly status: HTMLElement;
    private readonly file: HTMLInputElement;
    private fileTarget: string | undefined;
    private draftId = operationId();
    private draftParent: string | null = null;
    private draftError = false;
    private readonly continueButton: HTMLButtonElement;
    private area: GoalArea = 'library';
    private filter: GoalFilter = 'all';
    private query = '';

    constructor(readonly host: HTMLElement, readonly deps: HomeDependencies) {
        host.innerHTML = `
          <div class="goal-home-inner">
            <header class="goal-home-top"><nav aria-label="Goal location"><button id="home-root" class="home-icon" type="button" aria-label="Home" title="Home"><i class="ri-home-4-line" aria-hidden="true"></i></button><button id="home-up" class="home-icon" type="button" aria-label="Up one level" title="Up one level"><i class="ri-arrow-up-line" aria-hidden="true"></i></button><div id="home-path" class="home-path"></div></nav><button id="home-continue" class="home-resume" type="button"></button></header>
            <div class="home-heading"><h1 id="home-goal-title">Library</h1><div class="goal-home-actions"><button id="home-new-goal" class="home-icon" type="button" aria-label="New goal" title="New goal"><i class="ri-add-line" aria-hidden="true"></i></button><button id="home-library-import" class="home-icon" type="button" aria-label="Import a book" title="Import a book"><i class="ri-download-2-line" aria-hidden="true"></i></button><button id="home-add-book" class="home-icon home-book-add goal-home-primary" type="button" aria-label="Add book" title="Add book"><i class="ri-book-2-line" aria-hidden="true"></i><i class="ri-add-line" aria-hidden="true"></i></button></div></div>
            <div class="home-goal-tools"><nav class="goal-collections" aria-label="Goal collections"><button id="home-active" type="button">Library</button><button id="home-archive" type="button">Archive</button><button id="home-trash" type="button">Recently deleted</button></nav><div class="home-goal-filters"><input id="home-goal-search" type="search" aria-label="Search goals" placeholder="Search goals"><select id="home-goal-filter" class="goal-filter" aria-label="Filter goals by completion"><option value="all">All goals</option><option value="ongoing">In progress</option><option value="completed">Completed</option></select></div></div>
            <section id="home-welcome"><p>A book, a question, a place to begin.</p><div class="goal-home-actions"><button id="home-start-goal" type="button">Create a goal</button><button id="home-start-import" class="goal-home-primary" type="button">Import a book</button></div></section>
            <section id="home-work">
              <section id="home-folder-section"><h2>Goals</h2><div id="home-goal-folders" class="home-goal-folders"></div></section>
              <section id="home-book-section"><h2>Books</h2><ul id="home-books" class="home-book-grid" aria-label="Books"></ul><p id="home-books-empty" class="home-empty"></p></section>
              <section id="home-materials" hidden><h2>Linked notes and highlights</h2><div id="home-material-list"></div></section>
            </section>
            <form id="home-goal-form" hidden><label for="home-goal-draft">New goal</label><textarea id="home-goal-draft" rows="2" placeholder="Your goal, in your own words"></textarea><div class="goal-home-actions"><button class="goal-home-primary" type="submit">Create</button><button id="home-cancel-goal" type="button">Cancel</button></div></form>
            <section id="home-picker" hidden aria-label="Choose a book"><div class="home-picker-heading"><h2>Add a book</h2><div class="goal-home-actions"><button id="home-import-book" type="button">Import a book</button><button id="home-cancel-picker" class="home-icon" type="button" aria-label="Close book picker" title="Close"><i class="ri-close-line" aria-hidden="true"></i></button></div></div><ul id="home-book-candidates" class="goal-home-books"></ul></section>
            <p id="home-status" role="status" aria-live="polite"></p><button id="home-retry" type="button" hidden>Retry</button>
            <input id="home-book-file" type="file" accept=".epub,.txt" hidden>
          </div>`;
        const get = <T extends HTMLElement>(id: string) => host.querySelector<T>('#' + id)!;
        this.welcome = get('home-welcome'); this.work = get('home-work'); this.form = get('home-goal-form'); this.draft = get('home-goal-draft');
        this.title = get('home-goal-title'); this.bookList = get('home-books');
        this.folders = get('home-goal-folders'); this.folderSection = get('home-folder-section'); this.bookSection = get('home-book-section'); this.path = get('home-path'); this.emptyBooks = get('home-books-empty');
        this.picker = get('home-picker'); this.candidates = get('home-book-candidates'); this.status = get('home-status'); this.file = get('home-book-file');
        this.continueButton = get('home-continue');
        try {
            const saved = localStorage.getItem('aura_goal_home_draft');
            if (saved) {
                const draft = JSON.parse(saved); if (!draft.id || typeof draft.text !== 'string') throw new Error('Invalid Goal draft');
                this.draftId = draft.id; this.draftParent = draft.parentId || null; this.draft.value = draft.text; this.form.hidden = false;
            }
        } catch { this.draftError = true; this.status.textContent = 'The saved Goal draft could not be read. Please keep your local data.'; }
        this.draft.addEventListener('input', () => {
            try { localStorage.setItem('aura_goal_home_draft', JSON.stringify({ id: this.draftId, parentId: this.draftParent, text: this.draft.value })); }
            catch { this.status.textContent = 'The draft could not be saved. Please keep this page open.'; }
        });
        const on = (id: string, run: () => void) => get(id).addEventListener('click', run);
        on('home-start-goal', () => this.showCreate()); on('home-new-goal', () => this.showCreate());
        on('home-start-import', () => { void this.chooseImport(); });
        on('home-library-import', () => { void this.chooseImport(); });
        on('home-root', () => this.showArea('library'));
        on('home-up', () => { const parent = deps.goals.state.goals.find(g => g.id === this.chosen)?.parentId; this.navigate(parent && goalArea(deps.goals.state, parent) === this.area ? parent : null); });
        on('home-active', () => this.showArea('library')); on('home-archive', () => this.showArea('archive')); on('home-trash', () => this.showArea('trash'));
        get<HTMLInputElement>('home-goal-search').addEventListener('input', event => { this.query = (event.target as HTMLInputElement).value; this.render(); });
        get<HTMLSelectElement>('home-goal-filter').addEventListener('change', event => { this.filter = (event.target as HTMLSelectElement).value as GoalFilter; this.render(); });
        on('home-add-book', () => { if (this.chosen) { this.picking = this.chosen; this.render(); get('home-import-book').focus(); } });
        on('home-cancel-picker', () => { this.picking = null; this.render(); get('home-add-book').focus(); });
        on('home-import-book', () => { void this.chooseImport(this.picking || undefined); });
        on('home-cancel-goal', () => { this.clearDraft(); this.render(); (this.welcome.hidden ? get('home-new-goal') : get('home-start-goal')).focus(); });
        on('home-continue', () => { this.leave(); deps.goals.useReadingSurface(); });
        on('home-retry', () => { void this.perform(async () => { await deps.goals.initialize(); await deps.goals.assertWritesSaved(); await deps.goals.recoverBookIntents(); this.picking = null; await this.refresh(); }); });
        this.form.addEventListener('submit', event => {
            event.preventDefault(); if (!this.draft.value.trim() || this.busy) { this.draft.focus(); return; }
            let created: string | undefined;
            void this.perform(async () => { created = await this.finishDraft(); }).then(()=>{
                if (created) [...this.folders.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.dataset.goalId===created)?.focus();
            });
        });
        this.file.addEventListener('change', () => {
            const selected = this.file.files?.[0], target = this.fileTarget; this.file.value = '';
            if (selected) void this.importFile(selected, target);
        });
        host.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.picking && !this.busy) { event.preventDefault(); this.picking = null; this.render(); get('home-add-book').focus(); }
        });
    }

    private showCreate() { if (this.draftError || this.area !== 'library') return; if (this.form.hidden) this.draftParent = this.chosen; this.picking = null; this.form.hidden = false; this.render(); this.draft.focus(); }
    private clearDraft() { localStorage.removeItem('aura_goal_home_draft'); this.form.hidden = true; this.draft.value = ''; this.draftId = operationId(); this.draftParent = null; }
    async finishDraft() {
        if (!this.form.hidden && this.draft.value.trim()) {
            const selected = this.deps.goals.selected;
            let id: string;
            try { id = await this.deps.goals.createGoal(this.draft.value, this.draftParent, this.draftId); }
            finally { if (selected) this.deps.goals.selectGoal(selected); else this.deps.goals.goHome(); }
            this.chosen = this.draftParent; this.clearDraft(); return id;
        }
    }
    showArea(area: GoalArea) { if (!this.form.hidden) return; this.area = area; this.chosen = null; this.picking = null; this.query = ''; this.filter = 'all'; this.render(); this.host.scrollTop = 0; }
    navigate(goalId: string | null) { if (!this.form.hidden) return; this.chosen = goalId; if (goalId) this.area = goalArea(this.deps.goals.state, goalId); this.picking = null; this.query = ''; this.render(); this.host.scrollTop = 0; }
    private perform(run: () => Promise<void>): Promise<void> {
        if (this.busy) return this.running || Promise.resolve(); this.busy = true; this.status.textContent = ''; this.render();
        const task = (async () => {
            try { await run(); }
            catch (error) { this.status.textContent = error instanceof Error ? error.message : 'Please try again'; }
            finally { this.busy = false; this.render(); }
        })();
        this.running = task; return task;
    }
    private async chooseImport(target?: string) {
        if (this.busy) return;
        if (window.auraDesktop) {
            try { const file = await chooseDesktopFile('book'); if (file) await this.importFile(file, target); }
            catch (error) { this.status.textContent = error instanceof Error ? error.message : 'Could not open the file'; }
        } else { this.fileTarget = target; this.file.click(); }
    }
    async importFile(file: File, target?: string) {
        await this.perform(async () => {
            const id = await this.deps.coordinator.importBook(file, target);
            if (!id) throw new Error('The book could not be imported. Please try again.');
            this.picking = null; await this.refresh();
        });
        // A saved book is still visible in the picker if only its Goal association failed.
        if (this.active) await this.refresh().catch(() => {});
    }
    async open() {
        await this.deps.goals.finishInlineEdit(); await this.deps.finishAnnotations();
        this.deps.beforeOpen(); this.active = true; this.host.hidden = false; this.deps.goals.setHomeHidden(true);
        this.area = 'library'; this.query = ''; this.filter = 'all';
        this.chosen = this.form.hidden ? null : this.draftParent; await this.refresh();
        try { await this.deps.goals.recoverBookIntents(); } catch (error) { this.status.textContent = error instanceof Error ? error.message : 'Book association needs a retry'; this.render(); }
    }
    leave() { if (!this.active) return; this.active = false; this.request++; this.picking = null; this.host.hidden = true; this.deps.goals.setHomeHidden(false); }
    async refresh() {
        const request = ++this.request;
        try { const books = await getAllBooksFromDB(); if (request !== this.request) return; this.books = books; this.render(); }
        catch (error) { if (request === this.request) { this.status.textContent = error instanceof Error ? error.message : 'Could not load books'; this.render(); } throw error; }
    }
    changed() { if (this.active) this.render(); }
    async prepareClose() { await this.running; await this.finishDraft(); }
    private candidatesFor(goalId: string) {
        const state = this.deps.goals.state, priority: string[] = [this.deps.currentBookId()];
        let goal = state.goals.find(g => g.id === goalId);
        const seen = new Set<string>();
        while (goal && !seen.has(goal.id)) {
            seen.add(goal.id);
            priority.push(...(state.bookLinks || []).filter(l => l.goalId === goal!.id).map(l => l.bookId));
            priority.push(...state.links.filter(l => l.goalId === goal!.id).map(l => l.bookId));
            if (goal.origin?.bookId) priority.push(goal.origin.bookId);
            goal = state.goals.find(g => g.id === goal!.parentId);
        }
        return [...new Set([...priority, ...this.books.map(b => b.id)])].map(id => this.books.find(b => b.id === id)).filter((b): b is Book => !!b);
    }
    private render() {
        if (!this.active) return;
        const goals = this.deps.goals.state.goals;
        const state = this.deps.goals.state;
        if (!goals.some(g => g.id === this.chosen) || (this.chosen && goalArea(state, this.chosen) !== this.area)) this.chosen = null;
        if (this.picking && goalArea(state, this.picking) !== 'library') this.picking = null;
        const creating = !this.form.hidden, unavailable = this.deps.goals.disabled || this.deps.goals.lifecycleBusy, readOnly = this.area !== 'library';
        const firstUse = !goals.length && !this.books.length && !this.chosen && !readOnly;
        this.welcome.hidden = !firstUse || creating || !!this.picking;
        this.work.hidden = firstUse || creating || !!this.picking;
        this.continueButton.hidden = !this.deps.currentBookId();
        const reading = this.books.find(b=>b.id===this.deps.currentBookId());
        this.continueButton.replaceChildren(glyph('play-line'),element('span',reading?.title || 'Continue reading'));
        this.continueButton.title = `Continue reading${reading ? ': '+reading.title : ''}`;
        this.continueButton.setAttribute('aria-label',this.continueButton.title);
        const current = goals.find(g => g.id === this.chosen);
        this.title.textContent = current?.text || (this.area === 'archive' ? 'Archive' : this.area === 'trash' ? 'Recently deleted' : 'Library');
        this.title.parentElement!.querySelector('.home-current-actions')?.remove();
        if (current) {
            const tools = element('div', '', 'home-current-actions');
            if (current.completedAt) tools.append(element('span', '✓ Completed', 'goal-completion'));
            const more = action('⋯', () => this.deps.goals.actions.open(current.id, more), 'home-icon'); more.setAttribute('aria-label', 'Goal actions'); more.setAttribute('aria-haspopup', 'menu');
            tools.append(more); this.title.parentElement!.insertBefore(tools, this.title.nextSibling);
            this.title.oncontextmenu = event => { event.preventDefault(); this.deps.goals.actions.open(current.id, more, { x: event.clientX, y: event.clientY }); };
        } else this.title.oncontextmenu = null;
        const get = (id: string) => this.host.querySelector<HTMLButtonElement>('#'+id)!;
        get('home-root').dataset.unavailable = String(!this.chosen && this.area === 'library');
        get('home-root').setAttribute('aria-current',this.chosen || readOnly ? 'false' : 'page');
        get('home-up').dataset.unavailable = String(!this.chosen);
        get('home-new-goal').hidden = readOnly || firstUse || creating || !!this.picking;
        get('home-add-book').hidden = readOnly || !this.chosen || creating || !!this.picking;
        get('home-library-import').hidden = readOnly || !!this.chosen || firstUse || creating;
        for (const [id, area] of [['home-active','library'],['home-archive','archive'],['home-trash','trash']]) get(id).setAttribute('aria-current', String(this.area === area ? 'page' : 'false'));
        this.host.querySelector<HTMLInputElement>('#home-goal-search')!.value = this.query;
        this.host.querySelector<HTMLSelectElement>('#home-goal-filter')!.value = this.filter;
        this.host.querySelector<HTMLElement>('.home-goal-tools')!.hidden = creating || !!this.picking;
        const ancestors: HTMLElement[] = [], seen = new Set<string>();
        let ancestor = goals.find(g=>g.id===this.chosen)?.parentId;
        while (ancestor && !seen.has(ancestor)) {
            seen.add(ancestor); const goal = goals.find(g=>g.id===ancestor); if (!goal) break;
            if (goalArea(state, goal.id) === this.area) { const id = goal.id, crumb = action(goal.text,()=>this.navigate(id)); crumb.title = goal.text; ancestors.unshift(crumb); } ancestor = goal.parentId;
        }
        this.path.replaceChildren(...ancestors);
        const children = areaGoals(state, this.area, this.chosen, this.query, this.filter);
        this.folderSection.hidden = false;
        this.folders.replaceChildren(...children.map(goal=>{
            const button = action('',()=>this.navigate(goal.id),'home-goal-folder');button.dataset.goalId = goal.id;
            button.title = goal.text;button.setAttribute('aria-label',`Open goal: ${goal.text}`);
            const label = element('span',goal.text);
            if (readOnly || this.query) label.append(element('small',goalPath(state, goal.id),'goal-original-path'));
            button.append(glyph(goal.completedAt ? 'checkbox-circle-line' : 'folder-line'),label,glyph('arrow-right-s-line'));
            const row = element('div','','home-goal-row'), more = action('⋯',()=>this.deps.goals.actions.open(goal.id,more),'home-icon');
            more.setAttribute('aria-label',`Actions for ${goal.text}`); more.setAttribute('aria-haspopup','menu');
            row.addEventListener('contextmenu',event=>{event.preventDefault();this.deps.goals.actions.open(goal.id,more,{x:event.clientX,y:event.clientY});});
            row.append(button,more);return row;
        }));
        if (!children.length) this.folders.append(element('p', this.query ? 'No matching goals.' : readOnly && !this.chosen ? this.area === 'archive' ? 'Archived goals will appear here.' : 'Deleted goals will appear here. Nothing is removed automatically.' : 'No goals in this view.', 'home-empty'));
        const own = (this.deps.goals.state.bookLinks || []).filter(l => l.goalId === this.chosen);
        const entries = this.chosen ? own.map(link=>({book:this.books.find(b=>b.id===link.bookId),id:link.bookId,goalId:link.goalId}))
            : this.books.map(book=>({book,id:book.id,goalId:null}));
        this.bookList.setAttribute('aria-label',this.chosen ? 'Books added to this goal' : 'All books');
        this.emptyBooks.hidden = !!entries.length;
        this.emptyBooks.textContent = this.chosen ? 'Add a book to read for this goal.' : 'Import a book to start reading.';
        this.bookSection.hidden = false;
        this.bookList.replaceChildren(...entries.map(({book,id,goalId:owner}) => {
            const row = element('li','', 'home-book-card');
            const open = action('', () => {
                const goalId = this.chosen;
                void this.perform(async () => {
                    if (goalId && this.area === 'library') this.deps.goals.selectGoal(goalId);
                    else this.deps.goals.goHome();
                    await this.deps.coordinator.openBook(id);
                });
            }, 'goal-home-book');
            const cover = element('span','','home-book-cover');cover.append(glyph('book-2-line'));
            const name = book?.title || 'Book unavailable';
            open.append(cover,element('span',name,'home-book-title'),element('span',book ? book.format || 'EPUB' : '','home-book-meta'));
            open.title = name; open.setAttribute('aria-label',`Read: ${name}`);
            open.disabled = !book;
            open.dataset.unavailable = String(!book);
            row.append(open);
            if (owner && !readOnly) {
                const remove = action('', () => { void this.perform(async () => { await this.deps.goals.removeBook(owner,id); }); },'home-book-remove home-icon');
                remove.append(glyph('link-unlink-m'));remove.title = 'Remove from goal';remove.setAttribute('aria-label',`Remove ${name} from goal`);row.append(remove);
            }
            return row;
        }));
        this.bookSection.hidden = readOnly && !this.chosen;
        const materials = this.host.querySelector<HTMLElement>('#home-materials')!;
        materials.hidden = !readOnly || !this.chosen;
        this.host.querySelector<HTMLElement>('#home-material-list')!.replaceChildren(...(this.chosen ? this.deps.goals.materialEntries(this.chosen).map(({link, annotation, title}) => {
            const row = element('div','','goal-item');
            const open = action(annotation ? annotation.kind === 'note' ? annotation.comment : annotation.quote : 'Source unavailable',()=>{void this.deps.goals.jumpMaterial(link).catch(error=>{this.status.textContent=error.message;});},'goal-item-text');
            open.disabled = !annotation; open.dataset.unavailable = String(!annotation); row.append(open,element('small',title,'goal-item-source'));return row;
        }) : []));
        this.picker.hidden = !this.picking;
        if (this.picking) {
            const target = this.picking;
            this.candidates.replaceChildren(...this.candidatesFor(target).map(book => {
                const row = element('li'), added = (this.deps.goals.state.bookLinks || []).some(l => l.goalId === target && l.bookId === book.id);
                row.append(element('span', book.title));
                const add = action(added ? 'Added' : 'Add', () => {
                    void this.perform(async () => { await this.deps.goals.addBook(target, book.id); this.picking = null; }).then(()=>this.host.querySelector<HTMLButtonElement>('#home-add-book')?.focus());
                });
                add.disabled = added; add.dataset.added = String(added); row.append(add); return row;
            }));
        }
        const retry = this.host.querySelector<HTMLButtonElement>('#home-retry')!;
        const error = this.deps.goals.saveError;
        if (!this.deps.goals.lifecycleBusy && error && !this.status.textContent) this.status.textContent = error instanceof Error ? error.message : 'Goal changes need a retry.';
        retry.hidden = !this.deps.goals.disabled && !this.status.textContent;
        if (this.deps.goals.disabled && !this.status.textContent) this.status.textContent = 'Goals are unavailable. You can retry or import a book to keep reading.';
        if (this.draftError && !this.status.textContent) this.status.textContent = 'The saved Goal draft could not be read. Please keep your local data.';
        for (const control of this.host.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>('button,textarea,input,select')) {
            if (['home-start-import','home-library-import','home-continue','home-retry'].includes(control.id) || (!this.chosen && control.classList.contains('goal-home-book'))) control.disabled = this.busy || control.dataset.unavailable === 'true';
            else control.disabled = this.busy || unavailable || control.dataset.added === 'true' || control.dataset.unavailable === 'true'
                || (creating && (!!control.closest('nav') || control.id === 'home-new-goal'))
                || (this.draftError && ['home-start-goal', 'home-new-goal'].includes(control.id));
        }
        this.host.setAttribute('aria-busy', String(this.busy));
    }
}
