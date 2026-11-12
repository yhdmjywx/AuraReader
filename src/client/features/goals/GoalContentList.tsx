import type { GoalUI, GoalView } from './goalUI.js';
import { useEffect, useState } from 'react';
import { responseTargetKey, type GoalResponseTarget } from '../../domain/goalContentEngine.js';
import { GoalResponseItem, ResponseTagControl } from './GoalResponse.js';
import { goalContent } from '../../domain/goalContentEngine.js';
import { ActionIcon } from '../../components/ui/action-icon.js';
import { Button } from '../../components/ui/button.js';
import { GoalMaterialText } from './GoalMaterialText.js';
import { GoalUserInput, GoalSaveError } from './GoalUserInput.js';

export function GoalContentList({ view, ui, goalId }: { view: GoalView; ui: GoalUI; goalId: string }) {
    const annotations = new Map(view.annotations.map(n => [n.id, n]));
    const entries = goalContent(view.state, goalId);
    const [openKey, setOpenKey] = useState<string | null>(null);
    const openExists = entries.some(entry => responseTargetKey(entry.kind === 'input' ? { kind: 'input', goalId, id: entry.input.id }
        : { kind: 'annotation', goalId, annotationId: entry.link.annotationId, bookId: entry.link.bookId, generation: entry.link.generation, associationOrder: entry.order }) === openKey
        && (entry.kind === 'input' || annotations.has(entry.link.annotationId)));
    useEffect(() => { if (!openExists || view.disabled || view.edit || view.inputEdit) setOpenKey(null); }, [openExists, view.disabled, view.edit, view.inputEdit]);
    const tag = (target: GoalResponseTarget, marked: boolean, unavailable = false) => <ResponseTagControl target={target} marked={marked} ui={ui}
        disabled={view.disabled || !!view.inputEdit || !!view.edit || unavailable} open={openKey === responseTargetKey(target)}
        onOpenChange={open => setOpenKey(current => open ? responseTargetKey(target) : current === responseTargetKey(target) ? null : current)} />;
    return <section className="goal-unified-content" aria-label="Goal content">
        <div className="goal-content-divider" />
        <div className="goal-content-region"><ActionIcon name="goal-content" />
            <Button size="icon-lg" id="goal-add-text" aria-label="Add text" title="Add text" disabled={view.disabled} onClick={ui.actions.addInput}><ActionIcon name="goal-add-text" /></Button>
        </div>
        <div className="goal-items" id="goal-content-items">
            {view.inputEdit?.mode === 'input-new' && view.inputEdit.draft.goalId === goalId && <GoalUserInput key={view.inputEdit.draft.id} view={view} ui={ui} />}
            {entries.map(entry => {
                if (entry.kind === 'input') {
                    const target: GoalResponseTarget = { kind: 'input', goalId, id: entry.input.id };
                    return <GoalResponseItem key={responseTargetKey(target)} target={target} marked={!!entry.input.response} menuOpen={openKey === responseTargetKey(target)} view={view} ui={ui}>
                        <GoalUserInput input={entry.input} view={view} ui={ui} actionsBefore={tag(target, !!entry.input.response)} />
                    </GoalResponseItem>;
                }
                const link = entry.link, note = annotations.get(link.annotationId);
                const target: GoalResponseTarget = { kind: 'annotation', goalId, annotationId: link.annotationId, bookId: link.bookId, generation: link.generation, associationOrder: entry.order };
                return <GoalResponseItem key={responseTargetKey(target)} target={target} marked={!!link.response} menuOpen={openKey === responseTargetKey(target)} view={view} ui={ui}><div className="goal-item">
                    <ActionIcon name={note?.kind === 'note' ? 'note' : 'highlight'} className="goal-material-icon" />
                    <div className="goal-item-detail">
                        <Button className="goal-item-text" data-annotation-id={link.annotationId} disabled={!note} onClick={() => ui.actions.jump(link.annotationId)}>
                            {note ? <GoalMaterialText annotation={note} /> : view.materialStatus === 'loading' ? 'Loading…' : 'Source unavailable'}
                        </Button>
                        {(view.fullPage || link.bookId !== view.sourceBook) && <div className="goal-item-source">{view.titles.get(link.bookId) || link.bookId}</div>}
                    </div>
                    <div className="goal-material-actions">{tag(target, !!link.response, !note)}
                        <Button size="icon-lg" className="goal-icon" aria-label="Unlink" title="Unlink" disabled={view.disabled} onClick={() => ui.actions.unlink(link.annotationId)}><ActionIcon name="close" /></Button>
                    </div>
                </div></GoalResponseItem>;
            })}
        </div>
        {view.saveError && !entries.some(e => e.kind === 'input' && view.failedInputs.has(e.input.id)) && <GoalSaveError ui={ui} />}
    </section>;
}
