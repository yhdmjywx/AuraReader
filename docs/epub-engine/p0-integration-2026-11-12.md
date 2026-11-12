# EPUB P0 集成调查与实施记录

日期为 2026 年 11 月 12 日。分支为 `codex/epub-engine`。

## 1. 范围与依据

本次实现用户指定的前三项 P0。依据为本目录下的 [技术审计报告原文](audit-2026-11-12.md) 与 [技术选型对比原文](technology-comparison-2026-11-12.md)。两份原文独立保留，本记录承接源码调用关系、实施取舍和验证结果。

合规目标沿用 EPUB 3.3 正式标准及 EPUB 3.4 前向兼容方向。当前验证覆盖本轮 P0 的具体行为。后续标准功能与完整阅读系统合规验收见第 6 节。

状态按证据区分为「已通过测试」「代码中存在实现」「尚未验证」。

## 2. 原有功能的依赖关系

| 模块 | 实际依赖与本轮兼容处理 | 源码入口 |
|---|---|---|
| 导入、书库与身份 | 书籍 ID 由文件名生成。保留既有 ID，并在同名 EPUB 重新导入时核对源章节文本，避免覆盖已有坐标体系 | `src/client/app/appCoordinator.ts` 的 `importBook`，`src/client/infrastructure/bookRepository.ts` |
| 章节页号、屏幕分页 | `Book.pages` 与标注 `page` 使用从 1 开始的源文档序号。屏幕栏数由布局计算。新包模型保留源路径、Spine 出现位置及 `chapter-N` 映射 | `src/client/domain/book.ts`，`readerEngine.ts`，`chapterFlow.ts` |
| 高亮与笔记范围 | `bookId`、`page`、`sectionId`、UTF-16 文本偏移与引用文本参与恢复。渲染投影的属性重写保持正文文本偏移，跨文档选区继续使用原来的限制 | `src/client/features/reader/annotationRenderer.js`，`src/client/features/annotations/selectionController.ts` |
| 卷标题衔接 | 纯卷标题可能作为下一阅读单元的前缀。前缀保留自己的源页号，链接按各自源文档路径解析，标注仍按源文档定位 | `src/client/infrastructure/bookStructure.ts`，`ReaderController.paintChapter` |
| Goal 材料及回源 | Goal 关联通过书籍与标注 ID 找回原文。保留这些 ID，沿用已有的打开书籍、定位引用及激活标注流程 | `src/client/app/appCoordinator.ts` 的 `jumpToGoalSource`、`jumpToAnnotation`，`src/client/features/goals/` |
| 页边笔记与可见性 | 原实现直接比较正文、视口和卡片矩形。独立文档需要把正文坐标投影到宿主文档，再执行现有裁剪与卡片排布 | `visibleAnnotations.js`，`marginNotesLayout.js`，`selectionTooltipUI.js` |
| React 工作台 | React 管理笔记与 Goal 周边界面，阅读器持有正文 DOM 和 Range。工作台 Portal 使用宿主笔记列表的文档，新 iframe 由阅读器持有 | `src/client/features/workbench/ReadingWorkbench.tsx`，`ReaderRuntime.mount` |
| 字体与输入事件 | 字体集合、选区、事件及 AbortSignal 与所属文档有关。分别绑定宿主控件和正文事件，字体加载进入正文的 FontFaceSet，桥接翻页快捷键与滚轮 | `readerController.ts` 的 `initUI`，`selectionController.ts` 的 `initUI`，`fontController.js` 的 `ensure` |
| 导出与恢复 | 章节导出依赖保存的 HTML 及内联图片。保留这一兼容投影，并把原 EPUB 加入可往返的 Book JSON 字段，现有仓库、备份和恢复保存完整记录 | `src/client/infrastructure/exporters.js`，`src/client/features/backup/backupController.js`，`src/server/dataStore.js` |
| 普通文本 | 阅读边界同时承载 TXT。普通文档按内容高度撑开 iframe，章节单页模式按容器高度分页 | `readerDocument.ts` 的 `syncReaderDocumentSize`，`paperRenderer.js` 的 `renderPaper` |

