/** Match actual scroll movement to recent input, ignoring programmatic placement. */
export function observeReadingScroll(
    viewport: HTMLElement, contentDocument: Document, signal: AbortSignal, contentSignal: AbortSignal,
    read: () => { offset: number; extent: number } | null, report: (distance: number, extent: number) => void
) {
    const clock = viewport.ownerDocument.defaultView!.performance;
    let offset = 0;
    let intentUntil = -Infinity;
    let draggingScrollbar = false;

    function markIntent(event: Event) {
        if (!event.isTrusted || event.defaultPrevented) return;
        const position = read();
        if (!position) return;
        const now = clock.now();
        if (now > intentUntil) offset = position.offset;
        intentUntil = now + 250;
    }

    function onScroll() {
        const position = read();
        if (!position) return;
        const now = clock.now();
        const distance = Math.abs(position.offset - offset);
        offset = position.offset;
        if (distance > 0 && (draggingScrollbar || now <= intentUntil)) {
            intentUntil = now + 250;
            report(distance, position.extent);
        }
    }

    function bind(target: HTMLElement | Document, bindings: AbortSignal) {
        const options = { passive: true, capture: true, signal: bindings } as const;
        target.addEventListener('scroll', onScroll, options);
        target.addEventListener('wheel', event => {
            const wheel = event as WheelEvent;
            if (!wheel.ctrlKey && !wheel.altKey && !wheel.metaKey) markIntent(wheel);
        }, options);
        target.addEventListener('touchmove', markIntent, options);
        target.addEventListener('keydown', event => {
            const key = event as KeyboardEvent;
            if (key.altKey || key.ctrlKey || key.metaKey || key.isComposing) return;
            if (key.target && (key.target as Element).closest?.('input, textarea, select, button, [contenteditable]')) return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(key.key)) {
                markIntent(key);
            }
        }, options);
    }

    bind(viewport, signal);
    if (contentDocument !== viewport.ownerDocument) bind(contentDocument, contentSignal);
    viewport.addEventListener('pointerdown', event => {
        if (event.target !== viewport || event.button !== 0) return;
        const bounds = viewport.getBoundingClientRect();
        if (event.clientX >= bounds.left + viewport.clientLeft &&
            event.clientX < bounds.left + viewport.clientLeft + viewport.clientWidth) return;
        markIntent(event);
        draggingScrollbar = event.isTrusted;
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'blur']) {
        viewport.ownerDocument.defaultView!.addEventListener(type, () => { draggingScrollbar = false; }, { signal });
    }
    return () => {
        intentUntil = -Infinity;
        draggingScrollbar = false;
    };
}
