/* ==========================================================================
   LayoutController - UI Layout & Viewport Mode Feature Controller
   Authority owner of: layoutMode ('scroll' | 'single' | 'double'), isCollapsed,
   readerWidthPercent, isAutoDowngraded.
   Manages spread layout, sidebar toggles, resizer dragging, and 760px responsive rules.
   ========================================================================== */

export const DOUBLE_PAGE_MIN_WIDTH = 760;

export class LayoutController {
    constructor(callbacks = {}) {
        const storage = (typeof localStorage !== 'undefined') ? localStorage : null;
        const storedMode = storage && storage.getItem('aura_layout_mode');
        this.layoutMode = (storedMode === 'scroll' || storedMode === 'double' || storedMode === 'single')
            ? storedMode
            : 'single';
        this.isCollapsed = storage ? (storage.getItem('aura_sidebar_collapsed') === 'true') : false;
        this.readerWidthPercent = storage ? (parseFloat(storage.getItem('aura_reader_width')) || 75) : 75;
        this.isAutoDowngraded = false;
        this.callbacks = callbacks;
        this.elements = null;
        this._uiInitialized = false;
    }

    isDoublePageEffective() {
        return this.layoutMode === 'double' && !this.isAutoDowngraded;
    }

    getEffectiveReaderMode() {
        if (this.layoutMode === 'scroll') return 'scroll';
        return this.isDoublePageEffective() ? 'double' : 'single';
    }

    getLayoutMode() {
        return this.layoutMode;
    }

    getIsCollapsed() {
        return this.isCollapsed;
    }

    getReaderWidthPercent() {
        return this.readerWidthPercent;
    }

    getIsAutoDowngraded() {
        return this.isAutoDowngraded;
    }

    getLayoutState() {
        return {
            pageMode: this.layoutMode,
            sidebarOpen: !this.isCollapsed,
            splitRatio: this.readerWidthPercent / 100,
            isAutoDowngraded: this.isAutoDowngraded,
            isDoubleEffective: this.isDoublePageEffective()
        };
    }

    setPageMode(mode, availableWidth = 1200) {
        if (this.callbacks.beforeGeometryChange) this.callbacks.beforeGeometryChange();
        const nextMode = (mode === 'scroll' || mode === 'double' || mode === 'single') ? mode : 'single';
        this.layoutMode = nextMode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aura_layout_mode', nextMode);
        }

        let downgraded = false;
        if (nextMode === 'double' && availableWidth < DOUBLE_PAGE_MIN_WIDTH) {
            this.isAutoDowngraded = true;
            downgraded = true;
        } else {
            this.isAutoDowngraded = false;
        }

        const res = {
            layoutMode: this.layoutMode,
            isAutoDowngraded: this.isAutoDowngraded,
            isDoubleEffective: this.isDoublePageEffective()
        };

        if (this.callbacks.onLayoutChange) {
            this.callbacks.onLayoutChange(res);
        }

