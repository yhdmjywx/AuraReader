import type { GoalController } from './goalController.js';
import { goalAncestors, goalArea, goalBranch, type GoalOperation } from '../../domain/goalLifecycle.js';
import { Button } from '../../components/ui/button.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu.js';
import { renderSurface } from '../../components/ui/renderSurface.js';

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
        this.menuOpen = true; anchor.setAttribute('aria-expanded', 'true'); this.render();
    }
    private async run(id: string, operation: GoalOperation) {
        try { await this.goals.operate(id, operation); }
        catch (error) { this.notice(error instanceof Error ? error.message : '无法保存 Goal'); }
    }
    notice(message: string) { this.message = message; this.render(); }
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
                {anchor && <DropdownMenuContent anchor={anchor} aria-label={goal ? `Actions for ${goal.text}` : 'Goal actions'}
                    finalFocus={() => this.restoreFocus ? this.anchor : false}>
                    {goal && area === 'library' && <>
                        {item(goal.completedAt ? '重新开始' : '标记完成', goal.completedAt ? 'reopen' : 'complete')}
                        {item('归档', 'archive')}
                    </>}
                    {goal && area === 'archive' && item('从归档恢复', 'unarchive', goalAncestors(state, goal.id).slice(1).some(g => !!g.archivedAt))}
                    {goal && area === 'trash' && <>
                        {item('恢复', 'restore', !!goal.parentId && goalArea(state, goal.parentId) === 'trash')}
                        {goal.parentId && goalArea(state, goal.parentId) === 'trash' && item('恢复到书库根目录', 'restore-root')}
                    </>}
                    <DropdownMenuSeparator />
                    {item(area === 'trash' ? '永久删除…' : '删除…', area === 'trash' ? 'purge' : 'delete', true, true)}
                </DropdownMenuContent>}
            </DropdownMenu>
            <Dialog open={!!current} onOpenChange={open => { if (!open) closeDialog(); }}>
                <DialogContent finalFocus={() => this.anchor}>
                    <DialogTitle>{operation === 'purge' ? '永久删除 Goal？' : deleting ? '删除 Goal？' : '恢复 Goal 及上级？'}</DialogTitle>
                    <DialogDescription>{current && <>“{current.text}”及其 {goalBranch(state, current.id).size - 1} 个子 Goal。
                        {operation === 'purge' ? '此操作无法撤销。' : deleting ? '可在最近删除中恢复。' : '所需的上级 Goal 将一并恢复。'}原书、高亮和笔记保留。</>}</DialogDescription>
                    {this.error && <p role="alert">{this.error}</p>}
                    <div className="ui-dialog-actions">
                        <Button disabled={this.busy} onClick={closeDialog}>取消</Button>
                        <Button variant={deleting ? 'destructive' : 'default'} disabled={this.busy} onClick={() => {
                            const action = this.confirmation!; this.busy = true; this.render();
                            void this.goals.operate(action.id, action.operation).then(() => { this.confirmation = null; })
                                .catch(error => { this.error = error instanceof Error ? error.message : '保存失败'; })
                                .finally(() => { this.busy = false; this.render(); });
                        }}>{this.busy ? '保存中…' : deleting ? '删除' : '恢复'}</Button>
                    </div>
                </DialogContent>
            </Dialog>
            {this.message && <div className="goal-lifecycle-notice" role="status"><span>{this.message}</span>
                {this.goals.undoChange && <Button disabled={this.goals.lifecycleBusy || this.goals.disabled}
                    onClick={() => { void this.goals.undoLifecycle().catch(error => this.notice(error.message)); }}>撤销</Button>}
                <Button aria-label="Dismiss" onClick={() => { this.message = ''; this.render(); }}>×</Button>
            </div>}
        </>);
    }
}
