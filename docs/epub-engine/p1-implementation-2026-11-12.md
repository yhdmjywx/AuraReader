# EPUB P1 实施与浏览器验证记录

日期为 2026 年 11 月 12 日，分支为 `codex/epub-engine`。本轮承接原审计与技术选型中的四项 P1，实施依赖顺序、实现范围及证据记录如下。两份原始报告继续保留原文。

同日用户确认字体行为。Auto 继续按语言选择应用字体，原书字体接入现有 Book font 按钮。以下实现范围已同步更新，按钮接通和追加验收见第 3 节。

用户指定本轮功能测试使用 ChatGPT 内置浏览器。本轮运行生产构建和编译期类型检查，功能验收使用独立本地测试书库与合成 EPUB，通过应用的文件选择器、阅读设置、目录、笔记、Goal、导出和恢复入口完成。桌面源码适配的运行结果及安装产物仍属尚未验证。

## 1. 实施顺序与交付范围

| 顺序 | P1 内容 | 本轮实现 | 主要源码依据 |
|---|---|---|---|
| 1 | 包模型与解析语义 | 保存包及 Manifest／Spine 原属性、Metadata、rendition、encryption。解析主标题、UTF-16、NAV heading、NCX、fallback 链与首次 URL 定位，保留非线性条目 | `src/client/infrastructure/epubXml.ts` 的 `decodeEpubText`、`packageModel`、`publicationTitle`、`spineResource`、`documentModel`、`navigation`，`epubArchive.ts` 的 `readEpubArchive` |
| 2 | 原书样式与字体 | 独立文档恢复 HTML／BODY 属性、语言／方向、样式顺序、外部 CSS、嵌套 import、字体及资源 URL。加入 Readium CSS 适配，保留 Auto 与用户明确选择的字体、字号、纸色、缩进控制 | `features/reader/publicationDocument.ts` 的 `preparePublicationDocument`、`refreshReadiumStyles`，`readiumStyles.ts`，`fontController.js`，`src/shared/epubPaths.mjs` 的 `rewriteEpubCss`，`src/server/publicationWorker.cjs` 的 `deobfuscate` |
| 3 | Fixed Layout 与方向轴 | 独立固定页渲染与视口缩放，包级／itemref 级布局覆盖，XHTML／SVG 固定页，混合版式切换。横排 RTL 与竖排使用逻辑偏移，区分文本方向与 Spine 页进方向，顺序阅读跳过非线性条目 | `publicationDocument.ts` 的 `layoutFixedDocument`，`readingAxis.js`，`chapterColumnView.js`，`ReaderController.layoutAndPlace`、`stepChapter`，`src/client/app/appShell.ts` 的方向键处理 |
| 4 | Worker、资源与读取成本 | 导入 Worker 执行 ZIP／XML／文本解码。独立 Node Worker 解压资源、反混淆字体和重写 CSS。合并同版本加载及同资源请求，限制保留缓存与活动 RPC。书库、Goal 标题及版本检查读取摘要，打开书籍读取单条完整记录 | `epubImport.ts`、`epubImport.worker.ts`、`epubArchive.ts`，`src/server/publicationWorkerClient.js`、`publicationWorker.cjs`、`publicationResources.js`，`dataStore.js` 的 `book`、`bookSummaries`，`storageClient.ts` 的 `readBook`、`readBookSummaries` |

