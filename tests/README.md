# 测试范围与维护

`npm test` 依次运行语法检查、6 个单元测试脚本和 `regression/` 中的全部脚本。回归脚本自动发现，每个脚本失败必须以非零状态退出；不使用跳过项掩盖环境或产品错误。需要 Node.js >= 24.15.0。

SQLite 集成测试使用 `helpers/sqlite.js` 创建临时目录、真实 HTTP API 和真实 SQLite 文件，结束后仅清理自己的临时目录。不会连接日常运行的书库。`sqlite_child.cjs` 用于真实 Node.js 正常退出和强制终止测试。

## 本次清理的分类

| 分类 | 测试 | 处理与覆盖 |
| --- | --- | --- |
| 保留 | SQLite API、迁移、恢复、进程重启、备份恢复、Markdown 摘要、单章 Markdown、整书及所选章节文件夹导出 | 调用实际模块/API，比较完整对象和磁盘数据 |
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

## Electron 桌面测试

`npm test` 自动执行 `test_desktop_assets.js`、`test_desktop_storage.js`、`test_desktop_repositories.js`、`test_desktop_files.js` 和 `test_desktop_export_feedback.js`。覆盖资源响应、CSP/MIME、路径隔离、显式建库、命令校验、版本/幂等/删除、备份恢复和实际 Repository/SQLite 链路。Repository 测试把 fetch 替换为失败函数，确认桌面路径不使用 HTTP；在服务提交后注入丢失响应，验证重试原命令、恢复缓冲和错误 status/details；同时覆盖短暂启动失败后重试、快速输入、恢复成功解除关闭阻断和无恢复权限时仍阻止退出。文件测试使用真实临时文件与主进程对话框替身，验证大小限制、允许扩展名、字体哈希/持久化、保存/替换/取消/失败、目录保护、并发对话框与等待；反馈测试验证保存前无成功提示，多书备份按实际保存数量反馈并在取消/失败后停止。阶段 6 增加 `test_sqlite_faults.js` 后，当前完整计数为 46（6 个语法检查、6 个 unit 脚本、34 个 regression 脚本）。

`npm run test:desktop` 单独启动真实 Windows x64 Electron 主进程及可见原生窗口，不使用 headless/jsdom 替代桌面验收。除运行时 SQLite、安全隔离、资源/字体、主题与 CSP 外，还验证首次点击前没有数据库、实际 IPC 完整对象/冲突/重试/备份/恢复回滚、其他窗口和非精确 URL 的访问拒绝、真实编辑器输入落库、待写记录跨重载保留并阻止关闭、恢复补写和离线读取。最后不触发 input 事件地修改实际编辑器再关闭窗口，由关闭握手读取并保存最后内容；父进程重新启动一个新的 Electron 进程，从同一测试 profile 读取该内容作断言。截图等待绘制帧和主题过渡结束，并检查非空图像。

每次测试生成独立 `.commandcode/desktop-tests/run-*/`，其中 profile 和 runtime-storage 都只属于测试，results.json、failure.json 及截图用于诊断，不纳入 Git。它不读取或恢复日常书库，也不清理用户配置。桌面检查失败或超时返回非零；默认 `npm test` 通过不能代替该检查通过。图形测试需可用的 Windows 桌面会话；Codex 外层沙箱若不允许启动原生应用，需在允许原生进程运行的权限下执行，不允许加 `--no-sandbox` 绕过 Electron 隔离。

阶段 4 增加了真实 Electron 内的 EPUB/TXT 导入、系统字体读取与 FontFace 加载、四种导出实际文件、ZIP 解压核对、当前 `.aurabackup` 恢复、取消与错误提示、全屏和重启后的书籍/字体持久化。自动化测试在主进程注入对话框选择结果，不将它计为原生对话框操作；其他窗口和非精确 URL 访问文件/字体能力必须被拒绝。原阅读/标注和存储安全断言继续执行。

`npm run test:desktop:native` 是单独的交互验收，不能在无人桌面上自动通过。它不注入对话框替身，依次要求用真实系统对话框选择项目 `test.epub`、`literata.woff2`，将 Markdown 保存到终端打印的隔离输出目录，然后取消 ZIP 保存；完成后检查实际文件、SQLite 完整性和 UI 反馈，生成 `.commandcode/desktop-native/run-*/results.json` 与截图。失败或十分钟超时返回非零，不得改为跳过通过。本次已通过实际 Windows 操作完成该检查。

上述桌面文件测试使用本地源码和未打包 Electron；不能单独证明安装包验收通过。旧数据库桌面迁移已按用户要求移出范围，原浏览器测试保留。文件操作边界见 [阶段 4 记录](../docs/electron-desktop-stage4.md)。

阶段 5 增加 `npm run dist:win` / `npm run verify:package`：检查实际 app.asar 的 16 项必需资源、生产依赖、许可证、安全 fuses 和私有数据/测试/HTTP Server 排除，生成 SHA256 与 package-verification.json。安装验收使用 `npm run test:install`，它构建 1.0.0 候选包及仅供本地测试的 1.0.1 包，调用真实 NSIS 执行当前用户安装、升级、卸载、重装。脚本按稳定安装 GUID 检查 HKCU/HKLM；发现已有 AuraReader 安装就停止，不覆盖用户安装。递归卸载前核对注册路径精确属于本轮 `.commandcode/install-tests/run-*/AuraReader`，保留隔离 profile。

