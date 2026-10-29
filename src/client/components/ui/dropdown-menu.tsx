import { Menu } from '@base-ui/react/menu';
import type { ComponentProps } from 'react';
import { clsx } from 'clsx';

export const DropdownMenu = Menu.Root;
export const DropdownMenuItem = Menu.Item;
export const DropdownMenuSeparator = Menu.Separator;
export function DropdownMenuContent({ anchor, children, className, ...props }:
    ComponentProps<typeof Menu.Popup> & { anchor: HTMLElement | { getBoundingClientRect(): DOMRect } }) {
    return <Menu.Portal><Menu.Positioner anchor={anchor} align="end" sideOffset={5} className="ui-floating-positioner">
        <Menu.Popup data-slot="dropdown-menu-content" className={clsx('ui-menu', className)} {...props}>{children}</Menu.Popup>
    </Menu.Positioner></Menu.Portal>;
}
