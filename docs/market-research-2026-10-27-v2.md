# AuraReader 市场调研

日期：2026-10-27。仅做公开资料检索：没有安装、登录或购买竞品。商店、GitHub 与价格数据的读取日期都是当天。凡标“未证实”的，都没有拿到一手证据。本报告不沿用此前报告的结论。

**修订说明：** 同日前几版有两类错误。一是把 Goal 拆成层级、归入、回跳等部件，逐项寻找竞品，并当作批注或材料组织系统来分析，甚至分析读者意图如何发展。二是随后矫枉过正，只剩一句理念，把产品本身丢掉了。本版以 AuraReader **整个产品**为调研对象，与其他完整产品比较。

## 0. 调研对象：AuraReader 是什么

依据项目 README、官网展示稿（`website/`）、设计文档和当前代码。

**定位：** 面向 PC 的本地 EPUB 阅读与笔记工作台，为“阅读的工作”而做（*for the work of reading, not just letting your eyes pass over the words*）。官网口号是“读有所思，思有所留”“A little less UI. A lot more reading.”。

**它要解决的问题（README “Why AuraReader?”）：**
- 读完就结束了，阅读没有留下自己的东西；
- 笔记离开了原文，没有显示在原文旁边；
- 导出时，书、高亮、笔记被强行拆开，也很难得到方便迁移、可以交给 AI 的 Markdown；
- 阅读器功能大而全，想要的功能藏在设置深处；
- 读者在阅读中被书籍支配，而不是阅读的主体。

**产品整体由这些部分构成，彼此一体，不是功能清单：**

| 部分 | 现状 |
| --- | --- |
| **Goal（最重要的模块）** | 设立目的是改变读者被书籍支配的状况，让读者成为阅读的主体。完全从读者主观出发、完全自由，可以不设。书库可以按读者的 Goal 进入，阅读时 Goal 在侧栏或独立页面里伴随。Goal 不是批注系统，也不是材料组织系统 |
| 阅读 | EPUB/TXT；单页、双页、连续滚动；双页每栏 560px；字体按书籍语言自动选择，内置更纱黑体、Literata，可用本机或导入字体；离线可用 |
| 沉浸式页边笔记 | 选中文字即可高亮或写笔记；笔记直接显示在对应原文外侧，跟随当前屏幕可见正文；不需要展开侧栏；正文与笔记共享背景，没有分界线和卡片边框 |
| 完整的阅读成果 | 按章节导出 Markdown，原文、`<mark>` 高亮和笔记（附原文引用、放在对应段落后）合在一起；多章导出为文件夹加目录概览；每本书可导出 `.aurabackup` 备份并恢复 |
| 简洁 | 统一的功能入口，原位展开，不翻设置 |
| 形态 | Windows x64 Electron 桌面应用（未签名候选版），也可作为本地 Node 服务在浏览器使用；SQLite 本地存储；无账号、无云、无 AI、无书店、无移动端 |

## 1. 这个项目有没有类似的产品？

按整体产品来看：**有很多阅读器，但没有找到与 AuraReader 整体同类的产品。** 阅读器、批注工具、笔记工具都有，但没有一个产品同时具备以下几点：读者作为阅读的主体（而不是围着书转）；想法就写在原文旁边；读完能把原文和自己的思考完整带走；界面足够克制。

现有相关产品按整体性质分为以下几类：

