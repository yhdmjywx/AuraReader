# 测试范围与维护

`npm test` 依次运行语法检查、6 个单元测试脚本和 `regression/` 中的全部脚本。回归脚本自动发现，每个脚本失败必须以非零状态退出；不使用跳过项掩盖环境或产品错误。需要 Node.js >= 24.15.0。

SQLite 集成测试使用 `helpers/sqlite.js` 创建临时目录、真实 HTTP API 和真实 SQLite 文件，结束后仅清理自己的临时目录。不会连接日常运行的书库。`sqlite_child.cjs` 用于真实 Node.js 正常退出和强制终止测试。

## 本次清理的分类

| 分类 | 测试 | 处理与覆盖 |
| --- | --- | --- |
| 保留 | SQLite API、迁移、恢复、进程重启、备份恢复、Markdown/HTML/ZIP 导出 | 调用实际模块/API，比较完整对象和磁盘数据 |
| 保留 | `test_inline_notes.js`、`test_visible_notes.js`、`test_mini_tooltip_interaction.js`、`test_immersive_notes.js` | DOM 事件、原位编辑、合成 IME 事件、焦点与光标、可见范围、独立删除、页边定位 |
| 改造 | `test_unified_note_editing.js` | 替换源码搜索和自写模拟：创建、输入中自动保存、服务重启后重开、编辑和删除，均经过实际控制器与 SQLite |
| 改造 | `test_selection_fix_verification.js` | 实际左右页 mouseup/touchend 与 click 冒泡，不再要求门面内存在空监听器 |
| 改造 | `test_page_layout_system.js` | 实际 LayoutController 按钮、模式偏好、降级恢复及 ReaderEngine 翻页边界，替换旧侧栏的自写状态机 |
| 改造 | `test_toc_drawer.js`、`test_cross_paragraph_highlight.js`、`test_annotation_colors.js` | 实际目录点击和导航、DOM 跨段范围及格式保留、领域类型/过滤与重叠标记 |
| 改造 | `test_html_and_dom_audit.js` | DOM 引用检查指向实际入口 `main.js`，保留 HTML 结构和已移除功能的静态检查 |
| 删除 | `test_selection_event_flow.js` | 只有诊断日志，没有断言；选区事件由实际事件测试覆盖 |
| 删除 | `test_advanced_highlight_engine.js` | 自写旧高亮算法且无失败断言；跨段、格式标签和 emoji 由真实渲染/持久化测试覆盖 |
| 删除 | `test_separated_highlights_and_notes.js` | 自写过滤逻辑与过时卡片断言；实际过滤、当前页显示和高亮/笔记独立性已有领域及集成测试覆盖 |

DOM 测试通过 jsdom 执行真实产品事件和模块，只为不可用的几何 API 提供矩形数据。它不能代替真实浏览器排版、系统输入法及原生光标的检查。涉及视觉布局或焦点交接的修改，仍需浏览器回归。

源码静态检查只用于明确的资源/结构约束（例如无独立笔记弹窗、红色 caret CSS、入口 DOM 引用），不要用函数名、源码片段或测试自写的算法代替行为验证。

## SQLite 收尾与侧栏清理验证记录（2026-10-19）

- 迁移收尾沿用上一阶段独立浏览器测试：旧书库、待写恢复、待删除生效、重载持久化；原 IndexedDB 记录仍保留。后续迁移修复由真实 SQLite 迁移/恢复测试覆盖，日常 Repository 不再调用 IndexedDB。
- 补验真实 Node.js 正常退出和强制终止后重启：完整书籍字段、大章节 HTML、已确认笔记均保留。恢复演练包含在线备份、拒绝缺失数据库的静默重建、从已验证备份恢复及从迁移快照重建。
- 侧栏清理前后在独立测试服务、合成 EPUB 书籍上对照浏览器排版：1613 × 928 下每栏 560px，间距 72px，总宽 1192px；正文位置和笔记锚点一致。1440px 仍为完整双栏并将笔记放右侧；1366px 为完整双栏和底部笔记带；1024px 临时单页，扩大后恢复双页。
- 浏览器另验单页、滚动、翻页/章节切换、当前屏笔记过滤、点击原位编辑、红色原生 caret、换行及 emoji 自动保存、重载重开；并只读查询实际 SQLite 文件确认输入一致、完整性为 `ok`、无外键错误。控制台无警告或错误，入口 DOM 引用无孤立项。
- 当前所有自动化脚本均执行，不设跳过项。系统输入法候选窗、物理断电及真实用户全部书库没有在本次测试中实测；合成 IME 事件通过不代表完成系统输入法实测。用户原存储和日常服务未被清理或切换。
