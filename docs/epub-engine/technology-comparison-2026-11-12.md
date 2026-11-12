# AuraReader EPUB 引擎技术选型对比

## 1. 选型结论与证据范围

**建议首轮引入 `@zip.js/zip.js` 和 `@readium/css`，保留 AuraReader 的 `ReaderRuntime`、控制器、仓储和业务模型。** 资源服务重点参考 Thorium，资源生命周期与分页实现重点参考 Foliate 的独立引擎 `foliate-js`。Readium TS Toolkit 的完整 Navigator 可进入后续集成评估。

这一组合能够分阶段覆盖审计中的九项处理项，同时控制业务迁移范围。AuraReader 当前的主要问题集中在导入转换、资源寻址、文档隔离、布局和全书数据读取，分别需要对应层面的改造。[已归档审计报告](/E:/dp/reader_workstation/docs/epub-engine/audit-2026-11-12.md)、[当前解析器](/E:/dp/reader_workstation/src/client/infrastructure/epubParser.js:356)、[ReaderRuntime](/E:/dp/reader_workstation/src/client/features/reader/readerRuntime.ts:19)

本次核查截至 **2026 年 11 月 12 日**，覆盖 GitHub 固定提交源码、实际调用链、许可证原文、`package.json`、发布记录和 npm 元数据。

- 表中的能力判断均为**代码中存在实现**或**源码层限制**。
- 六个项目接入 AuraReader 后的符合性、视觉渲染、性能和业务兼容性均属**尚未验证**。
- 既有审计报告中的测试结果仍保留其原有范围。
- 依赖大小采用 **npm 解压包大小**。最终加载体积、Worker／WASM 资源量和内存成本需要通过选定入口的构建及运行测量。