| 类别 | 代表 | 整体以什么为中心 | 与 AuraReader 的整体差异 |
| --- | --- | --- | --- |
| 书店型阅读平台 | Kindle、Apple Books、Google Play 图书、微信读书、Kobo | 书与卖书、订阅 | 读者是消费者；笔记在侧栏或笔记本里，附属于书；导出受 DRM 限制；平台在阅读周围加推荐、时长、目标、社交 |
| 本地/开源阅读器 | Calibre 查看器、Koodo、Readest、Thorium、KOReader、Moon+、ReadEra | 书文件与书库 | 用自己的书阅读，但一切仍围着单本书；笔记在侧边面板；没有页边笔记；导出以笔记清单为主 |
| 研究/学习工作台 | Zotero、Citavi、MarginNote、LiquidText | 文献、引用或学习方法 | 读者按产品的方法工作；以 PDF 和论文为主，或仅 Apple 平台，或不支持 EPUB |
| 高亮收集与复习 | Readwise / Reader | 高亮的收集与复习推送 | 云端订阅；阅读之后的复习，不是阅读本身 |
| AI 阅读与知识工具 | NotebookLM、Recall、Syntopica、Anx Reader | 模型对资料的理解 | 由 AI 解读、生成，读者不是主体 |
| 笔记工具 | Obsidian、Logseq、Heptabase | 笔记库 | 阅读不在中心；与 AuraReader 是上下游关系，Markdown 导出正好衔接 |
| 阅读意图类小产品 | Canto、Deepread | 单本书，或产品提出的问题和 AI 反思 | 意图附属于单本书，或成为读前、读后的仪式 |

另外，Goodreads、Apple Books 的 “reading goal” 指读书数量或时长，是平台给读者设的指标，只是名称相近。

## 2. 相关的竞争对手是谁？

竞争对手是读者现在拿来读书和做阅读笔记的整个产品。

**直接竞争：PC 上读自有 EPUB 的阅读器。** 这是 AuraReader 实际要接替的位置。

| 产品 | 整体特征 | 对 AuraReader 的威胁 |
| --- | --- | --- |
| **Calibre（查看器）** | 事实上的桌面电子书标准：书库管理、格式转换，附带查看器；近 60 天活跃安装约 297 万台；免费，GPL-3 | 用户基础最大；但阅读体验和笔记是附属功能：带笔记的高亮只显示一个小圆点，手册未说明笔记导出 |
| **Koodo Reader** | 全平台书库加阅读器，2.86 万星；自选网盘同步；导出 CSV/MD/HTML 等（README 声明，未实测）；免费，AGPL | 最直接的开源桌面对手，覆盖多设备 |
| **Readest** | 现代跨平台阅读器，2.57 万星，每月发版；笔记集中在 Notebook 面板；可按书导出 Markdown，按章分组并带回跳链接；免费，AGPL | 迭代最快；在导出体验上最接近 AuraReader |
| **Thorium Reader** | Electron 桌面，出版标准和无障碍导向；批注可打标签导出（未实测） | 机构用户为主，个人阅读体验不是重点 |

**间接竞争：读者的书在哪里，阅读就在哪里。** 书在 Kindle、微信读书、Apple Books 的读者，会留在这些平台上，因为书源和全设备同步是它们的护城河。

**相邻竞争：** 争夺读者在“阅读的工作”上的时间和预算，主要是 Readwise（$9.99/月起）、MarginNote（Max $51.99）、Zotero 和 Obsidian 组合。

## 3. 排名前三、用户最多的类似产品是什么？它们有什么特征？我们有什么特征？

### 3.1 规模（2026-10-27 读取）

| 产品 | 规模证据 | 说明 |
| --- | --- | --- |
| Google Play 图书 | Play 10 亿+ 下载，约 326 万条评价 | 大量来自 Android 预装 |
| Kindle App | Play 1 亿+ 下载、约 412 万条评价；iOS 美区约 588 万条评分 | 亚马逊不公布月活 |
| Apple Books | iOS 美区约 11.9 万条评分 | 系统预装；“月活 1 亿+”没有出处，未证实 |
| （中国）微信读书 | iOS 国区约 170 万条评分；百科称注册 3 亿+（二手） | 近期月活没有可靠来源 |
| （PC 本地参照）Calibre | 近 60 天活跃安装 2,972,398 台（官方） | 与 AuraReader 同场景 |

全球前三：**Google Play 图书、Kindle、Apple Books**。中国月活靠前的是番茄、七猫、掌阅等网文免费阅读，场景不同；出版书阅读的代表是**微信读书**。PC 本地 EPUB 场景里，用户最多的是 **Calibre**。

### 3.2 前三的特征

三者（以及微信读书）都是**书店加阅读器**，而且首先为手机和平板设计。

