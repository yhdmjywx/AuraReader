import { eventElement } from './dom.js';
import { unwrapDesktop } from '../infrastructure/storageClient.js';
import type { AppElements } from './elements.js';
import type { ShellCallbacks } from './contracts.js';
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
    constructor(callbacks: ShellCallbacks = {}) {
        this.callbacks = callbacks;
        this.appTheme = 'light';
        this.elements = null;
        this.resizeDebounceTimer = undefined;
    }

    showToast(msg: string) {
        if (!this.elements || !this.elements.toastMsg || !msg) return;
        this.elements.toastMsg.textContent = msg;
        this.elements.toastMsg.classList.add('show');
        setTimeout(() => {
            if (this.elements && this.elements.toastMsg) {
                this.elements.toastMsg.classList.remove('show');
            }
        }, 2600);
    }

    setBookLoading(loading: boolean) {
        // Leave header and shelf controls available for a newer book request.
        for (const panel of [this.elements?.readerPanel, this.elements?.notesPanel, this.elements?.goalPanel]) {
            if (!panel) continue;
            panel.inert = loading;
            panel.setAttribute('aria-busy', String(loading));
        }
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
    }

    toggleAppearance(forceOpen?: boolean) {
        const panel = this.elements && this.elements.appearancePanel;
        const button = this.elements && this.elements.btnAppearance;
        if (!panel) return;
        const open = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
        if (open) {
            this.closeExportPanel();
            this.callbacks.onOpenPanel?.();
        }
        panel.classList.toggle('open', open);
        if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
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
                this.elements.exportBookTitle.textContent = this.elements.currentBookTitle
                    ? this.elements.currentBookTitle.textContent
                    : '未打开书籍';
            }
        }
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
        const PanelEvent = panel.ownerDocument?.defaultView?.Event || Event;
        if (!open) panel.dispatchEvent?.(new PanelEvent('exportpanelclose'));
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
            }).catch(error => this.showToast(error instanceof Error ? error.message : '全屏切换失败'));
            return;
        }
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn("全屏模式不可用:", err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.warn("退出全屏异常:", err);
                });
            }
        }
    }

    init(elements: AppElements, callbacks: ShellCallbacks = {}) {
        this.elements = elements;
        this.callbacks = { ...this.callbacks, ...callbacks };
        if (!elements) return;

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
                if (path.some(node => node === elements.exportPanel || node === elements.btnExportMenu)) return;
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
                button.title = document.fullscreenElement ? '退出全屏' : '全屏阅读';
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
            if (e.key === 'Escape' && elements.exportPanel && elements.exportPanel.classList.contains('open')) {
                e.preventDefault();
                this.closeExportPanel();
                if (elements.btnExportMenu) elements.btnExportMenu.focus();
                return;
            }
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement | null)?.isContentEditable) {
                return;
            }

            if (elements.backupSelectModal && elements.backupSelectModal.classList.contains('active')) return;
            if (elements.exportPanel?.classList.contains('open')) return;
            if (elements.shelfPanel?.classList.contains('open')) return;

            if (e.key === 'Escape' && elements.appearancePanel && elements.appearancePanel.classList.contains('open')) {
                e.preventDefault();
                this.closeAppearance();
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (this.callbacks.onPrevPage) this.callbacks.onPrevPage();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (this.callbacks.onNextPage) this.callbacks.onNextPage();
            } else if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                if (this.callbacks.onTogglePageMode) this.callbacks.onTogglePageMode();
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
