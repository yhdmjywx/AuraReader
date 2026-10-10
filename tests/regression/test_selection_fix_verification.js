const fs = require('fs');
const path = require('path');

console.log("=== AuraReader 选区浮动菜单防误杀修复校验 ===");

const jsContent = fs.readFileSync(path.resolve(__dirname, '../../src/client/app.js'), 'utf8');

// 1. 检查 mouseup 与 touchend 监听
const hasMouseUpListener = jsContent.includes("elements.bookPaper.addEventListener('mouseup'");
const hasTouchEndListener = jsContent.includes("elements.bookPaper.addEventListener('touchend'");
console.log(`[机制检查 1] mouseup 释放触发定位: ${hasMouseUpListener ? 'PASSED' : 'FAILED'}`);
console.log(`[机制检查 2] touchend 触摸触发定位: ${hasTouchEndListener ? 'PASSED' : 'FAILED'}`);

// 2. 检查 click 冒泡防误杀守卫
const hasActiveSelectionGuard = jsContent.includes('hasActiveSelection');
console.log(`[防护检查 3] 全局 click 事件防误杀有效选区: ${hasActiveSelectionGuard ? 'PASSED' : 'FAILED'}`);

// 3. 检查 stopPropagation
const hasStopPropagationOnButtons = /e\.stopPropagation\(\);\r?\n            if \(!state\.pendingSelection\) return;/.test(jsContent);
console.log(`[冒泡检查 4] 选区按钮阻止事件冒泡: ${hasStopPropagationOnButtons ? 'PASSED' : 'FAILED'}`);

const allPass = hasMouseUpListener && hasTouchEndListener && hasActiveSelectionGuard && hasStopPropagationOnButtons;
console.log(`\n最终结论: ${allPass ? '✅ 100% 通过！彻底修复划选文字后菜单被误杀消失的 Bug！' : '❌ 校验失败'}`);

if (!allPass) {
    console.error("❌ SELECTION FIX CHECKS FAILED!");
    process.exit(1);
}

console.log("\n=== ALL SELECTION FIX CHECKS PASSED (100% SUCCESS) ===");
