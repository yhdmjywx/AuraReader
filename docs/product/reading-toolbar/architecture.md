# 紧凑顶栏与目录浮层代码设计

视觉以 [Figma 默认态](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=394-1551) 和 [目录展开态](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=394-1742) 为准。功能和验收见 [项目需求](feature-spec.md)。

## 布局与状态

- `WorkbenchShell` 挂载独立的 `ReadingToolbar`。短栏使用现有的 Button、书名 ID、分页节点和各操作入口，供现有控制器绑定。样式保留 Figma 的 52 px 顶部布局区，内部显示 36 px 短栏，因此开关目录不会改变 reader 的布局。浏览区在 Goal 侧栏开合和窗口尺寸改变时重新分配空间，短栏通过 CSS 随之定位。
- 目录浮层是短栏的绝对定位子元素，左外缘跟随短栏，最大高度受内容和视口约束。打开时列表覆盖正文，各章节继续由 `tocUI` 渲染，列表滚动局限在浮层内。窗口宽度不足时先压缩书名，再收紧固定控件间距。
- `ReaderController` 继续持有章节跳转命令。`tocUI` 同步浮层可见性和按钮的 `aria-expanded`。可跳转章节使用原生按钮，分组作为标题保留。键盘可从 `Contents` 进入章节列表。再次点击入口、点外部、按 Esc 或跳转章节时收起，焦点在浮层内时归还入口。正文 iframe 继续通过既有 reader 事件边界处理外部点击。

## 桌面窗口

Windows `BrowserWindow` 启用 Electron Window Controls Overlay，在原生窗口中提供最小化、最大化／还原和关闭。样式使用系统报告的安全区避开窗口按钮，顶部空白用作拖动区。原生关闭事件继续进入 `coordinateClose`，执行现有的保存确认。浏览器模式使用同一短栏，窗口由浏览器管理。参见 [Electron 自定义标题栏](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar)。

`src/desktop/entry.cjs` 是 Electron 的应用入口，调用 `main.cjs` 的 `startDesktop`。Electron 动态导入入口时直接启动应用。桌面测试仍可单独导入 `startDesktop`，以隔离的书库启动同一窗口。

## 源码验证

- 生产构建与 `npm test` 通过。79 项检查覆盖目录层级、章节导航、外部点击、键盘收起和焦点恢复。
- 在本地 Web 页面用实际 EPUB 检查目录开合、Tab 和 Esc、章节跳转、长列表滚动、560 px 和 600 px 行宽、Goal 侧栏开合以及翻页、书库、阅读设置和导出入口。
- 桌面阅读流程检查 36 px 短栏、左缘锚定、目录开合前后的阅读区域与页码、最小窗口下的安全区、书籍和 Goal 交互。Agent Desktop 实际操作原生按钮并核对最小化、最大化、还原、关闭状态。桌面关闭回归覆盖写入失败时阻止关闭及恢复后的保存退出。
- 使用 Electron 的项目目录入口启动隔离配置，确认初始书库界面显示且可通过原生关闭按钮退出。

## 现行沉浸式布局实现

- `ReadingToolbar` 专门绘制书名与翻页，`ReadingTools` 挂载右侧入口和浮层。两者共用阅读区的纸面颜色。绝对定位覆盖层与正文视口并列，使用阅读工作区的高度对齐浮层和工具组。52 px 顶部区继续承担阅读视口定位。
- 现有目录、书库和阅读设置控制器负责各自的命令与展开状态。`main.ts` 接入互斥关闭及阅读文档的点击事件。三个右侧浮层共用 CSS 高度上限，取 360 px 和阅读区高度减 16 px 中的较小值。字体菜单共用阅读设置的滚动区，并在 Escape 时先返回字体入口。
- `WorkspaceSettings` 挂载 `Export book` 折叠区域及现有导出控件，关闭时通知 `AppShell` 收起导出区域。导出及章节选择逻辑继续复用原控制器。章节列表保留内部滚动，展开导出时 Settings 也按可用空间限制自身高度。
- Paper 颜色通过阅读区的 CSS 变量覆盖相应层。Windows 渲染器经受限 IPC 更新原生按钮前景色，窗口安全区与拖动由 Window Controls Overlay 提供。关闭仍进入统一的 `coordinateClose` 保存流程。

[现行 Figma 阅读画板](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=424-1892) · [沉浸式组件](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=419-4306)

### 沉浸式布局首次上线验证

- 生产构建与 `npm test` 通过，79 项检查全部通过。Windows 阅读流程和两种关闭保存流程在同一构建上通过 `node scripts/test-desktop.cjs` 验证。
- 内置浏览器使用实际 EPUB，确认四个浮层宽 210 px、距工具组 7 px、中线重合且互斥。验证了目录 Tab 与 Escape、点击正文关闭、字体搜索和逐层 Escape、章节导出长列表、三种纸面、390 px 和 640 px 视口以及 Goal 侧栏开合。正文调至 600 px 后开合浮层，正文几何和页码保持稳定。
- 在 800 × 600 的 Windows 测试窗口测量原生窗口按钮安全区。使用 Agent Desktop 在隔离书库中实测最小化、最大化、还原与原生关闭，并确认进程退出。写入受阻时的关闭与恢复由桌面回归覆盖。

### 浮层限高与导出入口迁移验证

- 用真实 EPUB 验证目录和书库浮层均在 360 px 封顶，阅读设置按内容高度显示。三个浮层宽 210 px，距工具组 7 px，中线重合。长目录可在面板内滚动，收起前后正文几何和页码一致。
- 在应用 Settings 进入 `Export book`，验证笔记摘要、章节入口与 68 项章节选择列表。逐层按 Escape 可收起并返回触发入口，重新打开 Settings 时导出区域默认收起。生产构建及 `npm test` 的 79 项检查通过。
- Windows 桌面阅读流程通过，覆盖 Settings 内的章节选择与备份入口。两种关闭保存场景也通过。
