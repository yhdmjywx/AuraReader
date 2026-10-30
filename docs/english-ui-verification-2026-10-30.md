# 产品文案统一英文：实现与验证

日期：2026-10-30。用户确认范围：完整统一产品英文，解除显示文案与逻辑的耦合，保持现有布局。

## 实现范围

- 工作台、Goal 首页与共享编辑器、书库、阅读设置、选区及笔记操作、备份与导出使用英文。
- 覆盖 Tooltip、无障碍标签、占位文字、动态数量、保存反馈、冲突与恢复提示、启动和关闭异常。
- 本地服务及 Electron 的应用错误、应用提供的文件弹窗标题和类型说明统一英文。
- 页面 `lang` 改为 `en`。新生成的导出说明、默认文件名、目录名、索引链接使用英文；日期说明显式采用英文格式。
- 阅读器正文节点显式沿用书籍语言；未知语言设为空值，避免继承英文应用界面的语言。原文自身的语言标记仍保留。
- 新笔记时间继续使用本地数字时间字符串，通过明确字段格式化，移除 `zh-CN` 格式化后截取字符串的做法。历史时间不解析、不改写。
- 保留书籍、章节、引文、读者 Goal、笔记、导入名称与历史值。示例书正文与示例笔记保留原文。
- 未增加多语言依赖、切换入口、数据迁移或存储字段变更。

## 解除文案耦合

1. `fontCatalog.ts`：字体回退通过稳定字体 ID 判断，不再比较显示分组。测试修改分组名，确认字体及加载列表不变。
2. `exporters.js`：生成未归属笔记文档时保留对象引用，单章导出直接合并该对象；不再按显示文件名反查。索引链接从同一文档对象的文件名生成。

与本次变更直接相关的修复：应用根语言变为英文后，阅读器显式声明书籍自身语言，避免未标记的中文正文被继承为英文；不更改书籍元数据或原文节点内容。

源书的中文卷名、前言、附录等识别正则属于内容解析，继续保留。它们没有依赖应用的显示文案。

## 测试维护

同步更新界面文案、错误提示和生成文件名的断言。保留中文、混合语言、emoji、原始 HTML 及历史字段用例。

新增 `tests/unit/test_english_ui.js`，扫描生产代码中的字符串和 JSX 文案；排除原文示例、注释及内容识别正则，防止中文产品文案遗漏。另检查英文数量、确定性日期和用户内容、历史时间的保留。

单独修正以下测试夹具，未修改对应业务行为：

- `test_inline_notes.js` 为选区控制器传入阅读器节点，使其能按现有阅读器边界清除选区。
- `test_book_structure_export.js` 复用现有 React 工作台夹具并等待渲染，避免缺少 DOM 类型和渲染完成前查询节点。
- `native-dialogs.cjs` 适配当前 Vite 生产入口，取代已失效的固定模块路径；继续使用真实 Windows 弹窗。

## 验证结果

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过严格类型检查及 Vite 生产构建 |
| `npm test` | 66 项语法、单元及回归检查通过 |
| `npm run test:migration` | 16 项 React 集成检查通过 |
| `npm run test:desktop` | 当前桌面核心流程通过 |
| `npm run test:reading-workflow` | 最终文案版本通过：IME、保存、跨书回跳、字体和阅读设置、导出选择、备份选择、Goal 菜单、重载持久化 |
| `npm run test:desktop:native` | 真实 Windows EPUB 导入、字体导入、Markdown 保存、取消章节文件夹导出通过；隔离 SQLite 完整性为 `ok` |
| 英文文案扫描及内容保留 | 通过 |
| 最终迁移与缓存恢复定向复验 | 通过 |

日志位于本地忽略目录 `.commandcode/english/`。JSDOM 检查中仍有既有 React `act` 警告；测试以退出码和断言结果为准。真实 Electron 核心流程未记录 renderer 错误。

## 界面证据与布局

修改前、修改后均使用隔离测试书库、同一窗口尺寸与同一工作流。没有修改 CSS、组件位置、尺寸、间距、字体大小或断点；开始任务时已有的阅读设置样式与图标改动予以保留。

- 修改前：`.commandcode/desktop-tests/run-J3RTdQ/`
- 最终修改后：`.commandcode/desktop-tests/run-nxu32y/`
- 真实原生弹窗结果：`.commandcode/desktop-native/run-XY6dE3/results.json`
- 几何比较：`.commandcode/english/layout-comparison.json`

110 组界面区域几何比较中，109 组一致。全局设置浮层宽度仍为 300 CSS px，英文正常行高使自动高度减少约 1.52 CSS px，底部锚定不变；没有通过调整布局补偿字体度量差异。正文、阅读器容器、侧栏和阅读设置区域的几何值一致。

| 界面 | 修改前 | 修改后 |
|---|---|---|
| 首次使用 | [截图](../.commandcode/desktop-tests/run-J3RTdQ/home-welcome.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/home-welcome.png) |
| Goal 与书库首页 | [截图](../.commandcode/desktop-tests/run-J3RTdQ/home-library.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/home-library.png) |
| 阅读设置 | [截图](../.commandcode/desktop-tests/run-J3RTdQ/reader-settings.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/reader-settings.png) |
| 字体菜单 | [截图](../.commandcode/desktop-tests/run-J3RTdQ/reader-font-menu.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/reader-font-menu.png) |
| 全局设置 | [截图](../.commandcode/desktop-tests/run-J3RTdQ/workspace-settings.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/workspace-settings.png) |
| 书库浮层 | [截图](../.commandcode/desktop-tests/run-J3RTdQ/shelf.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/shelf.png) |
| 备份选择 | [截图](../.commandcode/desktop-tests/run-J3RTdQ/backup-selection.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/backup-selection.png) |
| 完整 Goal | [截图](../.commandcode/desktop-tests/run-J3RTdQ/goal-workspace.png) | [截图](../.commandcode/desktop-tests/run-nxu32y/goal-workspace.png) |

已检查截图中的英文排版和用户内容保留。基线与修改后截图中，章节导出展开区域都没有可见呈现，虽然脚本能够操作其选择节点；这是既有可见性问题，本次保持布局和行为，不据此宣称该区域的可视交互已验收。

## 边界与未验证项

- Windows 标准的打开、保存、取消按钮和系统导航随操作系统语言；实际中文 Windows 上仍显示中文。应用提供的标题和筛选说明已英文。
- 历史保存值、原书内容和示例内容可以包含中文，不代表产品文案遗漏。
- 本次验证源码和实际 Vite/Electron 入口，未生成、安装或发布新版安装包，也未运行长期压力、全部历史桌面专项或纯净系统验收。
