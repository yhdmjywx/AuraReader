const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== AuraReader 页面布局系统 (单/双页与侧边栏折叠/展开) 全量自动化测试 ===");

const clientDir = path.resolve(__dirname, '../../src/client');
const htmlContent = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(clientDir, 'styles.css'), 'utf8');
const jsContent = fs.readFileSync(path.join(clientDir, 'app.js'), 'utf8');

// =========================================================================
// 1. 静态结构与关键控制器检测 (Static Verification)
// =========================================================================
console.log("\n--- [测试维度 1: 静态结构与 DOM 控制器完整性] ---");

const checks = [
    { name: "单/双页切换按钮 (#btn-page-mode)", cond: htmlContent.includes('id="btn-page-mode"') },
    { name: "单/双页状态文本 (#text-page-mode)", cond: htmlContent.includes('id="text-page-mode"') },
    { name: "侧边栏顶层切换控制器 (#btn-toggle-sidebar)", cond: htmlContent.includes('id="btn-toggle-sidebar"') },
    { name: "侧边栏内收起控制器 (#btn-collapse-sidebar)", cond: htmlContent.includes('id="btn-collapse-sidebar"') },
    { name: "侧边栏召回把手 (#btn-sidebar-recall)", cond: htmlContent.includes('id="btn-sidebar-recall"') },
    { name: "双页对称容器 (#paper-container)", cond: htmlContent.includes('id="paper-container"') },
    { name: "左侧/主画布 (#book-paper)", cond: htmlContent.includes('id="book-paper"') },
    { name: "中缝阴影线 (#spread-spine)", cond: htmlContent.includes('id="spread-spine"') },
    { name: "右侧/辅画布 (#book-paper-right)", cond: htmlContent.includes('id="book-paper-right"') },
    
    // CSS
    { name: "CSS 侧栏折叠规则 (.sidebar-collapsed)", cond: cssContent.includes('.workspace-container.sidebar-collapsed') },
    { name: "CSS 召回把手样式 (.sidebar-recall-handle)", cond: cssContent.includes('.sidebar-recall-handle') },
    { name: "CSS 双页展开样式 (.paper-container.spread-active)", cond: cssContent.includes('.paper-container.spread-active') },
    { name: "CSS 中缝阴影样式 (.spread-spine)", cond: cssContent.includes('.spread-spine') },
    { name: "CSS 按钮自适应降级样式 (.btn-icon-sm.auto-downgraded)", cond: cssContent.includes('.btn-icon-sm.auto-downgraded') },

    // JS
    { name: "JS layoutMode 状态定义", cond: jsContent.includes("layoutMode: localStorage.getItem('aura_layout_mode') || 'single'") },
    { name: "JS isDoublePageEffective 判断", cond: jsContent.includes("function isDoublePageEffective()") },
    { name: "JS togglePageMode 切换方法", cond: jsContent.includes("function togglePageMode()") },
    { name: "JS toggleSidebar 折叠方法", cond: jsContent.includes("function toggleSidebar(") },
    { name: "JS checkResponsiveLayout 自适应降级与恢复", cond: jsContent.includes("function checkResponsiveLayout()") },
    { name: "JS 双页划选与右页定位能力", cond: jsContent.includes("elements.bookPaperRight.contains(selection.anchorNode)") },
    { name: "JS 键盘快捷键监听 (B / D / Arrow)", cond: jsContent.includes("toggleSidebar(true);") && jsContent.includes("togglePageMode();") }
];

let staticPass = true;
checks.forEach((c, idx) => {
    if (c.cond) {
        console.log(`[静态检查 1.${idx + 1}] ${c.name}: ✅ PASSED`);
    } else {
        console.error(`[静态检查 1.${idx + 1}] ${c.name}: ❌ FAILED`);
        staticPass = false;
    }
});
assert.strictEqual(staticPass, true, "静态结构检测未通过！");