- **以书为中心：** 从选书、买书或借阅开始；书库就是买过的书；收藏夹和书单只装书。
- **阅读体验：** 排版成熟，全设备同步进度，有词典、翻译和朗读等辅助功能。
- **笔记：** 高亮和笔记按书存放，需要打开侧栏或笔记本查看，不在原文旁边。
- **导出受限：** Kindle 有出版社设定的导出比例上限，手机端导出为 PDF，桌面端导出为 HTML；Apple Books 没有官方批量导出；Play 图书每本书生成一份 Drive 文档；微信读书只能复制或生成图片卡片。都不能导出“原文加高亮加笔记”的完整章节。
- **平台目标：** 推荐、阅读时长、连续天数、年度目标、排行、社交。
- **收入：** 卖书加订阅，如 Kindle+（$11.99/月，2026-10-22 由 Kindle Unlimited 更名）、微信读书会员（连续包月 19 元，年卡 228 元）。
- **优势：** 海量正版书、全设备、零门槛。

### 3.3 我们的特征

| | 前三 | AuraReader |
| --- | --- | --- |
| 中心 | 书与书店 | 读者：Goal 让读者成为阅读的主体 |
| 设备 | 手机、平板优先 | PC：大屏可同时容纳双页正文和页边笔记，键盘鼠标操作 |
| 想法写在哪里 | 侧栏或笔记本，离开原文 | 页边，就在原文旁边，跟随当前页 |
| 读完得到什么 | 受限、拆散的笔记导出 | 按章 Markdown，原文、高亮和笔记合为一体，可放进 Obsidian 或交给 AI；整书备份可恢复 |
| 界面 | 功能多，周围有推荐和社交 | 克制，统一入口，没有平台目标 |
| 数据 | 云端账号 | 本地，无账号 |
| 书源 | 自带书店，覆盖全设备 | 只能读用户自有的无 DRM EPUB/TXT |
| 平台 | 全平台同步 | 仅 Windows 桌面，没有同步 |

## 4. 我们能做什么他们做不了的？

1. **让读者成为阅读的主体。** 前三的商业模式建立在书上：卖书、订阅、推荐下一本，产品必须以书为中心，并在阅读周围设定平台自己的目标。把中心交给读者，与它们的商业模式冲突。这是它们不会做的。
2. **把阅读成果完整交给读者。** 书店平台受版权和 DRM 约束，不能让读者导出整章原文连同自己的高亮和笔记。AuraReader 处理的是用户自有的文件，可以完整导出。这是它们结构上做不到的。
3. **为 PC 大屏设计阅读和思考的同一空间。** 前三以手机为先，PC 端（Kindle for PC、Apple Books for Mac）是移植版，笔记仍在侧栏。开源阅读器有桌面版，但没有页边笔记（MarginNote 的边注只在 Apple 平台）。这一点不是做不到，而是现有产品都没有这样设计；对开源产品来说，可以被追赶。
4. **安静、本地、无 AI 解读。** 没有推荐、排行和打卡，数据不上传。

## 5. 我们的卖点、用户愿意购买的点是什么？

### 5.1 卖点

- **你是阅读的主体，不是书。** 这是核心，由 Goal 承载。读者可以从自己出发进入书库、进入阅读，也可以什么都不设，只是读。
- **想法就在原文旁边。** 页边笔记跟随当前页，阅读和思考在同一个空间进行，不用打开侧栏。
- **读完，带得走。** 按章 Markdown 导出，原文、高亮、笔记不拆开，直接进入 Obsidian、VS Code 或 AI；每本书一个备份文件。
- **少一点界面，多一点阅读。** 舒适排版、离线字体，功能入口统一，不用翻设置。
- **数据在你的电脑上。** 本地、离线、无账号。

对外表达时，避免把 Goal 说成“目标管理”“读书计划”“带着问题读书”，以免被归入以方法为中心或以数量目标为中心的产品。

### 5.2 用户可能愿意付费的地方，以及现有证据（相邻行为，不是对本产品的验证）

