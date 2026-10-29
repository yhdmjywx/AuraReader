import type { ComponentProps } from 'react';
import { clsx } from 'clsx';

export function Input({ className, ...props }: ComponentProps<'input'>) {
    return <input data-slot="input" className={clsx('ui-input', className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
    return <textarea data-slot="textarea" className={clsx('ui-input ui-textarea', className)} {...props} />;
}
