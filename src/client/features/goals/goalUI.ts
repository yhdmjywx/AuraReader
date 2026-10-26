import type { Annotation } from '../../domain/annotation.js';
import type { BookGoalState, GoalDraft } from '../../domain/goal.js';
import { goalChildren } from '../../domain/goalEngine.js';
export interface GoalView {
    state: BookGoalState; selected: string | null; allGoals: boolean; expanded: Set<string>;
    itemsOpen: boolean; edit: { mode: 'root' | 'child' | 'edit'; draft: GoalDraft } | null;
    sourcePage: number; annotations: Annotation[]; disabled: boolean;
}
interface Actions {
    select(id: string): void; tree(): void; branch(id: string): void; items(): void;
    edit(mode: 'root' | 'child' | 'edit'): void; input(text: string): void; finish(): void;
    unlink(id: string): void; jump(id: string): void;
}
const node = <T extends keyof HTMLElementTagNameMap>(tag: T, className = '') => {
    const result = document.createElement(tag); result.className = className; return result;
};
function icon(name: string) { const result = node('i', `ri-${name}`); result.setAttribute('aria-hidden', 'true'); return result; }
function button(label: string, action: () => void, className: string, glyph?: string) {
    const result = node('button', className); result.type = 'button';
    if (glyph) { result.append(icon(glyph)); result.setAttribute('aria-label', label); result.title = label; }
    else result.textContent = label;
    result.addEventListener('click', action); return result;
}
// Keep live controls in place: blur/typing must not replace the next click target.
function reconcile(parent: HTMLElement, wanted: HTMLElement[]) {
    const keep = new Set(wanted);
    for (const child of [...parent.children]) if (!keep.has(child as HTMLElement)) child.remove();
    wanted.forEach((child, index) => { if (parent.children[index] !== child) parent.insertBefore(child, parent.children[index] || null); });
}
export class GoalUI {
    private view!: GoalView;
    private treeToggle: HTMLButtonElement;
    private addRoot: HTMLButtonElement;
    private parent: HTMLButtonElement;
    private parentText = node('span');
    private current = node('div', 'goal-current');
    private title: HTMLButtonElement;
    private addChild: HTMLButtonElement;
    private children = node('div', 'goal-children');
    private tree = node('ul', 'goal-tree');
    private content = node('div', 'goal-content');
    private toggle: HTMLButtonElement;
    private count = node('span');
    private items = node('div', 'goal-items');
    private editorShell = node('div', 'goal-editor');
    readonly editor = node('textarea');
    private childNodes = new Map<string, HTMLButtonElement>();
    private treeNodes = new Map<string, { row: HTMLLIElement; toggle: HTMLButtonElement; label: HTMLButtonElement; spacer: HTMLSpanElement }>();
    private itemNodes = new Map<string, { row: HTMLDivElement; icon: HTMLElement; text: HTMLButtonElement }>();
    private composing = false;
    private releasingFocus = false;
    private status = node('span', 'goal-status');
    constructor(readonly panel: HTMLElement, readonly actions: Actions) {
        this.treeToggle = button('All goals', actions.tree, 'btn btn-ghost-sm');
        this.treeToggle.id = 'goal-tree-toggle'; this.treeToggle.append(icon('arrow-down-s-line'));
        this.content.id = 'goal-content'; this.treeToggle.setAttribute('aria-controls', this.content.id);
        this.treeToggle.title = 'All goals';
        this.addRoot = button('New goal', () => actions.edit('root'), 'goal-icon', 'add-line');
        const header = node('div', 'goal-header'); header.append(this.treeToggle, this.addRoot);
        this.parent = button('', () => { const goal = this.view.state.goals.find(g => g.id === this.view.selected); if (goal?.parentId) actions.select(goal.parentId); }, 'goal-parent');
        this.parent.append(icon('arrow-left-s-line'), this.parentText);
        this.title = button('', () => actions.edit('edit'), 'goal-title');
        this.addChild = button('Add subgoal', () => actions.edit('child'), 'goal-icon', 'add-line');
        this.current.append(this.title, this.editorShell, this.addChild);
        this.toggle = button('', actions.items, 'goal-items-toggle'); this.toggle.append(icon('attachment-2'), this.count);
        this.toggle.title = 'Linked notes and highlights';
        this.editor.rows = 1; this.editor.setAttribute('aria-keyshortcuts', 'Escape Control+Enter Meta+Enter');
        this.editorShell.append(this.editor);
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.panel.replaceChildren(header, this.content, this.status);
        // A toolbar mouse click can finish editing inside its click handler,
        // without blur removing the button before that handler is reached.
        panel.addEventListener('mousedown', event => {
            if (this.view?.edit && (event.target as Element).closest('button')) event.preventDefault();
        });
        this.editor.addEventListener('input', () => { actions.input(this.editor.value); this.resize(); });
        this.editor.addEventListener('compositionstart', () => { this.composing = true; });
        this.editor.addEventListener('compositionend', () => { this.composing = false; actions.input(this.editor.value); this.resize(); });
        this.editor.addEventListener('keydown', event => {
            event.stopPropagation();
            if (this.composing || event.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); actions.finish(); }
        });
        this.editor.addEventListener('blur', () => { if (!this.releasingFocus && this.view?.edit) actions.finish(); });
    }
    releaseEditorFocus() {
        // Finish the old focus session before hiding/reparenting this shared
        // textarea. A delayed browser blur must not finish the next draft.
        this.releasingFocus = true;
        if (this.panel.ownerDocument.activeElement === this.editor) this.editor.blur();
        this.releasingFocus = false;
    }
    announce(text: string) { this.status.textContent = text; }
    focusEditor() { this.resize(); this.editor.focus({ preventScroll: true }); this.editor.setSelectionRange(this.editor.value.length, this.editor.value.length); }
    private resize() { this.editor.style.height = '0px'; this.editor.style.height = `${Math.max(32, this.editor.scrollHeight)}px`; }
    render(view: GoalView) {
        const priorEdit = this.view?.edit;
        this.view = view;
        this.treeToggle.firstChild!.textContent = view.allGoals ? 'Current goal' : 'All goals';
        this.treeToggle.setAttribute('aria-expanded', String(view.allGoals));
        this.treeToggle.disabled = view.disabled; this.addRoot.disabled = view.disabled;
        const editing = !!view.edit;
        this.editorShell.hidden = !editing; this.editor.disabled = view.disabled;
        this.editorShell.classList.toggle('is-new', editing && view.edit?.mode !== 'edit');
        if (view.edit && (priorEdit?.draft.id !== view.edit.draft.id || priorEdit.mode !== view.edit.mode)) {
            this.editor.value = view.edit.draft.text;
        }
        if (view.edit) {
            this.editor.setAttribute('aria-label', view.edit.mode === 'edit' ? 'Edit goal' : view.edit.mode === 'child' ? 'New subgoal' : 'New goal');
            this.editor.placeholder = view.edit.mode === 'child' ? 'Subgoal' : 'Goal';
        }
        const wanted: HTMLElement[] = [];
        if (view.allGoals) {
            const stack = goalChildren(view.state, null).reverse().map(goal => ({ goal, depth: 0 }));
            const rows: HTMLElement[] = [];
            while (stack.length) {
                const { goal, depth } = stack.pop()!;
                let entry = this.treeNodes.get(goal.id);
                if (!entry) {
                    const row = node('li', 'goal-tree-row'), spacer = node('span', 'tree-spacer');
                    const toggle = button('', () => this.actions.branch(goal.id), 'goal-icon', 'arrow-right-s-line');
                    const label = button('', () => this.actions.select(goal.id), 'goal-tree-label');
                    entry = { row, toggle, label, spacer }; this.treeNodes.set(goal.id, entry);
                }
                entry.row.style.paddingLeft = `${Math.min(depth, 3) * 14}px`;
                entry.label.textContent = goal.text; entry.label.setAttribute('aria-current', String(goal.id === view.selected));
                entry.toggle.setAttribute('aria-label', `${view.expanded.has(goal.id) ? 'Collapse' : 'Expand'} ${goal.text}`);
                entry.toggle.setAttribute('aria-expanded', String(view.expanded.has(goal.id)));
                entry.toggle.querySelector('i')!.className = view.expanded.has(goal.id) ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line';
                const nested = goalChildren(view.state, goal.id);
                reconcile(entry.row, [nested.length ? entry.toggle : entry.spacer, entry.label]);
                rows.push(entry.row);
                if (view.expanded.has(goal.id)) stack.push(...nested.reverse().map(child => ({ goal: child, depth: depth + 1 })));
            }
            reconcile(this.tree, rows); wanted.push(this.tree);
        } else {
            const goal = view.state.goals.find(item => item.id === view.selected);
            if (goal) {
                const parent = view.state.goals.find(item => item.id === goal.parentId);
                if (parent) { this.parentText.textContent = parent.text; this.parent.title = parent.text; wanted.push(this.parent); }
                this.title.textContent = goal.text; this.title.hidden = view.edit?.mode === 'edit'; this.title.disabled = view.disabled;
                this.addChild.disabled = view.disabled;
                if (view.edit?.mode === 'edit') {
                    if (this.editorShell.parentElement !== this.current) this.current.insertBefore(this.editorShell, this.addChild);
                }
                wanted.push(this.current);
                const kids = goalChildren(view.state, goal.id, view.sourcePage).map(child => {
                    let control = this.childNodes.get(child.id);
                    if (!control) { control = button('', () => this.actions.select(child.id), 'goal-child'); this.childNodes.set(child.id, control); }
                    control.textContent = child.text; return control;
                });
                reconcile(this.children, kids); if (kids.length) wanted.push(this.children);
                const related = view.state.links.filter(link => link.goalId === goal.id);
                const annotations = new Map(view.annotations.map(annotation => [annotation.id, annotation]));
                const live = related.filter(link => annotations.has(link.annotationId));
                if (live.length) {
                    this.count.textContent = String(live.length);
                    this.toggle.setAttribute('aria-label', `${live.length} linked ${live.length === 1 ? 'item' : 'items'}`);
                    this.toggle.setAttribute('aria-expanded', String(view.itemsOpen)); wanted.push(this.toggle);
                    if (view.itemsOpen) {
                        const rows = live.map(link => {
                            const annotation = annotations.get(link.annotationId)!;
                            let entry = this.itemNodes.get(link.annotationId);
                            if (!entry) {
                                const row = node('div', 'goal-item'), kind = icon('mark-pen-line');
                                const text = button('', () => this.actions.jump(link.annotationId), 'goal-item-text');
                                text.dataset.annotationId = link.annotationId;
                                row.append(kind, text, button('Unlink', () => this.actions.unlink(link.annotationId), 'goal-icon', 'close-line'));
                                entry = { row, icon: kind, text }; this.itemNodes.set(link.annotationId, entry);
                            }
                            const text = annotation.kind === 'note' ? annotation.comment : annotation.quote;
                            entry.icon.className = annotation.kind === 'note' ? 'ri-sticky-note-line' : 'ri-mark-pen-line';
                            if (entry.text.textContent !== text) entry.text.textContent = text;
                            entry.text.title = text; entry.text.setAttribute('aria-label', `${annotation.kind}: ${text}`);
                            return entry.row;
                        });
                        reconcile(this.items, rows); wanted.push(this.items);
                    }
                }
            }
        }
        if (view.edit && view.edit.mode !== 'edit') wanted.push(this.editorShell);
        reconcile(this.content, wanted);
        if (editing) this.resize();
    }
}