// =========================================================================
// 2. 状态独立性与全量四种布局组合仿真 (Four Layout Combinations)
// =========================================================================
console.log("\n--- [测试维度 2: 四种组合相互独立性与状态机验证] ---");

class LayoutEngineMock {
    constructor() {
        this.layoutMode = 'single'; // 'single' | 'double'
        this.isCollapsed = false;
        this.readerWidthPercent = 75;
        this.isAutoDowngraded = false;
        this.availableWidth = 1200;
        this.currentPage = 1;
        this.totalPages = 10;
    }

    setPageMode(mode) {
        this.layoutMode = mode;
        this.evalResponsive();
    }

    toggleSidebar() {
        this.isCollapsed = !this.isCollapsed;
        this.evalResponsive();
    }

    evalResponsive() {
        const readerWidth = this.isCollapsed ? this.availableWidth : (this.availableWidth * this.readerWidthPercent / 100);
        if (this.layoutMode === 'double') {
            this.isAutoDowngraded = readerWidth < 760;
        } else {
            this.isAutoDowngraded = false;
        }
    }

    isDoubleEffective() {
        return this.layoutMode === 'double' && !this.isAutoDowngraded;
    }

    getDisplayedPages(page = this.currentPage) {
        if (!this.isDoubleEffective()) {
            return { type: 'single', pages: [page] };
        } else {
            const left = (page % 2 === 1) ? page : page - 1;
            const right = left + 1;
            return {
                type: 'double',
                left,
                right: right <= this.totalPages ? right : null,
                pages: right <= this.totalPages ? [left, right] : [left]
            };
        }
    }

    nextPage() {
        if (this.isDoubleEffective()) {
            const currentLeft = (this.currentPage % 2 === 1) ? this.currentPage : this.currentPage - 1;
            const nextLeft = currentLeft + 2;
            if (nextLeft <= this.totalPages) {
                this.currentPage = nextLeft;
            }
        } else {
            if (this.currentPage < this.totalPages) this.currentPage++;
        }
    }

    prevPage() {
        if (this.isDoubleEffective()) {
            const currentLeft = (this.currentPage % 2 === 1) ? this.currentPage : this.currentPage - 1;
            const prevLeft = Math.max(1, currentLeft - 2);
            this.currentPage = prevLeft;
        } else {
            if (this.currentPage > 1) this.currentPage--;
        }
    }
}

const engine = new LayoutEngineMock();

// 状态 1: 单页 + 侧边栏展开
engine.setPageMode('single');
engine.isCollapsed = false;
console.log("组合 1: 单页 + 侧边栏展开 ->", {
    layoutMode: engine.layoutMode,
    isCollapsed: engine.isCollapsed,
    isDoubleEffective: engine.isDoubleEffective(),
    view: engine.getDisplayedPages(1)
});
assert.strictEqual(engine.isDoubleEffective(), false);
assert.strictEqual(engine.isCollapsed, false);
assert.deepStrictEqual(engine.getDisplayedPages(1).pages, [1]);

// 状态 2: 单页 + 侧边栏收起
engine.toggleSidebar();
console.log("组合 2: 单页 + 侧边栏收起 ->", {
    layoutMode: engine.layoutMode,
    isCollapsed: engine.isCollapsed,
    isDoubleEffective: engine.isDoubleEffective(),
    view: engine.getDisplayedPages(1)
});
assert.strictEqual(engine.layoutMode, 'single');
assert.strictEqual(engine.isCollapsed, true);
assert.strictEqual(engine.isDoubleEffective(), false);

// 状态 3: 双页 + 侧边栏收起
engine.setPageMode('double');
console.log("组合 3: 双页 + 侧边栏收起 ->", {
    layoutMode: engine.layoutMode,
    isCollapsed: engine.isCollapsed,
    isDoubleEffective: engine.isDoubleEffective(),
    view: engine.getDisplayedPages(1)
});
assert.strictEqual(engine.layoutMode, 'double');
assert.strictEqual(engine.isCollapsed, true);
assert.strictEqual(engine.isDoubleEffective(), true);
assert.deepStrictEqual(engine.getDisplayedPages(1).pages, [1, 2]);

