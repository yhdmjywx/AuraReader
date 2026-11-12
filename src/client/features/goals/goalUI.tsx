import { useLayoutEffect, useRef, useState } from 'react';
import type { Annotation } from '../../domain/annotation.js';
import type { GoalLibraryState, GoalDraft } from '../../domain/goal.js';
import { areaGoals } from '../../domain/goalLifecycle.js';
import { Button } from '../../components/ui/button.js';
import { ActionIcon } from '../../components/ui/action-icon.js';
import { Textarea } from '../../components/ui/input.js';
import { renderSurface } from '../../components/ui/renderSurface.js';
import { GoalContentList } from './GoalContentList.js';
import type { InputEdit, ResponseSaveState } from './goalController.js';
import type { GoalResponseTarget } from '../../domain/goalContentEngine.js';

export interface GoalView {
    state: GoalLibraryState; selected: string | null; allGoals: boolean;
    edit: { mode: 'root' | 'child' | 'edit'; draft: GoalDraft } | null;
    inputEdit: InputEdit | null; saveError: boolean; failedInputs: ReadonlySet<string>;
    responseWrites: ReadonlyMap<string, ResponseSaveState>;
    sourcePage: number; annotations: Annotation[]; disabled: boolean;
    sourceBook: string; fullPage: boolean; titles: Map<string, string>; materialStatus: 'ready' | 'loading' | 'error';
}
interface Actions {
    select(id: string): void; home(): void; up(): void; create(): void; expand(): void;
    addInput(): void; editInput(id: string): void; deleteInput(id: string): void; retry(): void; dismissError(): void;
    setResponse(target: GoalResponseTarget, marked: boolean): void; retryResponse(target: GoalResponseTarget): void; dismissResponseError(target: GoalResponseTarget): void;
    edit(mode: 'root' | 'child' | 'edit', id?: string): void; input(text: string): void; finish(): void;
    unlink(id: string): void; jump(id: string): void;
    menu?(id: string, anchor: HTMLElement, point?: { x: number; y: number }): void;
}
// Terminal blank lines do not add empty rows to the compact Goal presentation.
function rowDisplayText(text: string) { return text.replace(/[\r\n]+$/u, ''); }
function GoalEditor({ view, ui }: { view: GoalView; ui: GoalUI }) {
    const editor = useRef<HTMLTextAreaElement>(null), composing = useRef(false);
    const inline = view.edit?.mode === 'edit';
    const originalText = useRef(view.edit!.draft.text);
    const initialText = inline ? rowDisplayText(originalText.current) : originalText.current;
    const [text, setText] = useState(initialText);
    useLayoutEffect(() => {
        const input = editor.current!;
        input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length);
    }, []);
    const resize = () => {
        if (inline) return;
        const input = editor.current!;
        input.style.height = '0px'; input.style.height = `${Math.max(32, input.scrollHeight)}px`;
    };
    useLayoutEffect(resize, []);
    return <div className={`goal-editor${view.edit?.mode === 'edit' ? ' is-inline' : ' is-new'}`}>
        {inline && <span className="goal-editor-measure" aria-hidden="true">{text}</span>}
        <Textarea ref={editor} rows={1} defaultValue={initialText} disabled={view.disabled}
            data-original-text={inline ? originalText.current : undefined}
            aria-label={view.edit?.mode === 'edit' ? 'Edit goal' : 'New goal'} placeholder="Goal"
            aria-keyshortcuts="Escape Control+Enter Meta+Enter"
            onInput={event => { setText(event.currentTarget.value); ui.actions.input(event.currentTarget.value); resize(); }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; setText(event.currentTarget.value); ui.actions.input(event.currentTarget.value); resize(); }}
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
    return <div onMouseDown={event => {
        if ((view.edit || view.inputEdit) && (event.target as Element).closest('button')) event.preventDefault();
    }}>
        <div className="goal-header">
            <nav className="goal-navigation" aria-label="Goal navigation">
                <Button id="goal-home-nav" size="icon-lg" className="goal-icon" aria-label="Goal root" title="Goal root" aria-current={view.allGoals ? 'page' : undefined} disabled={view.disabled || view.allGoals} onClick={actions.home}><ActionIcon name={view.allGoals ? 'home-filled' : 'home'} /></Button>
                <Button id="goal-up" size="icon-lg" className="goal-icon" aria-label="Up one level" title="Up one level" disabled={view.disabled || view.allGoals} onClick={actions.up}><ActionIcon name="up" /></Button>
            </nav>
            <div className="goal-navigation">
                <Button id="goal-new" size="icon-lg" className="goal-icon" aria-label={view.allGoals ? 'New goal' : 'New child goal'} title={view.allGoals ? 'New goal' : 'New child goal'} disabled={view.disabled} onClick={actions.create}><ActionIcon name="plus" /></Button>
                {!view.fullPage && <Button id="goal-expand" size="icon-lg" className="goal-icon" aria-label="Expand goals" title="Open full goal workspace" onClick={actions.expand}><ActionIcon name="expand" /></Button>}
            </div>
        </div>
        <div className="goal-content" id="goal-content">
            {!view.allGoals && goal && <div className="goal-current">
                <div className="goal-title-row" data-disabled={view.disabled ? '' : undefined}>
                    {view.edit?.mode === 'edit' && view.edit.draft.id === goal.id
                        ? <GoalEditor key={`edit:${view.edit.draft.id}`} view={view} ui={ui} />
                        : <Button className="goal-title" aria-current="page" disabled={view.disabled} onClick={() => actions.select(goal.id)}><span className="goal-row-label">{rowDisplayText(goal.text)}</span></Button>}
                    <Button size="icon-lg" className="goal-icon goal-edit" aria-label="Edit goal" title="Edit goal" disabled={view.disabled} onClick={() => actions.edit('edit')}><ActionIcon name="edit" /></Button>
                    <Button size="icon-lg" className="goal-icon" aria-label={`Actions for ${goal.text}`} title="Goal actions" aria-haspopup="menu" disabled={view.disabled}
                        onClick={event => actions.menu?.(goal.id, event.currentTarget)}><ActionIcon name="more" /></Button>
                </div>
                {goal.completedAt && <span className="goal-completion">✓ Completed</span>}
            </div>}
            <div className={`goal-descendants${!view.allGoals && goal ? ' is-nested' : ''}`}>
            {!view.allGoals && goal && <div className="goal-children-region" aria-hidden="true"><ActionIcon name="goal-branch" /></div>}
            {view.edit && view.edit.mode !== 'edit' && <GoalEditor key={`${view.edit.mode}:${view.edit.draft.id}`} view={view} ui={ui} />}
            <div className="goal-children">
            {children.map(child => <div className="goal-row" key={child.id} data-goal-id={child.id} data-goal-kind={view.allGoals ? 'root' : 'child'} data-disabled={view.disabled ? '' : undefined}>
                {view.edit?.mode === 'edit' && view.edit.draft.id === child.id
                    ? <GoalEditor key={`edit:${child.id}`} view={view} ui={ui} />
                    : <Button className="goal-child" disabled={view.disabled} onClick={() => actions.select(child.id)}><span className="goal-row-label">{rowDisplayText(child.text)}</span></Button>}
                {child.completedAt && <span className="goal-completion">✓</span>}
                <Button size="icon-lg" className="goal-icon goal-child-edit" aria-label={`Edit ${child.text}`} title="Edit goal" disabled={view.disabled} onClick={() => actions.edit('edit', child.id)}><ActionIcon name="edit" /></Button>
                <Button size="icon-lg" className="goal-icon" aria-label={`Actions for ${child.text}`} title="Goal actions" aria-haspopup="menu" disabled={view.disabled}
                    onClick={event => actions.menu?.(child.id, event.currentTarget)}><ActionIcon name="more" /></Button>
            </div>)}</div>
            {!children.length && !goal && !view.edit && <p className="goal-empty">{view.state.goals.length ? "No ongoing goals at this level." : "Start with a question you want to understand."}</p>}
            {!view.allGoals && goal && <GoalContentList view={view} ui={ui} goalId={goal.id} />}
            </div>
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
    get editingText() {
        const input = this.panel.querySelector('textarea');
        if (!input) return undefined;
        const original = input.dataset.originalText;
        return original !== undefined && input.value === rowDisplayText(original) ? original : input.value;
    }
    releaseEditorFocus() {
        this.releasingFocus = true;
        this.panel.querySelector('textarea')?.blur();
        this.releasingFocus = false;
    }
    announce(message: string) { this.message = message; if (this.view) this.render(this.view); }
    focusEditor() { requestAnimationFrame(() => this.panel.querySelector('textarea')?.focus({ preventScroll: true })); }
    render(view: GoalView) { this.view = view; renderSurface(this.panel, <GoalPanel view={view} ui={this} />); }
}
