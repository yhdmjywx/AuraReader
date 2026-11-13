# 行距与行宽：实施与验证记录

日期：2026-11-13。分支：`codex/epub-engine`。

依据：[功能需求与 Figma 设计](reading-settings-line-spacing-width.md)。本轮实现原 Reading settings 中的行距、行宽，不增加全局／单书偏好系统，不修改数据结构、导入器、资源服务、Goal、笔记、备份或导出业务。

## 1. 已实现的行为

| 功能 | 本轮实现 | 主要代码位置 |
| --- | --- | --- |
| 原面板新增两行 | Size 后增加 Line spacing、Reading width，复用现有 Button、ActionIcon 和字号步进样式；新增控件的焦点、按下、禁用样式仅作用于这两行 | `src/client/features/workbench/WorkbenchShell.tsx:71`；`src/client/components/ui/workbench.css:294` |
| 行距 | 显示原书代表正文的当前行高倍数；第一次主动调整才覆盖。范围 1.20–2.40，步长 0.05。只覆盖普通正文块及具有直接文本的普通容器 | `src/client/features/reader/readerController.ts`，`changeLineSpacing()`、`applyTypography()`；`src/client/features/reader/readingTypography.ts`，`readLineSpacing()`、`applyLineSpacing()` |
| 特殊内容保护 | 不清空出版物 CSS；不覆盖表格、代码、公式、SVG、Ruby 子树中的正文块。若这些子树位于被覆盖段落内，保留其原本计算行高；字号变化时从原书值重新计算。标题保留原样式与字号比例 | `readingTypography.ts`，`ordinaryBlocks()`、`protectedContent`、`applyLineSpacing()` |
| 行宽 | 范围 320–800px，步长 40px；在现有页边笔记几何中传入首选正文宽度。显示有效宽度，受限时通过 title／可访问文本说明首选值；减号从实际宽度减，空间不足时禁用加号 | `src/client/features/layout/marginNotesLayout.js`，`marginGeometry()`、`applyMarginGeometry()`；`layoutController.js`，`readingWidth`；`readerController.ts`，`changeReadingWidth()`、`refreshReadingSettingsControls()` |
| 当前会话 | 行距覆盖与首选宽度保留在现有控制器实例中；切换章节继续使用。刷新重新采用原书行距及默认首选宽度 560px，不新增 localStorage、数据库字段或偏好优先级 | `ReaderController.lineSpacingOverride`、`LayoutController.readingWidth` |
| 分页和阅读位置 | 两项控件的同帧连续调整合并为一次布局；沿用当前章节测量、图片适配、翻页和页码显示。捕获原文字符偏移，重排后恢复其所在屏幕／滚动位置，不改写源章节或标注坐标 | `readerController.ts`，`queueReadingSettingsLayout()`；`chapterColumnView.js`，`captureReadingPosition()`、`restoreReadingPosition()` |
| RTL／竖排 | 保留原 direction／writing-mode；竖排步长仅在启用行距覆盖时读取当前正文列间距，不改变未覆盖时的原逻辑 | `src/client/features/reader/readingAxis.js`；`readingTypography.ts` 中 `--aura-reading-line-height` |
| 固定版式与小高度面板 | 当前章节为 Fixed Layout 时禁用四个按钮，保留原 viewport／固定坐标／整页缩放；流式章节恢复会话值。面板高度受窗口限制，内部可滚动到原有底部控件 | `readingSettingsUnavailable()`、`applyMarginGeometry()`；`workbench.css` 中 `#appearance-panel` |

以上是代码实现范围，不等同于对所有出版物的兼容性保证。

## 2. 与本功能直接相关的定位处理

实书验证发现，部分原书 CSS 下，原有句子锚点的分页恢复会落到相邻屏。新增控件因此使用原文文本偏移作为短期定位信息，恢复包含该字符的屏幕；Scroll 模式同时恢复字符相对视口的纵向位置。Range 仅在 reader 内部临时使用，不传给 React、不持久化。

该路径仅用于本次两个新控件；字号、字体、目录、Goal 链接等仍使用原来的入口。原 `readTopLeftSentence()` 的裁剪矩形计算抽成共用函数，原行为不变。未捕获到可见文本时沿用原有句子锚点作为回退。

原分页锚点会克隆段落。排版覆盖的临时节点标记让这些克隆在后续重排中也能恢复原书行高，防止把上次覆盖值误认为出版物样式。标记及计算样式仅存在于阅读投影，不写回 Book 或原 EPUB。

## 3. 已通过的验证

构建和自动检查：