| 可能的付费点 | 现有证据 |
| --- | --- |
| 一个真正好用的阅读器（买断） | Moon+ Reader Pro $11.99，ReadEra Premium $14.99 |
| 阅读与思考的工作流（高亮、笔记、整理） | Readwise Full $119.88/年；MarginNote 4 Max $51.99；LiquidText Pro 约 $80–90；BookxNote Pro 约 ¥66 |
| 把阅读成果带进知识库或交给 AI | Readwise 的主要付费理由之一就是把高亮同步到 Obsidian、Notion 等；Kindle、微信读书用户长期依赖第三方导出插件（社区方案，说明需求存在） |
| PC 本地阅读人群规模 | Calibre 近 60 天活跃安装约 297 万台（规模上限参照，不是付费人数） |

**直接证据缺失：** 本次没有找到读者为“成为阅读主体”这种整体体验付费的直接证据。需要用真实读者访谈、试用后留存或预售来验证。

### 5.3 限制与风险

- **书源：** 书在 Kindle、微信读书等有 DRM 平台的读者，无法把书带进来。可触达的用户只限于持有无 DRM EPUB 的读者。
- **覆盖面：** 只有 Windows 桌面，没有移动端和同步；而前三和 Koodo、Readest 都覆盖多设备。
- **整体价值难以一眼说明：** “读者成为主体”是整体体验；页边笔记和导出可以演示（官网已经这样做），Goal 的价值则需要使用后才能体会。
- **免费开源对手：** Calibre、Koodo、Readest 免费且迭代快，AuraReader 收费需要在整体体验上明显胜出。
- **发布状态：** 安装包未签名，没有公开下载渠道，没有经过纯净系统验收。

## 6. 有哪些开源项目？

GitHub API 实时数据，2026-10-27 读取。

| 项目 | Stars | 许可证 | 最近 release | 平台 | 整体定位 |
| --- | --- | --- | --- | --- | --- |
| KOReader | 30,641 | AGPL-3.0 | v2026.07.1 | 墨水屏、Android、Linux | 墨水屏设备上的文档阅读器；高亮可导出 md/json 等 |
| Koodo Reader | 28,636 | AGPL-3.0 | v2.4.6（10-07） | 全平台 | 书库加阅读器；自选网盘同步；多格式笔记导出（README 声明） |
| Calibre | 26,258 | GPL-3.0 | v9.17.0（10-23） | Win/Mac/Linux | 电子书库管理、转换，附带查看器 |
| Readest | 25,652 | AGPL-3.0 | v0.12.16（10-13） | 全平台 | 现代阅读器；Notebook 面板；按书 Markdown 导出带回跳链接 |
| Anx Reader | 9,081 | MIT | v1.14.0 | 移动端为主 | AI 辅助阅读器 |
| Foliate | 8,847 | GPL-3.0 | 3.3.0（2025-04） | 仅 Linux | GNOME 阅读器，更新放缓 |
| Thorium Reader | 2,915 | BSD-3 | v3.5.1 | Electron 桌面 | 出版标准与无障碍导向 |
| Alexandria | 2,721 | GPL-3.0 | v0.13.2（2025-12） | 桌面（Tauri） | 已停更约 10 个月 |
| Zotero | 15,760 | AGPL-3.0 | — | 桌面 | 文献管理，支持 EPUB 批注 |
| Logseq | 45,395 | AGPL-3.0 | 2.0.2 | 桌面、移动 | 笔记工具，不支持 EPUB |
| Omnivore | 16,384 | AGPL-3.0 | — | — | 稍后读；托管服务 2024-11 已关闭 |
| obsidian-annotator | 1,777 | AGPL-3.0 | 0.2.11（2024-01） | Obsidian 插件 | 事实上已停更 |
| foliate-js / epub.js | 1,145 / 6,969 | MIT / BSD-2 | — | 引擎 | 渲染引擎，可以合法复用 |
| Deepread | 16 | MIT | 无 | 本地 Web | 单书阅读意图原型；有用户反馈运行失败 |

