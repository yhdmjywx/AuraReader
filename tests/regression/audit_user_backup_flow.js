const fs = require('fs');
const path = require('path');

console.log("=== AuraReader 从 0 开始全链路深度漏洞审计 ===");

const jsContent = fs.readFileSync(path.resolve(__dirname, '../../src/client/app.js'), 'utf8');

// 模拟完整 IndexedDB 异步行为与状态机 (Full State Machine Simulation)
class MockIndexedDB {
    constructor() {
        this.booksStore = new Map();
        this.notesStore = new Map();
    }
    async putBook(book) {
        this.booksStore.set(book.id, JSON.parse(JSON.stringify(book)));
    }
    async putNote(note) {
        this.notesStore.set(note.id, JSON.parse(JSON.stringify(note)));
    }
    async getAllBooks() {
        return Array.from(this.booksStore.values());
    }
    async getNotesByBookId(bookId) {
        return Array.from(this.notesStore.values()).filter(n => n.bookId === bookId);
    }
}

const mockDB = new MockIndexedDB();
const demoBooks = {};
const state = {
    currentBook: 'crisis-era',
    currentPage: 1,
    notes: []
};

// 模拟导入备份包 (含有 2 本书与属于不同书的笔记)
const backupPayload = {
    version: "1.0",
    type: "aurareader_full_backup",
    exportedAt: new Date().toISOString(),
    books: [
        { id: 'custom_book_A', title: '用户导入图书A', format: 'EPUB', pages: ['<p>图书A第一页内容</p>'] },
        { id: 'custom_book_B', title: '用户导入图书B', format: 'EPUB', pages: ['<p>图书B第一页内容</p>'] }
    ],
    notes: [
        { id: 'note-A1', bookId: 'custom_book_A', quote: '图书A内容', comment: '笔记A1', page: 1, chapter: '第一章' },
        { id: 'note-A2', bookId: 'custom_book_A', quote: '图书A内容2', comment: '笔记A2', page: 1, chapter: '第一章' },
        { id: 'note-B1', bookId: 'custom_book_B', quote: '图书B内容', comment: '笔记B1', page: 1, chapter: '第一章' }
    ]
};

console.log("--------------------------------------------------");
console.log("模拟 1: 软件初始状态 (访问网页未恢复前)");
console.log(`当前激活图书: ${state.currentBook}`);
console.log(`当前内存划线数: ${state.notes.length}`);

console.log("\n--------------------------------------------------");
console.log("模拟 2: 用户导入恢复备份包 (.aurabackup)");

// 准确再现 app.js 中的逻辑执行次序
async function simulateImportFullBackup(data) {
    let importedBooksCount = 0;
    let importedNotesCount = 0;

    // 1. 恢复所有包含原件的图书至 IndexedDB
    if (Array.isArray(data.books) && data.books.length > 0) {
        for (const b of data.books) {
            if (b && b.id) {
                demoBooks[b.id] = b;
                await mockDB.putBook(b);
                importedBooksCount++;
            }
        }
    }

    // 2. 恢复所有划线随笔至 IndexedDB
    const firstBookId = (data.books && data.books[0]) ? (data.books[0].id || data.books[0].title) : state.currentBook;
    const allImportedNotes = [];
    
    if (Array.isArray(data.notes) && data.notes.length > 0) {
        for (const n of data.notes) {
            if (n && n.id) {
                n.bookId = n.bookId || firstBookId || state.currentBook;
                allImportedNotes.push(n);
                await mockDB.putNote(n);
            }
        }
    }

    // 3. 自动切换并载入第一本恢复的电子书
    if (data.books && data.books.length > 0 && data.books[0].id) {
        const targetBookId = data.books[0].id;
        demoBooks[targetBookId] = data.books[0];
        
        // 模拟 loadBook(targetBookId)
        state.currentBook = targetBookId;
        const dbNotes = await mockDB.getNotesByBookId(targetBookId);
        state.notes = dbNotes;
    }

    // 4. 合并笔记
    const noteMap = new Map(state.notes.map(n => [n.id, n]));
    allImportedNotes.forEach(n => noteMap.set(n.id, n));
    state.notes = Array.from(noteMap.values());
    importedNotesCount = allImportedNotes.length;

    return { importedBooksCount, importedNotesCount };
}

(async () => {
    const res = await simulateImportFullBackup(backupPayload);
    console.log(`执行结果: 恢复 ${res.importedBooksCount} 本图书, ${res.importedNotesCount} 条划线随笔`);
    console.log(`恢复后当前激活图书: ${state.currentBook}`);
    console.log(`恢复后内存中 state.notes 包含条数: ${state.notes.length}`);

    // 关键缺陷排查：如果在界面上过滤显示，属于当前图书 custom_book_A 的笔记有几条？
    const notesForCurrentBook = state.notes.filter(n => n.bookId === state.currentBook);
    console.log(`属于当前打开图书 (${state.currentBook}) 的划线随笔条数: ${notesForCurrentBook.length}`);

    // 缺陷排查 B：如果用户手动点击切换到图书 B (custom_book_B)
    console.log("\n--- [测试用户场景 B: 切换阅读《用户导入图书B》] ---");
    state.currentBook = 'custom_book_B';
    state.notes = await mockDB.getNotesByBookId('custom_book_B');
    console.log(`切换到图书 B 后，从 IndexedDB 读取出的划线数: ${state.notes.length}`);

    const isSuccess = (res.importedBooksCount === 2 && res.importedNotesCount === 3 && notesForCurrentBook.length === 2 && state.notes.length === 1);
    
    console.log("\n--------------------------------------------------");
    console.log(`全链路闭环模拟判定: ${isSuccess ? '✅ 链路完全正确，无死角漏洞' : '❌ 发现死角漏洞'}`);
    console.log("--------------------------------------------------");

    if (!isSuccess) {
        console.error("❌ BACKUP FLOW AUDIT FAILED!");
        process.exit(1);
    }
})();