## 3. 三项 P0 的实现

| P0 | 实现内容 | 代码证据 | 状态 |
|---|---|---|---|
| 图片、链接与容器路径 | 图片转换限于 `img` 和 SVG `image` 的图片属性。使用容器内大小写敏感的精确路径，规范化 `.`、`..`、编码、查询及片段。章节与目录使用各自文档基路径，重复 Spine URL 关联首次出现的源页号，移除同名文件模糊查找。空文本锚点具有块级定位回退 | `src/client/infrastructure/epubPaths.ts:2` 的 `resolveEpubUrl`，`epubParser.js:10` 的 `findZipFile`、`:19` 的 `processChapterImages`，`ReaderController.handleInTextLinkClick`，`chapterColumnView.js` 的 `placeAnchorIdAtTopLeft` | 已通过测试 |
| 原 EPUB、包模型与旧坐标 | Book 新增版本化 `epub` 字段，保存原始 ZIP 字节的 Base64、OPF 路径、出版物标识、Manifest、Spine 与源文档映射。重新导入使用逐章文本匹配，维持旧页号和 `chapter-N`，同步重映射目录与链接 | `src/client/domain/book.ts` 的 `EpubPackage`，`epubParser.js` 的 `parseEpub`，`src/client/infrastructure/epubCompatibility.ts:4` 的 `retainEpubLocations`，`appCoordinator.ts:194` | 已通过测试 |
| 独立正文与资源访问 | 阅读器创建独立 iframe 文档，sandbox 允许宿主读取正文并禁用书内脚本。渲染时清理活动内容及事件属性，资源 URL 按书籍分区。浏览器 HTTP 与桌面 `aurareader://app` 协议共用原资源服务。选区、可见标注、页边卡片、滚动定位和快捷键通过所属文档及坐标桥接 | `readerDocument.ts:4` 的 `mountReaderDocument`、`:69` 的 `readerRect`，`publicationContent.ts:5` 的 `preparePublicationContent`，`src/server/publicationResources.js:9`，`src/server/server.js`，`src/desktop/assets.cjs:63`、`storage.cjs:113` | 浏览器与资源服务已通过测试，桌面进程退出检查尚未验证 |

浏览器正文中的 HTTP、HTTPS、mailto 及协议相对外部链接交由宿主打开独立标签页，并设置 `noopener,noreferrer`。桌面外部窗口请求经过现有窗口策略。

## 4. 存储、生命周期与实施取舍

- 沿用项目已有的 JSZip，本轮依赖清单保持现有版本。原始 ZIP 与章节兼容投影共同保存，便于既有章节导出和备份继续往返。Base64 与内联图片副本会增加书籍记录及备份体积，后续资源去重和按需读取承接这一成本。
- 已有书籍沿用其书籍、标注及章节标识。对于缺少原始 ZIP 的旧记录，现有章节继续用于阅读。重新导入原文件时，只有全部章节能确定文本映射，才补充原资源并更新渲染投影。文本版本不同或映射有歧义时，会保留当前记录，并提示使用其他文件名导入。
- ZIP 缓存保留最多两本书，并使用 32 MiB 压缩输入预算。资源读取核对数据库修订号，重新导入或删除会使旧资源失效。并发的同版本 ZIP 加载合并为一个 Promise。该预算衡量保留的压缩输入，图片解码和瞬时解压占用由后续性能工作评估。
- 资源服务提供 GET 与 HEAD，按 Manifest 媒体类型返回原字节，启用 `nosniff`、同源资源策略和内容 CSP。浏览器入口沿用本地同源请求校验。缓存与正文观察器在服务或阅读器销毁时清理。
- `bookStructure` 使用惰性的 template 内容分析章节，避免在宿主活动文档中创建出版物资源节点。字体完成加载后触发正文重排，长 TXT 和连续章节按正文高度调整 iframe。

