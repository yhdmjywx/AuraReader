const fs = require('fs');
const path = require('path');

console.log('=== HTML & DOM 深度审计 ===');
const clientDir = path.resolve(__dirname, '../../src/client');
const html = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(clientDir, 'main.ts'), 'utf8');

// 1. HTML Tag Balance Stack
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype']);
const tagRegex = /<\/?([a-zA-Z0-9\-]+)([^>]*?)>/g;
let stack = [];
let match;
let tagCount = 0;
let errors = [];

while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = match[0].startsWith('</');
    const tagName = match[1].toLowerCase();
    const isSelfClosing = match[0].endsWith('/>') || voidTags.has(tagName);

    if (tagName.startsWith('!') || tagName.startsWith('?')) continue;

    tagCount++;
    if (isClosing) {
        if (stack.length === 0) {
            errors.push(`多余闭合标签: </${tagName}> at pos ${match.index}`);
        } else {
            const last = stack.pop();
            if (last.tag !== tagName) {
                errors.push(`标签不匹配: 期望 </${last.tag}> (行 ${last.line})，实际为 </${tagName}> (pos ${match.index})`);
            }
        }
    } else if (!isSelfClosing) {
        // Calculate line number
        const line = html.substring(0, match.index).split('\n').length;
        stack.push({ tag: tagName, line });
    }
}

if (stack.length > 0) {
    errors.push(`未闭合标签: ${stack.map(s => `<${s.tag}> (第${s.line}行)`).join(', ')}`);
}

console.log(`[HTML 标签平衡栈校验] 解析 ${tagCount} 个标签:`, errors.length === 0 ? '✅ 完美闭合 (0 Errors)' : '❌ 失败: ' + JSON.stringify(errors));

// 2. DOM ID 引用校验
const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
const jsIds = new Set();
while ((match = idRegex.exec(js)) !== null) {
    jsIds.add(match[1]);
}

const missingIds = [];
for (const id of jsIds) {
    const idPattern = new RegExp(`id=["']${id}["']`);
    if (!idPattern.test(html)) {
        missingIds.push(id);
    }
}

console.log(`[DOM ID 完整性校验] main.ts 中引用 ${jsIds.size} 个元素 ID:`, missingIds.length === 0 ? '✅ 全部在 HTML 中存在 (0 孤立)' : '❌ 缺失 ID: ' + JSON.stringify(missingIds));

// 3. AI 遗留关键词扫描 (HTML / JS / CSS)
const css = fs.readFileSync(path.join(clientDir, 'styles.css'), 'utf8');
const aiKeywords = [
    'btn-ask-ai-selection',
    'btn-trigger-ai-batch',
    'tab-ai-summary',
    'btn-re-generate-ai',
    'ai-status-banner',
    'ai-output-container',
    'ai-core-ideas',
    'ai-key-bullets',
    'ai-tags-cloud',
    'ai-actionables',
    'ai-provider',
    'group-api-key',
    'input-api-key',
    'btn-save-settings',
    'triggerAiBatchProcessing',
    'triggerAiSingleAnalysis',
    'runMockAiStream',
    'runRealAiStream',
    'typeText',
    'btn-ai-sparkle',
    'icon-ai'
];

const foundInHtml = aiKeywords.filter(k => html.includes(k));
const foundInJs = aiKeywords.filter(k => js.includes(k));
const foundInCss = aiKeywords.filter(k => css.includes(k));

console.log('[AI 遗留选择器/函数检索]:');
console.log(' - HTML 遗留:', foundInHtml.length === 0 ? '✅ 0 遗留' : foundInHtml);
console.log(' - JS 遗留:', foundInJs.length === 0 ? '✅ 0 遗留' : foundInJs);
console.log(' - CSS 遗留:', foundInCss.length === 0 ? '✅ 0 遗留' : foundInCss);

if (errors.length > 0 || missingIds.length > 0 || foundInHtml.length > 0 || foundInJs.length > 0 || foundInCss.length > 0) {
    process.exit(1);
} else {
    console.log('=== 全部静态与引用审查通过 ===');
}
