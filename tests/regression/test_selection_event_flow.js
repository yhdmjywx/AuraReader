console.log("=== 选区浮动菜单消失根因诊断分析 ===");

// 模拟浏览器的事件触发时序：
// 1. 用户按住鼠标左键并在段落上拖拽 -> 触发 selectionchange 事件
// 2. handleSelection() 将 selectionTooltip 设置为 display: 'flex'
// 3. 用户松开鼠标左键 -> 浏览器触发 mouseup 及跟随的 click 事件
// 4. document 的 click 监听器触发：
//    因为点击的目标是 <p> 段落（不是 #selection-tooltip 自身），所以 !e.target.closest('#selection-tooltip') 为 true
//    导致 click 事件处理器立即调用 hideSelectionTooltip()，将刚弹出的菜单瞬间关闭！

console.log("根因结论: document 全局 click 监听器在用户划选松手触发 click 时，误杀掉了刚显示的选区菜单。");
console.log("修复方案:");
console.log("1. 在 document click 监听器中，判断当前是否有非空选区 (selection && !selection.isCollapsed && selection.toString().trim().length > 0)。如果有有效选区，绝不隐藏 selectionTooltip。");
console.log("2. 选区监听采用 mouseup / touchend + selectionchange 组合，并在 mouseup 延迟 30ms 计算定位，确保坐标准确且不被点击事件冒泡冲掉。");
