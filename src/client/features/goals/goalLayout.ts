import type { AppElements } from '../../app/elements.js';

const DEFAULT_WIDTH = 280, MIN_WIDTH = 220, MAX_WIDTH = 640, READING_SPACE = 720;
const WIDTH_KEY = 'aura_goal_sidebar_width', CLOSED_KEY = 'aura_goal_sidebar_closed';

export function goalSidebarGeometry(totalWidth: number, preferred = DEFAULT_WIDTH, mode = 'single') {
    const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, totalWidth - READING_SPACE));
    return { available: mode === 'single' && totalWidth >= MIN_WIDTH + READING_SPACE,
        min: MIN_WIDTH, max, width: Math.max(MIN_WIDTH, Math.min(max, preferred)) };
}
function readPreference(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
}
function writePreference(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* Layout preferences must not block reading or saved Goal data. */ }
}
function availableWidth(elements: AppElements) {
    const width = elements.readingWorkspace?.clientWidth || elements.workspaceContainer?.clientWidth || 0;
    const surface = elements.workspaceContainer;
    const style = surface?.ownerDocument.defaultView?.getComputedStyle(surface);
    const gutter = (parseFloat(style?.marginLeft || '') || 0) + (parseFloat(style?.marginRight || '') || 0);
    return Math.max(0, width - gutter);
}
export function positionGoals(elements: AppElements, mode: string, preferred = DEFAULT_WIDTH, closed = false): boolean {
    const { goalPanel: panel, goalSidebar: sidebar, btnGoals: toggle, goalResizer: resizer } = elements;
    if (!panel) return false;
    const geometry = goalSidebarGeometry(availableWidth(elements), preferred, mode);
    const visible = geometry.available && !closed;
    panel.hidden = !visible;
    if (sidebar) { sidebar.hidden = !visible; sidebar.style.width = `${geometry.width}px`; }
    if (toggle) {
        toggle.hidden = !geometry.available;
        toggle.setAttribute('aria-expanded', String(visible));
        toggle.title = visible ? 'Hide goals sidebar' : 'Show goals sidebar';
    }
    if (resizer) {
        resizer.setAttribute('aria-valuemin', String(geometry.min));
        resizer.setAttribute('aria-valuemax', String(geometry.max));
        resizer.setAttribute('aria-valuenow', String(geometry.width));
        resizer.setAttribute('aria-valuetext', `${geometry.width} pixels`);
    }
    return visible;
}

/** Presentation-only splitter. Book/annotation state and backup stay unchanged. */
export class GoalSidebar {
    preferredWidth = DEFAULT_WIDTH;
    closed = false;
    private mode = 'single';
    private drag: { id: number; x: number; width: number; preferred: number } | null = null;
    constructor(private elements: AppElements, private changed: () => void, private finishEdit: () => Promise<void>, private beforeResize = () => {}) {
        const stored = Number(readPreference(WIDTH_KEY));
        if (Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH) this.preferredWidth = stored;
        this.closed = readPreference(CLOSED_KEY) === 'true';
        elements.btnGoals?.addEventListener('click', () => {
            this.finishEdit().then(() => {
                this.beforeResize();
                this.closed = !this.closed;
                writePreference(CLOSED_KEY, String(this.closed)); this.changed();
            }).catch(() => {});
        });
        const handle = elements.goalResizer;
        if (!handle) return;
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || this.drag) return;
            event.preventDefault(); // Do not steal focus; annotations retain their existing outside-click handling.
            this.beforeResize();
            const geometry = goalSidebarGeometry(availableWidth(elements), this.preferredWidth, this.mode);
            this.drag = { id: event.pointerId, x: event.clientX, width: geometry.width, preferred: this.preferredWidth };
            handle.setPointerCapture(event.pointerId);
            elements.goalSidebar?.classList.add('is-resizing');
        });
        handle.addEventListener('pointermove', event => {
            if (!this.drag || event.pointerId !== this.drag.id) return;
            const geometry = goalSidebarGeometry(availableWidth(elements), this.drag.width + event.clientX - this.drag.x, this.mode);
            this.preferredWidth = geometry.width; this.changed();
        });
        handle.addEventListener('pointerup', event => { if (event.pointerId === this.drag?.id) this.endDrag(false); });
        handle.addEventListener('pointercancel', event => { if (event.pointerId === this.drag?.id) this.endDrag(true); });
        handle.addEventListener('lostpointercapture', () => { if (this.drag) this.endDrag(true); });
        handle.ownerDocument.addEventListener('keydown', event => {
            if (this.drag && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.endDrag(true); }
        }, true);
        handle.addEventListener('keydown', event => {
            const geometry = goalSidebarGeometry(availableWidth(elements), this.preferredWidth, this.mode);
            const step = event.shiftKey ? 40 : 10;
            let next: number;
            switch (event.key) {
                case 'ArrowLeft': next = geometry.width - step; break;
                case 'ArrowRight': next = geometry.width + step; break;
                case 'Home': next = geometry.min; break;
                case 'End': next = geometry.max; break;
                default: return;
            }
            event.preventDefault(); event.stopPropagation();
            this.beforeResize();
            this.preferredWidth = goalSidebarGeometry(availableWidth(elements), next, this.mode).width;
            this.saveWidth(); this.changed();
        });
        handle.addEventListener('dblclick', () => { this.beforeResize(); this.preferredWidth = DEFAULT_WIDTH; this.saveWidth(); this.changed(); });
    }
    update(mode: string): boolean {
        this.mode = mode;
        if (this.drag && mode !== 'single') this.endDrag(true);
        return positionGoals(this.elements, mode, this.preferredWidth, this.closed);
    }
    private saveWidth() { writePreference(WIDTH_KEY, String(this.preferredWidth)); }
    private endDrag(cancel: boolean) {
        const drag = this.drag; if (!drag) return;
        this.drag = null;
        if (cancel) this.preferredWidth = drag.preferred; else this.saveWidth();
        const handle = this.elements.goalResizer;
        if (handle?.hasPointerCapture(drag.id)) handle.releasePointerCapture(drag.id);
        this.elements.goalSidebar?.classList.remove('is-resizing'); this.changed();
    }
}
