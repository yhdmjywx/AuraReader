/* ==========================================================================
   BookRepository - Book Data Persistence & Demo Storage (Infrastructure Layer)
   Zero UI dependencies. Manages IndexedDB "books" store & demo books memory cache.
   ========================================================================== */

let dbInstance = null;

// Built-in Demo Books Database
export const demoBooks = {
    'crisis-era': {
        language: 'zh-CN',
        title: '危机时代（罗杰斯·思考与洞察）',
        format: 'EPUB',
        toc: [
            { title: '第一章：人生最险恶的危机不可避免', page: 1 },
            { title: '第二章：债台高筑与全球市场动荡', page: 3 },
            { title: '第三章：通货膨胀下的资产保值之道', page: 6 },
            { title: '第四章：如何在危机爆发前识别信号', page: 8 },
            { title: '第五章：面向未来二十年的投资哲学', page: 10 }
        ],
        pages: [
            // Page 1
            `<h1>第一章：人生最险恶的危机不可避免</h1>
            <p>这次的危机，与过往的危机在本质上并无任何不同。历史的轮回而已。</p>
            <p>雷曼危机之后的十二年间，全世界主要经济体的资本市场，均经历了股价长期大幅上涨的好景气。</p>
            <p>从历史上看，连续十到十二年股价上涨，是极为罕见的现象。事出反常必有妖。股价已经上涨了这么长时间，是时候掉头向下了。这才是真正的“必然”。</p>
            <p>也许是这次超长股市景气所带来的乐观情绪使然，在同一段时期内，世界各国的债务水平也大幅飙升。</p>
            <p>还是那句话，事出反常必有妖。当一个社会拼命借钱的时候，意味着这个社会存在着极为深刻（且不易解决）的结构性问题。</p>
            <p>正因如此，心虚的市场在危机爆发时往往会显得底气不足，极为脆弱。这是一中正常的表现。这一回也不例外。</p>`,
            
            // Page 2
            `<h2>周期的铁律与历史的经验</h2>
            <p>每一个时代的人都倾向于相信：“这一次不一样”。然而在长达几百年的金融历史面前，人性从未改变。贪婪与恐惧交替支配着市场价格。</p>
            <p>危机发生时，绝大部分投资者会感到恐慌，试图在最低点抛售一切。但真正的长期思考者会明白，危机的另一面是绝佳的资产重组机会。</p>
            <p>我们需要建立的不是预测危机的水晶球，而是一套在危机中生存并繁衍的思维框架。这意味着控制杠杆、保持流动性，并时刻关注核心实体价值。</p>`,

            // Page 3
            `<h1>第二章：债台高筑与全球市场动荡</h1>
            <p>央行的超发货币政策像是一种剧毒的麻醉剂。它能在短期内掩盖结构性矛盾，却在无形中把债务的雪球越推越大。</p>
            <p>当全球主要经济体的债务 GDP 占比突破历史警戒线时，边际收益开始急速递减。每一单位新发行的债务所能带来的经济增长微乎其微。</p>
            <p>作为独立的研读者与投资者，你必须学会看清资产负债表的真相，而不是被官方的乐观表态所蒙蔽。</p>`,

            // Page 4
            `<h2>实体供应链与大宗商品的锚点</h2>
            <p>在纸面财富与金融衍生品极度膨胀的时代，硬通货与实体资源将重新焕发光芒。无论是农产品、能源还是基础金属，它们是人类社会运转的物理基础。</p>
            <p>在危机到来时，那些拥有不可替代资源与强劲自由现金流的企业，能够抵御最严酷的寒冬。</p>`
        ]
    },
    'deep-work': {
        language: 'zh-CN',
        title: '深度工作（Cal Newport）',
        format: 'PDF',
        toc: [
            { title: '引言：深度工作的价值', page: 1 },
            { title: '准则一：工作要深度', page: 2 },
            { title: '准则二：拥抱无聊', page: 3 }
        ],
        pages: [
            `<h1>引言：深度工作的价值</h1>
            <p>在日益无休止的打扰与碎片化信息中，深度专注的能力正变得越来越稀缺。正因稀缺，它才变得无比珍贵。</p>
            <p>深度工作（Deep Work）是指在无干扰的状态下专注进行职业活动的能力。这种能力能将你的认知能力推向极限，创造出难以复制的新价值。</p>`,

            `<h1>准则一：工作要深度</h1>
            <p>意志力是有限的资源，而不是无限的源泉。想要建立持久的深度工作习惯，关键在于建立固定且不可侵犯的日程仪式。</p>
            <p>打造你的工作台环境，屏蔽一切即时通讯工具，为最重要的思考留下整块的时间。</p>`
        ]
    }
};

