import { useLayoutEffect, useRef } from 'react';
import type { Annotation } from '../../domain/annotation.js';
import type { GoalLibraryState, GoalDraft } from '../../domain/goal.js';
import { areaGoals } from '../../domain/goalLifecycle.js';
import { Button } from '../../components/ui/button.js';
import { Textarea } from '../../components/ui/input.js';
import { renderSurface } from '../../components/ui/renderSurface.js';

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
}
function GoalEditor({ view, ui }: { view: GoalView; ui: GoalUI }) {
    const editor = useRef<HTMLTextAreaElement>(null), composing = useRef(false);
    useLayoutEffect(() => {
        const input = editor.current!;
        input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length);
    }, []);
    const resize = () => { const input = editor.current!; input.style.height = '0px'; input.style.height = `${Math.max(32, input.scrollHeight)}px`; };
    useLayoutEffect(resize, []);
    return <div className={`goal-editor${view.edit?.mode !== 'edit' ? ' is-new' : ''}`}>
        <Textarea ref={editor} rows={1} defaultValue={view.edit!.draft.text} disabled={view.disabled}
            aria-label={view.edit?.mode === 'edit' ? 'Edit goal' : 'New goal'} placeholder="Goal"
            aria-keyshortcuts="Escape Control+Enter Meta+Enter"
            onInput={event => { ui.actions.input(event.currentTarget.value); resize(); }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; ui.actions.input(event.currentTarget.value); resize(); }}
            onKeyDown={event => {
                event.stopPropagation();
                if (composing.current || event.nativeEvent.isComposing) return;
                if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
                    event.preventDefault(); ui.actions.finish();
                }
            }} onBlur={() => { if (!ui.releasingFocus) ui.actions.finish(); }} />
    </div>;
}
function GoalPanel({ view, ui }: { view: GoalView; ui: GoalUI }) {
    const { actions } = ui;
    const goal = view.state.goals.find(g => g.id === view.selected);
    const children = areaGoals(view.state, 'library', view.allGoals ? null : goal?.id || null, '', 'ongoing');
    const materials = view.state.links.filter(link => link.goalId === goal?.id);
    const annotations = new Map(view.annotations.map(note => [note.id, note]));
    return <div onMouseDown={event => {
        if (view.edit && (event.target as Element).closest('button')) event.preventDefault();
    }}>
        <div className="goal-header">
            <nav className="goal-navigation" aria-label="Goal 导航">
                <Button id="goal-home-nav" className="goal-icon" aria-label="Home" disabled={view.disabled || view.allGoals} onClick={actions.home}><i className="ri-home-4-line" /></Button>
                <Button id="goal-up" className="goal-icon" aria-label="Up one level" disabled={view.disabled || view.allGoals} onClick={actions.up}>↑</Button>
            </nav>
            <div className="goal-navigation">
                <Button id="goal-new" className="goal-icon" aria-label="New goal" disabled={view.disabled} onClick={actions.create}>＋</Button>
                {!view.fullPage && <Button id="goal-expand" className="goal-icon" aria-label="Expand goals" onClick={actions.expand}>⤢</Button>}
            </div>
        </div>
        <div className="goal-content" id="goal-content">
            {!view.allGoals && goal && <div className="goal-current">
                <div className="goal-title-row">
                    {view.edit?.mode !== 'edit' && <Button className="goal-title" disabled={view.disabled} onClick={() => actions.edit('edit')}>{goal.text}</Button>}
                    <Button className="goal-icon" aria-label={`Actions for ${goal.text}`} aria-haspopup="menu" disabled={view.disabled}
                        onClick={event => actions.menu?.(goal.id, event.currentTarget)}>⋯</Button>
                </div>
                {goal.completedAt && <span className="goal-completion">✓ 已完成</span>}
            </div>}
            {view.edit && <GoalEditor key={`${view.edit.mode}:${view.edit.draft.id}`} view={view} ui={ui} />}
            <div className="goal-children">{children.map(child => <div className="goal-row" key={child.id}>
                <Button className="goal-child" disabled={view.disabled} onClick={() => actions.select(child.id)}>{child.text}</Button>
                {child.completedAt && <span className="goal-completion">✓</span>}
                <Button className="goal-icon" aria-label={`Actions for ${child.text}`} aria-haspopup="menu" disabled={view.disabled}
                    onClick={event => actions.menu?.(child.id, event.currentTarget)}>⋯</Button>
            </div>)}</div>
            {!children.length && !goal && !view.edit && <p className="goal-empty">{view.state.goals.length ? '当前层级暂无进行中的 Goal。' : '从一个想弄明白的问题开始。'}</p>}
            {!view.allGoals && goal && materials.length > 0 && <>
                <Button className="goal-items-toggle" aria-expanded={view.itemsOpen} aria-controls="goal-linked-items" onClick={actions.items}>{materials.length} 条关联材料 <span>{view.itemsOpen ? '⌃' : '⌄'}</span></Button>
                {view.itemsOpen && <div className="goal-items" id="goal-linked-items">{materials.map(link => {
                    const note = annotations.get(link.annotationId);
                    return <div className="goal-item" key={`${link.bookId}:${link.annotationId}`}>
                        <i className={note?.kind === 'note' ? 'ri-sticky-note-line' : 'ri-mark-pen-line'} aria-hidden="true" />
                        <div className="goal-item-detail">
                            <Button className="goal-item-text" data-annotation-id={link.annotationId} disabled={!note} onClick={() => actions.jump(link.annotationId)}>
                                {note ? note.comment || note.quote : view.materialStatus === 'loading' ? '载入中…' : '来源不可用'}
                            </Button>
                            {(view.fullPage || link.bookId !== view.sourceBook) && <div className="goal-item-source">{view.titles.get(link.bookId) || link.bookId}</div>}
                        </div>
                        <Button className="goal-icon" aria-label="Unlink" disabled={view.disabled} onClick={() => actions.unlink(link.annotationId)}>×</Button>
                    </div>;
                })}</div>}
            </>}
        </div>
        <span className="goal-status" role="status" aria-live="polite">{ui.message}</span>
    </div>;
}

/** React view adapter shared by the full Goal page and the reader sidebar. */
export class GoalUI {
    private view: GoalView | null = null;
    releasingFocus = false;
    message = '';
    constructor(readonly panel: HTMLElement, readonly actions: Actions) {}
    get editingText() { return this.panel.querySelector('textarea')?.value; }
    releaseEditorFocus() {
        this.releasingFocus = true;
        this.panel.querySelector('textarea')?.blur();
        this.releasingFocus = false;
    }
    announce(message: string) { this.message = message; if (this.view) this.render(this.view); }
    focusEditor() { requestAnimationFrame(() => this.panel.querySelector('textarea')?.focus({ preventScroll: true })); }
    render(view: GoalView) { this.view = view; renderSurface(this.panel, <GoalPanel view={view} ui={this} />); }
}