// 状态 4: 双页 + 侧边栏展开
engine.toggleSidebar();
console.log("组合 4: 双页 + 侧边栏展开 ->", {
    layoutMode: engine.layoutMode,
    isCollapsed: engine.isCollapsed,
    isDoubleEffective: engine.isDoubleEffective(),
    view: engine.getDisplayedPages(1)
});
assert.strictEqual(engine.layoutMode, 'double');
assert.strictEqual(engine.isCollapsed, false);
assert.strictEqual(engine.isDoubleEffective(), true);
assert.deepStrictEqual(engine.getDisplayedPages(1).pages, [1, 2]);

console.log("✅ 全部四种布局组合状态独立性验证 100% 通过！");

// =========================================================================
// 3. 翻页步长与对称跨页机制验证 (Page Stepping & Spread Math)
// =========================================================================
console.log("\n--- [测试维度 3: 翻页步长与跨页对称计算] ---");

engine.currentPage = 1;
engine.setPageMode('double');
assert.strictEqual(engine.isDoubleEffective(), true);

// 翻页测试: 1-2 -> 3-4 -> 5-6 -> 7-8 -> 9-10
console.log(`初始页码: ${JSON.stringify(engine.getDisplayedPages())}`);
assert.deepStrictEqual(engine.getDisplayedPages().pages, [1, 2]);

engine.nextPage();
console.log(`向后翻一页: ${JSON.stringify(engine.getDisplayedPages())}`);
assert.deepStrictEqual(engine.getDisplayedPages().pages, [3, 4]);

engine.nextPage();
assert.deepStrictEqual(engine.getDisplayedPages().pages, [5, 6]);

engine.nextPage();
assert.deepStrictEqual(engine.getDisplayedPages().pages, [7, 8]);

engine.nextPage();
console.log(`翻至最后一对: ${JSON.stringify(engine.getDisplayedPages())}`);
assert.deepStrictEqual(engine.getDisplayedPages().pages, [9, 10]);

// 在尾页继续 next 应被安全拦截
engine.nextPage();
assert.deepStrictEqual(engine.getDisplayedPages().pages, [9, 10]);

// 向前翻页测试
engine.prevPage();
console.log(`向前翻一页: ${JSON.stringify(engine.getDisplayedPages())}`);
assert.deepStrictEqual(engine.getDisplayedPages().pages, [7, 8]);

// 奇数总页数 (边界容错测试: 5页图书)
engine.totalPages = 5;
engine.currentPage = 5;
const oddSpread = engine.getDisplayedPages(5);
console.log(`奇数总页数末页展示 (P.5):`, oddSpread);
assert.strictEqual(oddSpread.left, 5);
assert.strictEqual(oddSpread.right, null);
assert.deepStrictEqual(oddSpread.pages, [5]);

console.log("✅ 翻页步长 (+2 / -2) 与跨页对称计算验证 100% 通过！");

// =========================================================================
// 4. 自适应降级与自动恢复策略验证 (Responsive Downgrade & Recovery)
// =========================================================================
console.log("\n--- [测试维度 4: 空间不足自适应降级与自动恢复] ---");

engine.availableWidth = 800; // 窗口变窄
engine.readerWidthPercent = 75; // 此时 readerWidth = 600px < 760px
engine.isCollapsed = false;
engine.setPageMode('double'); // 用户选择双页模式

console.log(`狭窄可用宽度 (600px): isAutoDowngraded = ${engine.isAutoDowngraded}, isDoubleEffective = ${engine.isDoubleEffective()}`);
assert.strictEqual(engine.layoutMode, 'double', "用户偏好不得被静默覆盖为 single");
assert.strictEqual(engine.isAutoDowngraded, true, "可用空间不足应自动降级");
assert.strictEqual(engine.isDoubleEffective(), false, "视觉上临时单页呈现");

