# AuraReader 市场研究：竞争关系、规模证据与商业机会

研究日期：2026-10-28（Asia/Shanghai）。这是一份独立的新报告，不覆盖 2026-10-27 的历史报告。

**主要判断：有实质竞品，有可能成立的差异化，但目前没有证据支持“没有同类”“别的产品不能让读者自主阅读”或“已经确定用户会为此付费”。最值得检验的是：读者是否愿意把持续发展的意图、原文旁的表达、跨书往返放在同一个阅读环境里，并因此迁移和付费。**

## 研究范围与证据等级

- AuraReader：阅读当前 README、PRD 的定位与原则、阅读指南、定位校正文档、已知限制、数据备份文档；核查 Goal 类型与领域逻辑、跨书回归用例、导出实现。此次没有重新运行整套产品验收。
- 竞品：官方产品页、操作手册、价格页、商店开发者说明、GitHub 仓库元数据；BookxNote 因官网访问超时，部分仅有销售渠道和社区线索。
- 实际体验：在 Readest 公开网页版用自写的三段合成文字完成导入、打开、选文、写笔记、保存、查看全部批注与笔记本。其他主要竞品未安装、登录或购买，不把文档描述写成实测。
- **事实**表示本次有可追溯来源；**判断**表示从事实推导的竞争关系；**假设**表示需要真实用户行为验证；**未证实**不等于不存在。
- 规模数据不混用：活跃用户、活跃安装、累计下载、评分数量、GitHub Stars 分别记录。网页抓取与厂商宣传可能落后于实际版本，价格以交易时地区、渠道为准。

## 1. 先理解 AuraReader 的完整产品

### 1.1 理念、定位和实际机制

AuraReader 是“以阅读者为主体的阅读工作台”：读者自己决定从哪里开始、什么值得关注、哪些内容有关、目的是否继续。意图不必是研究问题、任务、学习指标或产出计划，也不必先说清楚。没有 Goal 时，阅读、页边表达依然成立。

这种主体性通过整个产品体现：Goal 可在书籍之前或阅读过程中建立，文字可改写、可展开子 Goal，也可完成、归档、删除；书籍和批注的联系由读者主动建立。页边笔记让自己的声音与正在阅读的正文共同出现。跨书材料又让读者能沿着自己的关注返回原文，而不是只能沿单本书的目录走。

来源：[README](../README.md)、[PRD](prd_v0_5.md)、[定位校正](goal-positioning-correction-2026-10-27.md)、[阅读指南](reading-guide.md)。

### 1.2 一个完整工作流，以及同样有效的另一条路

| 环节 | AuraReader 当前行为 | 对读者的意义 |
| --- | --- | --- |
| 开始 | 建立独立 Goal，或者直接导入 EPUB/TXT 开始读 | 不强迫先声明用途 |
| 组织阅读 | 主动关联书籍；同书可服务多个 Goal | 书不决定阅读的边界 |
| 当下阅读 | 单页、双页或滚动；高亮；原文旁直接输入和编辑笔记 | 读与表达连贯 |
| 建立联系 | 手动把来自不同书的高亮、笔记关联到当前 Goal | 关系由读者认定，不由模型或分类器指定 |
| 往返与发展 | 从材料回原文；改写意图、展开子 Goal、放下或终止 | 发现可以改变出发点 |
| 保留与继续 | 按章节导出正文、高亮、笔记；逐书备份；数据库完整备份 | 在其他工具继续阅读和使用材料 |

“直接读—偶尔批注—从不建 Goal”也是完整有效的用法，不是入门失败。以上只是描述机制，不规定目的应当怎样变化。

代码核查：[Goal 数据模型](../src/client/domain/goal.ts)、[Goal 逻辑](../src/client/domain/goalEngine.ts)、[跨书用例](../tests/regression/test_goal_cross_book.js)、[导出实现](../src/client/infrastructure/exporters.js)。用例内容支持设计已落实到代码，但本次没有重跑它们。