- `npm run build`：严格 TypeScript／契约检查和生产 Web 构建通过。
- `tests/regression/test_reading_settings.js`：同帧重排合并、行距边界、原书 inline 优先级恢复、分页克隆、特殊内容、原标注节点／数据、受限行宽、Fixed Layout／RTL／竖排切换通过。
- `tests/unit/test_fonts.js`：原字体选择、回退、导入持久化、菜单及 EPUB 语言解析通过；仅把原五行设置面板的断言改为七行。
- `tests/regression/test_reader_runtime.js`：React／reader 隔离、选区、链接、高亮、布局、卸载／重挂载通过。
- `tests/regression/test_page_layout_system.js`、`tests/regression/test_immersive_notes.js`、`tests/unit/test_chapter_flow.js`：原模式、响应式几何、页边笔记、章节分页和标注跳转兼容检查通过。

用户在内置浏览器接口不可用后明确授权改用 **ego 浏览器测试网页版**。没有运行桌面应用测试。浏览器中的实际交互结果：

| 场景 | 已观察的结果 |
| --- | --- |
| 《创新与企业家精神》打开设置 | 打开前后正文文本及 body inline 样式完全一致；初始值按章节读到原书 1.75×／2.00×，没有强行套用设计示例 1.85× |
| 实书正文分页 | 16px 正文从 32px 行高变为 32.8px，宽度从 560px 变为 520px，屏幕页数随布局更新；源章节及 8568 字符的正文不变 |
| 最终原文位置恢复 | 分别测试行距、行宽变化；原文偏移 5335、5225 对应的字符在调整后仍可见。未把“首句必须不变”当作分页重排的错误验收条件 |
| Scroll 位置 | 两项调整前后的同一源字符，相对视口纵向位置变化均约 0.29px；无残留横向分页位移 |
| 旧标注／Goal／页边笔记 | 最终实书复查保留 12 个唯一标注 ID、正文和 Goal 内容；旧 Goal 笔记链接仍跳到原文，两条原笔记继续显示在正文右侧；分页实例仍只有一个 |
| 原有控件 | Tab、Enter、Space 能操作新增步进按钮；焦点为原稿要求的深色描边。Book font／Literata 切换和 More fonts 菜单可用；测试后恢复原 Literata 选择及 Page 模式 |
| 窄窗口 | 1258 × 420 的 Web 视口中，首选 560px 显示为实际可用 441px，加号禁用；减号立即减到 401px；面板内部可滚动并实际点击 Scroll／Page |
| 代码／MathML／Ruby／表格／标题 | 定向样书的普通正文由 32px 变为 33px，其他保护对象的字体／内部行高不变；字号从 20px 调到 21px 时，代码原书行高按字体比例从 28.8px 变为 30.24px，没有冻结旧像素值 |
| 书内跨章链接 | 在实际 pointer 点击下跳到 Arabic RTL 章节；方向仍为 rtl，翻页偏移为负，行宽及行距可继续调整 |
| 竖排 | vertical-rl、原文、Ruby 的 32px 内部行高保持；正文列间距从 34px 变为 35px，步长随有效宽度从 442px 变为 385px |
| Fixed Layout | 四个按钮禁用；保留 600 × 800 viewport、100px／200px 固定坐标、40px 原行高及整页缩放；正文宽度覆盖暂停，回到流式章后恢复 |
| 图片与上下限 | 800 × 1200 SVG 在 480px 阅读宽度下完整显示为 480 × 720，底部在视口内且只有一屏；增宽至 800px 后仍是一屏。2.40×／800px 上限和 1.20×／320px 下限均显示正确并禁用相应按钮 |
| 会话及测试清理 | 浏览器刷新后恢复原书 1.60× 和默认 560px；临时 QA 样书已通过应用界面移除，书库回到原来的 9 本书，未操作用户书籍的删除 |

本机证据在忽略目录 `.commandcode/reading-controls-20261113/`：`source-position-final.json`、`scroll-position-final.json`、`special-content.json`、`layout-boundaries.json`、`note-link-final.json`、`reading-settings-final.png`、`short-window.png`。目录中的分轮脚本和失败尝试保留为调试记录，以上最终证据覆盖已修正的问题。长期交付以本文、需求文档及源码为准。

## 4. 验证边界

- 未进行桌面版运行、安装包、安装、发布或合并主分支。本轮产物是当前分支源码与 Web 构建；没有引入依赖。
- 仅验证上述实书及一份五章节定向样书，不代表复杂混合样式、所有竖排／RTL 分片、完整 W3C 测试矩阵或所有阅读辅助软件均通过。
- 原位笔记回归脚本曾运行并退出 0，但既有换书 mock 输出 `this.reader.getFirstPage is not a function`；未修改这部分无关测试。真实的笔记链接与重排验证以上述浏览器记录为准。字体单元测试也有既有 React `act()` 警告，断言通过。
- 没有增加跨会话或单书持久化、CSS 全局模式、段距、媒体功能、图片解码预算或其他 P2 优化。
