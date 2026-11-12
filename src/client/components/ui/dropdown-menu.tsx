import { Menu } from '@base-ui/react/menu';
import type { ComponentProps } from 'react';
import { clsx } from 'clsx';

export const DropdownMenu = Menu.Root;
export const DropdownMenuItem = Menu.Item;
export const DropdownMenuSeparator = Menu.Separator;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuCheckboxItem = Menu.CheckboxItem;
export const DropdownMenuCheckboxItemIndicator = Menu.CheckboxItemIndicator;
export function DropdownMenuContent({ anchor, children, className, side, align = 'end', sideOffset = 5, ...props }:
    ComponentProps<typeof Menu.Popup> & { anchor?: ComponentProps<typeof Menu.Positioner>['anchor']; side?: ComponentProps<typeof Menu.Positioner>['side']; align?: ComponentProps<typeof Menu.Positioner>['align']; sideOffset?: number }) {
    return <Menu.Portal><Menu.Positioner anchor={anchor} side={side} align={align} sideOffset={sideOffset} className="ui-floating-positioner">
        <Menu.Popup data-slot="dropdown-menu-content" className={clsx('ui-menu', className)} {...props}>{children}</Menu.Popup>
    </Menu.Positioner></Menu.Portal>;
}
