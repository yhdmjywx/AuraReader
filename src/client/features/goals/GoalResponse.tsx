import type { ReactNode } from 'react';
import type { GoalResponseTarget } from '../../domain/goalContentEngine.js';
import { responseTargetKey } from '../../domain/goalContentEngine.js';
import type { GoalUI, GoalView } from './goalUI.js';
import { Button } from '../../components/ui/button.js';
import { ActionIcon } from '../../components/ui/action-icon.js';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuCheckboxItemIndicator } from '../../components/ui/dropdown-menu.js';

export function ResponseTagControl({ target, marked, disabled, open, onOpenChange, ui }: {
    target: GoalResponseTarget; marked: boolean; disabled: boolean; open: boolean; onOpenChange(open: boolean): void; ui: GoalUI;
}) {
    return <DropdownMenu open={open && !disabled} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenuTrigger render={<Button size="icon-lg" className="goal-response-trigger" />} aria-label="Response" title="Response" disabled={disabled} data-marked={marked ? '' : undefined}>
            <ActionIcon name="response-tag" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" align="center" className="goal-response-menu" aria-label="Response options">
            <DropdownMenuCheckboxItem checked={marked} closeOnClick disabled={disabled} onCheckedChange={value => ui.actions.setResponse(target, value)}>
                <span>Response</span><span className="goal-response-check"><DropdownMenuCheckboxItemIndicator><ActionIcon name="check" /></DropdownMenuCheckboxItemIndicator></span>
            </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
    </DropdownMenu>;
}
export function GoalResponseItem({ target, marked, menuOpen, view, ui, children }: {
    target: GoalResponseTarget; marked: boolean; menuOpen: boolean; view: GoalView; ui: GoalUI; children: ReactNode;
}) {
    const write = view.responseWrites.get(responseTargetKey(target));
    return <div className="goal-response-item" data-response={marked ? '' : undefined} data-menu-open={menuOpen ? '' : undefined}>
        {marked && <div className="goal-response-header"><span className="goal-response-label">Response</span></div>}
        {children}
        {write && <div className="goal-response-feedback" role={write.status === 'error' && !write.dismissed ? 'alert' : 'status'}>
            {write.status === 'saving' ? <span>Saving…</span> : <>
                <span>{write.dismissed ? 'Not saved' : 'Couldn’t save Response.'}</span>
                <Button className="goal-input-retry" onClick={() => ui.actions.retryResponse(target)}>Retry</Button>
                {!write.dismissed && <Button size="icon-lg" aria-label="Dismiss Response save error" title="Dismiss save error" onClick={() => ui.actions.dismissResponseError(target)}><ActionIcon name="close" /></Button>}
            </>}
        </div>}
    </div>;
}