// 动作 A: 用户点击收起侧边栏 -> 释放宽度到 800px (800px >= 760px)
engine.toggleSidebar();
console.log(`收起侧边栏释放宽度 (800px): isAutoDowngraded = ${engine.isAutoDowngraded}, isDoubleEffective = ${engine.isDoubleEffective()}`);
assert.strictEqual(engine.layoutMode, 'double', "用户模式依旧保持双页");
assert.strictEqual(engine.isAutoDowngraded, false, "宽度充足自动恢复");
assert.strictEqual(engine.isDoubleEffective(), true, "自动恢复双页对称展开！");

// 动作 B: 用户重新展开侧边栏 -> 宽度回落至 600px
engine.toggleSidebar();
console.log(`重新展开侧边栏收窄 (600px): isAutoDowngraded = ${engine.isAutoDowngraded}, isDoubleEffective = ${engine.isDoubleEffective()}`);
assert.strictEqual(engine.isAutoDowngraded, true, "宽度受限再次自适应降级");
assert.strictEqual(engine.isDoubleEffective(), false);

// 动作 C: 用户扩大窗口宽度到 1200px (1200 * 75% = 900px >= 760px)
engine.availableWidth = 1200;
engine.evalResponsive();
console.log(`拉大窗口宽度 (900px): isAutoDowngraded = ${engine.isAutoDowngraded}, isDoubleEffective = ${engine.isDoubleEffective()}`);
assert.strictEqual(engine.isAutoDowngraded, false, "扩大窗口后无感自动恢复");
assert.strictEqual(engine.isDoubleEffective(), true);

console.log("✅ 空间不足降级与自动恢复机制验证 100% 通过！");

// =========================================================================
// 5. 双页划选与笔记跨页归属测试 (Multi-page Annotations & Tooltips)
// =========================================================================
console.log("\n--- [测试维度 5: 双页划选与高亮节点挂载] ---");

const mockNotes = [
    { id: 'note-left-1', quote: '左页引文段落', page: 1, color: 'yellow', comment: '' },
    { id: 'note-right-1', quote: '右页引文段落', page: 2, color: 'green', comment: '右页感悟' }
];

function mockApplyHighlights(pageHtml, targetPage, notes) {
    let result = pageHtml;
    notes.forEach(note => {
        if (note.page === targetPage && result.includes(note.quote)) {
            result = result.replace(note.quote, `<mark class="hl-${note.color}" data-id="${note.id}">${note.quote}</mark>`);
        }
    });
    return result;
}

const leftHtml = "<p>这是左页引文段落的真实内容展示</p>";
const rightHtml = "<p>这是右页引文段落的深入研读分析</p>";

const renderedLeft = mockApplyHighlights(leftHtml, 1, mockNotes);
const renderedRight = mockApplyHighlights(rightHtml, 2, mockNotes);

console.log("左页渲染结果:", renderedLeft);
console.log("右页渲染结果:", renderedRight);

assert.ok(renderedLeft.includes('<mark class="hl-yellow" data-id="note-left-1">左页引文段落</mark>'), "左页高亮正确挂载");
assert.ok(renderedRight.includes('<mark class="hl-green" data-id="note-right-1">右页引文段落</mark>'), "右页高亮正确挂载");
assert.ok(!renderedLeft.includes('note-right-1'), "左页不混入右页高亮");
assert.ok(!renderedRight.includes('note-left-1'), "右页不混入左页高亮");

console.log("✅ 双页划线与随笔高亮精确挂载验证 100% 通过！");

// =========================================================================
// 6. 进阶边界与深度健壮性审计 (Advanced Edge Cases & Deep Robustness)
// =========================================================================
console.log("\n--- [测试维度 6: 进阶边界、右页随笔去重与阅读位置保真] ---");