规范基线采用 EPUB 3.3 与 Reading Systems 3.3。EPUB 3.4 当前为 2026 年 11 月 11 日候选推荐草案，前向兼容重点包括新增媒体类型和 roll layout。[EPUB 3.3](https://www.w3.org/TR/epub-33/)、[Reading Systems 3.3](https://www.w3.org/TR/epub-rs-33/)、[EPUB 3.4](https://www.w3.org/TR/epub-34/)

## 2. 详细技术对比表

适配程度是结合 AuraReader 当前源码作出的工程判断。表中的“覆盖问题”表示可复用能力或设计能够帮助解决的问题，实际完成度仍取决于集成实现。

| 项目定位及架构 | EPUB 解析与规范支持 | XHTML／CSS 渲染及字体、图片、媒体 | 分页、Fixed Layout、RTL | 缓存、内存及性能 | Worker／异步 | 许可证及依赖成本 | 维护状态 | 与 AuraReader 的适配程度 | 可覆盖的问题及具体模块 |
|---|---|---|---|---|---|---|---|---|---|
| **Readium TS Toolkit**<br>TypeScript 模块化 SDK，分为 Shared、Navigator、HTML Injectables 等包。以 Publication／Locator／Fetcher 模型连接资源与 iframe 渲染 | 当前仓库提供 publication 数据模型、资源接口和导航器。原始 EPUB 的 ZIP、container、OPF 解析需要外部提供。完整 3.3 合规仍需逐项验收 | 保留完整文档，在 iframe 中注入阅读 CSS，并通过 base URL 加载原书资源。支持样式、字体、图片和浏览器媒体。字体反混淆需由资源层承担 | 有 reflowable、FXL、spread、RTL 和 CJK 路径。**当前 CJK 竖排路径主动关闭分页，采用自由横向滚动** | 有 frame pool、并发请求合并、Blob 复用与销毁。流式文档 frame 淘汰时会保留 Blob，长书仍需补预算 | 异步资源与 iframe 通信已经实现。EPUB 解压 Worker 需要宿主提供。默认 `HttpResource.read(range)` 会抛未实现错误 | BSD-3-Clause。`@readium/navigator` 有 **6 个直接运行依赖**。发布包约 **1.52 MB**，另有 Shared、Injectables、Decorator、Speech 等依赖 | Navigator **2.15.0** 于 2026-11-06 发布。最近源码提交 2026-11-10。维护活跃 | **中等**。TS 与运行时边界契合，但需要转换 Publication／Locator、选区事件和标注坐标。完整接入范围较大 | **P0** 文档边界与 base URL。**P1** 分页、FXL、RTL、定位模型。**P2** decoration 与重排通知。重点参考 `FrameBlobBuilder`、`FramePoolManager`、`FXLFramePoolManager`、`EpubNavigator`。[文档构建](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/navigator/src/epub/frame/FrameBlobBuilder.ts)、[frame pool](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/navigator/src/epub/frame/FramePoolManager.ts) |
| **Thorium Reader**<br>完整 Electron／React 桌面阅读器，含自有业务、状态管理、资源协议和 vendored Readium R2 模块 | container、OPF、NCX、NAV、rendition、encryption、SMIL 等链路较完整。NAV 优先、NCX 回退已有实现。部分 XML 读取仍固定 UTF-8，细节需继续审核 | Chromium 文档上下文承载原书 CSS、字体和媒体。具备 IDPF 字体反混淆、SVG 处理、MathJax 和音文同步链路 | 有固定版式、跨页、RTL、竖排及成熟的阅读交互路径。适合作为桌面兼容性参考 | 原始 ZIP 按资源流式读取，协议层支持 Range 和缓存头，Publication 有缓存和关闭清理。缓存代码仍保留 LRU 待办 | Node stream 与异步 I/O 可降低一次性解压成本。审查到的主路径包含主进程解析，独立解析 Worker 仍需另行设计 | BSD-3-Clause。当前开发分支根清单有 **82 个直接运行依赖、97 个开发依赖**，包含 React／Redux／Saga、MathJax、PDF、XML、ZIP 等完整应用成本 | 稳定版 **3.5.1** 于 2026-09-02 发布。开发分支为 **3.6.0-beta.1**，最近提交 2026-11-12 | **设计参考高，整体接入低**。Electron 协议、资源流和阅读兼容性经验高度相关，完整应用耦合较重 | **P0** 原始资源保留、协议寻址、文档资源边界。**P1** NAV／元数据、字体反混淆、FXL。**P2** Range、媒体与 SMIL。重点参考当前 `src/main/streamer/streamerNoHttp.ts`、`transformPublicationStream.ts` 及 R2 parser／transform。[当前资源服务](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/src/main/streamer/streamerNoHttp.ts)、[EPUB parser](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/src/r2-xxx-js/r2-shared-js/parser/epub.ts) |
| **Readium CSS**<br>面向阅读系统的参考样式层，包含 before／default／after、RTL 和 CJK 变体 | 负责内容呈现。ZIP、OPF、NAV、fallback、资源访问等由宿主实现 | 提供媒体尺寸保护、字体与用户样式覆盖、Ruby 偏好、连字、断词、行距和分页保护。原书字体加载、反混淆及媒体播放由宿主实现 | 提供横排、RTL、CJK 横排／竖排的分页和滚动样式。FXL 的 viewport、缩放和 spread 仍由 JS 布局控制 | 静态 CSS，运行成本较低。可按语言／排版模式加载对应变体。媒体保护能减少图片跨栏和溢出异常 | 无 JS Worker 需求。布局执行由浏览器负责 | BSD-3-Clause。**0 个 npm 运行依赖**。`2.0.5` 解压约 **192 KB**，包含多个变体 | **2.0.5** 于 2026-05-13 发布。最近提交 2026-11-02，为依赖维护 | **高**。适合接入隔离后的阅读文档。需要协调现有 `.book-paper` 的强制字体、缩进和分页规则 | **P1** 原书／用户样式分层、字体覆盖、RTL／竖排基础。**P2** 图片／SVG／视频尺寸与分页保护。重点采用编译后的 CSS，参考 `ReadiumCSS-safeguards.css`、分页及用户设置模块。[媒体保护](https://github.com/readium/css/blob/803fea474b3c01ff26f1a93bc9568a02e1ad2b7d/css/src/modules/ReadiumCSS-safeguards.css)、[分页模块](https://github.com/readium/css/blob/803fea474b3c01ff26f1a93bc9568a02e1ad2b7d/css/src/modules/ReadiumCSS-pagination.css) |
| **epub.js**<br>浏览器 EPUB 引擎，Book／Spine／Rendition／Contents 分层，配合 iframe 和视图管理器 | 有 container、OPF、NAV／NCX、spine、CFI、rendition 等实现。Manifest 解析未保留 fallback，`Archive.getText()` 仍使用 JSZip 字符串解码 | iframe 保留书内样式，支持 CSS 资源替换、字体和图片 Blob／Base64。媒体依赖浏览器与资源替换链路。完整反混淆及 SMIL 播放证据不足 | 有 columns、连续滚动、pre-paginated、spread、RTL、CFI。复杂竖排及混合版式仍需专项验证 | 有 URL cache、章节视图回收和 localForage 存储。资源替换可一次并发创建全部 asset URL，存在全书资源成本。销毁实现也有需要复核的细节 | Promise 与异步加载较多，默认 ZIP 路径仍为 JSZip。独立解压 Worker 缺少实现 | BSD-2-Clause。**9 个直接运行依赖**，含 JSZip、Lodash、core-js、localForage、旧版本范围的 xmldom 等。解压约 **6.42 MB** | npm 最新 **0.3.93** 发布于 2022-02-16。仓库最近提交 2026-03-24，源码仍有维护，但发布滞后 | **中等**。浏览器模型容易包进 ReaderRuntime，旧依赖、资源模型和标注迁移仍有成本 | **P1** NAV heading、CFI、分页和连续视图管理可参考。**P2** 离屏视图回收。重点参考 `navigation.js`、`epubcfi.js`、`managers/continuous/`。源码中的现有缺口需分别处理。[NAV 解析](https://github.com/futurepress/epub.js/blob/eee359d0790002115a1156a9833c54f4bcd44c1d/src/navigation.js)、[连续视图管理](https://github.com/futurepress/epub.js/blob/eee359d0790002115a1156a9833c54f4bcd44c1d/src/managers/continuous/index.js) |
| **zip.js**<br>通用 ZIP 库，Reader／Writer、Web Streams、编解码器与 Worker pool 分层 | 支持 ZIP64、按条目读取、校验及多种 ZIP 特性。EPUB 的 OCF 白名单、container、OPF、导航和 fallback 需由 AuraReader 实现 | 输出字节、Blob 或流，能够保留原始字体、图片和媒体数据。呈现由上层负责 | 分页、FXL、RTL 由上层负责 | Blob 切片、HTTP Range、按需 entry 解压、流式输出和并发上限能降低全书转换成本。仍需应用级资源及解压预算 | **有真实 Worker pool、队列、终止、取消信号及原生 CompressionStream 路径**。Worker 失败存在回退策略，需要监测执行位置 | BSD-3-Clause。**0 个 npm 运行依赖**，包内包含编解码器、Worker、WASM 及多个入口。`2.24.0` 解压约 **8.73 MB** | **2.24.0** 于 2026-10-16 发布，最近提交 2026-11-12。维护活跃 | **高**。可替换 EPUB 导入与资源读取的 ZIP 适配器，React 和业务仓储边界清晰。导出功能可单独迁移 | **P1** 解压线程、按需读取、取消。**P2** 流式与资源预算基础。重点采用 `ZipReader`、`BlobReader`、`codec-pool.js`、native／reader 入口。**P0 URL 与文档隔离仍由上层完成**。[ZIP reader](https://github.com/gildas-lormeau/zip.js/blob/34f04fe5c46d46fa531893364d5c048b91c37a35/lib/core/zip-reader.js)、[Worker pool](https://github.com/gildas-lormeau/zip.js/blob/34f04fe5c46d46fa531893364d5c048b91c37a35/lib/core/codec-pool.js) |
| **Foliate／foliate-js**<br>Foliate 是 GTK4／GJS／WebKitGTK 桌面应用，通过子模块使用独立 JS 引擎 | `foliate-js` 有命名空间化的 container／OPF／NAV／NCX、元数据、spine、CFI、字体反混淆和 SMIL。Manifest 读取缺少 fallback 字段，规范细节仍有缺口 | 引擎保留完整文档并按属性处理 CSS、src、poster、object、srcset 等资源。Loader 用 Blob URL、依赖引用计数管理生命周期 | 有独立 `paginator.js` 和 `fixed-layout.js`，实现 RTL、竖排轴切换、viewport、spread、字体就绪及 ResizeObserver 重排 | 当前章节按需加载，资源引用计数归零后撤销 Blob URL。思路轻量，但引用计数、循环依赖及高峰资源仍需验收 | 大量异步加载。**默认 ZIP loader 明确设置 `useWebWorkers: false`**，需要自行接入 Worker 策略 | Foliate 应用 **GPL-3.0-or-later**，原生依赖较重。独立 **foliate-js 为 MIT**，核心为 ES modules，vendor ZIP 等资源仍需准备 | Foliate 稳定版 **3.3.0** 于 2025-04-01 发布，最近提交 2026-04-08。foliate-js 最近提交 2026-05-01，发布与维护节奏较慢 | **应用整体低，独立引擎设计高**。Web Components／iframe 可封装，但 API、更新节奏和选区桥接需维护 | **P0** 避免误改 `<a>`、资源依赖加载。**P1** 原书 CSS、字体反混淆、FXL／RTL。**P2** 引用计数、图片约束、字体迟到重排、overlay。重点参考 `epub.js` 内部 Loader、`paginator.js`、`fixed-layout.js`、`overlayer.js`。[资源 Loader](https://github.com/johnfactotum/foliate-js/blob/399248a67a8862ffb5e6463a33f9d52b317ca2eb/epub.js#L706)、[分页实现](https://github.com/johnfactotum/foliate-js/blob/399248a67a8862ffb5e6463a33f9d52b317ca2eb/paginator.js) |

**依赖与许可核验说明**

- npm 数值来自发布元数据，直接依赖数量按相应 `dependencies` 计算。Thorium 根清单用于其完整构建，生产依赖还经过打包处理，82 项不能直接换算成 AuraReader 的新增运行依赖数量。[Navigator 元数据](https://registry.npmjs.org/@readium%2Fnavigator/2.15.0)、[Readium CSS 元数据](https://registry.npmjs.org/@readium%2Fcss/2.0.5)、[zip.js 元数据](https://registry.npmjs.org/@zip.js%2Fzip.js/2.24.0)、[epub.js 元数据](https://registry.npmjs.org/epubjs/0.3.93)、[Thorium 清单](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/package.json)
- BSD-2／BSD-3 允许商业使用和修改分发，需要保留版权、许可条件及免责声明。BSD-3 还限制使用作者名称背书。[Readium 许可](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/LICENSE)、[Thorium 许可](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/LICENSE)、[Readium CSS 许可](https://github.com/readium/css/blob/803fea474b3c01ff26f1a93bc9568a02e1ad2b7d/LICENSE)、[zip.js 许可](https://github.com/gildas-lormeau/zip.js/blob/34f04fe5c46d46fa531893364d5c048b91c37a35/LICENSE)、[epub.js 许可](https://github.com/futurepress/epub.js/blob/eee359d0790002115a1156a9833c54f4bcd44c1d/license)
- GPL 允许商业使用，分发受 GPL 覆盖的衍生程序需要履行对应源码等义务。Foliate 应用与独立 MIT 引擎具有各自许可范围。MIT 引擎可商业复用并保留许可声明。[Foliate 清单](https://github.com/johnfactotum/foliate/blob/67b6676d3f936c5edea91d4d903385ef39dd25c0/package.json)、[GPL 原文](https://github.com/johnfactotum/foliate/blob/67b6676d3f936c5edea91d4d903385ef39dd25c0/COPYING)、[foliate-js 许可](https://github.com/johnfactotum/foliate-js/blob/399248a67a8862ffb5e6463a33f9d52b317ca2eb/LICENSE)

## 3. 需要计入选型的源码限制

### Readium TS Toolkit 需要配套解析和资源服务

当前根工作区包括 Shared、Navigator、Injectables、Decorator、Helpers、Guided Navigation。`Publication` 接收已经构建好的 Manifest 和 Fetcher，完整原始 EPUB 解析链路需要 AuraReader 提供或接入其他实现。仅引入 Navigator，现有 OPF／fallback／UTF-16 问题仍会留在导入层。[工作区清单](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/package.json)、[Publication 构造](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/shared/src/publication/Publication.ts#L39)

其性能和排版边界也需要明确。

- `HttpResource.read(range)` 直接抛出未实现错误，媒体 Range 应由宿主资源服务处理。[HttpFetcher](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/shared/src/fetcher/HttpFetcher.ts#L75)
- Reflowable frame 被淘汰时，Blob 仍保留以避免重复预处理，需要额外设置内存预算。[FramePoolManager](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/navigator/src/epub/frame/FramePoolManager.ts#L127)
- 当前 Navigator 对竖排设置 `noVerticalPagination`，CJK snapper 采用资源内自由横向滚动。若 AuraReader 要求竖排逐屏翻页，该项需要单独实现或选择其他分页路径。[EpubNavigator](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/navigator/src/epub/EpubNavigator.ts#L157)、[CJKVerticalSnapper](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/navigator-html-injectables/src/modules/snapper/CJKVerticalSnapper.ts#L19)

### Thorium 的参考价值主要在现行调用链和兼容性处理

本次追踪到的当前资源服务为 `src/main/streamer/streamerNoHttp.ts`，由应用调用，使用自定义协议、资源流和 R2 parser。旧 `r2-streamer-js/http/server-assets.ts`、`zip2.ts` 等文件有大段注释代码，复用时应以调用链为准。[当前调用入口](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/src/main/redux/sagas/streamer.ts#L15)、[ZIP factory](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/src/r2-xxx-js/r2-utils-js/_utils/zip/zipFactory.ts#L18)

Thorium 也有值得规避的实现细节，例如 OPF 的 UTF-8 固定解码，以及 Publication 缓存中的 LRU 待办。因此建议复用其资源服务分层与处理规则，并逐项补齐 AuraReader 的已知缺陷。[OPF 解码](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/src/r2-xxx-js/r2-shared-js/parser/epub-daisy-common.ts#L895)、[Publication 缓存](https://github.com/edrlab/thorium-reader/blob/51808f1f21f01f0958350010332d73d39eb6dd37/src/main/streamer/streamerNoHttp.ts#L2123)

### epub.js 与 foliate-js 都有可复用设计，也保留规范缺口

- epub.js 的 `parseManifest()` 未提取 fallback，`Archive.getText()` 的 encoding 参数没有用于实际解码。现有 P1 问题仍需专门修复。[Manifest 解析](https://github.com/futurepress/epub.js/blob/eee359d0790002115a1156a9833c54f4bcd44c1d/src/packaging.js#L115)、[文本读取](https://github.com/futurepress/epub.js/blob/eee359d0790002115a1156a9833c54f4bcd44c1d/src/archive.js#L148)
- foliate-js 的 Manifest 字段同样未包含 fallback，其默认 ZIP loader 显式关闭 Worker。资源依赖图、引用计数和属性级替换仍很适合借鉴。[Manifest 字段](https://github.com/johnfactotum/foliate-js/blob/399248a67a8862ffb5e6463a33f9d52b317ca2eb/epub.js#L642)、[ZIP loader](https://github.com/johnfactotum/foliate-js/blob/399248a67a8862ffb5e6463a33f9d52b317ca2eb/view.js#L30)
- Foliate 当前固定的引擎子模块提交为 `399248a`，独立引擎 main 为 `78914ae`。本报告对主要解析和分页模块核查了应用固定版本，避免把独立引擎后续变化计入应用能力。[Foliate 子模块](https://github.com/johnfactotum/foliate/tree/67b6676d3f936c5edea91d4d903385ef39dd25c0/src/foliate-js)

### zip.js 需要 EPUB 专用约束

zip.js 支持的通用 ZIP 能力包括分卷、加密及其他压缩方式。AuraReader 仍应在适配层执行 OCF 规则、允许的压缩方法和版本字段检查，并设置条目数、解压字节数、单资源大小和图片像素预算。[zip.js reader](https://github.com/gildas-lormeau/zip.js/blob/34f04fe5c46d46fa531893364d5c048b91c37a35/lib/core/zip-reader.js)、[Reading Systems OCF 要求](https://www.w3.org/TR/epub-rs-33/#sec-ocf-zip)

## 4. 最值得引入的依赖与设计参考

### 优先引入

**第一，`@zip.js/zip.js`。**

优先用于 EPUB 原始容器和按需资源读取，采用发布版固定版本，评估 native／reader 入口及显式 Worker 资源配置。它最直接对应解压线程、整本转换和重复 Base64 的成本。AuraReader 的章节导出可以保留独立 ZIP 适配边界，分阶段迁移。

**第二，`@readium/css`。**

采用已编译的发布资源，按横排、RTL、CJK 模式选择变体。注入顺序参考 Readium Toolkit 的实现，before 在作者样式之前，after 在其后，default 用于缺少作者样式的文档。固定版式采用独立布局路径。[CSS 注入实现](https://github.com/readium/ts-toolkit/blob/0d02a7432903f57750268a408c58cac8846c12eb/navigator/src/injection/epubInjectables.ts#L57)

**`@readium/shared` 可在采用 Readium publication 接口时引入。**

它适合连接 Publication／Link／Locator 和资源接口。AuraReader 的持久化 Book、Annotation、Goal 数据应通过适配层与这些对象衔接，避免扩大首轮数据迁移。

### 设计参考优先

| 项目 | 建议使用方式 | 原因 |
|---|---|---|
| **Thorium 整体应用** | 参考现行资源协议、Range、字体转换、NAV／SMIL 和 FXL 处理 | 完整应用依赖和状态体系较重，部分实现与 AuraReader 的现有仓储和界面职责重叠 |
| **Foliate 整体应用** | 参考应用对独立引擎的使用方式，具体源码复用优先核对 MIT 引擎范围 | GTK／GJS／WebKitGTK 平台成本较高，应用与引擎许可范围不同 |
| **foliate-js 引擎** | 优先借鉴 Loader 引用计数、属性级资源替换、分页轴切换、字体就绪重排和 overlay | 模块边界轻量，维护节奏与 API 版本管理需要 AuraReader 自行承担 |
| **epub.js** | 参考 NAV heading、CFI、连续视图及离屏回收 | npm 发布滞后、旧依赖范围和已确认解析缺口增加维护成本 |
| **Readium TS 完整 Navigator** | 作为 P1 阶段候选引擎进行隔离验证 | 活跃且能力较丰富，接入前需要验证竖排分页、旧标注定位、页边笔记坐标和缓存预算 |

## 5. 推荐技术组合与 AuraReader 适配方式

推荐组合为 **AuraReader 业务与运行时边界 + zip.js 容器读取 + 自有规范化包模型／资源服务 + Readium CSS 阅读样式**。

| 层次 | 推荐实现与职责 |
|---|---|
| React 与业务层 | 保持书架、Goal、Response、标注编辑、保存、导出和恢复流程 |
| `ReaderRuntime` 边界 | 继续向 React 暴露位置、选区、可见标注等可序列化数据，内部管理文档上下文 |
| 包解析层 | 完整保存 Manifest／Spine／NAV／Metadata／rendition／encryption，补齐 fallback、UTF-16 和重复 spine occurrence |
| ZIP 层 | zip.js 按条目读取、解压和取消，配合显式并发与内存预算 |
| 资源层 | 统一容器 URL，按 MIME 提供原始字节。桌面参考 Thorium 协议服务，浏览器使用对应 HTTP 资源适配 |
| 呈现层 | 隔离完整 XHTML／SVG 文档，流式内容采用 Readium CSS，FXL 使用独立 viewport／缩放布局 |
| 标注与几何层 | 保持旧位置语义，桥接文档内 Range、宿主坐标和可见性。参考 Readium decorations 与 Foliate overlay |

该组合需要特别处理四个当前源码约束。

- **旧标注依赖原 `pages[]` 文本及偏移。** 恢复隐藏文本、原始文档或改变文本归一化后，偏移可能发生变化。迁移应保留旧 page、引文和偏移版本，再建立到源 href、spine occurrence 的映射。[Book 与 ReadingLocation](/E:/dp/reader_workstation/src/client/domain/book.ts:1)、[标注偏移计算](/E:/dp/reader_workstation/src/client/features/reader/annotationRenderer.js:42)
- **iframe 后的选区和页边笔记需要坐标桥接。** 当前选择控制器直接读取 `bookPaper.ownerDocument`，页边笔记扫描当前 paper 的 token rect，需要在阅读器边界内转换。[SelectionController](/E:/dp/reader_workstation/src/client/features/annotations/selectionController.ts:239)、[页边笔记布局](/E:/dp/reader_workstation/src/client/features/layout/marginNotesLayout.js:123)
- **桌面 CSP 与资源策略需要精确适配。** 当前 `frame-src`、`worker-src` 为 `none`，请求过滤只允许应用来源及图片 data／blob。iframe、字体、媒体和 Worker 的资源路径都需要纳入受控策略。[桌面 CSP](/E:/dp/reader_workstation/src/desktop/assets.cjs:5)、[请求过滤](/E:/dp/reader_workstation/src/desktop/security.cjs:8)
- **DOM 解析、布局和图片解码要分别安排线程。** zip.js 可承担解压 Worker，字节解码与纯数据处理也可移出 renderer。浏览器 DOMParser、DOM 操作和布局仍需在支持对应 API 的上下文执行。图片解码还需单独的像素及并发预算。

其中，全书读取问题需要改造 AuraReader 自身仓储。当前打开一本书会先读取全部书籍记录，选择渲染库后仍需单独拆分书库摘要和正文读取。[loadBookFromDB](/E:/dp/reader_workstation/src/client/infrastructure/bookRepository.ts:19)

## 6. 按优先级排列的重构路线

以下路线覆盖已确认的九项处理项。每一步都应保留现有业务入口，并对受影响行为执行相应验证。

| 顺序 | 优先级 | 实施内容 | 借鉴／依赖 | 验收重点 |
|---|---|---|---|---|
| **1** | P0 | 修复图片处理误选 `<a>`，补齐 href 与图片属性的区别，统一路径规范化和精确资源查找 | Foliate 属性级替换；标准 URL 解析 | 普通跨章链接、同名文件、`./`／`../`、编码和片段定位 |
| **2** | P0 | 保留原始 EPUB／完整资源，建立包模型与稳定源文档标识，同时设计旧书和旧标注映射 | Thorium publication／资源分层；Readium Link／Locator 思路 | 旧书继续可读，旧标注、Goal 关联、导出和恢复可追踪 |
| **3** | P0 | 建立书籍级文档与资源边界，完成桌面协议和浏览器 HTTP 适配，桥接选区与页边笔记坐标 | Thorium 当前 streamer；Readium frame 构建 | 书内资源正确加载，React／reader 边界、选区、标注和页边笔记保持正确 |
| **4** | P1 | 接入 zip.js 按需读取与解压 Worker，拆开书库摘要和正文查询，建立取消、去重及预算 | zip.js；Foliate Loader 生命周期 | 首章可优先打开，大书可取消，全库正文不随单书打开进入内存 |
| **5** | P1 | 补齐 Manifest fallback、UTF-16、NAV heading、元数据、非线性资源和重复 spine occurrence | W3C 基线；Thorium／epub.js／Foliate 对应实现参考 | 已复现解析缺陷全部有对应通过证据，缺失内容可明确诊断 |
| **6** | P1 | 恢复原书 CSS、嵌入字体及反混淆，接入 Readium CSS，并完善 RTL／竖排轴 | Readium CSS；Thorium／Foliate 字体处理 | 语言、方向、原书字体、代码、Ruby、MathML 和用户样式覆盖 |
| **7** | P1 | 建立 FXL／混合版式专用布局，处理 viewport、itemref override、spread 和缩放 | Readium FXL；Foliate `fixed-layout.js` | 每个固定版式 spine 条目、跨页顺序、RTL 与缩放后的点击／标注位置 |
| **8** | P2 | 完善图片解码、像素预算、迟到字体／图片重排、缓存上限和阅读位置恢复 | Foliate paginator／overlay；Readium frame 生命周期 | 高分辨率图片、长章、重标注场景的内存和翻页表现 |
| **9** | P2 | 接入音视频、Range 和 Media Overlays，完善标注索引与可见性计算 | Thorium 媒体链路；Foliate MediaOverlay；Readium decoration 思路 | 离线媒体、seek、音文同步、标注数量增长时的交互表现 |

EPUB 3.4 前向兼容可随上述层次推进。资源模型保留完整 MIME 与未知属性，新增 AVIF、JPEG XL、Opus in MP4 的识别和能力检测，roll layout 使用跨 spine 的连续布局路径。各格式的实际解码与草案行为应在目标 Electron／浏览器版本上验证。[EPUB 3.4 变更记录](https://www.w3.org/TR/epub-34/#change-log)、[Reading Systems 3.4](https://www.w3.org/TR/epub-rs-34/)

本次交付为源码研究和技术选型结论。外部项目的集成测试、完整传递依赖许可清单、最终 bundle 大小和性能基准仍待实施阶段验证，当前工作区状态与研究开始时一致。