// Default seed notes for initial experience
export const seedNotes = [
    {
        id: 'note-seed-1',
        bookId: 'crisis-era',
        kind: 'note',
        quote: '当一个社会拼命借钱的时候，意味着这个社会存在着极为深刻（且不易解决）的结构性问题。',
        comment: '深刻分析了高债务杠杆背后的隐患，值得在研究宏观经济时作为风险指标。',
        color: 'green',
        page: 1,
        chapter: '第一章：人生最险恶的危机不可避免',
        timestamp: '2026-07-29 22:15'
    },
    {
        id: 'note-seed-2',
        bookId: 'crisis-era',
        kind: 'note',
        quote: '我们需要建立的不是预测危机的水晶球，而是一套在危机中生存并繁衍的思维框架。',
        comment: '从单纯预测转向构建抗风险的韧性系统，这是反脆弱思维的核心。',
        color: 'green',
        page: 2,
        chapter: '第一章：人生最险恶的危机不可避免',
        timestamp: '2026-07-29 22:20'
    }
];

export function getSeedNotes() {
    return JSON.parse(JSON.stringify(seedNotes));
}

export function initDB() {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            console.warn("当前环境不支持 IndexedDB");
            resolve(null);
            return;
        }
        const request = window.indexedDB.open("AuraReaderDB", 1);

        request.onupgradeneeded = function (e) {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains("books")) {
                dbInstance.createObjectStore("books", { keyPath: "id" });
            }
            if (!dbInstance.objectStoreNames.contains("notes")) {
                const notesStore = dbInstance.createObjectStore("notes", { keyPath: "id" });
                notesStore.createIndex("bookId", "bookId", { unique: false });
            }
        };

        request.onsuccess = function (e) {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };

        request.onerror = function (e) {
            console.error("IndexedDB 打开失败:", e);
            resolve(null);
        };
    });
}

export function getDB() {
    return dbInstance;
}

export function setDB(db) {
    dbInstance = db;
}

export function saveBookToDB(bookObj) {
    if (!bookObj || !bookObj.id) return Promise.resolve();
    demoBooks[bookObj.id] = bookObj;
    if (!dbInstance) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["books"], "readwrite");
        const store = tx.objectStore("books");
        store.put(bookObj);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
    });
}

export function loadBookFromDB(bookId) {
    if (!bookId) return Promise.resolve(null);
    if (demoBooks[bookId]) return Promise.resolve(demoBooks[bookId]);
    if (!dbInstance) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["books"], "readonly");
        const store = tx.objectStore("books");
        const req = store.get(bookId);
        req.onsuccess = () => {
            const res = req.result || null;
            if (res) demoBooks[bookId] = res;
            resolve(res);
        };
        req.onerror = (e) => reject(e);
    });
}

export function getAllBooksFromDB() {
    if (!dbInstance) {
        return Promise.resolve(Object.values(demoBooks));
    }

    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["books"], "readonly");
        const store = tx.objectStore("books");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e);
    });
}

export function deleteBookFromDB(bookId) {
    delete demoBooks[bookId];
    if (!dbInstance) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["books", "notes"], "readwrite");
        tx.objectStore("books").delete(bookId);

        // Cascade delete associated notes
        const notesStore = tx.objectStore("notes");
        const index = notesStore.index("bookId");
        const req = index.getAllKeys(bookId);
        req.onsuccess = () => {
            const keys = req.result || [];
            keys.forEach(k => notesStore.delete(k));
        };

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
    });
}
