import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

// Source-owned, shadcn-style variants; the workbench's CSS tokens also cover engine controls.
const buttonVariants = cva('ui-button', {
    variants: {
        variant: { default: 'ui-button-primary', secondary: 'ui-button-secondary', ghost: '', destructive: 'ui-button-danger' },
        size: { default: '', sm: 'ui-button-sm', icon: 'ui-button-icon',
            'icon-lg': 'vega-action vega-action-icon', lg: 'vega-action vega-action-text' },
    },
    defaultVariants: { variant: 'ghost', size: 'default' },
});
export function Button({ className, variant, size, type = 'button', ...props }:
    ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>) {
    return <ButtonPrimitive data-slot="button" type={type} className={clsx(buttonVariants({ variant, size }), className)} {...props} />;
}