- 从公开资料看，这些开源阅读器都以书或书库为中心，没有页边笔记，也没有“原文、高亮、笔记合为一体”的按章导出；Readest 的导出最接近。
- **许可证：** Readest、Koodo、KOReader、Zotero、Logseq 为 AGPL，Calibre、Foliate 为 GPL-3，只能参考思路。可以复用代码的是 foliate-js（MIT）、epub.js（BSD-2）、Thorium/Readium（BSD-3）、Anx Reader（MIT）。

## 7. 结论

AuraReader 是一个完整的 PC 本地阅读工作台：读者通过 Goal 成为阅读的主体，想法就写在原文旁边，读完能把原文和思考完整带走，界面克制。现有产品中，书店平台以书为中心，开源阅读器以书库为中心，研究和学习工具以方法为中心，AI 工具以模型为中心；本次没有找到整体同类的产品。

- **直接对手：** Calibre、Koodo、Readest 等 PC 阅读器。
- **大平台做不了的：** 以读者为中心，以及完整导出阅读成果。
- **最大约束：** 书源（DRM）和单设备。
- **最大不确定性：** 读者是否愿意为这种整体体验付费，需要用真实用户验证。

## 主要来源

- 规模与价格：[Kindle Play](https://play.google.com/store/apps/details?id=com.amazon.kindle)、[Kindle App Store](https://apps.apple.com/us/app/id302584613)、[Play 图书](https://play.google.com/store/apps/details?id=com.google.android.apps.books)、[微信读书 App Store](https://apps.apple.com/cn/app/id952059546)、[Calibre usage](https://calibre-ebook.com/dynamic/calibre-usage)、[Kindle+](https://www.aboutamazon.com/news/devices/what-is-kindle-plus)、[Readwise FAQ](https://docs.readwise.io/reader/docs/faqs)、[Moon+ Pro](https://play.google.com/store/apps/details?id=com.flyersoft.moonreaderp)、[ReadEra Premium](https://www.appbrain.com/app/readera-premium-ebook-reader/org.readera.premium)、[QuestMobile 2025 秋季](https://www.questmobile.com.cn/research/report/1985984354598359042/)
- 主流产品：[Kindle 收藏夹](https://www.amazon.com/gp/help/customer/display.html?nodeId=TEXEI39W4Jd6j9w4Fk)、[Kindle 导出](https://www.achriom.com/blog/how-to-export-your-kindle-highlights/)、[Apple Books 收藏集](https://support.apple.com/guide/books/create-custom-collections-ibkse71c34db/mac)、[Play 图书笔记](https://support.google.com/googleplay/answer/3165868)、[微信读书书单](https://zhuanlan.zhihu.com/p/609479065)、[微信读书笔记导出](https://zhuanlan.zhihu.com/p/2074230263899595825)
- 其他产品：[Zotero](https://www.zotero.org/support/pdf_reader)、[MarginNote 手册](https://manual.marginnote.com.cn/mn4/en/)、[Citavi](https://www1.citavi.com/sub/manual7/en/feature_overview.html)、[LiquidText](https://www.liquidtext.net/pricing-features)、[Readwise Themed Reviews](https://docs.readwise.io/readwise/guides/themed-reviews)、[Heptabase](https://wiki.heptabase.com/pdf-annotation)、[Recall](https://docs.recall.it/getting-started/4-organizing-content)、[NotebookLM EPUB](https://www.ghacks.net/2026/03/10/google-adds-epub-support-to-notebooklm-making-it-more-useful-for-students/)、[Canto](https://readcanto.com/)、[Deepread](https://github.com/AyingAI/deepread)
- 开源：[Readest](https://github.com/readest/readest)、[Readest 文档](https://readest.com/docs/reading)、[Koodo](https://github.com/koodo-reader/koodo-reader)、[KOReader 导出](https://github.com/koreader/koreader/wiki/Highlight-export)、[Calibre 查看器](https://manual.calibre-ebook.com/viewer.html)、[Calibre #2159668](https://bugs.launchpad.net/calibre/+bug/2159668)、[Thorium #3878](https://github.com/edrlab/thorium-reader/issues/3878)、[Omnivore 状态](https://github.com/omnivore-app/omnivore/blob/main/docs/SELF-HOST-UPDATE.md)
