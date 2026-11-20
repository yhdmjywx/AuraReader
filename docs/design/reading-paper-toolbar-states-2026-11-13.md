# Paper 与阅读工具栏背景状态

日期：2026-11-13。范围：Figma 设计补充、外层 Paper 背景接入及 Web 验收。

## 设计决定

用户确认在现有 Reading Interface 旁补充 Paper 与工具栏的对照状态，不另建模块。原始白色界面、工具栏主组件、字体、正文内容及布局保留。

- 工具栏隐藏时仍占用 52px，控件及工具栏自身背景透明，后方工作区使用当前 Paper 底色。
- 工具栏显示时恢复现有工具栏外观；工具栏背景、图标及文字维持原界面主题，不随书籍 Paper 整体变成深色。
- 两个状态的阅读视口起点均为工具栏下方 52px，正文位置不移动，不因显隐重新分页。
- 沿用现有鼠标进入顶部区域显示、离开隐藏，以及键盘焦点／弹出面板打开时保持可见的交互规则。没有新增 Paper 选项、偏好系统或另一套工具栏。

这份补充针对外层工具栏后方的背景，不是 EPUB iframe 内部上下白条的再次修复。

## Figma 状态

文件为 **Product UI Extraction — Goal & Reading**，位置为 **01 - Screens**，新增四张可编辑完整界面对照稿，位于原稿右侧。米色一行、深色一行，左侧隐藏、右侧显示。

| 状态 | 新画板 | 工具栏实例 |
| --- | --- | --- |
| Sepia Paper / Toolbar hidden | [388:1065](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=388-1065) | `388:1069`，复用 Rest |
| Sepia Paper / Toolbar visible | [388:1194](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=388-1194) | `388:1198`，复用 Visible |
| Dark Paper / Toolbar hidden | [388:1325](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=388-1325) | `388:1329`，复用 Rest |
| Dark Paper / Toolbar visible | [388:1454](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=388-1454) | `388:1458`，复用 Visible |

当时的复制来源为 [Reading Interface](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-129) 与 [At rest](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-278)。四张对照画板及其原有组件实例链接现保留在 [Reading Interface / Archive](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=424-1893)。原主画板已迁移为 [沉浸式阅读默认态](design-index.md#immersive-reading-toolbar-and-right-side-tools)。

颜色采用当前 Paper 渲染值：米色背景 `#fbf0d9`、正文 `#433422`；深色背景 `#121827`、正文 `#d1d5db`。新增四个限定于新画板使用的颜色变量：`reading-paper/sepia/background`、`reading-paper/sepia/text`、`reading-paper/dark/background`、`reading-paper/dark/text`。变量分别限制背景／形状填充或文字填充用途，未改变现有 `bg-paper`、`bg-paper-text` 等变量的值或模式。

## 验证及边界

- 图层检查：每张画板保留 24 个可编辑文字节点、40 个组件实例；文字内容及各文字段的字体与对应原稿一致。
- 几何检查：画板均为约 1850.67 × 1049.14；工具栏均高 52，隐藏／显示透明度分别为 0／1；阅读视口 y 均为 52；正文相对视口位置均为 x=467.625、y=32，尺寸 560 × 917.14。
- 已通过浏览器截图检查四个状态：隐藏区域与阅读背景连贯，显示状态保留白色工具栏，未见新增文字重叠或裁切。画布另有两行行为说明。
- Figma MCP 因 Starter 调用额度限制无法读写；内置浏览器打开文件后，对脚本插件内嵌编辑器的点击失败。最终通过此前授权的 Ego 浏览器，在 Figma Scripter 插件界面执行有范围的复制与覆盖，完成图层检查及视觉检查。
- 设计阶段没有新增可运行的 hover 原型连接；显隐规则以上述设计说明及两组对照稿表达。应用接入及运行时验证见下节；没有进行桌面测试。

本机证据位于忽略目录 `.commandcode/figma-paper-states-20261113/`：`states.json`、`create-output.txt`、`paper-toolbar-final.png`。状态链接与本文作为后续实现依据。

## 应用接入与 Web 验收

用户随后授权按上述四张状态稿实现，悬浮覆盖为可选项。本次沿用设计稿的 52px 预留区域，避免改变阅读视口及分页几何。

代码变更仅在 `src/client/styles.css` 的现有 Paper 配色规则：当工作区的直接 reader-panel 子节点为米色或深色时，工作区使用同一条 Paper 背景声明。隐藏工具栏后便露出当前 Paper，显示时仍由工具栏自己的应用背景覆盖。沿用现有 hover、键盘焦点及 aria-expanded 规则；没有新增状态、动画、计时器或偏好持久化。EPUB iframe 样式、分页算法、标注及业务模块没有在本次调整中修改。

已通过的验证：

- ChatGPT 内置浏览器，`http://localhost:5173/`，视口 1851 × 1049，对照四张 Figma 状态。米色／深色隐藏时工作区分别为 `rgb(251, 240, 217)`／`rgb(18, 24, 39)`，工具栏 opacity 为 0；鼠标进入顶部后 opacity 为 1，工具栏背景保持白色。白色 Paper 切回后工作区为白色。
- 《创新与企业家精神》源章节 14：改动前后及工具栏显隐前后，工具栏高 52px、正文 iframe 为 560 × 917、章节为 11 列、根节点留白为 `28px 0px 32px`，对应测量完全一致；正文文字及 12 个标注标识保持一致。
- 键盘 Tab 焦点及设置面板打开时，鼠标离开顶部后工具栏仍可见；Escape 关闭设置面板。分页前进至第 2 列时偏移为 560px，返回首列为 0。已有 Goal 笔记链接跳至第 7 列，正文高亮及两张对应页边笔记可见，没有写入或删除笔记。
- 滚动模式中，鼠标移入／移出工具栏时 opacity 为 1／0，显隐前后测量几何一致；完成后恢复 Page 模式，并清除临时浏览器视口覆盖。
- `npm run build` 通过；`node tests/regression/test_reading_settings.js` 通过。该自动回归覆盖已有排版与标注边界，工具栏实际显隐和配色以本次浏览器验证为依据。

本次没有进行桌面运行、打包安装验证或跨书籍兼容性全量测试。浏览器截图及测量记录保存在忽略目录 `.commandcode/paper-toolbar-implementation-20261113/`：`sepia-hidden.jpg`、`sepia-visible.jpg`、`dark-hidden.jpg`、`dark-visible.jpg`、`sepia-final.jpg`、`evidence.json`、`build.log`。
