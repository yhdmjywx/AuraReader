/* ==========================================================================
   LayoutSystem - UI Layout & Viewport Mode Controller
   Manages single/double spread modes, sidebar collapse/recall, split ratios,
   and 760px responsive downgrade/restore state.
   ========================================================================== */

export const DOUBLE_PAGE_MIN_WIDTH = 760;

export class LayoutSystem {
    constructor() {
        const storage = (typeof localStorage !== 'undefined') ? localStorage : null;
        this.layoutMode = (storage && storage.getItem('aura_layout_mode')) || 'single'; // 'single' | 'double'
        this.isCollapsed = storage ? (storage.getItem('aura_sidebar_collapsed') === 'true') : false;
        this.readerWidthPercent = storage ? (parseFloat(storage.getItem('aura_reader_width')) || 75) : 75;
        this.isAutoDowngraded = false;
    }

    isDoublePageEffective() {
        return this.layoutMode === 'double' && !this.isAutoDowngraded;
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
        this.layoutMode = mode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aura_layout_mode', mode);
        }

        let downgraded = false;
        if (mode === 'double' && availableWidth < DOUBLE_PAGE_MIN_WIDTH) {
            this.isAutoDowngraded = true;
            downgraded = true;
        } else {
            this.isAutoDowngraded = false;
        }

        return {
            layoutMode: this.layoutMode,
            isAutoDowngraded: this.isAutoDowngraded,
            isDoubleEffective: this.isDoublePageEffective()
        };
    }

    togglePageMode(availableWidth = 1200) {
        const nextMode = (this.layoutMode === 'double') ? 'single' : 'double';
        return this.setPageMode(nextMode, availableWidth);
    }

    toggleSidebar() {
        this.isCollapsed = !this.isCollapsed;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aura_sidebar_collapsed', this.isCollapsed ? 'true' : 'false');
        }
        return this.isCollapsed;
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
            return {
                changed: true,
                isAutoDowngraded: this.isAutoDowngraded,
                reason: shouldDowngrade ? 'downgraded' : 'restored'
            };
        }

        return { changed: false, isAutoDowngraded: this.isAutoDowngraded };
    }

    updateLayoutClasses(elements) {
        if (!elements || !elements.workspaceContainer) return;

        if (this.isCollapsed) {
            elements.workspaceContainer.classList.add('sidebar-collapsed');
        } else {
            elements.workspaceContainer.classList.remove('sidebar-collapsed');
        }

        const isDouble = this.isDoublePageEffective();
        if (isDouble) {
            elements.workspaceContainer.classList.add('layout-double');
            elements.workspaceContainer.classList.remove('layout-single');
        } else {
            elements.workspaceContainer.classList.add('layout-single');
            elements.workspaceContainer.classList.remove('layout-double');
        }

        this.updatePageModeButtonUI(elements);
        this.updateSidebarButtonsUI(elements);
    }

    updatePageModeButtonUI(elements) {
        if (!elements || !elements.btnPageMode) return;

        if (this.layoutMode === 'double') {
            elements.btnPageMode.classList.add('active');
            if (this.isAutoDowngraded) {
                elements.btnPageMode.classList.add('auto-downgraded');
                if (elements.textPageMode) elements.textPageMode.textContent = '双页(自适应)';
                elements.btnPageMode.title = '双页模式（因宽度受限临时单页展示，展开窗口或收起侧栏后将自动恢复）';
            } else {
                elements.btnPageMode.classList.remove('auto-downgraded');
                if (elements.textPageMode) elements.textPageMode.textContent = '双页';
                elements.btnPageMode.title = '切换为单页模式 (快捷键: D)';
            }
            if (elements.iconPageMode) elements.iconPageMode.className = 'ri-book-open-line';
        } else {
            elements.btnPageMode.classList.remove('active', 'auto-downgraded');
            if (elements.textPageMode) elements.textPageMode.textContent = '单页';
            elements.btnPageMode.title = '切换为双页模式 (快捷键: D)';
            if (elements.iconPageMode) elements.iconPageMode.className = 'ri-book-read-line';
        }
    }

    updateSidebarButtonsUI(elements) {
        if (!elements) return;

        if (this.isCollapsed) {
            if (elements.btnToggleSidebar) {
                elements.btnToggleSidebar.classList.remove('active');
                elements.btnToggleSidebar.title = '展开笔记侧边栏 (快捷键: B)';
            }
            if (elements.textToggleSidebar) elements.textToggleSidebar.textContent = '展开笔记';
            if (elements.iconToggleSidebar) elements.iconToggleSidebar.className = 'ri-layout-right-line';
            if (elements.btnSidebarRecall) elements.btnSidebarRecall.style.display = 'flex';
        } else {
            if (elements.btnToggleSidebar) {
                elements.btnToggleSidebar.classList.add('active');
                elements.btnToggleSidebar.title = '收起笔记侧边栏 (快捷键: B)';
            }
            if (elements.textToggleSidebar) elements.textToggleSidebar.textContent = '收起笔记';
            if (elements.iconToggleSidebar) elements.iconToggleSidebar.className = 'ri-side-bar-line';
            if (elements.btnSidebarRecall) elements.btnSidebarRecall.style.display = 'none';
        }
    }

    applySidebarState(elements) {
        if (!elements) return;

        if (this.isCollapsed) {
            if (elements.workspaceContainer) elements.workspaceContainer.classList.add('sidebar-collapsed');
            if (elements.readerPanel) elements.readerPanel.style.width = '100%';
            if (elements.notesPanel) elements.notesPanel.style.display = 'none';
            if (elements.resizerHandle) elements.resizerHandle.style.display = 'none';
        } else {
            if (elements.workspaceContainer) elements.workspaceContainer.classList.remove('sidebar-collapsed');
            if (elements.readerPanel) elements.readerPanel.style.width = `${this.readerWidthPercent}%`;
            if (elements.notesPanel) elements.notesPanel.style.display = 'flex';
            if (elements.resizerHandle) elements.resizerHandle.style.display = 'flex';
        }

        this.updateSidebarButtonsUI(elements);
    }

    initResizer(elements, onWidthChange, onToggleSidebar) {
        if (!elements || !elements.resizerHandle) return;

        let isDragging = false;

        elements.resizerHandle.addEventListener('mousedown', function () {
            isDragging = true;
            elements.resizerHandle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const containerWidth = elements.workspaceContainer.clientWidth;
            const newLeftWidthPx = e.clientX;
            let percent = (newLeftWidthPx / containerWidth) * 100;

            // Clamp between 25% and 85%
            percent = Math.max(25, Math.min(85, percent));
            this.readerWidthPercent = percent;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('aura_reader_width', percent);
            }

            if (elements.readerPanel) {
                elements.readerPanel.style.width = `${percent}%`;
            }

            if (typeof onWidthChange === 'function') {
                onWidthChange(percent);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                elements.resizerHandle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        elements.resizerHandle.addEventListener('dblclick', () => {
            if (typeof onToggleSidebar === 'function') {
                onToggleSidebar();
            }
        });
    }
}

export const layoutSystem = new LayoutSystem();