### 1.3 当前可售能力和交付边界

当前是 Windows x64 Electron 候选版及本地服务/浏览器模式，支持 EPUB/TXT；没有实际 PDF 正文解析、云同步或移动端产品。安装包未签名、未公开发布，最新 Goal 生命周期源码未重新打包验收。网页端仍有 CDN 依赖；桌面离线能力有历史验收，不能笼统写成所有模式完全离线。

本地 SQLite 保存书籍与关系；Markdown 导出目前按书/章组织，不是独立的跨书 Goal 通用导出。每书备份不覆盖完全无书籍关联的独立 Goal，也不包含全局设置、字体和原始 EPUB；完整 Goal 图需要数据库一致性备份。重新加载后不自动恢复上次书籍和位置仍列为限制。

这些是会影响购买与迁移的实际边界，不否定理念。依据：[已知限制](known-limitations.md)、[数据与备份](data-and-backup.md)。旧 status.md 含已被替代的布局、存储和导出描述，因此未作为当前交付依据。

## 2. 有没有类似产品？谁在实质竞争？

**有。竞争关系应以用户能否用它完成一段相近的阅读生活来判断，而不是要求对方宣称同一理念、使用 Goal 这个名称，或每项实现都相同。**

### 2.1 阅读与思考工作台：需要正面比较

| 产品 | 完整工作流与用户价值 | 与 AuraReader 的实质关系 | 差异及证据边界 |
| --- | --- | --- | --- |
| **MarginNote 4** | 自建 Study Set → 加入多份文档 → 阅读摘录 → 在脑图中编辑、组织、关联 → 回原文；可进一步复习 | 能承载读者自己命名和组织的跨文档方向，是强功能替代；尤其当用户已有 Apple 设备 | 官方叙事更偏学习与知识结构，平台是 Apple 系列。不能据此认定用户被强迫复习。支持 EPUB；Extend Note 有页边模式，不能说它没有原文旁笔记 |
| **LiquidText** | 多文档项目 → 在文档旁的自由工作区写想法和拖出摘录 → 建立跨页/跨文档联系 → 回源 → 导出/协作 | 对“边读边形成自己的联系”有很强替代性；Windows 版使其与 AuraReader 直接争夺桌面使用时间 | 官方格式列 PDF、Word、PowerPoint，未列原生 EPUB；工作空间方式更自由、更适合空间组织，AuraReader 更贴合流式电子书正文。优劣取决于个人习惯 |
| **Readwise Reader + Highlights** | 收集多种来源 → 阅读、批注 → 文档标签和过滤视图 → 按批注标签聚合跨文档摘录 → 同步知识库/复习 | 是完整阅读系统，不能只列为“读后复习工具”；可用标签承载个人关注 | 核心组织机制是文档数据库、过滤视图、标签。未证实其有与 AuraReader 同构的独立层级意图对象；但这不阻止用户用它自主阅读 |
| **Zotero** | 收集来源 → 分类/标签 → 阅读标注 → 把多份来源的批注放入同一独立笔记 → 回源 → 写作引用 | 免费且强的整套替代方案；配合笔记工具威胁更大 | Zotero 7 已支持 EPUB，不能再排除为“只支持 PDF”。学术引用是优势和默认导向，并非对阅读用途的强制规定 |
| **BookxNote** | 已确认 PDF/EPUB 阅读与知识整理定位；社区材料描述笔记本内多本书、摘录/笔记与脑图联动 | 应列入中国 Windows 场景的高优先级待实测竞品，不能因为是学习工具而漏掉 | 本次官网超时。渠道页足以支持格式和定位；跨书细节只有社区线索，未据此作确定性优劣结论 |

