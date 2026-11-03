import type { GoalController } from './goalController.js';
import { goalAncestors, goalArea, goalBranch, type GoalOperation } from '../../domain/goalLifecycle.js';
import { Button } from '../../components/ui/button.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu.js';
import { renderSurface } from '../../components/ui/renderSurface.js';
import { countLabel } from '../../domain/format.js';

/** One React/Base UI overlay shared by every Goal surface. */
export class GoalActions {
    private readonly host = document.createElement('div');
    private anchor: HTMLElement | null = null;
    private point?: { x: number; y: number };
    private goalId: string | null = null;
    private menuOpen = false;
    private restoreFocus = true;
    private confirmation: { id: string; operation: GoalOperation } | null = null;
    private busy = false;
    private error = '';
    private message = '';
    private messageError = false;
    private noticeTimer?: ReturnType<typeof setTimeout>;
    private noticePoint?: { left: number; top: number };
    constructor(private goals: GoalController) {
        this.host.dataset.reactGoalOverlays = '';
        document.body.append(this.host);
        window.addEventListener('resize', () => this.close(false));
    }
    close(focus = true) {
        this.restoreFocus = focus; this.menuOpen = false;
        this.anchor?.setAttribute('aria-expanded', 'false'); this.render();
    }
    open(id: string, anchor: HTMLElement, point?: { x: number; y: number }) {
        if (this.goals.disabled || this.goals.lifecycleBusy || this.confirmation) return;
        this.anchor?.setAttribute('aria-expanded', 'false');
        this.goalId = id; this.anchor = anchor; this.point = point; this.restoreFocus = true;
        const rect = anchor.getBoundingClientRect();
        this.noticePoint = { left: rect.left, top: rect.bottom + 8 };
        this.menuOpen = true; anchor.setAttribute('aria-expanded', 'true'); this.render();
    }
    private async run(id: string, operation: GoalOperation) {
        try { await this.goals.operate(id, operation); }
        catch (error) { this.notice(error instanceof Error ? error.message : "Could not save goal", true); }
    }
    notice(message: string, error = false) {
        clearTimeout(this.noticeTimer); this.message = message; this.messageError = error; this.render();
        if (!error && !this.goals.undoChange) this.noticeTimer = setTimeout(() => { this.message = ''; this.render(); }, 2600);
    }
    refresh() { this.render(); }
    private render() {
        const state = this.goals.state, goal = state.goals.find(g => g.id === this.goalId);
        const area = goal ? goalArea(state, goal.id) : 'library';
        const item = (label: string, operation: GoalOperation, confirm = false, danger = false) =>
            <DropdownMenuItem key={operation} data-operation={operation} className={danger ? 'ui-danger' : undefined}
                onClick={() => {
                    const id = this.goalId!;
                    this.close(!confirm);
                    if (confirm) { this.confirmation = { id, operation }; this.error = ''; this.render(); }
                    else void this.run(id, operation);
                }}>{label}</DropdownMenuItem>;
        const current = this.confirmation && state.goals.find(g => g.id === this.confirmation!.id);
        const operation = this.confirmation?.operation;
        const deleting = operation === 'delete' || operation === 'purge';
        const closeDialog = () => { if (!this.busy) { this.confirmation = null; this.render(); } };
        const anchor = this.point ? { getBoundingClientRect: () => new DOMRect(this.point!.x, this.point!.y, 0, 0) } : this.anchor;
        renderSurface(this.host, <>
            <DropdownMenu open={this.menuOpen && !!goal} onOpenChange={open => { if (!open) this.close(); }} modal={false}>
                {anchor && <DropdownMenuContent anchor={anchor} className="goal-action-menu" aria-label={goal ? `Actions for ${goal.text}` : 'Goal actions'}
                    finalFocus={() => this.restoreFocus ? this.anchor : false}>
                    {goal && area === 'library' && <>
                        {item(goal.completedAt ? "Reopen" : "complete", goal.completedAt ? 'reopen' : 'complete')}
                        {item("Archive", 'archive')}
                    </>}
                    {goal && area === 'archive' && item("Unarchive", 'unarchive', goalAncestors(state, goal.id).slice(1).some(g => !!g.archivedAt))}
                    {goal && area === 'trash' && <>
                        {item("Restore", 'restore', !!goal.parentId && goalArea(state, goal.parentId) === 'trash')}
                        {goal.parentId && goalArea(state, goal.parentId) === 'trash' && item("Restore to library root", 'restore-root')}
                    </>}
                    <DropdownMenuSeparator />
                    {item(area === 'trash' ? "Delete permanently…" : "Delete", area === 'trash' ? 'purge' : 'delete', true, true)}
                </DropdownMenuContent>}
            </DropdownMenu>
            <Dialog open={!!current} onOpenChange={open => { if (!open) closeDialog(); }}>
                <DialogContent finalFocus={() => this.anchor}>
                    <DialogTitle>{operation === 'purge' ? "Delete goal permanently?" : deleting ? "Delete goal?" : "Restore goal and ancestors?"}</DialogTitle>
                    <DialogDescription>{current && <>“{current.text}” and {countLabel(goalBranch(state, current.id).size - 1, 'child goal')}.{' '}
                        {operation === 'purge' ? "This cannot be undone. " : deleting ? "You can restore it from Recently Deleted. " : "Required ancestor goals will also be restored. "}Books, highlights, and notes are kept.</>}</DialogDescription>
                    {this.error && <p role="alert">{this.error}</p>}
                    <div className="ui-dialog-actions">
                        <Button disabled={this.busy} onClick={closeDialog}>Cancel</Button>
                        <Button variant={deleting ? 'destructive' : 'default'} disabled={this.busy} onClick={() => {
                            const action = this.confirmation!; this.busy = true; this.render();
                            void this.goals.operate(action.id, action.operation).then(() => { this.confirmation = null; })
                                .catch(error => { this.error = error instanceof Error ? error.message : "Save failed"; })
                                .finally(() => { this.busy = false; this.render(); });
                        }}>{this.busy ? "Saving…" : deleting ? "Delete" : "Restore"}</Button>
                    </div>
                </DialogContent>
            </Dialog>
            {this.message && <div className="goal-lifecycle-notice" role={this.messageError ? 'alert' : 'status'} data-kind={this.messageError ? 'error' : 'success'}
                style={this.noticePoint ? { left: Math.max(12, Math.min(this.noticePoint.left, window.innerWidth - 372)), top: Math.min(this.noticePoint.top, window.innerHeight - 120), bottom: 'auto', transform: 'none', maxWidth: 'min(360px, calc(100vw - 24px))' } : undefined}><span>{this.message}</span>
                {this.goals.undoChange && <Button disabled={this.goals.lifecycleBusy || this.goals.disabled}
                    onClick={() => { void this.goals.undoLifecycle().catch(error => this.notice(error.message, true)); }}>Undo</Button>}
                <Button aria-label="Dismiss" onClick={() => { this.message = ''; this.render(); }}>×</Button>
            </div>}
        </>);
    }
}