        return res;
    }

    togglePageMode(availableWidth) {
        const nextMode = (this.layoutMode === 'single') ? 'double' : 'single';
        const width = (availableWidth !== undefined && availableWidth > 0)
            ? availableWidth
            : ((this.elements && this.elements.readerPanel && this.elements.readerPanel.clientWidth > 0)
                ? this.elements.readerPanel.clientWidth
                : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200));
        return this.setPageMode(nextMode, width);
    }

    toggleSidebar(notify = true) {
        if (this.callbacks.beforeGeometryChange) this.callbacks.beforeGeometryChange();
        this.isCollapsed = !this.isCollapsed;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aura_sidebar_collapsed', this.isCollapsed ? 'true' : 'false');
        }

        if (this.callbacks.onSidebarChange) {
            this.callbacks.onSidebarChange({ isCollapsed: this.isCollapsed, notify });
        }

        return this.isCollapsed;
    }

    ensureSidebarExpanded({ notify = false } = {}) {
        if (!this.isCollapsed) return false;
        this.isCollapsed = false;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aura_sidebar_collapsed', 'false');
        }
        if (this.callbacks.onSidebarChange) {
            this.callbacks.onSidebarChange({ isCollapsed: false, notify });
        }
        return true;
    }

    checkResponsiveLayout(availableWidth = 1200) {
        if (this.layoutMode !== 'double') {
            const hadDowngrade = this.isAutoDowngraded;
            this.isAutoDowngraded = false;
            return { changed: hadDowngrade, isAutoDowngraded: false, reason: 'not_double' };
        }

        const shouldDowngrade = availableWidth < DOUBLE_PAGE_MIN_WIDTH;
        if (shouldDowngrade !== this.isAutoDowngraded) {
            this.isAutoDowngraded = shouldDowngrade;
            const res = {
                changed: true,
                isAutoDowngraded: this.isAutoDowngraded,
                reason: shouldDowngrade ? 'downgraded' : 'restored'
            };
            if (this.callbacks.onResponsiveChange) {
                this.callbacks.onResponsiveChange(res);
            }
            return res;
        }

        return { changed: false, isAutoDowngraded: this.isAutoDowngraded };
    }

    updateLayoutClasses(elements) {
        const el = elements || this.elements;
        if (!el || !el.workspaceContainer) return;

        if (this.isCollapsed) {
            el.workspaceContainer.classList.add('sidebar-collapsed');
        } else {
            el.workspaceContainer.classList.remove('sidebar-collapsed');
        }

        const isDouble = this.isDoublePageEffective();
        const isScroll = this.layoutMode === 'scroll';
        el.workspaceContainer.classList[isDouble ? 'add' : 'remove']('layout-double');
        el.workspaceContainer.classList[isScroll ? 'add' : 'remove']('layout-scroll');
        el.workspaceContainer.classList[!isDouble && !isScroll ? 'add' : 'remove']('layout-single');

        this.updatePageModeButtonUI(el);
        this.updateSidebarButtonsUI(el);
    }

    updatePageModeButtonUI(elements) {
        const el = elements || this.elements;
        if (!el || !el.btnPageMode) return;

        if (el.btnModeScroll) {
            el.btnModeScroll.classList[this.layoutMode === 'scroll' ? 'add' : 'remove']('active');
        }

        if (this.layoutMode === 'scroll') {
            el.btnPageMode.classList.remove('active', 'auto-downgraded');
            if (el.textPageMode) el.textPageMode.textContent = '滚动';
            el.btnPageMode.title = '切换为单页模式 (快捷键: D)';
            if (el.iconPageMode) el.iconPageMode.className = 'ri-scroll-to-bottom-line';
        } else if (this.layoutMode === 'double') {
            el.btnPageMode.classList.add('active');
            if (this.isAutoDowngraded) {
                el.btnPageMode.classList.add('auto-downgraded');
                if (el.textPageMode) el.textPageMode.textContent = '双页(自适应)';
                el.btnPageMode.title = '双页模式（因宽度受限临时单页展示，展开窗口或收起侧栏后将自动恢复）';
            } else {
                el.btnPageMode.classList.remove('auto-downgraded');
                if (el.textPageMode) el.textPageMode.textContent = '双页';
                el.btnPageMode.title = '切换为单页模式 (快捷键: D)';
            }
            if (el.iconPageMode) el.iconPageMode.className = 'ri-book-open-line';
        } else {
            el.btnPageMode.classList.remove('active', 'auto-downgraded');
            if (el.textPageMode) el.textPageMode.textContent = '单页';
            el.btnPageMode.title = '切换为双页模式 (快捷键: D)';
            if (el.iconPageMode) el.iconPageMode.className = 'ri-book-read-line';
        }
    }

    updateSidebarButtonsUI(elements) {
        const el = elements || this.elements;
        if (!el) return;

        if (this.isCollapsed) {
            if (el.btnToggleSidebar) {
                el.btnToggleSidebar.classList.remove('active');
                el.btnToggleSidebar.title = '展开笔记侧边栏 (快捷键: B)';
            }
            if (el.textToggleSidebar) el.textToggleSidebar.textContent = '展开笔记';
            if (el.iconToggleSidebar) el.iconToggleSidebar.className = 'ri-layout-right-line';
            if (el.btnSidebarRecall) el.btnSidebarRecall.style.display = 'flex';
        } else {
            if (el.btnToggleSidebar) {
                el.btnToggleSidebar.classList.add('active');
                el.btnToggleSidebar.title = '收起笔记侧边栏 (快捷键: B)';
            }
            if (el.textToggleSidebar) el.textToggleSidebar.textContent = '收起笔记';
            if (el.iconToggleSidebar) el.iconToggleSidebar.className = 'ri-side-bar-line';
            if (el.btnSidebarRecall) el.btnSidebarRecall.style.display = 'none';
        }
    }

    applySidebarState(elements) {
        const el = elements || this.elements;
        if (!el) return;

        if (this.isCollapsed) {
            if (el.workspaceContainer) el.workspaceContainer.classList.add('sidebar-collapsed');
            if (el.readerPanel) el.readerPanel.style.width = '100%';
            if (el.notesPanel) el.notesPanel.style.display = 'none';
            if (el.resizerHandle) el.resizerHandle.style.display = 'none';
        } else {
            if (el.workspaceContainer) el.workspaceContainer.classList.remove('sidebar-collapsed');
            if (el.readerPanel) el.readerPanel.style.width = `${this.readerWidthPercent}%`;
            if (el.notesPanel) el.notesPanel.style.display = 'flex';
            if (el.resizerHandle) el.resizerHandle.style.display = 'flex';
        }

        this.updateSidebarButtonsUI(el);
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements) return;
        if (this._uiInitialized) return;
        this._uiInitialized = true;

        this.applySidebarState(elements);
        this.updateLayoutClasses(elements);

        if (elements.btnPageMode) {
            elements.btnPageMode.addEventListener('click', (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
                    ? elements.readerPanel.clientWidth
                    : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
                this.togglePageMode(availWidth);
                if (!this.callbacks || !this.callbacks.onLayoutChange) {
                    this.updateLayoutClasses(elements);
                }
            });
        }

        if (elements.btnModeScroll) {
            elements.btnModeScroll.addEventListener('click', (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
                    ? elements.readerPanel.clientWidth
                    : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
                const next = this.layoutMode === 'scroll' ? 'single' : 'scroll';
                this.setPageMode(next, availWidth);
                if (!this.callbacks || !this.callbacks.onLayoutChange) {
                    this.updateLayoutClasses(elements);
                }
            });
        }

        if (elements.btnToggleSidebar) {
            elements.btnToggleSidebar.addEventListener('click', (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                this.toggleSidebar(true);
                if (!this.callbacks || !this.callbacks.onSidebarChange) {
                    this.applySidebarState(elements);
                    this.updateLayoutClasses(elements);
                }
            });
        }

        if (elements.btnCollapseSidebar) {
            elements.btnCollapseSidebar.addEventListener('click', (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (!this.isCollapsed) {
                    this.toggleSidebar(true);
                    if (!this.callbacks || !this.callbacks.onSidebarChange) {
                        this.applySidebarState(elements);
                        this.updateLayoutClasses(elements);
                    }
                }
            });
        }

        if (elements.btnSidebarRecall) {
            elements.btnSidebarRecall.addEventListener('click', (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (this.isCollapsed) {
                    this.toggleSidebar(true);
                    if (!this.callbacks || !this.callbacks.onSidebarChange) {
                        this.applySidebarState(elements);
                        this.updateLayoutClasses(elements);
                    }
                }
            });
        }
    }

    initResizer(elements, onWidthChange, onToggleSidebar) {
        const el = elements || this.elements;
        if (!el || !el.resizerHandle) return;

        let isDragging = false;

        el.resizerHandle.addEventListener('mousedown', () => {
            if (this.callbacks.beforeGeometryChange) this.callbacks.beforeGeometryChange();
            isDragging = true;
            el.resizerHandle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const containerWidth = el.workspaceContainer ? el.workspaceContainer.clientWidth : window.innerWidth;
            const newLeftWidthPx = e.clientX;
            let percent = (newLeftWidthPx / containerWidth) * 100;

            // Clamp between 25% and 85%
            percent = Math.max(25, Math.min(85, percent));
            this.readerWidthPercent = percent;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('aura_reader_width', percent);
            }

            if (el.readerPanel) {
                el.readerPanel.style.width = `${percent}%`;
            }

            if (typeof onWidthChange === 'function') {
                onWidthChange(percent);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                el.resizerHandle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        el.resizerHandle.addEventListener('dblclick', () => {
            if (typeof onToggleSidebar === 'function') {
                onToggleSidebar();
            }
        });
    }
}

// Backward-compatible alias for unit tests
export const LayoutSystem = LayoutController;
export const layoutController = new LayoutController();
export const layoutSystem = layoutController;
