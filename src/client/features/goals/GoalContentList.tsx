import type { GoalUI, GoalView } from './goalUI.js';
import { goalContent } from '../../domain/goalContentEngine.js';
import { ActionIcon } from '../../components/ui/action-icon.js';
import { Button } from '../../components/ui/button.js';
import { GoalMaterialText } from './GoalMaterialText.js';
import { GoalUserInput, GoalSaveError } from './GoalUserInput.js';

export function GoalContentList({ view, ui, goalId }: { view: GoalView; ui: GoalUI; goalId: string }) {
    const annotations = new Map(view.annotations.map(n => [n.id, n]));
    const entries = goalContent(view.state, goalId);
    return <section className="goal-unified-content" aria-label="Goal content">
        <div className="goal-content-divider" />
        <div className="goal-content-region"><ActionIcon name="goal-content" />
            <Button size="icon-lg" id="goal-add-text" aria-label="Add text" title="Add text" disabled={view.disabled} onClick={ui.actions.addInput}><ActionIcon name="goal-add-text" /></Button>
        </div>
        <div className="goal-items" id="goal-content-items">
            {view.inputEdit?.mode === 'input-new' && view.inputEdit.draft.goalId === goalId && <GoalUserInput key={view.inputEdit.draft.id} view={view} ui={ui} />}
            {entries.map(entry => {
                if (entry.kind === 'input') return <GoalUserInput key={entry.input.id} input={entry.input} view={view} ui={ui} />;
                const link = entry.link, note = annotations.get(link.annotationId);
                return <div className="goal-item" key={JSON.stringify([link.goalId, link.bookId, link.generation, link.annotationId])}>
                    <ActionIcon name={note?.kind === 'note' ? 'note' : 'highlight'} className="goal-material-icon" />
                    <div className="goal-item-detail">
                        <Button className="goal-item-text" data-annotation-id={link.annotationId} disabled={!note} onClick={() => ui.actions.jump(link.annotationId)}>
                            {note ? <GoalMaterialText annotation={note} /> : view.materialStatus === 'loading' ? 'Loading…' : 'Source unavailable'}
                        </Button>
                        {(view.fullPage || link.bookId !== view.sourceBook) && <div className="goal-item-source">{view.titles.get(link.bookId) || link.bookId}</div>}
                    </div>
                    <Button size="icon-lg" className="goal-icon" aria-label="Unlink" title="Unlink" disabled={view.disabled} onClick={() => ui.actions.unlink(link.annotationId)}><ActionIcon name="close" /></Button>
                </div>;
            })}
        </div>
        {view.saveError && !entries.some(e => e.kind === 'input' && view.failedInputs.has(e.input.id)) && <GoalSaveError ui={ui} />}
    </section>;
}
