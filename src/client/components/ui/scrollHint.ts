export function syncScrollHint(panel?: HTMLElement | null, list?: HTMLElement | null) {
    if (!panel || !list) return;
    // The scroll offset can be fractional while both heights are rounded.
    const remaining = list.scrollHeight - list.clientHeight - list.scrollTop;
    const visible = !panel.hidden && panel.getAttribute('aria-hidden') !== 'true';
    panel.toggleAttribute('data-can-scroll-down', visible && remaining > 1);
}

export function observeScrollHint(panel?: HTMLElement | null, list?: HTMLElement | null) {
    if (!panel || !list) return;
    const refresh = () => syncScrollHint(panel, list);
    list.addEventListener('scroll', refresh, { passive: true });
    const ResizeObserver = list.ownerDocument.defaultView?.ResizeObserver;
    const observer = ResizeObserver ? new ResizeObserver(refresh) : undefined;
    observer?.observe(list);
    return () => {
        observer?.disconnect();
        list.removeEventListener('scroll', refresh);
    };
}
