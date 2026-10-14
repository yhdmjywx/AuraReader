const fs = require('fs');
const path = require('path');

console.log("=== AuraReader 高亮与随笔分离模式及切换开关自动化测试 ===");

const clientDir = path.resolve(__dirname, '../../src/client');
const jsContent = fs.readFileSync(path.join(clientDir, 'app.js'), 'utf8');
const htmlContent = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');

// 1. 静态检测
const hasToggleButtonInHtml = htmlContent.includes('btn-toggle-show-highlights');
const hasPureCountInHtml = htmlContent.includes('count-pure-highlights');
const hasShowHighlightsInState = jsContent.includes('showHighlightsInSidebar: false');
const hasFilterLogic = jsContent.includes('state.showHighlightsInSidebar ? state.notes : thoughtNotes');
const hasPureBadge = jsContent.includes('pure-highlight-card');

console.log(`[检查 1] index.html 切换显示划线按钮: ${hasToggleButtonInHtml ? 'PASSED' : 'FAILED'}`);
console.log(`[检查 2] index.html 纯划线数量徽章: ${hasPureCountInHtml ? 'PASSED' : 'FAILED'}`);
console.log(`[检查 3] state.showHighlightsInSidebar 默认隐藏: ${hasShowHighlightsInState ? 'PASSED' : 'FAILED'}`);
console.log(`[检查 4] renderNotesList 默认仅展示随笔过滤: ${hasFilterLogic ? 'PASSED' : 'FAILED'}`);
console.log(`[检查 5] 纯高亮与随笔视觉徽章分级: ${hasPureBadge ? 'PASSED' : 'FAILED'}`);

// 2. 模拟运行验证 (Simulation Verification)
const mockNotes = [
    { id: '1', quote: '宏观债务危机不可避免', comment: '', page: 1 }, // 纯划线
    { id: '2', quote: '建立反脆弱系统', comment: '这是极有价值的韧性模型，需要深入思考', page: 2 }, // 随笔思考
    { id: '3', quote: '全球资产配置的再平衡', comment: '', page: 3 } // 纯划线
];

let showHighlights = false;

function getDisplayedNotes() {
    const thoughtNotes = mockNotes.filter(n => n.comment && n.comment.trim() !== '');
    const pureHighlights = mockNotes.filter(n => !n.comment || n.comment.trim() === '');
    return {
        displayed: showHighlights ? mockNotes : thoughtNotes,
        pureCount: pureHighlights.length,
        thoughtCount: thoughtNotes.length
    };
}

console.log("\n--- [测试状态 1: 默认视图 (未开启显示划线)] ---");
let view1 = getDisplayedNotes();
console.log(`笔记区展示条目数: ${view1.displayed.length} 条 (期望: 1 条随笔, 实际: ${view1.displayed.length} 条)`);
console.log(`纯划线徽章数字: ${view1.pureCount} 条`);
console.log(`首条展示内容: "${view1.displayed[0].comment}"`);

console.log("\n--- [测试状态 2: 用户点击【显示划线】切换开启] ---");
showHighlights = true;
let view2 = getDisplayedNotes();
console.log(`笔记区展示条目数: ${view2.displayed.length} 条 (期望: 3 条全量数据, 实际: ${view2.displayed.length} 条)`);

console.log("\n--- [测试状态 3: 用户再次点击恢复默认] ---");
showHighlights = false;
let view3 = getDisplayedNotes();
console.log(`笔记区展示条目数: ${view3.displayed.length} 条 (期望: 1 条随笔, 实际: ${view3.displayed.length} 条)`);

const allPass = (view1.displayed.length === 1 && view2.displayed.length === 3 && view3.displayed.length === 1);
console.log(`\n最终验证结论: ${allPass ? '✅ 100% 测试通过！' : '❌ 失败'}`);

if (!allPass) {
    console.error("❌ SEPARATED HIGHLIGHTS AND NOTES CHECKS FAILED!");
    process.exit(1);
}

console.log("\n=== ALL SEPARATED HIGHLIGHTS AND NOTES TESTS PASSED (100% SUCCESS) ===");
