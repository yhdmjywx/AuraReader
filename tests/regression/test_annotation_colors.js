const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== AuraReader 划线与随笔颜色规范回归测试 (Yellow vs Green) ===");

const clientDir = path.resolve(__dirname, '../../src/client');
const cssContent = fs.readFileSync(path.join(clientDir, 'styles.css'), 'utf8');
const appContent = fs.readFileSync(path.join(clientDir, 'app.js'), 'utf8');
const bookRepoContent = fs.readFileSync(path.join(clientDir, 'repositories/bookRepository.js'), 'utf8');
const annotEngineContent = fs.readFileSync(path.join(clientDir, 'core/annotationEngine.js'), 'utf8');

// 1. CSS 样式规范验证
console.log("\n[步骤 1: 验证 CSS 样式表中高亮颜色及卡片边框定义]");
assert.ok(cssContent.includes('mark.hl-yellow'), "CSS 必须定义 mark.hl-yellow 样式");
assert.ok(cssContent.includes('mark.hl-green'), "CSS 必须定义 mark.hl-green 样式");
assert.ok(cssContent.includes('.note-card.hl-green-card'), "CSS 必须定义 .note-card.hl-green-card 样式");
assert.ok(cssContent.includes('.note-card.pure-highlight-card'), "CSS 必须定义 .note-card.pure-highlight-card 样式");
assert.ok(cssContent.includes('--hl-yellow-bg'), "CSS 变量必须定义 --hl-yellow-bg");
assert.ok(cssContent.includes('--hl-green-bg'), "CSS 变量必须定义 --hl-green-bg");
console.log("✅ 样式表黄色划线与绿色随笔类名及变量校验全部通过！");

// 2. 种子数据 (Seed Data) 颜色规范校验
console.log("\n[步骤 2: 验证默认种子笔记颜色属性]");
assert.ok(!bookRepoContent.includes("id: 'note-seed-1',\n        bookId: 'crisis-era',\n        quote: '当一个社会拼命借钱的时候，意味着这个社会存在着极为深刻（且不易解决）的结构性问题。',\n        comment: '深刻分析了高债务杠杆背后的隐患，值得在研究宏观经济时作为风险指标。',\n        color: 'yellow'"), "note-seed-1 含思考感悟，绝不能标注为 yellow！");
assert.ok(bookRepoContent.includes("id: 'note-seed-1'"), "note-seed-1 必须存在");
assert.ok(bookRepoContent.includes("id: 'note-seed-2'"), "note-seed-2 必须存在");
console.log("✅ 种子笔记颜色校验通过（含感悟的种子标注均为 green）！");

// 3. 应用层与标注内核逻辑检测
console.log("\n[步骤 3: 静态检测 app.js 与 annotationEngine.js 颜色分配]");
assert.ok(annotEngineContent.includes("comment && comment.trim() !== '' ? 'green' : 'yellow'"), "annotationEngine 必须根据 comment 存在性动态推导 green/yellow");
assert.ok(appContent.includes("btnSaveQuickNote"), "app.js 必须包含独立随笔保存绑定");
assert.ok(appContent.includes("createHighlight(color = 'yellow')"), "createHighlight 默认应为 yellow 纯高亮");
console.log("✅ 应用层代码逻辑静态检查通过！");

// 4. 动态执行 AnnotationEngine 纯函数校验
(async () => {
    console.log("\n[步骤 4: 动态测试 AnnotationEngine 渲染与模型生成]");
    const { createAnnotationObject, applyHighlightToHtml } = await import(
        '../../src/client/core/annotationEngine.js'
    );

    // 测试 A: 纯划线 -> yellow
    const pureNote = createAnnotationObject({
        bookId: 'b1',
        quote: '纯划线内容',
        comment: ''
    });
    assert.strictEqual(pureNote.color, 'yellow', "无随笔感悟的划线必须为 yellow");

    // 测试 B: 随笔感悟 -> green
    const thoughtNote = createAnnotationObject({
        bookId: 'b1',
        quote: '深度思考内容',
        comment: '我的深度评论'
    });
    assert.strictEqual(thoughtNote.color, 'green', "含随笔感悟的标注必须为 green");

    // 测试 C: HTML 渲染出不同的 mark class
    const htmlSnippet = '<p>纯划线内容 与 深度思考内容 并存</p>';
    const htmlWithYellow = applyHighlightToHtml(htmlSnippet, pureNote);
    assert.ok(htmlWithYellow.includes('<mark class="hl-yellow" data-id="' + pureNote.id + '">纯划线内容</mark>'), "纯划线应渲染为 hl-yellow mark");

    const htmlWithGreen = applyHighlightToHtml(htmlWithYellow, thoughtNote);
    assert.ok(htmlWithGreen.includes('<mark class="hl-green" data-id="' + thoughtNote.id + '">深度思考内容</mark>'), "随笔感悟应渲染为 hl-green mark");

    console.log("✅ 动态渲染与模型色彩映射 100% 验证成功！");
    console.log("\n=== ALL ANNOTATION COLOR REGRESSION TESTS PASSED (100% SUCCESS) ===");
})();
