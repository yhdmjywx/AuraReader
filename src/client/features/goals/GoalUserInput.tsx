import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GoalInput } from '../../domain/goal.js';
import type { GoalUI, GoalView } from './goalUI.js';
import { ActionIcon } from '../../components/ui/action-icon.js';
import { Button } from '../../components/ui/button.js';
import { Textarea } from '../../components/ui/input.js';

export function GoalSaveError({ ui }: { ui: GoalUI }) {
    return <div className="goal-input-error" role="alert"><span>Couldn’t save.</span>
        <Button className="goal-input-retry" onClick={ui.actions.retry}>Retry</Button>
        <Button size="icon-lg" className="goal-input-dismiss" aria-label="Dismiss save error" title="Dismiss save error" onClick={ui.actions.dismissError}><ActionIcon name="close" /></Button>
    </div>;
}
function InputEditor({ view, ui }: { view: GoalView; ui: GoalUI }) {
    const edit = view.inputEdit!, editor = useRef<HTMLTextAreaElement>(null), composing = useRef(false);
    const [text, setText] = useState(edit.draft.text);
    useLayoutEffect(() => { const input = editor.current!; input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }, []);
    return <div className="goal-input-editor">
        <span className="goal-input-measure" aria-hidden="true">{text || '\u200b'}</span>
        <Textarea ref={editor} rows={1} defaultValue={edit.draft.text} disabled={view.disabled}
            aria-label={edit.mode === 'input-new' ? 'New goal text' : 'Edit goal text'} placeholder="Write…" aria-keyshortcuts="Escape Control+Enter Meta+Enter"
            onInput={event => { setText(event.currentTarget.value); ui.actions.input(event.currentTarget.value); }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; setText(event.currentTarget.value); ui.actions.input(event.currentTarget.value); }}
            onKeyDown={event => {
                event.stopPropagation(); if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); ui.actions.finish(); }
            }} onBlur={() => { if (!ui.releasingFocus) ui.actions.finish(); }} />
    </div>;
}
export function GoalUserInput({ input, view, ui, actionsBefore }: { input?: GoalInput; view: GoalView; ui: GoalUI; actionsBefore?: ReactNode }) {
    const editing = !!view.inputEdit && (input ? view.inputEdit.draft.id === input.id : view.inputEdit.mode === 'input-new');
    const id = input?.id || view.inputEdit!.draft.id;
    return <article className="goal-user-input" data-input-id={id} data-editing={editing ? '' : undefined} data-disabled={view.disabled ? '' : undefined}>
        <div className="goal-input-body"><ActionIcon name="goal-text" className="goal-input-type" />
            {editing ? <InputEditor key={id} view={view} ui={ui} /> : <div className="goal-input-text">{input!.text}</div>}
        </div>
        {!editing && <div className="goal-input-actions" data-response-actions={actionsBefore ? '' : undefined}>
            {actionsBefore}
            <Button size="icon-lg" aria-label="Edit text" title="Edit text" disabled={view.disabled} onClick={() => ui.actions.editInput(id)}><ActionIcon name="edit" /></Button>
            <Button size="icon-lg" aria-label="Delete text" title="Delete text" disabled={view.disabled} onClick={() => ui.actions.deleteInput(id)}><ActionIcon name="delete" /></Button>
        </div>}
        {view.saveError && view.failedInputs.has(id) && <GoalSaveError ui={ui} />}
    </article>;
}
