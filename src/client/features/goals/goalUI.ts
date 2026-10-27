import type { Annotation } from '../../domain/annotation.js';
import type { GoalLibraryState, GoalDraft } from '../../domain/goal.js';
import { areaGoals, type GoalFilter, type GoalArea } from '../../domain/goalLifecycle.js';
export interface GoalView {
    state: GoalLibraryState; selected: string | null; allGoals: boolean;
    itemsOpen: boolean; edit: { mode: 'root' | 'child' | 'edit'; draft: GoalDraft } | null;
    sourcePage: number; annotations: Annotation[]; disabled: boolean;
    sourceBook: string; fullPage: boolean; titles: Map<string, string>; materialStatus: 'ready' | 'loading' | 'error';
}
interface Actions {
    select(id: string): void; home(): void; up(): void; create(): void; expand(): void; items(): void;
    edit(mode: 'root' | 'child' | 'edit'): void; input(text: string): void; finish(): void;
    unlink(id: string): void; jump(id: string): void;
    menu?(id: string, anchor: HTMLElement, point?: { x: number; y: number }): void;
    collection?(area: GoalArea): void;
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
    private expand: HTMLButtonElement;
    private current = node('div', 'goal-current');
    private title: HTMLButtonElement;
    private children = node('div', 'goal-children');
    private content = node('div', 'goal-content');
    private toggle: HTMLButtonElement;
    private count = node('span');
    private itemsChevron = icon('arrow-down-s-line');
    private items = node('div', 'goal-items');
    private editorShell = node('div', 'goal-editor');
    readonly editor = node('textarea');
    private childNodes = new Map<string, HTMLButtonElement>();
    private childRows = new Map<string, { row: HTMLDivElement; badge: HTMLSpanElement; more: HTMLButtonElement }>();
    private itemNodes = new Map<string, { row: HTMLDivElement; icon: HTMLElement; text: HTMLButtonElement; source: HTMLDivElement }>();
    private empty = node('p', 'goal-empty');
    private composing = false;
    private releasingFocus = false;
    private status = node('span', 'goal-status');
    private filter = node('select', 'goal-filter');
    private completion = node('span', 'goal-completion');
    private more: HTMLButtonElement;
    private collections = node('div', 'goal-collections');
    constructor(readonly panel: HTMLElement, readonly actions: Actions) {
        this.treeToggle = button('Home', actions.home, 'goal-icon', 'home-4-line');
        this.treeToggle.id = 'goal-home-nav';
        this.content.id = 'goal-content'; this.treeToggle.setAttribute('aria-controls', this.content.id);
        this.addRoot = button('New goal', actions.create, 'goal-icon goal-action-primary', 'add-line');
        this.addRoot.id = 'goal-new';
        this.parent = button('Up one level', actions.up, 'goal-icon', 'arrow-up-line'); this.parent.id = 'goal-up';
        this.expand = button('Expand goals', actions.expand, 'goal-icon', 'fullscreen-line'); this.expand.id = 'goal-expand'; this.expand.setAttribute('aria-controls','goal-page');
        const header = node('div', 'goal-header');
        const navigation = node('div','goal-navigation'), tools = node('div','goal-navigation');
        navigation.append(this.treeToggle,this.parent);tools.append(this.addRoot,this.expand);header.append(navigation,tools);
        this.title = button('', () => actions.edit('edit'), 'goal-title');
        this.more = button('Goal actions', () => { if (this.view.selected) actions.menu?.(this.view.selected, this.more); }, 'goal-icon', 'more-line');
        this.more.setAttribute('aria-haspopup', 'menu');
        const titleRow = node('div', 'goal-title-row'); titleRow.append(this.title, this.more);
        this.current.append(titleRow, this.completion, this.editorShell);
        this.current.addEventListener('contextmenu', event => { if (this.view.selected && !(event.target as Element).closest('textarea')) { event.preventDefault(); actions.menu?.(this.view.selected, this.more, { x: event.clientX, y: event.clientY }); } });
        this.filter.setAttribute('aria-label', 'Filter goals by completion');
        for (const [value, label] of [['all', 'All goals'], ['ongoing', 'In progress'], ['completed', 'Completed']]) { const option = node('option'); option.value = value; option.textContent = label; this.filter.append(option); }
        this.filter.addEventListener('change', () => this.render(this.view));
        this.collections.append(button('Archive', () => actions.collection?.('archive'), 'goal-action', 'archive-line'), button('Recently deleted', () => actions.collection?.('trash'), 'goal-action', 'delete-bin-line'));
        this.collections.children[0].append(document.createTextNode('Archive')); this.collections.children[1].append(document.createTextNode('Recently deleted'));
        this.toggle = button('', actions.items, 'goal-items-toggle'); this.toggle.append(this.count, this.itemsChevron);
        this.items.id = 'goal-linked-items'; this.toggle.setAttribute('aria-controls', this.items.id);
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
    focusEditor() { this.resize(); this.editor.focus({ preventScroll: true }); this.editor.setSelectionRange(this.editor.value.length, this.editor.value.length); this.editor.scrollIntoView?.({block:'nearest'}); }
    private resize() { this.editor.style.height = '0px'; this.editor.style.height = `${Math.max(32, this.editor.scrollHeight)}px`; }
    render(view: GoalView) {
        const priorEdit = this.view?.edit;
        this.view = view;
        this.treeToggle.setAttribute('aria-current', view.allGoals ? 'page' : 'false');
        this.treeToggle.disabled = view.disabled || view.allGoals; this.parent.disabled = view.disabled || view.allGoals;
        this.addRoot.disabled = view.disabled; this.expand.hidden = view.fullPage;
        this.more.disabled = view.disabled; this.filter.disabled = view.disabled;
        const editing = !!view.edit;
        this.editorShell.hidden = !editing; this.editor.disabled = view.disabled;
        this.editorShell.classList.toggle('is-new', editing && view.edit?.mode !== 'edit');
        if (view.edit && (priorEdit?.draft.id !== view.edit.draft.id || priorEdit.mode !== view.edit.mode)) {
            this.editor.value = view.edit.draft.text;
        }
        if (view.edit) {
            this.editor.setAttribute('aria-label', view.edit.mode === 'edit' ? 'Edit goal' : 'New goal');
            this.editor.placeholder = 'Goal';
        }
        const wanted: HTMLElement[] = [];
        wanted.push(this.filter);
        if (!view.state.goals.length && !view.edit) { this.empty.textContent = 'Your goals, in your own words.'; wanted.push(this.empty); }
        if (view.allGoals) {
            this.renderChildren(areaGoals(view.state, 'library', null, '', this.filter.value as GoalFilter)); wanted.push(this.children, this.collections);
        } else {
            const goal = view.state.goals.find(item => item.id === view.selected);
            if (goal) {
                this.title.textContent = goal.text; this.title.hidden = view.edit?.mode === 'edit'; this.title.disabled = view.disabled;
                this.completion.textContent = goal.completedAt ? '✓ Completed' : ''; this.completion.hidden = !goal.completedAt;
                if (view.edit?.mode === 'edit') {
                    if (this.editorShell.parentElement !== this.current) this.current.append(this.editorShell);
                }
                wanted.push(this.current);
                const kids = areaGoals(view.state, 'library', goal.id, '', this.filter.value as GoalFilter); this.renderChildren(kids); if (kids.length) wanted.push(this.children);
                if (view.edit?.mode === 'child') wanted.push(this.editorShell);
                const related = view.state.links.filter(link => link.goalId === goal.id);
                const annotations = new Map(view.annotations.map(annotation => [annotation.id, annotation]));
                const live = related;
                if (live.length) {
                    this.count.textContent = `${live.length} ${live.length === 1 ? 'item' : 'items'}`;
                    this.itemsChevron.className = view.itemsOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line';
                    this.toggle.setAttribute('aria-label', `${live.length} linked ${live.length === 1 ? 'item' : 'items'}`);
                    this.toggle.setAttribute('aria-expanded', String(view.itemsOpen)); wanted.push(this.toggle);
                    if (view.itemsOpen) {
                        const rows = live.map(link => {
                            const annotation = annotations.get(link.annotationId);
                            let entry = this.itemNodes.get(link.annotationId);
                            if (!entry) {
                                const row = node('div', 'goal-item'), kind = icon('mark-pen-line');
                                const text = button('', () => this.actions.jump(link.annotationId), 'goal-item-text');
                                const source = node('div', 'goal-item-source');
                                text.dataset.annotationId = link.annotationId;
                                const detail = node('div', 'goal-item-detail'); detail.append(text, source);
                                row.append(kind, detail, button('Unlink', () => this.actions.unlink(link.annotationId), 'goal-icon', 'close-line'));
                                entry = { row, icon: kind, text, source }; this.itemNodes.set(link.annotationId, entry);
                            }
                            const text = annotation ? annotation.kind === 'note' ? annotation.comment : annotation.quote : view.materialStatus === 'loading' ? 'Loading…' : 'Source unavailable';
                            entry.text.disabled = !annotation;
                            entry.icon.className = annotation?.kind === 'note' ? 'ri-sticky-note-line' : 'ri-mark-pen-line';
                            if (entry.text.textContent !== text) entry.text.textContent = text;
                            entry.text.title = text; entry.text.setAttribute('aria-label', `${annotation?.kind || 'Source'}: ${text}`);
                            entry.source.textContent = view.titles.get(link.bookId) || link.bookId;
                            entry.source.hidden = !view.fullPage && link.bookId === view.sourceBook;
                            return entry.row;
                        });
                        reconcile(this.items, rows); wanted.push(this.items);
                    }
                }
            }
        }
        if (view.edit?.mode === 'root') wanted.push(this.editorShell);
        reconcile(this.content, wanted);
        if (editing) this.resize();
    }
    private renderChildren(goals: GoalLibraryState['goals']) {
        const controls = goals.map(goal => {
            let control = this.childNodes.get(goal.id);
            if (!control) { control = button('', () => this.actions.select(goal.id), 'goal-child'); this.childNodes.set(goal.id,control); }
            control.textContent = goal.text; control.disabled = this.view.disabled;
            let entry = this.childRows.get(goal.id);
            if (!entry) {
                const row = node('div', 'goal-row'), badge = node('span', 'goal-completion');
                const more = button(`Actions for ${goal.text}`, () => this.actions.menu?.(goal.id, more), 'goal-icon', 'more-line'); more.setAttribute('aria-haspopup', 'menu');
                row.addEventListener('contextmenu', event => { event.preventDefault(); this.actions.menu?.(goal.id, more, { x: event.clientX, y: event.clientY }); });
                row.append(control, badge, more); entry = {row, badge, more}; this.childRows.set(goal.id, entry);
            }
            entry.badge.textContent = goal.completedAt ? '✓' : ''; entry.badge.title = 'Completed'; entry.badge.hidden = !goal.completedAt;
            entry.more.disabled = this.view.disabled; entry.more.setAttribute('aria-label', `Actions for ${goal.text}`); entry.more.title = `Actions for ${goal.text}`;
            return entry.row;
        });
        reconcile(this.children,controls);
    }
}
