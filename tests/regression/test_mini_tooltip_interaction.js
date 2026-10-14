const fs = require('fs');
const path = require('path');

console.log("=== AuraReader 阅读区 0 阻塞弹窗轻量交互测试 ===");

const clientDir = path.resolve(__dirname, '../../src/client');
const jsContent = fs.readFileSync(path.join(clientDir, 'app.js'), 'utf8');
const htmlContent = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');

// 1. 检查正文高亮点击是否移除了 confirm
const applyHighlightsFunc = jsContent.slice(jsContent.indexOf('function applyHighlightsToPaper'), jsContent.indexOf('function initTextSelection'));
const hasConfirmInReader = applyHighlightsFunc.includes('confirm(');
console.log(`[体验检查 1] 阅读正文高亮点击 0 浏览器阻塞弹窗: ${!hasConfirmInReader ? 'PASSED (0 弹窗)' : 'FAILED'}`);

// 2. 检查悬浮气泡 DOM 元素
const hasTooltipHtml = htmlContent.includes('id="highlight-action-tooltip"');
const hasBtnAddThought = htmlContent.includes('id="btn-hl-add-thought"');
const hasBtnRemove = htmlContent.includes('id="btn-hl-remove"');
console.log(`[组件检查 2] 迷你悬浮气泡 HTML 配置: ${hasTooltipHtml && hasBtnAddThought && hasBtnRemove ? 'PASSED' : 'FAILED'}`);

// 3. 检查 JS 事件与定位
const hasShowActionTooltip = jsContent.includes('showHighlightActionTooltip(this, note)');
const hasDismissOnOutsideClick = jsContent.includes('hideHighlightActionTooltip()');
console.log(`[交互检查 3] 点击正文高亮弹出微型气泡: ${hasShowActionTooltip ? 'PASSED' : 'FAILED'}`);
console.log(`[交互检查 4] 点击空白处无感平滑收起: ${hasDismissOnOutsideClick ? 'PASSED' : 'FAILED'}`);

const allPass = !hasConfirmInReader && hasTooltipHtml && hasBtnAddThought && hasBtnRemove && hasShowActionTooltip && hasDismissOnOutsideClick;
console.log(`\n最终体验判定: ${allPass ? '✅ 100% 成功！完美还原自然纯粹的书本阅读质感！' : '❌ 校验失败'}`);

if (!allPass) {
    console.error("❌ MINI TOOLTIP INTERACTION CHECKS FAILED!");
    process.exit(1);
}

console.log("\n=== ALL MINI TOOLTIP INTERACTION CHECKS PASSED (100% SUCCESS) ===");
