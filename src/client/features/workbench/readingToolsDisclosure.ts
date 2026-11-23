type BookToolsState = { distance: number; deadline: number | null; hasCollapsed: boolean };

const FIRST_COLLAPSE_DELAY = 10_000;
const RETRACT_DELAY = 220;

export class ReadingToolsDisclosure {
    private readonly states = new Map<string, BookToolsState>();
    private readonly view: Window & typeof globalThis;
    private readonly group: HTMLElement;
    private readonly trigger: HTMLButtonElement;
    private readonly firstTool: HTMLButtonElement;
    private readonly panels: HTMLElement[];
    private bookId = '';
    private state?: BookToolsState;
    private timer?: number;
    private pointerInside = false;
    private clicked = false;
    private restoringFocus = false;

    constructor(private readonly root: HTMLElement) {
        const document = root.ownerDocument;
        this.view = document.defaultView!;
        this.group = root.querySelector<HTMLElement>('#reader-tool-group')!;
        this.trigger = root.querySelector<HTMLButtonElement>('#btn-reading-tools')!;
        this.firstTool = root.querySelector<HTMLButtonElement>('#btn-toc')!;
        this.panels = [...root.querySelectorAll<HTMLElement>('.reader-tool-panel')];

        const observer = new this.view.MutationObserver(() => this.refresh());
        for (const panel of this.panels) observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
        root.addEventListener('pointerenter', event => {
            if (!this.state || event.pointerType === 'touch') return;
            this.pointerInside = true;
            this.setExpanded(true);
            this.refresh();
        });
        root.addEventListener('pointerleave', () => {
            this.pointerInside = false;
            this.refresh();
        });
        this.trigger.addEventListener('click', () => this.reveal());
        root.addEventListener('focusin', event => {
            if (this.restoringFocus) return;
            if (event.target === this.trigger) this.reveal();
            this.refresh();
        });
        root.addEventListener('focusout', () => this.view.queueMicrotask(() => this.refresh()));
        document.addEventListener('click', event => {
            if (!event.composedPath().includes(root)) this.outsideClick();
        }, { capture: true });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented ||
                !this.state?.hasCollapsed || this.root.hasAttribute('data-collapsed')) return;
            if (document.querySelector('.ui-dialog[data-open]')) return;
            const panelWasOpen = this.panelOpen();
            // The current popup handles Escape first, including nested menus.
            this.view.queueMicrotask(() => {
                if (!this.panelOpen() && (panelWasOpen || !event.defaultPrevented)) this.dismiss();
            });
        }, { capture: true });
    }

    setBook(bookId: string) {
        if (bookId === this.bookId) return;
        this.bookId = bookId;
        this.pointerInside = this.clicked = false;
        if (!bookId) {
            this.state = undefined;
        } else {
            const state = this.states.get(bookId) ?? { distance: 0, deadline: null, hasCollapsed: false };
            this.states.set(bookId, state);
            this.state = state;
            if (state.deadline !== null && state.deadline <= this.view.performance.now()) state.hasCollapsed = true;
        }
        this.setExpanded(!this.state?.hasCollapsed);
        this.refresh();
    }

    pageTurned() { this.deferFirstCollapse(); }

    scrolled(distance: number, viewport: number) {
        if (!this.state || this.state.hasCollapsed || distance <= 0 || viewport <= 0) return;
        this.state.distance += distance;
        if (this.state.deadline !== null || this.state.distance >= viewport / 2) this.deferFirstCollapse();
    }

    outsideClick() {
        this.clicked = false;
        this.view.queueMicrotask(() => this.refresh());
    }

    dismiss() {
        if (!this.state?.hasCollapsed) return;
        const returnFocus = this.group.contains(this.root.ownerDocument.activeElement);
        this.pointerInside = this.clicked = false;
        this.view.clearTimeout(this.timer);
        this.setExpanded(false);
        if (returnFocus) {
            this.restoringFocus = true;
            this.trigger.focus({ preventScroll: true });
            this.restoringFocus = false;
        }
    }

    private reveal() {
        if (!this.state || !this.root.hasAttribute('data-collapsed')) return;
        this.clicked = !this.trigger.matches(':focus-visible');
        this.setExpanded(true);
        this.firstTool.focus({ preventScroll: true });
        this.refresh();
    }

    private deferFirstCollapse() {
        if (!this.state || this.state.hasCollapsed) return;
        this.state.deadline = this.view.performance.now() + FIRST_COLLAPSE_DELAY;
        this.refresh();
    }

    private panelOpen() { return this.panels.some(panel => panel.classList.contains('open')); }

    private setExpanded(expanded: boolean) {
        this.root.toggleAttribute('data-collapsed', !expanded);
        this.group.toggleAttribute('inert', !expanded);
        this.trigger.toggleAttribute('inert', expanded);
        this.trigger.tabIndex = expanded ? -1 : 0;
        this.trigger.setAttribute('aria-expanded', String(expanded));
    }

    private refresh() {
        this.view.clearTimeout(this.timer);
        if (!this.state || this.state.deadline === null || this.root.hasAttribute('data-collapsed')) return;
        const active = this.root.ownerDocument.activeElement;
        if (this.pointerInside || this.clicked || this.panelOpen() ||
            (this.group.contains(active) && active!.matches(':focus-visible'))) return;
        const remaining = this.state.hasCollapsed ? 0 : this.state.deadline - this.view.performance.now();
        this.timer = this.view.setTimeout(() => {
            this.state!.hasCollapsed = true;
            this.setExpanded(false);
        }, remaining > 0 ? remaining : RETRACT_DELAY);
    }
}
