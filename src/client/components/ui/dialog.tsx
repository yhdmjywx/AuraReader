import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { ComponentProps } from 'react';
import { clsx } from 'clsx';

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({ children, className, keepMounted, ...props }: ComponentProps<typeof DialogPrimitive.Popup> & { keepMounted?: boolean }) {
    return <DialogPrimitive.Portal keepMounted={keepMounted}><DialogPrimitive.Backdrop className="ui-dialog-backdrop" />
        <DialogPrimitive.Popup data-slot="dialog-content" className={clsx('ui-dialog', className)} {...props}>{children}</DialogPrimitive.Popup>
    </DialogPrimitive.Portal>;
}
