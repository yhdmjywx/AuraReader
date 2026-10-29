import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

const roots = new WeakMap<HTMLElement, Root>();
/** Stable React ownership for views called by existing feature controllers. */
export function renderSurface(host: HTMLElement, content: ReactNode) {
    let root = roots.get(host);
    if (!root) { host.replaceChildren(); root = createRoot(host); roots.set(host, root); }
    root.render(content);
}
