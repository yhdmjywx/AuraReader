import type { Annotation } from '../../domain/annotation.js';
import type { BookGoalState, GoalDraft } from '../../domain/goal.js';
import type { AppElements } from '../../app/elements.js';
import type { ReadingLocation } from '../../domain/book.js';
import { addGoal, changeGoal, emptyGoals, goalOrigin, linkGoal, unlinkGoal } from '../../domain/goalEngine.js';
import { onGoalsChanged, operationId } from '../../infrastructure/storageClient.js';
import { prepareGoalWrite, flushGoals, loadGoalsForBook } from '../../infrastructure/goalRepository.js';
import { clearGoalDraft, pendingGoals, storeGoalDraft } from '../../infrastructure/goalRecovery.js';
import { GoalUI } from './goalUI.js';
import { GoalSidebar, positionGoals } from './goalLayout.js';

export interface GoalCallbacks {
    getAnnotations(): Annotation[];
    getLocation(): ReadingLocation;
    getMode(): string;
    showToast(message: string): void;
    jump(id: string): void;
    finishAnnotations(): Promise<void>;
    annotationsSaved(): Promise<void>;
    onActionsChanged?(): void;
    onBeforeSidebarResize?(): void;
}
export class GoalController {
    state: BookGoalState = emptyGoals('');
    generation = '';
    selected: string | null = null;
    allGoals = false;
    itemsOpen = true;
    expanded = new Set<string>();
    edit: { mode: 'root' | 'child' | 'edit'; draft: GoalDraft; lastNonempty: string; previousTree: boolean } | null = null;
    disabled = false;
    visible = false;
    elements: AppElements | null = null;
    ui: GoalUI | null = null;
    sidebar: GoalSidebar | null = null;
    private dirty = false;
    private serial = 0;
    private stagedSerial = -1;
    private linksInFlight = new Set<Promise<void>>();
    private timer: ReturnType<typeof setTimeout> | null = null;
    private failure: unknown;
    private memory = new Map<string, { selected: string | null; expanded: Set<string> }>();
    constructor(readonly callbacks: GoalCallbacks) {
        onGoalsChanged(record => {
            if (record.bookId !== this.state.bookId || record.deleted) return;
            if (this.dirty || pendingGoals(record.bookId).length) {
                this.fail(Object.assign(new Error('Goal 数据已变化，未保存内容已保留；请重新载入处理冲突'), { status: 409 }));
                this.disabled = true;
            } else this.state = record.value;
            this.render();
        });
    }
    initUI(elements: AppElements) {
        this.elements = elements;
        if (elements.goalPanel) this.ui = new GoalUI(elements.goalPanel, {
            select: id => this.selectGoal(id), tree: () => { this.endEdit(); this.allGoals = !this.allGoals; this.render(); },
            branch: id => { if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id); this.render(); },
            items: () => { this.itemsOpen = !this.itemsOpen; this.render(); },
            edit: mode => this.beginEdit(mode), input: text => this.updateDraft(text),
            finish: () => { this.finishInlineEdit().catch(() => {}); },
            unlink: id => { this.endEdit(); if (this.selected) this.persist(unlinkGoal(this.state, this.selected, id)); this.render(); this.ui?.announce('Item unlinked from goal'); },
            jump: id => { this.endEdit(); this.callbacks.jump(id); }
        });
        if (elements.goalSidebar) this.sidebar = new GoalSidebar(elements, () => this.updateReadingContext(), () => this.finishInlineEdit(), () => this.callbacks.onBeforeSidebarResize?.());
        this.updateReadingContext();
    }
    setStateForBook(loaded: Awaited<ReturnType<typeof loadGoalsForBook>>) {
        if (this.state.bookId) this.memory.set(this.state.bookId, { selected: this.selected, expanded: this.expanded });
        this.state = loaded.state; this.generation = loaded.generation;
        this.disabled = !!loaded.error; this.failure = undefined; this.dirty = loaded.pending;
        const remembered = this.memory.get(this.state.bookId);
        this.selected = remembered?.selected && this.state.goals.some(goal => goal.id === remembered.selected)
            ? remembered.selected : this.state.goals.find(goal => goal.parentId === null)?.id || null;
        this.expanded = remembered?.expanded || new Set(this.state.goals.filter(goal => goal.parentId === null).map(goal => goal.id));
        this.allGoals = false; this.itemsOpen = true; this.edit = null;
        const recovered = loaded.draft;
        if (recovered) {
            if (recovered.generation !== this.generation) {
                this.disabled = true; this.fail(new Error('Goal 草稿属于旧书籍代次，请保留恢复内容'));
            } else if (!this.state.goals.some(goal => goal.id === recovered.draft.id)) {
                this.edit = { mode: recovered.draft.parentId ? 'child' : 'root', draft: recovered.draft,
                    lastNonempty: recovered.draft.text, previousTree: false };
                this.allGoals = !recovered.draft.parentId;
                if (recovered.draft.parentId) this.selected = recovered.draft.parentId;
            }
        }
        if (loaded.error) this.fail(loaded.error);
        this.render();
    }
    selectGoal(id: string) { this.endEdit(); this.selected = id; this.allGoals = false; this.itemsOpen = true; this.render(); }
    beginEdit(mode: 'root' | 'child' | 'edit') {
        if (this.disabled || !this.state.bookId) return;
        this.endEdit();
        const goal = this.state.goals.find(item => item.id === this.selected);
        if (mode !== 'root' && !goal) return;
        const location = this.callbacks.getLocation();
        const draft: GoalDraft = mode === 'edit' ? { id: goal!.id, parentId: goal!.parentId, text: goal!.text, origin: goal!.origin }
            : { id: operationId(), parentId: mode === 'child' ? goal!.id : null, text: '',
                origin: mode === 'child' ? goalOrigin(location.page, location.sectionId, location.chapter) : null };
        this.edit = { mode, draft, lastNonempty: draft.text, previousTree: this.allGoals };
        if (mode === 'root') this.allGoals = true;
        this.render(); this.ui?.focusEditor();
    }
    updateDraft(text: string) {
        const edit = this.edit; if (!edit) return;
        edit.draft.text = text;
        if (text.trim()) edit.lastNonempty = text;
        if (edit.mode === 'edit') { if (text.trim()) this.persist(changeGoal(this.state, edit.draft.id, text)); }
        else {
            try { storeGoalDraft({ bookId: this.state.bookId, generation: this.generation, draft: edit.draft }); }
            catch (error) { this.fail(error); }
        }
    }
    private endEdit() {
        const edit = this.edit; if (!edit) return;
        // Read the DOM too, including a final IME input or programmatic value.
        if (this.ui) this.updateDraft(this.ui.editor.value);
        this.edit = null;
        this.ui?.releaseEditorFocus();
        if (edit.mode === 'edit') {
            const text = edit.draft.text.trim() ? edit.draft.text : edit.lastNonempty;
            this.persist(changeGoal(this.state, edit.draft.id, text));
        } else if (edit.draft.text.trim()) {
            this.persist(addGoal(this.state, edit.draft)); this.selected = edit.draft.id;
            if (edit.draft.parentId) this.expanded.add(edit.draft.parentId);
            this.allGoals = false; this.itemsOpen = true;
        } else { clearGoalDraft(this.state.bookId); this.allGoals = edit.previousTree; }
        this.render();
    }
    async finishInlineEdit(): Promise<void> { this.endEdit(); await this.flush(); await Promise.all([...this.linksInFlight]); }
    private persist(state: BookGoalState) {
        if (state === this.state) return;
        this.state = state; this.dirty = true; this.serial++;
        try { prepareGoalWrite(state, this.generation); this.stagedSerial = this.serial; }
        catch (error) { this.fail(error); }
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.flush().catch(() => {}); }, 250);
        this.callbacks.onActionsChanged?.();
    }
    async flush() {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        const bookId = this.state.bookId, serial = this.serial;
        if (!bookId) return;
        if (this.disabled && this.failure) throw this.failure;
        try {
            if (this.dirty && this.stagedSerial !== serial) { prepareGoalWrite(this.state, this.generation); this.stagedSerial = serial; }
            if (pendingGoals(bookId).length) await flushGoals(bookId);
            if (this.state.bookId === bookId && this.serial === serial) { this.dirty = false; this.failure = undefined; }
        } catch (error) { if (this.state.bookId === bookId) this.fail(error); throw error; }
    }
    async assertWritesSaved() { await this.finishInlineEdit(); if (this.failure) throw this.failure; }
    private fail(error: unknown) {
        if (this.failure !== error) this.callbacks.showToast(error instanceof Error ? error.message : 'Goal 尚未可靠保存，请保留页面');
        this.failure = error;
    }
    canLink(id: string): boolean {
        return this.visible && !this.disabled && !!this.selected && this.callbacks.getAnnotations().some(note => note.id === id);
    }
    linked(id: string) { return this.state.links.some(link => link.goalId === this.selected && link.annotationId === id); }
    linkAnnotation(id: string): Promise<void> {
        const task = this.performLink(id);
        this.linksInFlight.add(task);
        task.finally(() => this.linksInFlight.delete(task)).catch(() => {});
        return task;
    }
    private async performLink(id: string) {
        if (!this.canLink(id)) return;
        this.endEdit();
        const bookId = this.state.bookId, generation = this.generation, goalId = this.selected;
        await this.callbacks.finishAnnotations(); await this.callbacks.annotationsSaved();
        if (this.state.bookId !== bookId || this.generation !== generation || !goalId) return;
        if (!this.callbacks.getAnnotations().some(note => note.id === id && note.bookId === bookId)) return;
        this.persist(linkGoal(this.state, goalId, id));
        if (this.selected === goalId) { this.allGoals = false; this.itemsOpen = true; }
        this.render(); await this.flush();
        this.ui?.announce('Item linked to goal');
    }
    updateReadingContext() {
        if (this.elements) {
            const visible = this.sidebar ? this.sidebar.update(this.callbacks.getMode()) : positionGoals(this.elements, this.callbacks.getMode());
            if (this.visible && !visible) this.finishInlineEdit().catch(() => {});
            this.visible = visible;
        }
        this.render();
    }
    refreshAnnotations() { this.render(); }
    render() {
        this.ui?.render({ state: this.state, selected: this.selected, allGoals: this.allGoals, expanded: this.expanded,
            itemsOpen: this.itemsOpen, edit: this.edit, sourcePage: this.callbacks.getLocation().page,
            annotations: this.callbacks.getAnnotations(), disabled: this.disabled });
        this.callbacks.onActionsChanged?.();
    }
}
