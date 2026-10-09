/* ==========================================================================
   AppShell - Application Shell & Global Presentation / Input Dispatcher
   Authority owner of: appTheme ('light' | 'dark').
   Coordinates Toast notifications, top header global actions,
   window resize debounce, and global keyboard shortcuts routing.
   ========================================================================== */

export class AppShell {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.appTheme = 'light';
        this.elements = null;
        this.resizeDebounceTimer = null;
    }

    showToast(msg) {
        if (!this.elements || !this.elements.toastMsg || !msg) return;
        this.elements.toastMsg.textContent = msg;
        this.elements.toastMsg.classList.add('show');
        setTimeout(() => {
            if (this.elements && this.elements.toastMsg) {
                this.elements.toastMsg.classList.remove('show');
            }
        }, 2600);
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
    }

    toggleFullscreen() {
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

    init(elements, callbacks = {}) {
        this.elements = elements;
        this.callbacks = { ...this.callbacks, ...callbacks };
        if (!elements) return;

        // Theme Toggle Button
        if (elements.btnThemeToggle) {
            elements.btnThemeToggle.addEventListener('click', () => {
                this.toggleAppTheme();
            });
        }

        // Fullscreen Button
        if (elements.btnFullscreen) {
            elements.btnFullscreen.addEventListener('click', () => {
                this.toggleFullscreen();
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
                const file = e.target.files[0];
                if (file && this.callbacks.onImportFile) {
                    this.callbacks.onImportFile(file);
                }
                e.target.value = '';
            });
        }

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || document.activeElement.isContentEditable) {
                return;
            }

            if (elements.noteModal && elements.noteModal.classList.contains('active')) return;
            if (elements.backupSelectModal && elements.backupSelectModal.classList.contains('active')) return;
            if (elements.shelfOverlay && elements.shelfOverlay.classList.contains('active')) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (this.callbacks.onPrevPage) this.callbacks.onPrevPage();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (this.callbacks.onNextPage) this.callbacks.onNextPage();
            } else if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                if (this.callbacks.onToggleSidebar) this.callbacks.onToggleSidebar(true);
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