## 5. 验证记录

### 已通过测试

| 检查 | 结果与证据 |
|---|---|
| 严格构建 | `npm run build` 通过。最终 `npm test` 和迁移基线均重新构建 TypeScript 与 Vite 产物 |
| 全量现有测试与定向回归 | `npm test` 共 76 项通过，失败 0。日志位于 `.commandcode/epub-p0-tests.log` |
| 迁移基线 | `npm run test:migration` 共 16 项通过，失败 0。日志位于 `.commandcode/epub-p0-migration.log` |
| P0 定向回归 | `tests/regression/test_epub_publication.js` 覆盖精确大小写、同名章节、父级路径、编码 OPF 目录、查询与 Unicode 片段、普通链接保留、原 ZIP 逐字节一致、旧页号映射、iframe 文档与坐标、外部引用委派、SQLite 重启、旧标注往返、HTTP 及桌面协议资源、删除后的缓存失效 |
| 原阅读器回归 | 更新 `test_reader_runtime.js`、`test_reader_wheel.js`，通过实际独立文档引用测试选择、链接、滚轮、销毁与重新挂载。现有卷标题、高亮重叠、页边笔记、Goal、导出和恢复测试通过 |
| ChatGPT 内置浏览器 | 使用隔离临时 SQLite 书库，经过实际文件选择器导入样书。验证同名章节往返、含空格及 `#` 的图片路径、SVG image、建笔记、高亮、Goal 关联、跨书回源、重新导入后标注 ID 保留、刷新后恢复、分页与连续滚动、旧书笔记和长 TXT。图片自然尺寸为 120 × 60，浏览器错误日志为空 |
| 坐标核对 | 在内置浏览器中，iframe 顶部为 92，标注局部顶部为 31.0476，页边卡片顶部为 123.0476，符合宿主坐标投影。截图位于 `.commandcode/epub-p0/browser-page-notes-goal.jpg` |

### 代码中存在实现

Manifest 原始资源访问、`srcset`、音视频资源属性重写及源文档语言、方向数据已进入模型或渲染适配。多类型资源与完整国际化排版仍需各自的代表性样书验收。

### 尚未验证

- 完整 EPUB 3.3 Reading Systems 合规、EPUB 3.4 前向兼容样书及全部 EPUB Tests。
- 桌面进程正常退出。运行 `node scripts/test-desktop.cjs reading-workflow.cjs` 时，完整阅读、IME 笔记、Goal、跨书回源、导出、备份和刷新断言曾输出 PASS，随后触发 90 秒进程退出超时。进一步检查常规关闭也超时。使用 `git show HEAD` 的原版 `main.cjs`、`assets.cjs`、`storage.cjs` 在隔离进程重放，尚未创建书库且 iframe 数量为 0 时，退出探针同样超时。按项目环境失败约定停止重试，保留该项待验证。日志位于 `.commandcode/epub-p0-desktop.log`，探针保留在 `.commandcode/epub-p0-*-close.cjs`。

桌面回归另修正了一处已有测试选择器。Goal 原有 Response 包装层包住 `.goal-user-input`，断言改为检查首个包装层中的文本条目，以继续验证原有排序。桌面正文选择器和 Range 创建也更新为 iframe 所属文档。

## 6. 后续处理项

后续按原审计优先级继续实现完整包语义及 fallback、NAV heading、UTF-16 解码，恢复原书 CSS、嵌入字体及反混淆，建立 Fixed Layout 与 RTL、竖排分页路径。解析和解压 Worker、书库摘要分离、资源去重归入 P1。图片像素预算、迟到资源重排、缓存细化、媒体与 Media Overlays 归入 P2。

桌面退出问题保留独立验证记录。现阶段通过的具体样书及回归结果作为本轮 P0 的证据，标准合规范围随后续验收逐项扩充。
