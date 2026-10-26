import type { Annotation } from '../../domain/annotation.js';
import type { GoalDraft, GoalLibraryState, GoalSourceLink } from '../../domain/goal.js';
import type { AppElements } from '../../app/elements.js';
import type { ReadingLocation } from '../../domain/book.js';
import { addGoal, changeGoal, goalOrigin } from '../../domain/goalEngine.js';
import { normalizeAnnotation } from '../../domain/annotationEngine.js';
import { bookVersion, onGoalLibraryChanged, operationId } from '../../infrastructure/storageClient.js';
import { stageLibrary, flushLibrary, loadGoalLibrary, loadGoalMaterials, pendingLibrary, libraryDrafts, storeLibraryDraft, discardLibraryDraft } from '../../infrastructure/goalLibraryRepository.js';
import { GoalUI } from './goalUI.js';
import { GoalSidebar, positionGoals } from './goalLayout.js';
export interface GoalCallbacks {
    getAnnotations(): Annotation[]; getLocation(): ReadingLocation; getMode(): string;
    showToast(message: string): void; jump(id: string, source?: GoalSourceLink): void | Promise<void>;
    finishAnnotations(): Promise<void>; annotationsSaved(): Promise<void>;
    onActionsChanged?(): void; onBeforeSidebarResize?(): void; onSurfaceChanged?(): void; chooseBook?(): void;
}
export class GoalController {
    state: GoalLibraryState = { goals: [], links: [] };
    selected: string | null = null; allGoals = false; itemsOpen = true; expanded = new Set<string>();
    edit: { mode: 'root' | 'child' | 'edit'; draft: GoalDraft; lastNonempty: string; previousTree: boolean } | null = null;
    disabled = true; visible = false; page = false;
    elements: AppElements | null = null; ui: GoalUI | null = null; sidebar: GoalSidebar | null = null;
    private dirty = false; private serial = 0; private stagedSerial = -1;
    private linksInFlight = new Set<Promise<void>>(); private timer: ReturnType<typeof setTimeout> | null = null;
    private failure: unknown; private ready: Promise<void> | null = null;
    private materialRequest = 0; private materials: Annotation[] = []; private titles = new Map<string, string>();
    private materialStatus: 'ready' | 'loading' | 'error' = 'ready';
    constructor(readonly callbacks: GoalCallbacks) {
        onGoalLibraryChanged(record => {
            if (record.deleted) return;
            if (this.dirty || pendingLibrary().length) { this.disabled = true; this.fail(Object.assign(new Error('Goal 数据已变化，未保存内容已保留；请重新载入处理冲突'), { status: 409 })); }
            else { this.state = record.value; this.ensureSelection(); this.refreshMaterials(); }
            this.render();
        });
    }
    initialize(): Promise<void> {
        if (this.ready) return this.ready;
        this.ready = (async () => {
            const loaded = await loadGoalLibrary();
            this.state = loaded.state; this.dirty = loaded.pending; this.disabled = !!loaded.error; this.failure = undefined;
            try { this.selected = localStorage.getItem('aura_selected_goal'); } catch { /* Optional selection. */ }
            this.ensureSelection(); this.expanded = new Set(this.state.goals.filter(g => g.parentId === null).map(g => g.id)); this.resumeDraft();
            if (loaded.error) throw loaded.error;
            await this.refreshMaterials(); this.render();
        })().catch(error => { this.disabled = true; this.ready = null; this.fail(error); this.render(); });
        return this.ready;
    }
    private ensureSelection() { if (!this.state.goals.some(g => g.id === this.selected)) this.selected = this.state.goals.find(g => g.parentId === null)?.id || null; }
    private rememberSelection() { try { if (this.selected) localStorage.setItem('aura_selected_goal', this.selected); else localStorage.removeItem('aura_selected_goal'); } catch { /* Optional UI state. */ } }
    initUI(elements: AppElements) {
        this.elements = elements;
        if (elements.goalPanel) this.ui = new GoalUI(elements.goalPanel, {
            select: id => this.selectGoal(id), tree: () => { this.endEdit(); this.allGoals = !this.allGoals; this.render(); },
            branch: id => { if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id); this.render(); },
            items: () => { this.itemsOpen = !this.itemsOpen; this.render(); }, edit: mode => this.beginEdit(mode), input: text => this.updateDraft(text),
            finish: () => { this.finishInlineEdit().catch(() => {}); },
            unlink: id => { this.endEdit(); this.persist({ ...this.state, links: this.state.links.filter(l => l.goalId !== this.selected || l.annotationId !== id) }); this.render(); this.ui?.announce('Item unlinked from goal'); },
            jump: id => { this.endEdit(); const source = this.state.links.find(l => l.goalId === this.selected && l.annotationId === id); Promise.resolve(this.callbacks.jump(id, source)).catch(error => this.fail(error)); }
        });
        if (elements.goalSidebar) this.sidebar = new GoalSidebar({ ...elements, btnGoals: elements.btnGoalSidebar }, () => this.updateReadingContext(), () => this.finishInlineEdit(), () => this.callbacks.onBeforeSidebarResize?.());
        elements.btnGoals?.addEventListener('click', () => { this.openPage().catch(() => {}); });
        elements.btnGoalBack?.addEventListener('click', () => { this.returnToReader().catch(() => {}); }); this.updateReadingContext();
    }
    async openPage() { await this.callbacks.finishAnnotations(); if (this.edit || this.dirty) await this.finishInlineEdit(); await this.initialize(); this.callbacks.onBeforeSidebarResize?.(); this.page = true; this.updateReadingContext(); }
    async returnToReader() { await this.finishInlineEdit(); this.useReadingSurface(); if (!this.callbacks.getLocation().bookId) this.callbacks.chooseBook?.(); }
    useReadingSurface() { const wasPage = this.page; this.page = false; this.updateReadingContext(); if (wasPage) this.callbacks.onSurfaceChanged?.(); }
    async bookChanged() { this.updateReadingContext(); await this.refreshMaterials(); }
    selectGoal(id: string) { this.endEdit(); this.selected = id; this.rememberSelection(); this.allGoals = false; this.itemsOpen = true; this.render(); }
    beginEdit(mode: 'root' | 'child' | 'edit') {
        if (this.disabled) return; this.endEdit(); const goal = this.state.goals.find(g => g.id === this.selected); if (mode !== 'root' && !goal) return;
        const location = this.callbacks.getLocation();
        const draft: GoalDraft = mode === 'edit' ? { id: goal!.id, parentId: goal!.parentId, text: goal!.text, origin: goal!.origin }
            : { id: operationId(), parentId: mode === 'child' ? goal!.id : null, text: '', origin: !this.page && location.bookId ? { ...goalOrigin(location.page, location.sectionId, location.chapter), bookId: location.bookId } : null };
        this.edit = { mode, draft, lastNonempty: draft.text, previousTree: this.allGoals }; if (mode === 'root') this.allGoals = true; this.render(); this.ui?.focusEditor();
    }
    updateDraft(text: string) {
        const edit = this.edit; if (!edit) return; edit.draft.text = text; if (text.trim()) edit.lastNonempty = text;
        if (edit.mode === 'edit') { if (text.trim()) this.persist(changeGoal(this.state, edit.draft.id, text)); }
        else try { storeLibraryDraft({ ...(libraryDrafts().find(d => d.draft.id === edit.draft.id) || {}), draft: edit.draft }); } catch (error) { this.fail(error); }
    }
    private endEdit() {
        const edit = this.edit; if (!edit) return; if (this.ui) this.updateDraft(this.ui.editor.value); this.edit = null; this.ui?.releaseEditorFocus();
        if (edit.mode === 'edit') this.persist(changeGoal(this.state, edit.draft.id, edit.draft.text.trim() ? edit.draft.text : edit.lastNonempty));
        else if (edit.draft.text.trim()) { this.persist(addGoal(this.state, edit.draft)); this.selected = edit.draft.id; this.rememberSelection(); if (edit.draft.parentId) this.expanded.add(edit.draft.parentId); this.allGoals = false; this.itemsOpen = true; }
        else { discardLibraryDraft(edit.draft.id); this.allGoals = edit.previousTree; } this.render();
    }
    private resumeDraft() {
        if (this.edit) return;
        for (const item of libraryDrafts()) {
            const existing = this.state.goals.find(g => g.id === item.draft.id);
            if (existing) { if (existing.text === item.draft.text) { discardLibraryDraft(existing.id); continue; } throw new Error('Goal 恢复草稿与已有内容冲突'); }
            if (item.draft.parentId && !this.state.goals.some(g => g.id === item.draft.parentId)) throw new Error('Goal 恢复草稿缺少父节点');
            this.edit = { mode: item.draft.parentId ? 'child' : 'root', draft: item.draft, lastNonempty: item.draft.text, previousTree: false }; this.allGoals = !item.draft.parentId; if (item.draft.parentId) this.selected = item.draft.parentId; break;
        }
    }
    async finishInlineEdit(): Promise<void> { this.endEdit(); await this.flush(); await Promise.all([...this.linksInFlight]); this.resumeDraft(); this.render(); }
    private persist(state: GoalLibraryState) {
        if (state === this.state) return; this.state = state; this.dirty = true; this.serial++;
        try { stageLibrary(state); this.stagedSerial = this.serial; } catch (error) { this.fail(error); }
        if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.flush().catch(() => {}); }, 250); this.callbacks.onActionsChanged?.();
    }
    async flush() {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; } const serial = this.serial;
        if (this.disabled && this.failure) throw this.failure;
        try { if (this.dirty && this.stagedSerial !== serial) { stageLibrary(this.state); this.stagedSerial = serial; } if (pendingLibrary().length) await flushLibrary(); if (this.serial === serial) { this.dirty = false; this.failure = undefined; } }
        catch (error) { this.fail(error); throw error; }
    }
    async assertWritesSaved() { do { await this.finishInlineEdit(); } while (this.edit); if (this.failure) throw this.failure; }
    private fail(error: unknown) { if (this.failure !== error) this.callbacks.showToast(error instanceof Error ? error.message : 'Goal 尚未可靠保存，请保留页面'); this.failure = error; }
    canLink(id: string) { return !this.page && this.visible && !this.disabled && !!this.selected && this.callbacks.getAnnotations().some(n => n.id === id); }
    linked(id: string) { return this.state.links.some(l => l.goalId === this.selected && l.annotationId === id); }
    linkAnnotation(id: string): Promise<void> { const task = this.performLink(id); this.linksInFlight.add(task); task.finally(() => this.linksInFlight.delete(task)).catch(() => {}); return task; }
    private async performLink(id: string) {
        if (!this.canLink(id)) return; this.endEdit(); const goalId = this.selected, bookId = this.callbacks.getLocation().bookId;
        const version = await bookVersion(bookId); await this.callbacks.finishAnnotations(); await this.callbacks.annotationsSaved();
        if (!goalId || !version.generation || !this.callbacks.getAnnotations().some(n => n.id === id && n.bookId === bookId)) return;
        if (!this.state.links.some(l => l.goalId === goalId && l.annotationId === id)) this.persist({ ...this.state, links: [...this.state.links, { goalId, annotationId: id, bookId, generation: version.generation }] });
        if (this.selected === goalId) { this.allGoals = false; this.itemsOpen = true; } this.refreshAnnotations(); await this.flush(); await this.refreshMaterials(); this.ui?.announce('Item linked to goal');
    }
    async refreshMaterials() {
        const request = ++this.materialRequest; this.materialStatus = 'loading'; this.render();
        try { const result = await loadGoalMaterials(this.state); if (request !== this.materialRequest) return; this.materials = result.annotations.map(normalizeAnnotation).filter((n): n is Annotation => !!n); this.titles = result.titles; this.materialStatus = 'ready'; }
        catch (error) { if (request !== this.materialRequest) return; this.materialStatus = 'error'; this.callbacks.showToast(error instanceof Error ? error.message : 'Goal 来源读取失败'); } this.render();
    }
    updateReadingContext() {
        const e = this.elements;
        if (e?.goalPage && e.goalSidebar && e.goalPanel) {
            e.readingWorkspace!.hidden = this.page; e.goalPage.hidden = !this.page;
            if (e.btnToc) e.btnToc.hidden = this.page;
            const host = this.page ? e.goalPageContent! : e.goalSidebar;
            if (e.goalPanel.parentElement !== host) host.insertBefore(e.goalPanel, this.page ? null : e.goalResizer || null);
            if (e.btnGoals) { e.btnGoals.hidden = false; e.btnGoals.setAttribute('aria-current', this.page ? 'page' : 'false'); }
            if (this.page) { e.goalSidebar.hidden = true; e.goalPanel.hidden = false; if (e.btnGoalSidebar) e.btnGoalSidebar.hidden = true; this.visible = true; }
            else this.visible = this.sidebar ? this.sidebar.update(this.callbacks.getMode()) : positionGoals(e, this.callbacks.getMode());
        } else if (e) this.visible = this.sidebar ? this.sidebar.update(this.callbacks.getMode()) : positionGoals(e, this.callbacks.getMode()); this.render();
    }
    refreshAnnotations() { this.render(); }
    render() {
        const annotations = new Map(this.materials.map(n => [n.id, n])); this.callbacks.getAnnotations().forEach(n => annotations.set(n.id, n));
        this.ui?.render({ state: this.state, selected: this.selected, allGoals: this.allGoals, expanded: this.expanded, itemsOpen: this.itemsOpen, edit: this.edit,
            sourcePage: this.callbacks.getLocation().page, sourceBook: this.callbacks.getLocation().bookId, annotations: [...annotations.values()], disabled: this.disabled,
            fullPage: this.page, titles: this.titles, materialStatus: this.materialStatus }); this.callbacks.onActionsChanged?.();
    }
}
