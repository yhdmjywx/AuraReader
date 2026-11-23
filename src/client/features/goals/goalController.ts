import type { GoalLibraryRecord } from '../../../shared/storage.js';
import type { Annotation } from '../../domain/annotation.js';
import type { Goal, GoalDraft, GoalLibraryState, GoalSourceLink, GoalInputDraft } from '../../domain/goal.js';
import { addGoalInput, changeGoalInput, deleteGoalInput, addGoalSource, normalizeGoalContent } from '../../domain/goalContentEngine.js';
import { responseContent, responseTargetKey, setGoalResponse, type GoalResponseTarget } from '../../domain/goalContentEngine.js';
import { onResponseWrite, type ResponseWriteIntent } from '../../infrastructure/goalLibraryRepository.js';
import { inputDrafts, storeInputDraft, discardInputDraft } from '../../infrastructure/goalLibraryRepository.js';
import type { AppElements } from '../../app/elements.js';
import type { ShowToast } from '../../app/contracts.js';
import type { ReadingLocation } from '../../domain/book.js';
import { addGoal, changeGoal, goalOrigin } from '../../domain/goalEngine.js';
import { normalizeAnnotation } from '../../domain/annotationEngine.js';
import { bookVersion, cachedGoalLibrary, readBookSummaries, onGoalLibraryChanged, operationId } from '../../infrastructure/storageClient.js';
import { stageLibrary, rebaseUnsentInlineEdit, flushLibrary, loadGoalLibrary, loadGoalMaterials, pendingLibrary, libraryDrafts, storeLibraryDraft, discardLibraryDraft } from '../../infrastructure/goalLibraryRepository.js';
import { pendingBookIntents, stageBookIntent, acknowledgeBookIntent } from '../../infrastructure/goalLibraryRepository.js';
import { GoalUI } from './goalUI.js';
import { GoalSidebar, positionGoals } from './goalLayout.js';
import { goalBranch, goalEditable, operateGoal, type GoalArea, type GoalOperation } from '../../domain/goalLifecycle.js';
import { GoalActions } from './goalActions.js';
import { AppNavigation } from '../../app/navigation.js';
export interface GoalCallbacks {
    getAnnotations(): Annotation[]; getLocation(): ReadingLocation; getMode(): string;
    showToast: ShowToast; jump(id: string, source?: GoalSourceLink): void | Promise<void>;
    finishAnnotations(): Promise<void>; annotationsSaved(): Promise<void>; onEnterGoalPage?(): void;
    onActionsChanged?(): void; onBeforeSidebarResize?(): void; onSurfaceChanged?(): void; chooseBook?(): void;
    openCollection?(area: GoalArea): void;
}
export type InputEdit = ({ mode: 'input-new' } | { mode: 'input-edit' }) & { draft: GoalInputDraft; lastNonempty: string };
export interface ResponseSaveState extends ResponseWriteIntent { status: 'saving' | 'error'; dismissed: boolean }
export class GoalController {
    private listeners = new Set<() => void>();
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    state: GoalLibraryState = { goals: [], links: [] };
    selected: string | null = null; allGoals = true;
    edit: { mode: 'root' | 'child' | 'edit'; draft: GoalDraft; lastNonempty: string; previousTree: boolean } | InputEdit | null = null;
    private changedInputs = new Set<string>();
    private errorDismissed = false;
    private responseWrites = new Map<string, ResponseSaveState>();
    disabled = true; visible = false;
    get page() { return this.navigation.surface === 'goal'; }
    elements: AppElements | null = null; ui: GoalUI | null = null; sidebar: GoalSidebar | null = null;
    private dirty = false;
    private dirtyBase = 0;
    private serial = 0; private stagedSerial = -1;
    private linksInFlight = new Set<Promise<void>>(); private timer: ReturnType<typeof setTimeout> | null = null;
    private failure: unknown; private ready: Promise<void> | null = null;
    get saveError() { return this.failure; }
    private externalPending: GoalLibraryRecord | null = null;
    private materialRequest = 0; private materials: Annotation[] = []; private titles = new Map<string, string>();
    private materialStatus: 'ready' | 'loading' | 'error' = 'ready';
    lifecycleBusy = false;
    undoChange: { before: Goal[]; after: Goal[]; message: string } | null = null;
    private actionUI: GoalActions | null = null;
    get actions() { return this.actionUI ||= new GoalActions(this); }
    constructor(readonly callbacks: GoalCallbacks, readonly navigation = new AppNavigation()) {
        onResponseWrite((intents, error) => {
            for (const intent of intents) {
                const key = responseTargetKey(intent.target), latest = this.responseWrites.get(key);
                if (latest?.id !== intent.id) continue;
                if (error) this.responseWrites.set(key, { ...latest, status: 'error', dismissed: false });
                else this.responseWrites.delete(key);
            }
            this.render();
        });
        navigation.subscribe(() => { this.updateReadingContext(); this.callbacks.onSurfaceChanged?.(); });
        onGoalLibraryChanged((record, external) => {
            if (record.deleted) return;
            if (external) { this.receiveExternal(record, external.previous); return; }
            if (this.dirty || this.edit || pendingLibrary().length || inputDrafts().length) { this.disabled = true; this.fail(Object.assign(new Error("Goal data has changed. Unsaved content is preserved. Reload to resolve the conflict."), { status: 409 })); }
            else { this.state = normalizeGoalContent(record.value); this.ensureSelection(); this.refreshMaterials(); }
            this.render();
        });
    }
    private receiveExternal(record: GoalLibraryRecord, previous?: GoalLibraryRecord) {
        if (record.deleted) return;
        const remote = normalizeGoalContent(record.value);
        const confirmed = previous && !previous.deleted ? normalizeGoalContent(previous.value) : this.state;
        const edit = this.edit;
        const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
        if (edit && edit.mode !== 'root') {
            const goalId = edit.mode === 'input-new' || edit.mode === 'input-edit' ? edit.draft.goalId
                : edit.mode === 'child' ? edit.draft.parentId : edit.draft.id;
            const extract = (state: GoalLibraryState) => edit.mode === 'input-edit'
                ? state.inputs?.find(item => item.id === edit.draft.id)
                : edit.mode === 'edit' ? state.goals.find(item => item.id === edit.draft.id) : null;
            if (!goalEditable(remote, goalId) || !same(extract(confirmed), extract(remote))) {
                this.disabled = true;
                this.fail(Object.assign(new Error("This Goal or its text changed. Your input is preserved locally. Reload to resolve the conflict."), { status: 409 }));
                return;
            }
            if (this.dirty && previous && (edit.mode === 'edit' || edit.mode === 'input-edit')) {
                // Merge only the edited row when it is the entire unsent change.
                // A dispatched command keeps the revision and body it was sent with.
                const local = extract(this.state);
                const field = edit.mode === 'edit' ? 'goals' : 'inputs';
                const baselineItems = confirmed[field] || [];
                const localItems = this.state[field] || [];
                const revisedBaseline = { ...confirmed, [field]: baselineItems.map(item => item.id === edit.draft.id ? local : item) };
                if (local && localItems.some(item => item.id === local.id) && same(revisedBaseline, this.state)) {
                    const merged = { ...remote, [field]: (remote[field] || []).map(item => item.id === local.id ? local : item) };
                    if (rebaseUnsentInlineEdit(previous.revision, record.revision, merged)) {
                        this.dirtyBase = record.revision;
                        this.installExternal(merged); return;
                    }
                }
            }
        }
        if (this.dirty || pendingLibrary().length) { this.externalPending = record; return; }
        this.installExternal(remote);
    }
    private installExternal(state: GoalLibraryState) {
        this.state = state;
        this.undoChange = null;
        if (this.selected && !goalEditable(this.state, this.selected)) this.ensureSelection();
        void this.refreshMaterials();
    }
    initialize(): Promise<void> {
        if (this.ready) return this.ready;
        this.ready = (async () => {
            const loaded = await loadGoalLibrary();
            this.state = loaded.state; this.dirty = loaded.pending; this.disabled = !!loaded.error; this.failure = undefined;
            this.responseWrites.clear();
            for (const entry of pendingLibrary()) for (const intent of entry.responseIntents || [])
                this.responseWrites.set(responseTargetKey(intent.target), { ...intent, status: loaded.error ? 'error' : 'saving', dismissed: false });
            try { this.selected = localStorage.getItem('aura_selected_goal'); } catch { /* Optional selection. */ }
            this.ensureSelection(); this.resumeDraft();
            if (loaded.error) throw loaded.error;
            await this.refreshMaterials(); this.render();
        })().catch(error => { this.disabled = true; this.ready = null; this.fail(error); this.render(); });
        return this.ready;
    }
    private ensureSelection() { if (!goalEditable(this.state, this.selected)) { this.selected = null; this.rememberSelection(); } this.allGoals = this.selected === null; }
    private rememberSelection() { try { if (this.selected) localStorage.setItem('aura_selected_goal', this.selected); else localStorage.removeItem('aura_selected_goal'); } catch { /* Optional UI state. */ } }
    initUI(elements: AppElements) {
        this.elements = elements;
        if (elements.goalPanel) this.ui = new GoalUI(elements.goalPanel, {
            select: id => this.selectGoal(id), home: () => this.goHome(), up: () => this.goUp(), create: () => this.beginNew(),
            menu: (id, anchor, point) => this.actions.open(id, anchor, point),
            expand: () => { this.openPage().catch(() => {}); },
            edit: (mode, id) => this.beginEdit(mode, id), input: text => this.updateDraft(text),
            finish: () => { this.finishInlineEdit().catch(() => {}); },
            addInput: () => this.beginInput(), editInput: id => this.beginInput(id), deleteInput: id => this.removeInput(id),
            retry: () => { this.finishInlineEdit().then(() => this.render()).catch(() => this.render()); },
            dismissError: () => { this.errorDismissed = true; this.render(); },
            setResponse: (target, marked) => this.setResponse(target, marked),
            retryResponse: target => { this.retryResponse(target).catch(() => {}); },
            dismissResponseError: target => {
                const key = responseTargetKey(target), current = this.responseWrites.get(key);
                if (current) this.responseWrites.set(key, { ...current, dismissed: true }); this.render();
            },
            unlink: id => { if (!goalEditable(this.state, this.selected) || this.lifecycleBusy) return; this.endEdit(); this.persist({ ...this.state, links: this.state.links.filter(l => l.goalId !== this.selected || l.annotationId !== id) }); this.render(); this.ui?.announce('Item unlinked from goal'); },
            jump: id => { this.endEdit(); const source = this.state.links.find(l => l.goalId === this.selected && l.annotationId === id); Promise.resolve(this.callbacks.jump(id, source)).catch(error => this.fail(error)); }
        });
        if (elements.goalSidebar) this.sidebar = new GoalSidebar({ ...elements, btnGoals: elements.btnGoalSidebar }, () => this.updateReadingContext(), () => this.finishInlineEdit(), () => this.callbacks.onBeforeSidebarResize?.());
        elements.btnGoalBack?.addEventListener('click', () => { this.returnToReader().catch(() => {}); }); this.updateReadingContext();
    }
    async openPage() {
        const request = this.navigation.begin();
        await this.callbacks.finishAnnotations(); await this.callbacks.annotationsSaved();
        await this.assertWritesSaved(); await this.initialize();
        if (!this.navigation.isCurrent(request)) return;
        this.callbacks.onBeforeSidebarResize?.();
        this.navigation.commit('goal', request);
        this.callbacks.onEnterGoalPage?.();
    }
    async returnToReader() {
        const request = this.navigation.begin();
        await this.assertWritesSaved(); await this.callbacks.finishAnnotations(); await this.callbacks.annotationsSaved();
        if (!this.navigation.isCurrent(request)) return;
        if (this.navigation.returnTarget === 'home' || !this.callbacks.getLocation().bookId) {
            if (this.callbacks.chooseBook) this.callbacks.chooseBook();
            else this.navigation.commit('home', request);
        } else this.navigation.commit('reader', request);
    }
    useReadingSurface() { this.navigation.show(this.callbacks.getLocation().bookId ? 'reader' : 'home'); }
    async bookChanged() { this.updateReadingContext(); await this.refreshMaterials(); }
    selectGoal(id: string) { if (!goalEditable(this.state, id)) return; this.endEdit(); this.selected = id; this.rememberSelection(); this.allGoals = false; this.render(); }
    goHome() { this.endEdit(); this.selected = null; this.allGoals = true; this.rememberSelection(); this.render(); }
    goUp() { const parent = this.state.goals.find(g => g.id === this.selected)?.parentId; if (parent) this.selectGoal(parent); else this.goHome(); }
    beginNew() {
        const parentId = this.allGoals ? null : this.selected;
        this.endEdit(); this.selected = parentId; this.allGoals = !parentId; this.rememberSelection();
        this.beginEdit(parentId ? 'child' : 'root');
    }
    beginEdit(mode: 'root' | 'child' | 'edit', id?: string) {
        if (this.disabled || this.lifecycleBusy) return; this.endEdit(); const goal = this.state.goals.find(g => g.id === (mode === 'edit' ? id ?? this.selected : this.selected)); if (mode !== 'root' && (!goal || !goalEditable(this.state, goal.id))) return;
        const location = this.callbacks.getLocation();
        const draft: GoalDraft = mode === 'edit' ? { id: goal!.id, parentId: goal!.parentId, text: goal!.text, origin: goal!.origin }
            : { id: operationId(), parentId: mode === 'child' ? goal!.id : null, text: '', origin: !this.page && location.bookId ? { ...goalOrigin(location.page, location.sectionId, location.chapter), bookId: location.bookId } : null };
        this.edit = { mode, draft, lastNonempty: draft.text, previousTree: this.allGoals }; if (mode === 'root') this.allGoals = true; this.render(); this.ui?.focusEditor();
    }
    updateDraft(text: string) {
        const edit = this.edit; if (!edit) return; edit.draft.text = text; if (text.trim()) edit.lastNonempty = text;
        if (this.disabled && this.failure) {
            try {
                if ('goalId' in edit.draft) storeInputDraft(edit.draft);
                else storeLibraryDraft({ draft: edit.draft });
            } catch (error) { this.fail(error); }
            return;
        }
        if (edit.mode === 'input-new' || edit.mode === 'input-edit') {
            try {
                storeInputDraft({ ...edit.draft, text: text.trim() ? text : edit.mode === 'input-edit' ? edit.lastNonempty : '' });
                if (edit.mode === 'input-edit' && text.trim()) { this.changedInputs.add(edit.draft.id); this.persist(changeGoalInput(this.state, edit.draft.goalId, edit.draft.id, text)); }
            } catch (error) { this.changedInputs.add(edit.draft.id); this.fail(error); }
            return;
        }
        if (edit.mode === 'edit') { if (text.trim()) this.persist(changeGoal(this.state, edit.draft.id, text)); }
        else try { storeLibraryDraft({ ...(libraryDrafts().find(d => d.draft.id === edit.draft.id) || {}), draft: edit.draft }); } catch (error) { this.fail(error); }
    }
    private endEdit() {
        const edit = this.edit; if (!edit) return; if (this.ui?.editingText !== undefined) this.updateDraft(this.ui.editingText); this.edit = null; this.ui?.releaseEditorFocus();
        if (this.disabled && this.failure) { this.render(); return; }
        if (edit.mode === 'input-new' || edit.mode === 'input-edit') {
            const text = edit.draft.text.trim() ? edit.draft.text : edit.mode === 'input-edit' ? edit.lastNonempty : '';
            if (text.trim()) {
                this.changedInputs.add(edit.draft.id);
                this.persist(edit.mode === 'input-new' ? addGoalInput(this.state, { ...edit.draft, text }) : changeGoalInput(this.state, edit.draft.goalId, edit.draft.id, text));
            } else discardInputDraft(edit.draft.id);
            this.render(); return;
        }
        if (edit.mode === 'edit') this.persist(changeGoal(this.state, edit.draft.id, edit.draft.text.trim() ? edit.draft.text : edit.lastNonempty));
        else if (edit.draft.text.trim()) { this.persist(addGoal(this.state, edit.draft)); this.selected = edit.draft.parentId; this.rememberSelection(); this.allGoals = !this.selected; }
        else { discardLibraryDraft(edit.draft.id); this.allGoals = edit.previousTree; } this.render();
    }
    private resumeDraft() {
        if (this.edit) return;
        for (const draft of inputDrafts()) {
            const existing = this.state.inputs?.find(i => i.id === draft.id);
            if (existing && existing.goalId !== draft.goalId) throw new Error('The recovered text belongs to another goal.');
            if (existing?.text === draft.text) continue; // Keep the draft until its matching ACK.
            if (!goalEditable(this.state, draft.goalId)) throw new Error('Restore the goal before recovering its text. The draft is preserved.');
            this.edit = { mode: existing ? 'input-edit' : 'input-new', draft, lastNonempty: draft.text };
            this.selected = draft.goalId; this.allGoals = false; return;
        }
        for (const item of libraryDrafts()) {
            const existing = this.state.goals.find(g => g.id === item.draft.id);
            if (existing) { if (existing.text === item.draft.text) { discardLibraryDraft(existing.id); continue; } throw new Error("The recovered goal draft conflicts with existing content."); }
            if (item.draft.parentId && !this.state.goals.some(g => g.id === item.draft.parentId)) throw new Error("The recovered goal draft has no parent.");
            this.edit = { mode: item.draft.parentId ? 'child' : 'root', draft: item.draft, lastNonempty: item.draft.text, previousTree: false }; this.allGoals = !item.draft.parentId; if (item.draft.parentId) this.selected = item.draft.parentId; break;
        }
    }
    async finishInlineEdit(): Promise<void> { this.endEdit(); await this.flush(); await Promise.all([...this.linksInFlight]); this.resumeDraft(); this.render(); }
    private persist(state: GoalLibraryState) {
        if (state === this.state) return;
        if (!this.dirty) this.dirtyBase = cachedGoalLibrary()?.revision || 0;
        this.undoChange = null; this.state = state; this.dirty = true; this.serial++;
        try { stageLibrary(state, [...this.responseWrites.values()], this.dirtyBase); this.stagedSerial = this.serial; } catch (error) { this.fail(error); }
        if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.flush().catch(() => {}); }, 250); this.callbacks.onActionsChanged?.();
    }
    async flush() {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; } const serial = this.serial;
        if (this.disabled && this.failure && (this.dirty || pendingLibrary().length || libraryDrafts().length || inputDrafts().length)) throw this.failure;
        try { if (this.dirty && this.stagedSerial !== serial) { stageLibrary(this.state, [...this.responseWrites.values()], this.dirtyBase); this.stagedSerial = serial; } if (pendingLibrary().length) await flushLibrary(); if (this.serial === serial) {
                this.dirty = false; this.failure = undefined; this.changedInputs.clear();
                const external = this.externalPending; this.externalPending = null;
                if (external && !external.deleted && external.revision >= (cachedGoalLibrary()?.revision || 0)) {
                    this.installExternal(normalizeGoalContent(external.value));
                }
            } this.render(); }
        catch (error) { this.fail(error); throw error; }
    }
    setResponse(target: GoalResponseTarget, marked: boolean) {
        if (this.disabled || this.lifecycleBusy || this.edit || !goalEditable(this.state, target.goalId)) return;
        if (target.kind === 'annotation' && ![...this.materials, ...this.callbacks.getAnnotations()].some(n => n.id === target.annotationId && n.bookId === target.bookId)) return;
        const next = setGoalResponse(this.state, target, marked);
        if (next === this.state) return;
        this.responseWrites.set(responseTargetKey(target), { id: operationId(), target, status: 'saving', dismissed: false });
        this.persist(next); this.render();
    }
    async retryResponse(target: GoalResponseTarget) {
        const key = responseTargetKey(target), write = this.responseWrites.get(key);
        if (!write || !responseContent(this.state, target)) return;
        if (this.disabled) { await this.initialize(); return; }
        // Retry the exact frozen command first, then any newer desired snapshot.
        for (const [id, pending] of this.responseWrites) this.responseWrites.set(id, { ...pending, status: 'saving', dismissed: false });
        this.render(); await this.flush();
    }
    async assertWritesSaved() { do { await this.finishInlineEdit(); } while (this.edit); if (this.failure) throw this.failure; }
    async createRoot(text: string, id = operationId()): Promise<string> {
        return this.createGoal(text,null,id);
    }
    async createGoal(text: string, parentId: string | null, id = operationId()): Promise<string> {
        await this.initialize(); if (this.disabled) throw this.failure || new Error('Goals are unavailable');
        await this.assertWritesSaved();
        this.persist(this.state.goals.some(g => g.id === id) ? changeGoal(this.state, id, text) : addGoal(this.state, { id, parentId, text, origin: null }));
        this.selected = id; this.allGoals = false; this.rememberSelection(); await this.flush(); this.render(); return id;
    }
    async addBook(goalId: string, bookId: string, expectedGeneration?: string) {
        if (this.lifecycleBusy || !goalEditable(this.state, goalId)) throw new Error('Restore this goal before adding books');
        const version = (await readBookSummaries()).find(b => b.id === bookId);
        if (!version || version.deleted || (expectedGeneration && version.generation !== expectedGeneration)) throw new Error('This book is no longer available or has changed');
        const intent = { goalId, bookId, generation: version.generation }; stageBookIntent(intent);
        await this.assertWritesSaved(); if (this.disabled) throw this.failure || new Error('Goals are unavailable');
        if (!goalEditable(this.state, goalId)) throw new Error('Restore this goal before adding books');
        const links = this.state.bookLinks || [];
        if (!links.some(l => l.goalId === goalId && l.bookId === bookId)) {
            this.persist({ ...this.state, bookLinks: [...links, { goalId, bookId, generation: version.generation }] });
        }
        await this.flush(); acknowledgeBookIntent(intent); this.render();
    }
    async recoverBookIntents() { for (const link of pendingBookIntents()) await this.addBook(link.goalId, link.bookId, link.generation); }
    async removeBook(goalId: string, bookId: string) {
        if (this.lifecycleBusy || !goalEditable(this.state, goalId)) throw new Error('Restore this goal before changing books');
        await this.assertWritesSaved(); if (this.disabled) throw this.failure || new Error('Goals are unavailable');
        this.persist({ ...this.state, bookLinks: (this.state.bookLinks || []).filter(l => l.goalId !== goalId || l.bookId !== bookId) });
        await this.flush(); this.render();
    }
    private fail(error: unknown) {
        if (this.failure !== error && (!this.responseWrites.size || this.changedInputs.size)) this.callbacks.showToast(error instanceof Error ? error.message : "Goals are not confirmed saved. Keep this window open.", { kind: 'error' });
        for (const [key, write] of this.responseWrites) this.responseWrites.set(key, { ...write, status: 'error', dismissed: false });
        this.failure = error; this.errorDismissed = false; this.render();
    }
    beginInput(id?: string) {
        if (this.disabled || this.lifecycleBusy || !goalEditable(this.state, this.selected)) return;
        this.endEdit(); const goalId = this.selected!;
        const input = id ? this.state.inputs?.find(i => i.id === id && i.goalId === goalId) : undefined;
        if (id && !input) return;
        const draft = input ? { id: input.id, goalId, text: input.text } : { id: operationId(), goalId, text: '' };
        this.edit = { mode: input ? 'input-edit' : 'input-new', draft, lastNonempty: draft.text }; this.render(); this.ui?.focusEditor();
    }
    removeInput(id: string) {
        const goalId = this.selected;
        if (this.disabled || this.lifecycleBusy || !goalId || !goalEditable(this.state, goalId)) return;
        this.endEdit(); discardInputDraft(id); this.changedInputs.add(id);
        this.persist(deleteGoalInput(this.state, goalId, id)); this.render(); this.ui?.announce('Text deleted');
    }
    canLink(id: string) { return !this.lifecycleBusy && !this.page && !this.allGoals && this.visible && !this.disabled && goalEditable(this.state, this.selected) && this.callbacks.getAnnotations().some(n => n.id === id); }
    linked(id: string) { return this.state.links.some(l => l.goalId === this.selected && l.annotationId === id); }
    linkAnnotation(id: string): Promise<void> { const task = this.performLink(id); this.linksInFlight.add(task); task.finally(() => this.linksInFlight.delete(task)).catch(() => {}); return task; }
    private async performLink(id: string) {
        if (!this.canLink(id)) return; this.endEdit(); const goalId = this.selected, bookId = this.callbacks.getLocation().bookId;
        const version = await bookVersion(bookId); await this.callbacks.finishAnnotations(); await this.callbacks.annotationsSaved();
        if (!goalId || !goalEditable(this.state, goalId) || !version.generation || !this.callbacks.getAnnotations().some(n => n.id === id && n.bookId === bookId)) return;
        this.persist(addGoalSource(this.state, { goalId, annotationId: id, bookId, generation: version.generation }));
        if (this.selected === goalId) { this.allGoals = false; } this.refreshAnnotations(); await this.flush(); await this.refreshMaterials(); this.ui?.announce('Item linked to goal');
    }
    async refreshMaterials() {
        const request = ++this.materialRequest; this.materialStatus = 'loading'; this.render();
        try { const result = await loadGoalMaterials(this.state); if (request !== this.materialRequest) return; this.materials = result.annotations.map(normalizeAnnotation).filter((n): n is Annotation => !!n); this.titles = result.titles; this.materialStatus = 'ready'; }
        catch (error) { if (request !== this.materialRequest) return; this.materialStatus = 'error'; this.callbacks.showToast(error instanceof Error ? error.message : "Could not load goal sources.", { kind: 'error' }); } this.render();
    }
    updateReadingContext() {
        const e = this.elements;
        if (this.navigation.surface === 'home' && e) {
            if (e.readingWorkspace) e.readingWorkspace.hidden = true;
            if (e.goalPage) e.goalPage.hidden = true;
            if (e.btnToc) e.btnToc.hidden = true;
            if (e.btnGoalSidebar) e.btnGoalSidebar.hidden = true;
            this.visible = false; this.callbacks.onActionsChanged?.();
            for (const listener of this.listeners) listener();
            return;
        }
        if (e?.goalPage && e.goalSidebar && e.goalPanel) {
            e.readingWorkspace!.hidden = this.page; e.goalPage.hidden = !this.page;
            if (e.btnToc) e.btnToc.hidden = this.page;
            const host = this.page ? e.goalPageContent! : e.goalSidebar;
            if (e.goalPanel.parentElement !== host) host.insertBefore(e.goalPanel, this.page ? null : e.goalResizer || null);
            if (this.page) { e.goalSidebar.hidden = true; e.goalPanel.hidden = false; if (e.btnGoalSidebar) e.btnGoalSidebar.hidden = true; this.visible = true; }
            else this.visible = this.sidebar ? this.sidebar.update(this.callbacks.getMode()) : positionGoals(e, this.callbacks.getMode());
        } else if (e) this.visible = this.sidebar ? this.sidebar.update(this.callbacks.getMode()) : positionGoals(e, this.callbacks.getMode()); this.render();
    }
    refreshAnnotations() { this.render(); }
    materialEntries(goalId: string) {
        const annotations = new Map(this.materials.map(n => [n.id, n])); this.callbacks.getAnnotations().forEach(n => annotations.set(n.id, n));
        return this.state.links.filter(link => link.goalId === goalId).map(link => ({ link, annotation: annotations.get(link.annotationId), title: this.titles.get(link.bookId) || link.bookId }));
    }
    async jumpMaterial(source: GoalSourceLink) { await this.callbacks.jump(source.annotationId, source); }
    async operate(id: string, operation: GoalOperation) {
        if (this.lifecycleBusy || this.disabled) throw new Error('Goals are busy or unavailable');
        this.lifecycleBusy = true; this.render();
        try {
            await this.assertWritesSaved();
            if (['archive', 'delete', 'purge'].includes(operation)) {
                const branch = goalBranch(this.state, id);
                for (const link of pendingBookIntents().filter(link => branch.has(link.goalId))) {
                    if (!(this.state.bookLinks || []).some(saved => saved.goalId === link.goalId && saved.bookId === link.bookId && saved.generation === link.generation)) throw new Error('Finish pending book associations in Library before archiving or deleting this goal');
                    acknowledgeBookIntent(link);
                }
            }
            const before = this.state, next = operateGoal(before, id, operation);
            const changed = next.goals.filter(g => before.goals.find(old => old.id === g.id) !== g);
            const previous = before.goals.filter(g => changed.some(n => n.id === g.id));
            this.persist(next); const selected = this.selected; this.ensureSelection(); this.render(); await this.flush();
            const messages: Record<GoalOperation, string> = { complete: `Completed ${changed.length} goal${changed.length === 1 ? '' : 's'}`, reopen: 'Goal reopened', archive: 'Goal branch archived', unarchive: 'Goal restored from archive', delete: 'Moved to Recently deleted', restore: 'Goal restored', 'restore-root': 'Goal restored to Library', purge: 'Goal permanently deleted' };
            if (['complete', 'reopen', 'archive', 'unarchive'].includes(operation) && changed.length) this.undoChange = { before: previous, after: changed, message: messages[operation] };
            this.actions.notice(messages[operation] + (selected && !this.selected ? ' Your book and annotations are unchanged.' : ''));
        } finally { this.lifecycleBusy = false; this.render(); }
    }
    async undoLifecycle() {
        const undo = this.undoChange; if (!undo || this.lifecycleBusy || this.disabled) return;
        this.lifecycleBusy = true; this.render();
        try {
            await this.assertWritesSaved();
            if (undo !== this.undoChange || undo.after.some(g => JSON.stringify(this.state.goals.find(n => n.id === g.id)) !== JSON.stringify(g))) throw new Error('Goals have changed; this action can no longer be undone');
            const restore = new Map(undo.before.map(g => [g.id, g]));
            this.persist({ ...this.state, goals: this.state.goals.map(g => restore.get(g.id) || g) }); await this.flush(); this.actions.notice('Action undone');
        } finally { this.lifecycleBusy = false; this.render(); }
    }
    render() {
        this.actionUI?.refresh();
        const annotations = new Map(this.materials.map(n => [n.id, n])); this.callbacks.getAnnotations().forEach(n => annotations.set(n.id, n));
        const inputEdit = this.edit?.mode === 'input-new' || this.edit?.mode === 'input-edit' ? this.edit : null;
        this.ui?.render({ state: this.state, selected: this.selected, allGoals: this.allGoals, edit: inputEdit ? null : this.edit as Exclude<typeof this.edit, InputEdit>, inputEdit,
            saveError: !!this.failure && !this.errorDismissed && (!this.responseWrites.size || !!this.changedInputs.size), failedInputs: this.changedInputs, responseWrites: this.responseWrites,
            sourcePage: this.callbacks.getLocation().page, sourceBook: this.callbacks.getLocation().bookId, annotations: [...annotations.values()], disabled: this.disabled || this.lifecycleBusy,
            fullPage: this.page, titles: this.titles, materialStatus: this.materialStatus }); this.callbacks.onActionsChanged?.();
        for (const listener of this.listeners) listener();
    }
}
