import { eventElement } from './dom.js';
import { unwrapDesktop } from '../infrastructure/storageClient.js';
import type { AppElements } from './elements.js';
import type { ShellCallbacks, ToastOptions } from './contracts.js';
import type { AppSurface } from './navigation.js';
/* ==========================================================================
   AppShell - Application Shell & Global Presentation / Input Dispatcher
   Authority owner of: appTheme ('light' | 'dark').
   Coordinates Toast notifications, top header global actions,
   window resize debounce, and global keyboard shortcuts routing.
   ========================================================================== */

export class AppShell {
    callbacks: ShellCallbacks;
    appTheme: 'light' | 'dark';
    elements: AppElements | null;
    resizeDebounceTimer: ReturnType<typeof setTimeout> | undefined;
    private toastTimer?: ReturnType<typeof setTimeout>;
    private feedbackAnchor: HTMLElement | null = null;
    private feedbackRect?: DOMRect;
    constructor(callbacks: ShellCallbacks = {}) {
        this.callbacks = callbacks;
        this.appTheme = 'light';
        this.elements = null;
        this.resizeDebounceTimer = undefined;
    }

    showToast(msg: string, { kind = 'success', anchor = this.feedbackAnchor }: ToastOptions = {}) {
        if (!this.elements || !this.elements.toastMsg || !msg) return;
        clearTimeout(this.toastTimer);
        const toast = this.elements.toastMsg;
        toast.textContent = msg;
        toast.dataset.kind = kind;
        toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        if (kind === 'error') {
            const close = toast.ownerDocument.createElement('button');
            close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss error'); close.title = 'Dismiss error';
            close.onclick = () => toast.classList.remove('show'); toast.append(close);
        }
        toast.style.removeProperty('left'); toast.style.removeProperty('top'); toast.style.removeProperty('bottom');
        const rect = anchor?.isConnected ? anchor.getBoundingClientRect() : anchor === this.feedbackAnchor ? this.feedbackRect : undefined;
        toast.classList.toggle('is-local', !!rect?.width);
        if (rect?.width) {
            const width = toast.offsetWidth, height = toast.offsetHeight;
            toast.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
            toast.style.top = `${Math.max(12, rect.bottom + height + 20 <= window.innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`;
            toast.style.bottom = 'auto';
        }
        toast.classList.add('show');
        if (kind !== 'error') this.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    setBookLoading(loading: boolean) {
        // Leave header and shelf controls available for a newer book request.
        for (const panel of [this.elements?.readerPanel, this.elements?.notesPanel, this.elements?.goalPanel]) {
            if (!panel) continue;
            panel.inert = loading;
            panel.setAttribute('aria-busy', String(loading));
        }
    }

    presentSurface(surface: AppSurface) {
        if (typeof document === 'undefined') return;
        document.documentElement.dataset.appSurface = surface;
        const e = this.elements;
        const home = document.getElementById('goal-home');
        if (home) home.hidden = surface !== 'home';
        if (e?.readingWorkspace) e.readingWorkspace.hidden = surface !== 'reader';
        if (e?.goalPage) e.goalPage.hidden = surface !== 'goal';
        for (const control of [e?.btnToc, e?.btnShelf]) if (control) control.hidden = surface !== 'reader';
        for (const control of [e?.btnExportMarkdown, e?.chapterExportEntry]) if (control) control.hidden = surface !== 'reader';
        this.syncWindowControls();
        const status = document.getElementById('app-status');
        if (status) { status.hidden = true; status.replaceChildren(); }
        const back = e?.btnGoalBack;
        if (back) { back.title = back.getAttribute('aria-label') || "Back"; }
        requestAnimationFrame(() => {
            if (document.documentElement.dataset.appSurface !== surface || document.body.inert) return;
            const target = surface === 'home' ? document.getElementById('home-goal-title')
                : surface === 'goal' ? e?.goalPanel : e?.readerPanel;
            if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
        });
    }

    toggleAppTheme() {
        if (this.appTheme === 'light') {
            this.appTheme = 'dark';
            document.body.className = 'theme-dark';
            if (this.elements && this.elements.btnThemeToggle) {
                this.elements.btnThemeToggle.innerHTML = '<i class="ri-moon-line"></i>';
            }
        } else {
            this.appTheme = 'light';
            document.body.className = 'theme-light';
            if (this.elements && this.elements.btnThemeToggle) {
                this.elements.btnThemeToggle.innerHTML = '<i class="ri-sun-line"></i>';
            }
        }
        this.callbacks.onThemeChanged?.();
        this.syncWindowControls();
    }

    syncWindowControls() {
        const desktop = window.auraDesktop;
        if (desktop?.platform !== 'win32') return;
        const paper = document.documentElement.dataset.appSurface === 'reader' ? this.elements?.readerPanel : null;
        const dark = paper?.classList.contains('paper-dark') || (
            !paper?.matches('.paper-white, .paper-sepia') && this.appTheme === 'dark'
        );
        void desktop.window.setControlsTone(dark ? 'light' : 'dark').then(unwrapDesktop)
            .catch(error => console.error('Could not update window controls:', error));
    }

    toggleAppearance(forceOpen?: boolean) {
        const panel = this.elements && this.elements.appearancePanel;
        const button = this.elements && this.elements.btnAppearance;
        if (!panel) return;
        const open = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
        if (open) {
            this.closeExportPanel();
            this.callbacks.onOpenPanel?.();
        } else {
            this.callbacks.onCloseAppearance?.();
            if (panel.contains(document.activeElement)) button?.focus({ preventScroll: true });
        }
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', String(!open));
        if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) requestAnimationFrame(() => { if (panel.classList.contains('open')) panel.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); });
    }

    closeAppearance() {
        this.toggleAppearance(false);
    }

    toggleExportPanel(forceOpen?: boolean) {
        const panel = this.elements && this.elements.exportPanel;
        const button = this.elements && this.elements.btnExportMenu;
        if (!panel) return;
        const open = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
        if (open) {
            this.closeAppearance();
            this.callbacks.onOpenPanel?.();
            if (this.elements?.exportBookTitle) {
                const title = this.elements.currentBookTitle?.textContent || "No book open";
                this.elements.exportBookTitle.textContent = title;
                this.elements.exportBookTitle.title = title;
            }
        } else if (panel.contains(document.activeElement)) button?.focus({ preventScroll: true });
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
        const PanelEvent = panel.ownerDocument?.defaultView?.Event || Event;
        if (!open) panel.dispatchEvent?.(new PanelEvent('exportpanelclose'));
        if (open) requestAnimationFrame(() => {
            if (panel.classList.contains('open')) [...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].find(control => !control.hidden && !control.closest('[hidden]'))?.focus();
        });
    }

    closeExportPanel() {
        this.toggleExportPanel(false);
    }

    toggleFullscreen() {
        if (window.auraDesktop) {
            window.auraDesktop.window.toggleFullscreen().then(result => {
                const { fullscreen } = unwrapDesktop(result);
                const icon = this.elements?.btnFullscreen?.querySelector('i');
                if (icon) icon.className = fullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
            }).catch(error => this.showToast(error instanceof Error ? error.message : "Could not toggle fullscreen.", { kind: 'error' }));
            return;
        }
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn("Fullscreen unavailable:", err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.warn("Could not exit fullscreen:", err);
                });
            }
        }
    }

    init(elements: AppElements, callbacks: ShellCallbacks = {}) {
        this.elements = elements;
        this.callbacks = { ...this.callbacks, ...callbacks };
        if (!elements) return;
        document.addEventListener('click', event => {
            this.feedbackAnchor = eventElement(event)?.closest<HTMLElement>('button, [role="menuitem"], [role="menuitemradio"]') || null;
            this.feedbackRect = this.feedbackAnchor?.getBoundingClientRect();
        }, true);

        // Theme Toggle Button
        if (elements.btnThemeToggle) {
            elements.btnThemeToggle.addEventListener('click', () => {
                this.toggleAppTheme();
            });
        }

        if (elements.btnAppearance && elements.appearancePanel) {
            elements.btnAppearance.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleAppearance();
            });
            // Clicks inside the panel must not count as outside clicks. Some
            // controls replace their own markup during the click (theme icon),
            // which detaches event.target before a closest() walk.
            elements.appearancePanel.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('click', (e) => {
                if (!elements.appearancePanel?.classList.contains('open')) return;
                const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
                const inside = path.some((node) => node === elements.appearancePanel || node === elements.btnAppearance);
                if (inside) return;
                this.closeAppearance();
            });
        }

        if (elements.btnExportMenu && elements.exportPanel) {
            const workspaceSettings = elements.btnExportMenu.closest('#workspace-settings-panel');
            workspaceSettings?.addEventListener('workspacesettingsclose', () => this.closeExportPanel());
            elements.btnExportMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleExportPanel();
            });
            elements.exportPanel.addEventListener('click', (e) => {
                e.stopPropagation();
                if (eventElement(e)?.closest('[data-export-action]')) {
                    this.closeExportPanel();
                }
            });
            document.addEventListener('click', (e) => {
                if (!elements.exportPanel?.classList.contains('open')) return;
                const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
                if (path.some(node => node === workspaceSettings || node === elements.exportPanel || node === elements.btnExportMenu)) return;
                this.closeExportPanel();
            }, true);
        }

        // Fullscreen Button
        if (elements.btnFullscreen) {
            elements.btnFullscreen.addEventListener('click', () => {
                this.toggleFullscreen();
            });
            document.addEventListener('fullscreenchange', () => {
                const button = elements.btnFullscreen;
                const icon = button?.querySelector('i');
                if (!button || !icon) return;
                icon.className = document.fullscreenElement ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
                button.title = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
            });
        }

        // Switch Demo Book
        if (elements.btnSwitchDemo) {
            elements.btnSwitchDemo.addEventListener('click', () => {
                if (this.callbacks.onSwitchDemo) {
                    this.callbacks.onSwitchDemo();
                }
            });
        }

        // File Input Upload
        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', (e) => {
                const input = e.currentTarget as HTMLInputElement;
                const file = input.files?.[0];
                if (file && this.callbacks.onImportFile) {
                    this.callbacks.onImportFile(file);
                }
                input.value = '';
            });
        }

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.defaultPrevented || e.isComposing) return;
            if (eventElement(e)?.closest('[role="menu"],[data-slot="dialog-content"],.toc-popover')) return;
            if (e.key === 'Escape' && elements.exportPanel?.classList.contains('open')) {
                e.preventDefault();
                this.closeExportPanel();
                if (elements.btnExportMenu) elements.btnExportMenu.focus();
                return;
            }
            if (e.key === 'Escape' && elements.appearancePanel?.classList.contains('open')) {
                e.preventDefault();
                this.closeAppearance();
                elements.btnAppearance?.focus({ preventScroll: true });
                return;
            }
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement | null)?.isContentEditable) {
                return;
            }

            if (elements.backupSelectModal && elements.backupSelectModal.classList.contains('active')) return;
            if (elements.exportPanel?.classList.contains('open')) return;
            if (elements.shelfPanel?.classList.contains('open')) return;

            if (eventElement(e)?.closest('.reader-tool-panel')) return;

            if (document.documentElement.dataset.appSurface && document.documentElement.dataset.appSurface !== 'reader') return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (elements.bookPaper?.dataset.progression === 'rtl') this.callbacks.onNextPage?.();
                else this.callbacks.onPrevPage?.();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (elements.bookPaper?.dataset.progression === 'rtl') this.callbacks.onPrevPage?.();
                else this.callbacks.onNextPage?.();
            }
        });

        // Window Resize with Debounce
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeDebounceTimer);
            this.resizeDebounceTimer = setTimeout(() => {
                if (this.callbacks.onWindowResize) {
                    this.callbacks.onWindowResize(true);
                }
            }, 60);
        });
    }
}

export const appShell = new AppShell();