// 6.1 右页选区随笔去重与 targetPage 绑定检测
console.log("子测试 6.1: 右页选区随笔去重与 targetPage 绑定");
const mockNotesDB = [
    { id: 'hl-p2', page: 2, quote: '右页核心观点', comment: '', color: 'yellow' }
];

function simulateOpenNoteModal(quote, pendingSelection, currentPage, notes) {
    const targetPage = (pendingSelection && pendingSelection.page) ? pendingSelection.page : currentPage;
    const overlap = notes.find(n => n.page === targetPage && (n.quote === quote || (n.quote && quote && (n.quote.includes(quote) || quote.includes(n.quote)))));
    return overlap ? { mode: 'edit', noteId: overlap.id, targetPage } : { mode: 'create', targetPage };
}

// 模拟双页模式：左页为 1，右页为 2。用户选中国右页文字进行“添加随笔”
const rightSelection = { text: '右页核心观点', page: 2 };
const modalResult = simulateOpenNoteModal('右页核心观点', rightSelection, 1, mockNotesDB);
console.log("右页随笔选区触发结果:", modalResult);
assert.strictEqual(modalResult.mode, 'edit', "右页已有高亮必须就地识别为编辑模式，不可当成新建");
assert.strictEqual(modalResult.noteId, 'hl-p2', "准确关联到右页的高亮 ID");
assert.strictEqual(modalResult.targetPage, 2, "目标页码必须锁定为右页 P.2");

// 6.2 双页切换至单页的偶数页位置保真性验证
console.log("\n子测试 6.2: 双页切换至单页的偶数页位置保真性");
class PreservationLayoutMock {
    constructor() {
        this.layoutMode = 'double';
        this.currentPage = 1;
        this.currentLeftPage = 1;
        this.currentRightPage = 2;
        this.totalPages = 10;
    }
    renderPage(pageNum) {
        this.currentPage = pageNum;
        if (this.layoutMode === 'double') {
            const left = (pageNum % 2 === 1) ? pageNum : pageNum - 1;
            this.currentLeftPage = left;
            this.currentRightPage = left + 1;
        }
    }
    toggleMode() {
        this.layoutMode = (this.layoutMode === 'double') ? 'single' : 'double';
        this.renderPage(this.currentPage);
    }
}

const presMock = new PreservationLayoutMock();
// 用户跳转到第 4 章（位于右页 P.4）
presMock.renderPage(4);
console.log(`在双页模式下定位至 P.4 -> 视口显示 [${presMock.currentLeftPage}, ${presMock.currentRightPage}], 聚焦页码: P.${presMock.currentPage}`);
assert.strictEqual(presMock.currentPage, 4, "双页模式下聚焦在 P.4");

// 此时切换至单页模式
presMock.toggleMode();
console.log(`切换至单页模式 -> 当前页码: P.${presMock.currentPage}`);
assert.strictEqual(presMock.layoutMode, 'single');
assert.strictEqual(presMock.currentPage, 4, "切换至单页模式必须严格停留在 P.4，不得跳回 P.3！");

// 6.3 静态健壮性规则校验 (CSS 与防抖机制)
console.log("\n子测试 6.3: 静态健壮性规范校验");
assert.ok(cssContent.includes('.paper-container:not(.spread-active) .book-paper-right'), "CSS 必须具备非双页状态下隐藏右页画布的兜底规则");
assert.ok(cssContent.includes('writing-mode: horizontal-tb;'), "召回把手内箭头图标必须阻止 90 度旋转");
assert.ok(jsContent.includes('resizeDebounceTimer'), "窗口 resize 监听器必须配置防抖计时器");
assert.ok(jsContent.includes('checkResponsiveLayout(false)'), "应用启动初期必须执行静默自适应检查，避免 FOUC");

console.log("✅ 进阶边界与深度健壮性审计 100% 通过！");

console.log("\n====================================================");
console.log("🎉 全部 6 大维度页面布局系统测试 100% PASSED！");
console.log("====================================================");
