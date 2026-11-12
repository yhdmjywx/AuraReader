export type AppSurface = 'home' | 'reader' | 'goal';

/** Page authority only. Book, reading Goal and Home browsing state stay with their owners. */
export class AppNavigation {
    private current: AppSurface;
    private revision = 0;
    private listeners = new Set<(surface: AppSurface) => void>();
    returnTarget: 'home' | 'reader' = 'home';

    constructor(initial: AppSurface = 'reader') { this.current = initial; }
    get surface() { return this.current; }
    get request() { return this.revision; }
    begin() { return ++this.revision; }
    isCurrent(request: number) { return request === this.revision; }
    commit(surface: AppSurface, request = this.revision) {
        if (!this.isCurrent(request)) return false;
        if (surface === 'goal' && this.current !== 'goal') this.returnTarget = this.current;
        this.current = surface;
        for (const listener of this.listeners) listener(surface);
        return true;
    }
    show(surface: AppSurface) { return this.commit(surface, this.begin()); }
    subscribe(listener: (surface: AppSurface) => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
}