`tests/desktop/packaged.cjs` 从已安装的真实 exe 启动 Renderer，PATH 只保留 Windows 系统目录，验证包内运行时、字体/资源、IPC、SQLite 读写、幂等、在线备份、关闭前编辑保存、新进程重启，以及升级/重装后的完整对象、字体和偏好。字体文件是测试主进程写入当前测试 profile 的有效 WOFF2 素材，后续由实际打包 Renderer 加载，不将这项测试声称为原生字体选择操作。正常卸载前后比较全部 data 文件哈希。测试没有向安装包加入专用 IPC 或测试模块；外部 CDP 仅通过验收启动参数开启，不能视为产品依赖 localhost HTTP。结果和截图位于 `.commandcode/install-tests/run-*/`，完整 `npm test` 不包含这项另行运行的系统安装验收。

实际 NSIS 静默生命周期和已安装 GUI 程序通过不等于逐页点击安装向导或纯净无 Node 虚拟机已通过。额外普通窗口观察遇到 Computer Use 应用授权超时，仍记为未验证；签名、文件关联、系统强制关机与最终发布检查留待后续。最新证据见 [阶段 5 记录](../docs/electron-desktop-stage5.md)。

阶段 6 的 `test_sqlite_faults.js` 用真实 SQLite 的 `max_page_count`、`query_only` 和第二写连接产生 SQLITE_FULL、SQLITE_READONLY、SQLITE_BUSY，验证原错误、完整对象、版本与操作数量、同命令恢复及在线备份。它不是物理磁盘满或 Windows ACL 验收。

`npm run test:stability` 使用真实 Electron 可见窗口与独立 `.commandcode/stability/run-*/`。先验证页面关闭、崩溃页面关闭、模拟 query-session-end，再验证故障期间 journal 与关闭阻断、解除故障后重放、显式重载 Renderer 后恢复、128 章 EPUB 的原解析/导入/ZIP 导出、默认 300 秒持续写读及窗口/内存/计时数据。父进程在真实未提交 WAL 事务产生后终止测试主进程；新进程核对旧的已确认完整对象和操作数量、回滚未提交内容、校验数据库并在线备份。损坏样本单独阻断启动，不改变其字节。可用 `npm run test:stability -- 600` 改时长（30–3600 秒）；不把后台计时器、短时内存样本或模拟会话事件称为前台流畅性、无泄漏或实际系统关机验收。故障控制只在测试进程中获取服务引用，不增加生产 IPC。

`npm run test:packaged:stability` 验证已有 `release/win-unpacked` 的实际 hardened exe（先构建 dist:win），也可直接向 `node tests/desktop/packaged-stability.cjs` 传入安装目录。PATH 排除宿主 Node、模拟断网，以外部第二 SQLite 写连接检查保存失败/拒绝关闭和恢复；40 次已确认 Repository 写入后杀主进程并重开，检查完整数据、页面关闭末次原始输入、当前 SQLite 在线备份在新 profile 恢复，以及损坏库不重置。证据在 `.commandcode/packaged-stability/run-*/`。CDP 仅由测试启动参数开启，首屏仅重试导航引起的 execution-context 销毁，其他错误和超时仍失败；未加入通用 IPC 或产品测试入口。

阶段 6 实际结果、性能界限与尚未通过的发布条件见 [验证记录](../docs/electron-desktop-stage6.md)。本轮仅验证和修复，不上传、推送、创建 Release 或发布安装包。

源码静态检查只用于明确的资源/结构约束（例如无独立笔记弹窗、红色 caret CSS、入口 DOM 引用），不要用函数名、源码片段或测试自写的算法代替行为验证。

## SQLite 收尾与侧栏清理验证记录（2026-10-19）

- 迁移收尾沿用上一阶段独立浏览器测试：旧书库、待写恢复、待删除生效、重载持久化；原 IndexedDB 记录仍保留。后续迁移修复由真实 SQLite 迁移/恢复测试覆盖，日常 Repository 不再调用 IndexedDB。
- 补验真实 Node.js 正常退出和强制终止后重启：完整书籍字段、大章节 HTML、已确认笔记均保留。恢复演练包含在线备份、拒绝缺失数据库的静默重建、从已验证备份恢复及从迁移快照重建。
- 侧栏清理前后在独立测试服务、合成 EPUB 书籍上对照浏览器排版：1613 × 928 下每栏 560px，间距 72px，总宽 1192px；正文位置和笔记锚点一致。1440px 仍为完整双栏并将笔记放右侧；1366px 为完整双栏和底部笔记带；1024px 临时单页，扩大后恢复双页。
- 浏览器另验单页、滚动、翻页/章节切换、当前屏笔记过滤、点击原位编辑、红色原生 caret、换行及 emoji 自动保存、重载重开；并只读查询实际 SQLite 文件确认输入一致、完整性为 `ok`、无外键错误。控制台无警告或错误，入口 DOM 引用无孤立项。
- 当前所有自动化脚本均执行，不设跳过项。系统输入法候选窗、物理断电及真实用户全部书库没有在本次测试中实测；合成 IME 事件通过不代表完成系统输入法实测。用户原存储和日常服务未被清理或切换。
