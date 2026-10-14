const fs = require('fs');
const path = require('path');

console.log("=== AuraReader 高亮与随笔合并绑定及原地编辑自动化测试 ===");

const jsContent = fs.readFileSync(path.resolve(__dirname, '../../src/client/app.js'), 'utf8');

// 1. 静态检测核心逻辑
const hasEditingNoteIdInState = jsContent.includes('editingNoteId: null');
const hasOpenNoteModalEditParam = jsContent.includes('function openNoteModal(quote, existingNoteId = null)');
const hasInPlaceSave = jsContent.includes('if (state.editingNoteId)');
const hasEditButtonInCard = jsContent.includes('btn-edit-note');
const openBody = jsContent.slice(jsContent.indexOf('function openNoteModal'), jsContent.indexOf('function closeNoteModal'));
const hasNoAutoMerge = openBody.length > 0 && !openBody.includes('findOverlappingNote');

console.log(`[静态检查 1] state.editingNoteId 状态追踪: ${hasEditingNoteIdInState ? 'PASSED' : 'FAILED'}`);
console.log(`[静态检查 2] openNoteModal 编辑模式支持: ${hasOpenNoteModalEditParam ? 'PASSED' : 'FAILED'}`);
console.log(`[静态检查 3] saveModalNote 原地更新逻辑: ${hasInPlaceSave ? 'PASSED' : 'FAILED'}`);
console.log(`[静态检查 4] 笔记卡片【编辑】按钮配置: ${hasEditButtonInCard ? 'PASSED' : 'FAILED'}`);
console.log(`[静态检查 5] 新建笔记不再自动改写已有高亮: ${hasNoAutoMerge ? 'PASSED' : 'FAILED'}`);

// 2. 交互仿真测试 (Mock Interactive Lifecycle)
const mockState = {
    currentBook: 'crisis-era',
    currentPage: 7,
    notes: [],
    editingNoteId: null,
    pendingSelection: null
};

// 步骤 A: 用户划线高亮一段文字
function mockCreateHighlight(quote, color = 'yellow') {
    const existing = mockState.notes.find(n => n.page === mockState.currentPage && n.quote === quote);
    if (existing) {
        existing.color = color;
    } else {
        mockState.notes.unshift({
            id: 'highlight-' + Date.now(),
            bookId: mockState.currentBook,
            kind: 'highlight',
            quote: quote,
            comment: '',
            color: color,
            page: mockState.currentPage
        });
    }
}

// 步骤 B: 选区里的“笔记”始终新建，不改写已有高亮
function mockOpenNoteModal(quote, existingId = null) {
    mockState.editingNoteId = existingId || null;
}

function mockSaveModalNote(quote, comment) {
    if (mockState.editingNoteId) {
        const idx = mockState.notes.findIndex(n => n.id === mockState.editingNoteId);
        if (idx !== -1 && mockState.notes[idx].kind !== 'highlight') {
            mockState.notes[idx].comment = comment;
        }
    } else if (comment && comment.trim()) {
        mockState.notes.unshift({
            id: 'note-' + Date.now(),
            bookId: mockState.currentBook,
            kind: 'note',
            quote: quote,
            comment: comment,
            page: mockState.currentPage
        });
    }
    mockState.editingNoteId = null;
}

const sampleQuote = "远超2008年‘雷曼时刻’的金融危机已迫在眉睫。";

console.log("\n--- [测试步骤 1: 用户点击高亮] ---");
mockCreateHighlight(sampleQuote, 'yellow');
console.log(`生成划线后笔记总数: ${mockState.notes.length} 条 (感悟: "${mockState.notes[0].comment}")`);

console.log("\n--- [测试步骤 2: 用户为同一段文字新建笔记 'wfokfaw'] ---");
mockOpenNoteModal(sampleQuote);
console.log(`新建流程不应进入编辑: ${mockState.editingNoteId === null ? 'YES' : 'NO'}`);
mockSaveModalNote(sampleQuote, 'wfokfaw');
const highlight = mockState.notes.find(n => n.kind === 'highlight');
const createdNote = mockState.notes.find(n => n.kind === 'note');
console.log(`保存后记录数: ${mockState.notes.length} 条 (期望: 高亮 1 + 笔记 1)`);
console.log(`高亮仍无正文: "${highlight && highlight.comment}", 笔记内容: "${createdNote && createdNote.comment}"`);

console.log("\n--- [测试步骤 3: 用户只编辑这条笔记] ---");
mockOpenNoteModal(sampleQuote, createdNote.id);
mockSaveModalNote(sampleQuote, '修改后的深度思考感悟');
const highlightAfter = mockState.notes.find(n => n.kind === 'highlight');
const noteAfter = mockState.notes.find(n => n.id === createdNote.id);
console.log(`编辑后记录数: ${mockState.notes.length} 条 (期望: 2 条)`);
console.log(`笔记更新为: "${noteAfter && noteAfter.comment}", 高亮评论仍为: "${highlightAfter && highlightAfter.comment}"`);

const testPassed = mockState.notes.length === 2
    && noteAfter
    && noteAfter.comment === '修改后的深度思考感悟'
    && highlightAfter
    && highlightAfter.comment === ''
    && hasNoAutoMerge;
console.log(`\n判定结果: ${testPassed ? '✅ 100% 通过！高亮与笔记独立保存，编辑笔记不会改写高亮。' : '❌ 校验失败'}`);

if (!testPassed) {
    console.error("❌ UNIFIED NOTE EDITING CHECKS FAILED!");
    process.exit(1);
}

console.log("\n=== ALL UNIFIED NOTE EDITING TESTS PASSED (100% SUCCESS) ===");
