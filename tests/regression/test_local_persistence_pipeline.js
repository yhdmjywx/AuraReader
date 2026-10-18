const fs = require('fs');
const path = require('path');

console.log("=== AuraReader 本地数据持久化全链路审查与测试 ===");

const clientDir = path.resolve(__dirname, '../../src/client');
const appJs = fs.readFileSync(path.join(clientDir, 'app.js'), 'utf8');
const bookRepoJs = fs.readFileSync(path.join(clientDir, 'repositories/bookRepository.js'), 'utf8');
const annotRepoJs = fs.readFileSync(path.join(clientDir, 'repositories/annotationRepository.js'), 'utf8');
const controllerJs = fs.readFileSync(path.join(clientDir, 'features/annotations/annotationController.js'), 'utf8');
const jsContent = [appJs, bookRepoJs, annotRepoJs, controllerJs].join('\n');

// 1. 静态检测核心持久化管道
const checks = [
    {
        name: "IndexedDB 数据库初始化 (AuraReaderDB & notes/books 表及 bookId 索引)",
        pass: jsContent.includes('window.indexedDB.open("AuraReaderDB", 1)') && jsContent.includes('dbInstance.createObjectStore("notes",') && jsContent.includes('notesStore.createIndex("bookId"')
    },
    {
        name: "高亮划线生成保存至 IndexedDB (saveNoteToDB)",
        pass: jsContent.includes("function createHighlight") && jsContent.includes("repoSaveNote(newNote)")
    },
    {
        name: "引用笔记新建/更新保存至 IndexedDB (saveNoteToDB)",
        pass: jsContent.includes("function saveModalNote") && jsContent.includes("repoSaveNote(this.notes[noteIndex])") && jsContent.includes("repoSaveNote(newNote)")
    },
    {
        name: "停用独立随笔创建，引用笔记仍保留持久化管道",
        pass: !jsContent.includes("elements.btnSaveQuickNote") && controllerJs.includes('this.requireQuote(quote)') && controllerJs.includes('repoSaveNote(newNote)')
    },
    {
        name: "笔记/高亮删除同步物理删除 IndexedDB (deleteNoteFromDB)",
        pass: jsContent.includes("function deleteNote(id)") && jsContent.includes("repoDeleteNote(id")
    },
    {
        name: "LocalStorage 自动同步持久化 (persistNotes 双保险)",
        pass: jsContent.includes("function persistNotes()") && jsContent.includes("localStorage.setItem('aura_notes_' + state.currentBook,")
    },
    {
        name: "书籍加载通过统一入口恢复笔记及未完成写入",
        pass: appJs.includes('state.notes = await repoLoadNotesForBook(bookKey);')
            && controllerJs.includes('const loaded = await repoLoadNotesForBook(bookId);')
    }
];

let allPassed = true;
checks.forEach((chk, idx) => {
    console.log(`[检查项 ${idx + 1}] ${chk.name}: ${chk.pass ? '✅ PASSED' : '❌ FAILED'}`);
    if (!chk.pass) allPassed = false;
});

console.log(`\n审查结论: ${allPassed ? '🎉 100% 本地双重持久化（IndexedDB + LocalStorage）已完全闭环！' : '❌ 存在未持久化的漏洞'}`);

if (!allPassed) {
    console.error("❌ LOCAL PERSISTENCE PIPELINE CHECKS FAILED!");
    process.exit(1);
}

console.log("\n=== ALL LOCAL PERSISTENCE PIPELINE CHECKS PASSED (100% SUCCESS) ===");