来源：[MarginNote Study Set 手册](https://manual.marginnote.com.cn/mn4/en/creating-study-set-start-theme-based/)、[MarginNote 页边扩展笔记](https://manual.marginnote.com.cn/mn4/en/extend-note-basic-operations-freely-open/)、[MarginNote 导入格式](https://manual.marginnote.com.cn/mn4/en/importing-documents-document-management/)、[LiquidText 功能](https://www.liquidtext.net/features)、[LiquidText 平台与套餐](https://www.liquidtext.net/pricing-features)、[Reader 标签与笔记](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes)、[Reader 过滤视图](https://docs.readwise.io/reader/docs/faqs/filtered-views)、[Zotero 笔记与回源](https://www.zotero.org/support/pdf_reader)、[Zotero 7](https://www.zotero.org/blog/zotero-7/)、[BookxNote 销售渠道介绍](https://bookxnote.apsgo.cn/zh-cn)、[BookxNote 社区概念资料，非官方](https://b3logfile.com/pdf/article/1649167359260.pdf)。

### 2.2 本地阅读器：同一文件入口的竞争

**Readest、Koodo Reader、Calibre、Thorium、KOReader、Foliate** 并不一定直接替代全部 Goal 工作流，但它们已经满足大量用户“用自己的文件舒服地读、划线、保留笔记”的需求。用户也可能用这些阅读器加一个文本文件、Obsidian 页面或纸本笔记，完成自己的意图组织。

- **Readest**：跨平台阅读、标注、导出和同步；还提供 Parallel Read，官方文档支持页面书写、笔画随重排文字定位。不能再用“开源阅读器都没有页边表达”作卖点。它的公开导出规范主要组织批注，AuraReader 的整章正文与批注合并导出是更具体的不同。[阅读手册](https://readest.com/docs/reading)、[Parallel Read](https://readest.com/docs/parallel-read)。
- **Koodo Reader**：多格式、跨平台书库与同步/备份，能降低多设备和迁移成本；这可能比 Goal 更影响部分人的选择。未实测其跨书笔记使用体验。[项目](https://github.com/koodo-reader/koodo-reader)。
- **Calibre**：管理、转换、阅读自有电子书的一整套桌面工具；查看器支持高亮、附注和阅读定制。不能仅因界面传统就认定其阅读能力不重要。[查看器手册](https://manual.calibre-ebook.com/viewer.html)。
- **Thorium** 的标准与无障碍定位、**KOReader** 的墨水屏使用环境，是各自不同的竞争优势；与 AuraReader 的 PC 工作台有部分场景交集。[Thorium](https://github.com/edrlab/thorium-reader)、[KOReader](https://github.com/koreader/koreader)。

### 2.3 组合替代、内容入口和新竞争

| 类型 | 候选 | 为什么必须保留 |
| --- | --- | --- |
| 自己搭建阅读与思考方式 | Obsidian + 阅读器/Zotero；Heptabase；Citavi | Obsidian 可以先写独立想法，再关联材料和调整关系；不是只有下游导出关系。Citavi 可自主建立和修改分类层级，连接引文、想法；Heptabase 可把 PDF 批注和自己的卡片放在白板 |
| 已有书籍与习惯所在的平台 | Kindle、Apple Books、Google Play Books、微信读书 | 它们掌握用户的内容、跨设备状态、笔记积累和使用习惯；即使不提供相同的意图工作流，也影响用户会不会转移 |
| AI 跨来源理解 | NotebookLM / Google 当前帮助页中的 Gemini Notebook、Heptabase AI、Anx Reader | 当读者想快速比较材料或获取回答时，它们可能替代某段工作，也可能成为导出后的互补工具。不能把“有 AI”推导成“读者没有主体性” |
| 阅读伴侣和理解训练 | Syntopica、Canto 等 | 可能竞争预算与心智。Syntopica 页面强调理解测试、概念连接与阅读记录，仍展示候补名单；不能把路线图当成熟装机产品。Canto 本次主页未成功获取，保留线索不升级为直接竞品 |
| 非软件替代 | 纸书页边批注 + 活页笔记；电子书 + 普通文档 | 能低成本承载开放意图与跨书思考。不是“没有买某个竞品”就没有既有解法 |

来源：[Obsidian Canvas](https://help.obsidian.md/Plugins/Canvas)、[Heptabase 1.0 的阅读批注工作流](https://wiki.heptabase.com/version-one)、[Heptabase 当前 EPUB 边界](https://support.heptabase.com/en/articles/16762580-how-do-i-use-a-whole-book-or-long-pdf-with-heptabase-ai)、[Citavi 7 入门](https://www1.citavi.com/sub/docs/en/Citavi_7_Getting_Started.pdf)、[Google 来源支持](https://support.google.com/gemininotebook/answer/16215270?hl=en-CU)、[Syntopica](https://syntopica.app/)、[微信读书开发者介绍](https://apps.apple.com/cn/app/id952059546)。

**研究优先级判断：**整体工作流先比较 MarginNote、LiquidText、Readwise Reader；中国 Windows 获客额外优先验证 BookxNote；迁移门槛与免费替代必须对照 Readest、Zotero。这个顺序不是用户数量排名。

## 3. “用户最多的前三”能回答到什么程度？

### 3.1 当前不能可靠排出直接竞品的活跃用户前三

未获得 MarginNote、BookxNote、Readest、Reader、Zotero 在同一时期、同一地域、同一口径下的活跃用户数据。**不能将明星产品列表写成规模榜，也不能用 Stars 替代用户数量。**

已核实的规模证据如下：

| 产品 | 本次拿到的数字 | 口径与时间 | 可以得出的结论 |
| --- | --- | --- | --- |
| Google Play Books | 10 亿+ | Google Play 累计下载档位，本次检索页面 | 大规模分发；不等于 10 亿读者或月活 |
| Kindle Android | 1 亿+ | 同上 | 大规模分发；不含全部 Kindle 设备与其他平台，也不是当前活跃数 |
| Apple Books | 超过 9000 万月活 | Apple 2021-01-06 公告、描述 2020 年表现 | 有历史大规模使用证据；不能当作 2026 年数字 |
| ReadEra | 5000 万+ | Google Play 累计下载档位 | 本地文件阅读有广泛市场；不直接说明 Windows 需求 |
| Calibre | 2,973,377 活跃安装 | 官方动态页：过去 60 天至少启动一次，本次读取 | 桌面电子书工具存在大量实际使用；官方明确安装不等于用户 |
| LiquidText | 600 万累计下载；20,000+ 每月法律用户 | 厂商 Company 页面，本次读取，未给统计截止日 | 阅读/思考工具已获得实际采用；法律用户是子群，不能当全产品月活 |
| Readwise | 招聘页称数万用户 | 未标统计期、未区分 Reader 与其他产品 | 商业采用的弱规模信号，不据此排名 |

来源：[Play Books](https://play.google.com/store/apps/details?id=com.google.android.apps.books)、[Kindle](https://play.google.com/store/apps/details?id=com.amazon.kindle)、[Apple 历史公告](https://www.apple.com/newsroom/2021/01/apple-services-entertain-inform-and-connect-the-world-in-unprecedented-year/)、[ReadEra](https://play.google.com/store/apps/details?id=org.readera)、[Calibre 官方统计](https://calibre-ebook.com/dynamic/calibre-usage)、[LiquidText 公司页](https://law.liquidtext.net/company/)、[Readwise 招聘页](https://readwise.io/careers/senior-staff-engineer)。

### 3.2 如果需要三个大众规模参照

选 **Google Play Books、Kindle、Apple Books**，称为“有大规模证据的三个大众参照”，而不是“2026 年用户最多前三名”。

| 参照 | 完整体验的优势 | 与 AuraReader 的比较 |
| --- | --- | --- |
| Google Play Books | 购买内容、上传 EPUB/PDF、跨设备阅读、自定义书架、笔记同步 Drive | 对书源与连续使用更完整；本次没有证据显示独立意图树及跨书材料共同组织达到 AuraReader 的同一形式 |
| Kindle | 内容生态、阅读辅助、批注与设备间连续阅读 | 对已经拥有 Kindle 内容与设备的用户，迁移成本高；AuraReader 优势需来自自己的阅读组织方式，而非宣称所有 Kindle 用户都缺乏自主性 |
| Apple Books | Apple 设备间连续阅读、收藏集、书内批注与回跳 | 自定义收藏集本身允许个人组织；已证实的批注查看流程按书展开。AuraReader 的 Goal 将意图、书籍与跨书材料进一步联系起来 |

来源：[Play Books 开发者说明](https://play.google.com/store/apps/details?id=com.google.android.apps.books)、[Kindle 开发者说明](https://play.google.com/store/apps/details?id=com.amazon.kindle)、[Apple 批注](https://support.apple.com/en-euro/guide/books/ibks3975f128/mac)、[Apple 收藏集](https://support.apple.com/guide/books/create-custom-collections-ibkse71c34db/mac)、[Apple 同步](https://support.apple.com/en-gb/guide/books/-ibks86dab303/mac)。

中国市场应另外比较微信读书的内容、笔记与阅读习惯，但本次未找到能用于同口径排行的近期月活。网文平台的规模也不能直接转成 AuraReader 的可服务市场。

## 4. 我们能做什么他们做不了的？

**尚未发现被证实、所有竞品都无法实现的独占能力。** 更有用的区分是：对方当前明确没有的交付范围、对方能以其他方式完成的价值，以及 AuraReader 值得强化的整体设计。

| AuraReader 特点 | 相对于谁成立 | 证据支持的表述 | 不应说成 |
| --- | --- | --- | --- |
| 意图可以独立存在、改写、分支、归档/删除，书与材料主动关联，且整体可选 | 主要相对于按书管理的常规阅读器 | 当前产品把这种自由意图作为原生组织对象，贯穿书库和阅读 | “别的工具不能让人自主思考” |
| 流式正文旁直接编辑自己的文字，随可见正文出现 | 对照本次 Readest 的选文编辑/保存与列表流程 | 交互节奏、空间和连续性存在具体不同 | “页边笔记是独有发明”；MarginNote 与 Readest 已有其他页边表达能力 |
| Windows 下直接读取 EPUB/TXT 并结合跨书意图 | 相对 MarginNote 的 Apple 平台、LiquidText 官方列出的文件格式 | 在明确设备与输入组合中有现实价值 | “Windows 没有阅读思考软件”；BookxNote、Zotero 都应比较 |
| 整章正文、高亮和笔记合并到 Markdown | 相对默认批注导出工作流 | 提供有上下文、可外部编辑的阅读材料 | “别人绝对无法导出”；转换器、模板或组合工具可能完成 |
| 本地存储、无需云端 AI 服务 | 相对以账号云服务为中心的产品 | 核心工作流不依赖模型代写；适合重视本地掌控的读者 | “离线、本地、无 AI 就是独有优势” |

这里的商业价值并不只是“少几次点击”：它涉及谁决定阅读关系、读者是否能保持自己的方向并允许方向改变。但自由笔记、脑图、白板和标签同样可能承载这种自主性。要证明优势，需要观察**同一个人完成同一段真实阅读时，是否更愿意继续在 AuraReader 中生活**。

当前 Markdown 导出与 Goal 全图之间的断层值得注意。如果用户最在意的是自己形成的跨书关系，只能导出逐书正文和笔记，未必满足其最重要的长期保存需求。这是潜在机会，不是现成功能。

不要把版权推论当技术护城河：AuraReader 能处理用户可导入的文件，不代表任何来源内容都能自由再发布；书店商业模式也并不逻辑上阻止其改进个人阅读组织。

## 5. 卖点是什么，用户可能为什么购买？

### 5.1 建议对外表达

**“从你的关注出发，让不同书里的内容进入自己的思考；想法留在原文旁，目的也可以随阅读改变。”**

支持它的三段具体演示：

1. 没有书时也能留下一个尚未定形的意图；或直接读，不建立 Goal。
2. 在两本书里分别写下自己的话，主动把有关的材料联系起来，随时回原文；之后改写或放下原来的目的。
3. 导出一章，展示正文、高亮和自己的批注一起进入普通 Markdown 编辑器。

“目的可变化”不应被演成产品鼓励某种必然的成长轨迹，也不以完成 Goal、读完数量或输出文章证明阅读有价值。

### 5.2 从卖点到付费：需要不同强度的证据

| 可能购买的价值 | 谁可能在意（行为假设，不限定产品受众） | 当前证据 | 关键反证 |
| --- | --- | --- | --- |
| 保持自己的阅读线索，几天后能继续 | 经常同时读不同书、跨书关注自然发生的人 | 相邻工作台已有跨文档关系和付费产品 | 用户可能觉得一篇普通笔记足够，不愿维护 Goal |
| 不打断阅读的页边表达 | 在 PC 上读长文、经常写自己的回应的人 | 可具体演示，并与本次 Readest 交互区分 | 屏幕拥挤、长笔记排版、中文输入不稳定，会让优势反转 |
| 可迁移、带上下文的材料 | 已经使用 Markdown 编辑器、希望长期保存的人 | Readwise 等收费产品把导出和集成列为服务内容 | 全章输出可能过长；用户可能只想要短摘录与稳定回链 |
| 安心的本地产品和可靠交付 | 想控制数据、减少账号依赖的人 | 存在大量本地阅读工具采用；买断产品在市场销售 | 免费开源替代很多；本地备份麻烦也会使人选云服务 |
| 简洁而完整的一体体验 | 不想维护插件组合，但需要读和思考联系的人 | 相邻产品类别已成立 | 理念认同并不等于愿意迁移或购买 |

商业形式的真实参照：

- Readwise 官网本次列 Reader 单独版按年计费折合 **$7.99/月**；Full Readwise **$9.99/月**，按年计费。它显示持续阅读服务具有收费空间，不能证明 AuraReader 能按同价销售。[价格页](https://readwise.io/pricing)
- MarginNote 官网列 Max 年订阅 **$16.99/年**，Max 买断 **$51.99**；平台、地区及 AI 额度条件不同。说明成熟阅读思考工具并不都采用昂贵月订阅。[价格页](https://www.marginnote.com/en/pricing/index.html)
- LiquidText 列免费、单平台买断及云订阅，网页金额未正常呈现，本次不补猜旧价格。跨文档和跨文档连线列在付费 Pro 功能内，但没有拿到各功能促成购买的因果数据。[套餐页](https://www.liquidtext.net/pricing-features)

**对 AuraReader 的判断：**现阶段“稳定桌面版 + 清楚的买断/升级边界”值得先验证，因为现有产品主要价值在本机；没有持续服务时，高额订阅的理由较弱。这只是商业假设，不是建议立即确定收费方式，更不是要求改变开源许可。

可以把 ¥99/¥199 或 $19/$39 作为早期价格实验档位，明确这些数字是测试设计，不是研究发现的支付意愿或市场最优价。应在相同功能、相同使用条件下比较实际选择，而非仅问“你愿意付多少”。

### 5.3 最值得保留的市场机会

**机会 A：中文 Windows 上，围绕自主阅读的一体化体验。**不是 Windows 无竞品，而是验证现有学习工作台是否对一部分读者过重、常规阅读器是否对他们过于按书分散。BookxNote、Readest、Zotero 是必须现场比较的对手。

**机会 B：作为读者自己声音的长期保存入口。**全文与批注在一起是起点；意图、跨书关联、来源定位也应能可靠保留。当前完整关系的通用导出尚不是卖点，可以成为发展方向。

**机会 C：成为现有知识库的阅读入口。**与 Obsidian/其他编辑器互补，降低迁移门槛；同时接受它们也能替代部分核心价值。第一步可以是稳定导出和来源定位，不必立刻做插件生态。

**机会 D：支持读者亲自阅读，与外部 AI 按需衔接。**AuraReader 无需自建 AI 才有市场；也不必把“不使用 AI”变成对用户的要求。用户自行把导出内容交给外部工具，是不同阶段的选择。

最大的阻力可能不是“竞争者先做出 Goal”，而是用户的内容拿不到、主阅读设备不是 PC、已有笔记迁不进来、安装不可信或退出后位置不恢复。商业化验证要同时记录这些摩擦。

## 6. 开源项目有哪些？

2026-10-28 通过 GitHub 连接器读取仓库元数据。原始整理：[仓库证据 JSON](market-research-2026-10-28-repositories.json)。Stars 只反映 GitHub 关注，不代表用户量；以下顺序按研究用途排列。

| 项目 | Stars | API 许可证标记 | 可研究的价值 |
| --- | ---: | --- | --- |
| [Readest](https://github.com/readest/readest) | 25,695 | AGPL-3.0 | 当前最值得比较的跨平台阅读、批注、导出与平行阅读 |
| [Koodo Reader](https://github.com/koodo-reader/koodo-reader) | 28,650 | AGPL-3.0 | 多格式书库、同步与备份工作流 |
| [Calibre](https://github.com/kovidgoyal/calibre) | 26,267 | GPL-3.0 | 桌面书库、转换和阅读基础能力 |
| [Zotero](https://github.com/zotero/zotero) | 15,777 | NOASSERTION | 阅读批注与独立跨来源笔记；API 未归类许可，使用源码前读具体文件 |
| [KOReader](https://github.com/koreader/koreader) | 30,677 | AGPL-3.0 | 墨水屏、离线阅读、批注导出 |
| [Thorium Reader](https://github.com/edrlab/thorium-reader) | 2,918 | BSD-3-Clause | 阅读标准、无障碍与桌面实现 |
| [Foliate](https://github.com/johnfactotum/foliate) | 8,850 | GPL-3.0 | Linux 电子书体验；最近推送较早，不据此断言停更 |
| [Anx Reader](https://github.com/Anxcye/anx-reader) | 9,089 | MIT | 阅读与可选 AI 能力的结合，作为不同产品路线参照 |
| [foliate-js](https://github.com/johnfactotum/foliate-js) | 1,147 | MIT | 浏览器电子书渲染组件，不是完整竞品 |
| [epub.js](https://github.com/futurepress/epub.js) | 6,969 | NOASSERTION | EPUB 浏览器渲染组件；API 未归类，不能据此说没有许可 |

十个仓库本次均未标记 archived。最近推送时间保存在 JSON，不能据此保证版本稳定或持续维护。Obsidian、MarginNote、LiquidText 不应混入开源项目清单。对 GPL/AGPL 项目，也不能像旧报告那样笼统写“只能参考思路、不能复用”；具体复用需要依照实际许可和分发方式判断，本报告不作代码合规审计。

## 7. 已完成体验与保留的验证事项

### 7.1 Readest 有限体验记录

环境：2026-10-28，公开网页版 https://web.readest.com ，界面为中文，未登录购买；仅使用合成文本，不使用个人书籍内容。

1. 通过“导入书籍 → 从粘贴的文本”新建 Market research sample。
2. 打开后可见正文、目录/笔记/书签侧栏，以及笔记本入口。
3. 选中第一段的一部分，弹层提供复制、划线、笔记、搜索、词典、翻译等。
4. 点“笔记”，输入合成评论，点击“保存”。
5. “全部笔记”显示 1 条注释，截图可见笔记文本、摘录与正文高亮；另有书级笔记本编辑区域。

这验证了该版本的实际批注路径。没有完成长书重排、跨书组织、批量导出、同步和断网验证，不能从这次短体验推断那些能力缺失。官方说明中部分界面叫法与实测布局有差异，报告以实际观察描述本次体验。

### 7.2 可以直接用于后续对比的同一任务

不要求用户创造人工目标；使用他们原本正在读的两本书和已有关注。若没有关注，允许不建 Goal。

| 对比动作 | 要观察什么 | 当前状态 |
| --- | --- | --- |
| 留下一个尚无材料的想法/意图 | 系统是否允许独立存在，之后如何与阅读连接 | AuraReader 源码/文档确认；MarginNote/Obsidian 已有部分机制证据 |
| 从两本书写下回应并联系起来 | 是否需要重复抄写；关系由谁建立；读者是否觉得自然 | 主要竞品文档确认可做部分或全部；未完成同场实测 |
| 改写、展开或放下原方向 | 是否保留原始材料；是否能继续读而不被未完成状态束缚 | AuraReader 实现有依据；竞品详细生命周期待体验 |
| 隔三天继续阅读 | 能否找回自己的关注、材料及原文位置 | 必须用户实测；也是 AuraReader 已知恢复限制的风险 |
| 导出并离开产品 | 正文、表达、意图和关联分别剩下什么 | AuraReader 边界已核查；竞品实导文件待核查 |
| 完全不使用组织功能 | 是否仍愿意把它作为日常阅读器 | 不预设正确用法，观察真实选择 |

### 7.3 商业验证建议

招募 12–15 位已有相关行为的人，覆盖常规阅读器使用者、阅读思考工作台使用者、自己组合工具的人；按行为抽样而非把产品限定为研究者或学生。

让他们使用自己的材料 7–14 天。记录是否自发回来、是否在另一书中继续同一关注、是否改变或停止某个意图、是否愿意用 AuraReader 替代原工具、最后是否实际选择购买。**这些是研究观察，不是产品内要强加的阅读 KPI。**

分别询问：哪一步让他们更能按照自己的方式读；哪一步反而迫使他们管理工具；如果去掉 Goal、页边笔记或导出，购买选择是否改变。保留无 Goal 用户，他们可能验证阅读体验本身的价值。

预先写下接受/否定假设的标准，避免把任何正面反馈解释为市场成立。比如，若多数人称赞理念却回原阅读器，需查明是书源、设备、可靠性问题，还是整体价值不足；不能直接加功能或重写理念。

## 8. 本轮修正的旧结论

- 从“没有整体同类”改为“有强替代，完全同构未证实；同构不是竞争的必要条件”。
- 从“Readwise 只是复习”改为“Reader 是阅读产品，Highlights 是关联服务”。
- 从“Zotero 只偏 PDF，可忽略”改为“EPUB 与跨来源笔记使它具备实质替代性”。
- 从“其他工具不能给读者主体性”改为“需要比较用户控制权的具体机制与整个工作流”。
- 从“页边表达独有”改为“MarginNote 和 Readest 等已有不同形式，需要比较交互质量”。
- 从“Google/Kindle/Apple 是确定前三”改为“大众规模参照；当前直接竞品用户前三仍未知”。
- 从“整套成果完整带走”改为“按章正文与批注可带走；独立 Goal 与跨书关系的通用迁移有边界”。
- 不用理念差异、AI 功能、默认学习导向替竞品用户判定他们是否拥有自主性。

**保留的判断：AuraReader 有值得检验的完整产品主张。最有价值的商业证据将是读者在自己的真实材料上，更愿意以这种方式继续阅读，并愿意为可靠的实现付费；本轮公开研究尚不能替代这个验证。**

