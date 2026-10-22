/** Resolve delegated DOM events, including clicks whose target is a text node. */
export function eventElement(event: Event): Element | null {
    const target = event.target;
    if (!target) return null;
    if ('closest' in target && typeof target.closest === 'function') return target as Element;
    return (target as Node).parentElement || null;
}
