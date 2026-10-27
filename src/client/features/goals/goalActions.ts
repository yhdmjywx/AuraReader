import type { GoalController } from './goalController.js';
import { goalAncestors, goalArea, goalBranch, type GoalOperation } from '../../domain/goalLifecycle.js';

const makeButton = (text: string, run: () => void) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
    button.addEventListener('click', run); return button;
};

/** One menu/dialog implementation shared by Home, the Goal page and the reader sidebar. */
export class GoalActions {
    private menu: HTMLElement | null = null;
    private anchor: HTMLElement | null = null;
    private banner: HTMLElement | null = null;
    private dialog: HTMLDialogElement | null = null;
    constructor(private goals: GoalController) {
        document.addEventListener('pointerdown', event => { if (this.menu && !this.menu.contains(event.target as Node) && !this.anchor?.contains(event.target as Node)) this.close(false); });
        window.addEventListener('resize', () => this.close(false));
    }
    close(focus = true) { this.menu?.remove(); this.menu = null; this.anchor?.setAttribute('aria-expanded', 'false'); if (focus && this.anchor?.isConnected) this.anchor.focus(); }
    open(id: string, anchor: HTMLElement, point?: { x: number; y: number }) {
        if (this.goals.disabled || this.goals.lifecycleBusy || this.dialog) return;
        this.close(false); this.anchor = anchor;
        const state = this.goals.state, goal = state.goals.find(g => g.id === id); if (!goal) return;
        const area = goalArea(state, id), count = goalBranch(state, id).size - 1;
        const menu = document.createElement('div'); menu.className = 'goal-context-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', `Actions for ${goal.text}`);
        menu.addEventListener('keydown', event => {
            // Handle before document-level reading shortcuts, regardless of listener order.
            event.stopPropagation();
            if (event.key === 'Escape' || event.key === 'Tab') { this.close(event.key === 'Escape'); if (event.key === 'Escape') event.preventDefault(); return; }
            const items = [...menu.querySelectorAll<HTMLButtonElement>('button')], index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault(); items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus();
            }
        });
        const add = (text: string, op: GoalOperation, danger = false, confirm = false) => {
            const item = makeButton(text, () => { this.close(); if (confirm) this.confirm(id, op); else void this.run(id, op); });
            item.setAttribute('role', 'menuitem'); item.dataset.operation = op; if (danger) item.className = 'goal-danger'; menu.append(item);
        };
        if (area === 'library') {
            const incomplete = [...goalBranch(state, id)].some(child => goalArea(state, child) !== 'trash' && !state.goals.find(g => g.id === child)?.completedAt);
            add(goal.completedAt ? 'Reopen goal' : count && incomplete ? 'Complete goal and subgoals' : 'Mark as complete', goal.completedAt ? 'reopen' : 'complete');
            add(count ? 'Archive goal and subgoals' : 'Archive', 'archive');
        } else if (area === 'archive') {
            const ancestors = goalAncestors(state, id).slice(1).some(g => g.archivedAt);
            add(ancestors ? 'Restore goal and required ancestors…' : 'Restore from archive', 'unarchive', false, ancestors);
        } else {
            const parentDeleted = goal.parentId && goalArea(state, goal.parentId) === 'trash';
            add(parentDeleted ? 'Restore with required ancestors…' : 'Restore', 'restore', false, !!parentDeleted);
            if (parentDeleted) add('Restore to Library root', 'restore-root');
        }
        const separator = document.createElement('hr'); separator.setAttribute('role', 'separator'); menu.append(separator);
        add(area === 'trash' ? 'Permanently delete…' : 'Delete…', area === 'trash' ? 'purge' : 'delete', true, true);
        document.body.append(menu); this.menu = menu; anchor.setAttribute('aria-expanded', 'true');
        const rect = anchor.getBoundingClientRect(), bounds = menu.getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(point?.x ?? rect.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(point?.y ?? rect.bottom + 4, window.innerHeight - bounds.height - 8))}px`;
        menu.querySelector<HTMLButtonElement>('button')?.focus();
    }
    private async run(id: string, op: GoalOperation) {
        try { await this.goals.operate(id, op); }
        catch (error) { this.notice(error instanceof Error ? error.message : 'Could not save goal changes'); }
    }
    private confirm(id: string, op: GoalOperation) {
        const goal = this.goals.state.goals.find(g => g.id === id); if (!goal || this.dialog) return;
        const dialog = document.createElement('dialog'); this.dialog = dialog; dialog.className = 'goal-confirm';
        dialog.setAttribute('aria-labelledby', 'goal-confirm-title'); dialog.setAttribute('aria-describedby', 'goal-confirm-description');
        const title = document.createElement('h2'); title.id = 'goal-confirm-title';
        const isDelete = op === 'delete' || op === 'purge';
        title.textContent = op === 'purge' ? 'Permanently delete goal?' : op === 'delete' ? 'Delete goal?' : 'Restore goal and ancestors?';
        const description = document.createElement('p'); description.id = 'goal-confirm-description';
        const count = goalBranch(this.goals.state, id).size - 1;
        description.textContent = isDelete ? `“${goal.text}”${count ? ` and ${count} subgoal${count === 1 ? '' : 's'}` : ''}. ${op === 'purge' ? 'This cannot be undone.' : 'Moved to Recently deleted; you can restore it later.'} Original books, highlights and notes will be kept.`
            : `Restore “${goal.text}” and the required ancestors to make it visible. Completion states and independently archived or deleted subgoals will be kept.`;
        const error = document.createElement('p'); error.setAttribute('role', 'alert');
        const close = () => { if (dialog.open && typeof dialog.close === 'function') dialog.close(); dialog.remove(); this.dialog = null; if (this.anchor?.isConnected) this.anchor.focus(); };
        const cancel = makeButton('Cancel', close), submit = makeButton(isDelete ? op === 'purge' ? 'Permanently delete' : 'Delete' : 'Restore', () => {
            cancel.disabled = submit.disabled = true;
            void this.goals.operate(id, op).then(close).catch(cause => { error.textContent = cause instanceof Error ? cause.message : 'Could not save changes'; }).finally(() => { cancel.disabled = submit.disabled = false; });
        });
        if (isDelete) submit.className = 'goal-danger';
        dialog.addEventListener('cancel', event => { event.preventDefault(); if (!submit.disabled) close(); });
        dialog.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.key === 'Tab') { const items = [cancel, submit].filter(b => !b.disabled); if (!items.length) { event.preventDefault(); return; }
                if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)!.focus(); }
                else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); } }
        });
        const buttons = document.createElement('div'); buttons.className = 'goal-confirm-actions'; buttons.append(cancel, submit);
        dialog.append(title, description, error, buttons); document.body.append(dialog);
        if (typeof dialog.showModal === 'function') dialog.showModal(); else { dialog.setAttribute('open', ''); dialog.setAttribute('aria-modal', 'true'); }
        cancel.focus();
    }
    notice(message: string) {
        this.banner?.remove();
        const banner = document.createElement('div'); banner.className = 'goal-lifecycle-notice'; banner.setAttribute('role', 'status');
        const text = document.createElement('span'); text.textContent = message; banner.append(text);
        if (this.goals.undoChange) {
            const undo = makeButton('Undo', () => { void this.goals.undoLifecycle().catch(error => this.notice(error.message)); }); undo.dataset.goalUndo = ''; banner.append(undo);
        }
        const dismiss = makeButton('×', () => { banner.remove(); if (this.banner === banner) this.banner = null; }); dismiss.setAttribute('aria-label', 'Dismiss'); banner.append(dismiss);
        document.body.append(banner); this.banner = banner;
    }
    refresh() { const undo = this.banner?.querySelector<HTMLButtonElement>('[data-goal-undo]'); if (undo) { undo.hidden = !this.goals.undoChange; undo.disabled = this.goals.lifecycleBusy || this.goals.disabled; } }
}