元数据与 fallback 处理参照 EPUB 3.3 的 Package Document 和资源要求。主标题使用 `title-type=main` 与 `display-seq`。字体反混淆使用 unique-identifier 对应的标识。保留未知元数据和属性，为后续草案扩展提供数据基础。EPUB 3.4 当前为草案，后续变更需继续核对。[EPUB 3.3](https://www.w3.org/TR/epub-33/)、[EPUB Reading Systems 3.3](https://www.w3.org/TR/epub-rs-33/)、[EPUB 3.4](https://www.w3.org/TR/epub-34/)

## 2. 原业务兼容与实现取舍

- 继续使用既有 Book、章节 `page`／`chapter-N` 和文本偏移模型。屏幕列数与源文档页号分别计算，分页、字体和固定页缩放均通过源文档坐标连接标注与 Goal。DOM、Range 及布局计算保留在阅读器边界内。
- `epubCompatibility.ts` 的 `retainEpubLocations` 使用逐章文本的确定映射保存旧页号与标注位置。`upgradeEpubBook` 自动补齐已有原始 ZIP 的 P0 记录。映射存在歧义时保留旧记录。缺少原始 ZIP 的旧书继续使用已有正文投影。
- 出版物 BODY 成为正文根节点，支持 `body > p` 等作者选择器。应用默认 CSS 放入 `aura` 层，作者正文使用该层的回退规则，Readium CSS 使用独立层。阅读器仍控制分页容器的尺寸和滚动。用户明确选择的阅读样式沿用原入口。
- 字体模式使用既有菜单。Auto 按出版物语言选择应用字体，沿用中文更纱、英文 Literata 和其他语言系统回退。Book font 接通原有禁用按钮，使用独立的 `original` 偏好值，恢复出版物 CSS 与 BODY 行内字体。内置、系统和导入字体继续明确覆盖正文。字体模式也适用于固定页，固定页的作者字号和视口缩放保持各自的布局处理。
- Readium CSS 使用 LTR、RTL、CJK 横排与竖排的 before／default／after 原始样式，并在适配层内移除 vendor `!important`，交由现有阅读器管理分页。该集成经过本轮样书验证，全部出版物 CSS 的组合行为仍需扩充样书。
- 固定版式沿用现有 Page 交互，每次显示一个 Spine 文档的固定视口。保留 `spread`、`orientation` 和 `page-spread-*` 数据，支持页面左右对齐。合成双页跨页显示和设备方向锁定仍属尚未实现。
- 竖排采用原生竖排流及水平视口步进，翻页保留边缘重叠以覆盖跨边界字形。完整竖排 CSS 分片、强制分页与避头尾组合仍需专项实现及验证。
- 新导入保留原 ZIP 和兼容正文投影，图片、字体等二进制资源通过书籍级 URL 按需读取。导出章节时由 `epubExport.ts` 的 `withExportImages` 将所选源页的图片展开为 Data URL，保持 Markdown 携带图片与标注。
- ZIP／XML 解析转移到导入 Worker，正文的浏览器 HTML 规范化、文本投影、布局及分页在渲染线程执行，规范化每八章让出一次执行机会。当前打开书籍仍保留完整 `pages`，大型书籍的全文字符串、Base64 和数据库 JSON 成本继续存在。
- 资源 Worker 最多保留两本书、32 MiB 压缩输入。一册超出预算的活动书籍允许作为工作集保留。展开字节缓存上限 8 MiB，超过上限的单项资源即时返回。最多四个活动 RPC，等待队列随实际请求增长。图片解码像素与浏览器原生缓存另计。
- 数据库修订号保护资源读取，重复导入／删除会使旧资源访问失效。旧缓存内存随淘汰和服务关闭回收。Worker 异常和退出时拒绝等待请求，后续请求可重新建立 Worker。
- 普通书库、Goal 与阅读打开走摘要／单书接口。完整备份选择仍使用原有整书读取以显示结构信息，备份、恢复和兼容 API 保留全量数据路径。

## 3. 已通过测试

以下结论覆盖本轮指定样书和实际应用入口。合成样书使用 ZIP 内实际资源与反混淆字体。浏览器检查包含可见内容、布局坐标、真实字体使用、请求记录及保存后的数据。

| 功能／业务 | 内置浏览器实际结果 |
|---|---|
| 主标题与 UTF-16 | `P1-features.epub` 的 OPF 使用 UTF-16LE，首个标题为补充标题，主标题正确显示为 P1 Engine Features。fallback XHTML 使用 UTF-16BE，正文正常显示 |
| EPUB 2／NCX | `P1-epub2.epub` 的 OPF 为 UTF-16BE、正文与 NCX 为 UTF-16LE。中文章节与 UTF16 目录均正常显示 |
| fallback 与重复引用 | 外来媒体 Spine 项回退到 XHTML。重复源文档保留各自 Spine 页，重复 URL 的目录项定位至首次源页 P.1 |
| NAV heading 与非线性条目 | Part A heading 以无页号 heading 展示，点击保持当前位置。目录可以打开非线性附录，顺序翻页从第 1 源页跳至第 3 源页 |
| 原书 CSS | 作者段落颜色为 `rgb(12,88,166)`，嵌套 CSS import 的字距为 2 px，行内出版物颜色保留，根语言和方向正确 |
| 字体反混淆 | `encryption.xml` 声明 IDPF 混淆，正确标识为第二个 identifier。CDP `CSS.getPlatformFontsForNode` 返回 Literata、`isCustomFont=true`、47 个使用字形，确认浏览器实际使用了解混淆后的字体 |
| Auto 与用户覆盖 | 追加验收中，Auto 在英文书显示 Literata／更纱回退，在 zh-CN 书显示更纱。Book font 显示 P1Embedded，明确选择更纱后正文覆盖为更纱。字号按钮可改至 17 px，Dark paper 可改正文颜色和纸色。固定页切换 Auto／Book font 时字体相应变化，作者 24 px 字号保留 |
| 横排分页与滚动 | Page 模式 1/4 → 2/4 → 1/4 往返，连续滚动按屏移动，返回首屏时页边笔记重新出现 |
| 竖排 | 日文 `vertical-rl` 正常显示与选择，页进产生负 scrollLeft，1/9 → 2/9 → 1/9 往返。Scroll 模式滚轮移动后页码同步 1/9 → 2/9 |
| RTL | 阿拉伯文 `dir=rtl`、`lang=ar` 保留，分页使用负 scrollLeft。包级 RTL 页进下，左方向键进入后续 Spine 文档 |
| 固定与混合版式 | XHTML 固定页使用 600×800 内部视口，按 0.735 缩放到 441×588。SVG 固定页可阅读。包级固定页的 itemref 可覆盖成 reflowable，切换后恢复正常宽度与滚动 |
| 标注与 Goal | 横排、竖排与固定页均通过实际选区创建并保存笔记。字体与布局变化保留源章节偏移。Goal 可以跨书回源。重新导入及刷新后横排笔记 ID 仍为 `note-1794484984411-351` |
| 旧书 | 有原 ZIP 的 P0-fixture 自动恢复新包信息与作者样式，旧笔记 `note-1794477335808-63`、原高亮及 Goal 关联保留。无 ZIP 的 Legacy P0 book 保留正文和原笔记。P0-text.txt 正常打开 |
| 章节导出 | 实际下载的 `P1 Engine Features_01_First source.md` 包含原引文、保存的笔记及 `data:image/svg+xml;base64` 图片 |
| 备份恢复 | 实际下载 1.3 备份含 1 本书、3 条标注、7 个源文档、原 ZIP 的 536808 字符 Base64 和 Goal graph。经应用 Restore books 入口恢复成功，Goal 资料按钮仍能激活原笔记并定位可见引文 |
| Worker 与读取 | 浏览器实际 GET 导入 Worker 资产 225950 字节，成功导入样书。服务日志记录 publicationWorker.cjs 的真实 Worker threadId=1。正常书库／打开路径使用 `/books/summary` 和 `/books/get`，6 本书的摘要浏览器传输约 1.5 kB |
| 日志与编译 | 最终浏览器 warn／error 日志为空。`npm run build`、`npm run typecheck` 和 `git diff --check` 通过 |

本轮测试使用独立书库 `.commandcode/epub-p1/library`，样书生成文件为 `.commandcode/epub-p1/fixtures.cjs`。HTTP 与线程证据分别位于 `http.log`、`worker-events.log`。最终截图为 `author-styles-final.jpg`、`fixed-layout-final.jpg`、`vertical-final.jpg`，均位于同一目录。章节与备份下载保留在本机 `E:/download/`。

验收中修正了两处相关缺陷。iframe 内的竖排滚动补齐页码与锚点更新。异步样式与字体完成时沿用已记录锚点，避免读取重排后的其他文本覆盖 Goal 请求的回源位置。相关修改分别位于 `ReaderController.initUI`、`paintChapter`、字体 onReady 及 `ReaderRuntime.mount`。

### 同日追加的字体按钮验收

`src/client/features/workbench/WorkbenchShell.tsx` 中已有 Book font 菜单项原先处于禁用状态并显示 Not yet，现已接入 `data-font-choice="original"`。`domain/font.ts`、`fontCatalog.ts` 和 `FontController` 处理模式解析、切换、选中状态及持久化。`publicationDocument.ts` 保存原始 BODY 行内字体，切回原书字体时恢复该声明。

内置浏览器实际验证了 Auto → Book font → 更纱 → Auto，英文及中文书按语言应用 Auto，键盘 Enter 选择 Book font，刷新后恢复 Book font 标签与 radio 选中状态。原横排笔记 `note-1794484984411-351` 和固定页笔记 `note-1794485209283-741` 保留，页边笔记在对应源文显示。固定页在 Book font 下使用 serif，在 Auto 下使用 Literata，字号均为 24 px。浏览器 warn／error 日志为空。

追加验收截图为 `.commandcode/epub-p1/book-font-enabled.jpg`，构建日志为 `.commandcode/epub-font-choice-build.log`，类型检查日志为 `.commandcode/epub-font-choice-typecheck.log`。BODY 行内字体优先级恢复已有源码处理，实际嵌入字体样书覆盖的是外部 CSS 字体声明。

### 真实书籍图片分页修复

用户提供的《创新与企业家精神（珍藏版）》原 EPUB 已通过应用正常入口重新导入。原书记录补齐 68 个源文档及 113 个 Manifest 项，13 条原标注与 Goal 数据逐条核对一致。图片裁切在恢复原书 CSS 后改善，随后仍复现单张图片产生 2～3 列及空白分页。

布局检查发现，BODY 的底部 32 px 内边距会成为额外的分栏片段。Readium CSS 的 `95vh` 图片高度上限同时包含阅读留白和段落占用，图片段落可能被挤入下一列。`chapterColumnView.js` 的 `layoutChapterStrip` 将横排分页留白交由根容器处理，`fitChapterImages` 按内容区高度扣除段落边距、边框、内边距和行盒预留，限制图片高度并恢复原样式以响应重排。纯图片段落使用零首行缩进。`readerDocument.ts` 为普通正文图片提供等比宽度适配。`ReaderController` 在图片加载后重新布局。

本次也修复分页转连续滚动时的水平偏移残留，配置滚动模式的 Readium 媒体高度，确保图片可随正文滚动。相关验收发现末尾不足整屏时页码停留在前一屏，现已修正尾屏计数。固定页切回普通内容时，补齐正文自动高度和 overflow 的复位。

内置浏览器在 1280×720、1611×950 和实际窄窗口中验证了前三个源图片页，均显示为 `1/1 column`。在较小视口中寄语图片约为 351×468，完整显示于 560×588 视口中，前后翻页直接进入相邻源文档。较大视口中图片约为 523×698，同样保持单列。“推荐序三”的横幅为 560×131.25，对 130 个文字行片段检查得到横向溢出 0。Page／Scroll 切换后水平偏移为 0，滚动至尾部显示 `2/2 screens`。

原 Goal 可以定位 `note-1793935117507-642` 并显示对应页边笔记。13 条标注及 Goal 数据的散列与重导前记录一致。独立样书回归覆盖日文竖排、阿拉伯文 RTL、600×800 XHTML 固定页、SVG 固定页和长 TXT 打开，浏览器错误日志为空。长 TXT 切换后使用自动高度按内容展开。最终冷加载后也通过图片页及“推荐序三”检查，新增 warn／error 为 0。桌面运行继续遵循本会话的尚未验证边界。

截图位于 `.commandcode/epub-p1/innovation-pagination-letter-fixed.jpg` 和 `innovation-recommendation-fixed.jpg`，构建日志为 `.commandcode/epub-pagination-build.log`。完整复杂 CSS 分片与各类 SVG／媒体资源的适配仍需按样书扩充覆盖。

## 4. 代码中存在实现与尚未验证

| 状态 | 范围与边界 |
|---|---|
| 代码中存在实现 | Adobe 字体 UUID 反混淆、缺失／循环 fallback 的失败处理、导入取消、Worker 错误／退出后的请求拒绝与恢复、ZIP 缓存淘汰后重新打开、各类未知 Metadata／Manifest／Spine 属性保留 |
| 代码中存在实现 | 桌面摘要／单书 IPC、预加载接口、Worker CSP 和打包文件清单同步适配。此轮功能验收仅覆盖浏览器入口 |
| 尚未验证 | 全部 EPUB Tests、EPUBCheck 样书矩阵、完整 EPUB 3.3 Reading Systems 合规、EPUB 3.4 草案扩展及后续变更 |
| 尚未验证 | Adobe 混淆的实际字体样书、导入取消／故障注入／并发缓存淘汰的浏览器专项、复杂 CSS 竖排分片、跨页表格、极端字体回退与多脚本排版 |
| 尚未验证 | 大型真实书库和超长章节的峰值内存、布局耗时、Worker 排队与图片像素预算。当前包体及少量请求数据只作为实现成本记录 |
| 尚未验证 | 本轮桌面运行、桌面进程退出、打包、安装与升级。P0 记录中的桌面退出问题继续保留 |

音视频与 Media Overlays、图片解码像素预算及更广泛迟到资源调度继续归入原 P2。固定页缺失有效 viewport 时使用当前阅读区域尺寸回退，准确比例仍依赖出版物给出有效尺寸。

## 5. 依赖、许可证与实际成本

| 新依赖 | 锁定版本 | 许可证 | npm 解包体积 | 直接依赖 |
|---|---|---|---|---|
| @zip.js/zip.js | 2.24.0 | BSD-3-Clause | 8725221 bytes | 0 |
| @readium/css | 2.0.5 | BSD-3-Clause | 192368 bytes | 0 |
| @xmldom/xmldom | 0.9.12 | MIT | 440251 bytes | 0 |

已核对安装包内 LICENSE 和 package.json。上述许可证允许商业使用与修改，分发应保留版权和许可文本，BSD-3-Clause 同时要求遵守名称背书条款。项目已有打包 notices 生成器扫描生产依赖。正式分发产物中的声明完整性随打包验收检查。

ZIP 入口使用 `index-native.js`，在自有 Worker 内关闭嵌套 WebWorkers。原有 JSZip 继续服务现存导出和兼容调用。最终 Vite 构建的导入 Worker 为 225.95 kB，Worker 缺失回退的异步归档块为 222.57 kB／gzip 93.40 kB，阅读主块约 452 kB／gzip 112 kB。Readium CSS 的四种方向变体和 XML 解析增加包体，书库摘要与二进制按需读取减少常规打开路径的数据复制。持续内存和速度收益仍需代表性大书测量。

## 6. 后续验收重点

按现有优先级继续扩充 EPUB 3.3 官方样书覆盖，首先覆盖 Adobe 字体、复杂 CSS、竖排分片、双页固定版式与资源故障恢复。P2 承接图片像素预算、缓存细化、媒体和标注性能。标准能力结论继续按本文件的三种状态记录，并结合真实出版物逐项升级验证状态。[EPUB Tests](https://github.com/w3c/epub-tests)、[EPUBCheck](https://github.com/w3c/epubcheck)
