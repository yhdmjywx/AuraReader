import { useEffect, useId, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import type { GoalLibraryState } from '../../domain/goal.js';
import { areaGoals, goalAncestors } from '../../domain/goalLifecycle.js';
import { Button } from '../../components/ui/button.js';
import { ActionIcon } from '../../components/ui/action-icon.js';

interface Props {
    state: GoalLibraryState;
    selected: string | null;
    disabled: boolean;
    navigate(id: string | null): Promise<boolean>;
}

/** Named crumbs navigate on click; a single non-modal popup shows their siblings. */
export function GoalBreadcrumbs({ state, selected, disabled, navigate }: Props) {
    const path = selected ? goalAncestors(state, selected).reverse() : [];
    const [anchor, setAnchor] = useState<{ id: string; element: HTMLElement } | null>(null);
    const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const popupId = useId();
    const clearTimers = () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current); };
    const close = () => { clearTimers(); setAnchor(null); };
    useEffect(() => { close(); }, [selected, disabled]);
    useEffect(() => clearTimers, []);

    const enter = (id: string, element: HTMLElement) => {
        clearTimers();
        if (!disabled) openTimer.current = setTimeout(() => setAnchor({ id, element }), 150);
    };
    const leave = () => {
        clearTimers();
        closeTimer.current = setTimeout(() => setAnchor(null), 250);
    };
    const choose = (id: string | null) => { close(); void navigate(id); };
    const hovered = state.goals.find(goal => goal.id === anchor?.id);
    const siblings = hovered ? areaGoals(state, 'library', hovered.parentId, '', 'ongoing') : [];

    return <Popover.Root open={!!anchor} modal={false} onOpenChange={open => { if (!open) close(); }}>
        <nav className="goal-breadcrumbs" aria-label="Goal path">
            <Button id="goal-home-nav" className="goal-crumb" disabled={disabled}
                aria-current={!selected ? 'page' : undefined} onMouseEnter={close} onClick={() => choose(null)}>Goals</Button>
            {path.map(goal => <span className="goal-crumb-segment" key={goal.id}>
                <ActionIcon name="right" className="goal-crumb-separator" />
                <Button className="goal-crumb" data-goal-crumb={goal.id} disabled={disabled}
                    aria-current={goal.id === selected ? 'page' : undefined}
                    aria-haspopup="dialog" aria-expanded={anchor?.id === goal.id} aria-controls={anchor?.id === goal.id ? popupId : undefined}
                    onMouseEnter={event => enter(goal.id, event.currentTarget)} onMouseLeave={leave}
                    onClick={() => choose(goal.id)}><span>{goal.text.replace(/[\r\n]+/gu, ' ')}</span></Button>
            </span>)}
        </nav>
        <Popover.Portal>
            <Popover.Positioner anchor={anchor?.element} side="bottom" align="start" sideOffset={4}
                className="ui-floating-positioner goal-breadcrumb-positioner" onMouseEnter={clearTimers} onMouseLeave={leave}>
                <Popover.Popup id={popupId} className="ui-menu goal-breadcrumb-picker" initialFocus={false} finalFocus={false}
                    aria-label={`Goals at the same level as ${hovered?.text || ''}`} onMouseDown={event => event.preventDefault()}>
                    {siblings.map(goal => <Button key={goal.id} className="goal-breadcrumb-option" data-goal-option={goal.id}
                        aria-current={goal.id === hovered?.id ? 'page' : undefined} disabled={disabled} onClick={() => choose(goal.id)}>
                        <span>{goal.text}</span>{goal.id === hovered?.id && <span className="goal-breadcrumb-check" aria-hidden="true">✓</span>}
                    </Button>)}
                </Popover.Popup>
            </Popover.Positioner>
        </Popover.Portal>
    </Popover.Root>;
}
