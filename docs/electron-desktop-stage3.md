# Electron Windows 桌面迁移：阶段 3 SQLite 与 IPC

日期：2026-10-23（Asia/Shanghai）。起点：阶段 2 提交 `123e3f9`。本阶段只实施 SQLite/IPC 与其必需的启动、恢复及关闭协调，未进入阶段 4。

## 修改与行为

桌面现在复用现有 main.ts 装配、Repository、阅读/标注引擎与 SQLite 服务。首次启动先提示原浏览器书库尚未迁移，用户点击“创建独立桌面书库”后，才创建数据库并使用原有示例书/示例标注。创建前访问书库返回 423，不假装已有一个空书库。已有独立桌面书库重开时直接读取，不重复植入种子数据。

数据库位于 `app.getPath('userData')/data/aurareader.sqlite`，普通 Windows 路径为 `%APPDATA%\AuraReader\data\aurareader.sqlite`；标记、迁移原始快照、数据库在线备份都在同一 data 根内。桌面不打开项目 data/，不复制或清理浏览器 IndexedDB/localStorage，不读取浏览器 profile。未知目录、缺失/空数据库、已建立书库的更高 schema 版本仍会阻断，不能静默重置。

| 文件 | 修改与设计 |
| --- | --- |
| src/shared/desktop.ts、client/app/browser.d.ts、desktop/desktop.d.ts | 具体能力、结果信封、状态与生命周期的类型契约；不提供任意频道、SQL、Node 或文件路径能力 |
| src/desktop/storage.cjs | 从主进程注入目录，延迟建库；调用原 createDataStore/createMigration/backupDatabase；校验命令字段、无损 JSON、大小和版本信息 |
| src/desktop/ipc.cjs | 逐项注册固定频道；校验登记窗口、顶层 senderFrame 与精确 APP_URL；结构化返回 message/status/details；关闭请求带随机 ID 和对应 frame |
| src/desktop/preload.cjs | 只暴露具体读写、初始化、备份/记录恢复函数，以及去除 Electron event 的关闭回调；频道均固定，不向页面暴露 ipcRenderer |
| src/desktop/main.cjs | 从 userData 派生数据根，注册 IPC/关闭协调；窗口真正关闭后移除 handler、关闭数据库 |
| src/client/infrastructure/storageClient.ts | 桌面选择具体 IPC 能力，浏览器仍走原 HTTP；保持 Repository 队列和版本表；运输异常重试同一命令，业务错误不盲目重试，短暂启动失败可重试 |
| src/client/desktop.ts、desktop/renderer/shell.js / shell.css | 独立桌面启动与显式建库 UI；确认后导入原装配；禁用阶段 4 未接入入口；关闭前等待编辑器、写队列并严格检查剩余恢复缓冲 |
| src/client/features/annotations/annotationController.ts | 记录自动保存失败，提供关闭前检查；有恢复缓冲的操作经 Repository 确认补写后解除阻断，没有可靠缓冲的失败仍阻止退出；现有提示保留 |
| src/client/infrastructure/annotationRepository.ts | 包装错误时继续保留 details，避免 IPC 业务信息在第二层丢失 |
| src/client/features/reader/fontController.js | 桌面不访问尚未提供的 HTTP 字体服务；本地内置字体继续使用，系统/导入字体留在阶段 4 |
| src/server/dataStore.d.ts、migration.d.ts、storageMaintenance.d.ts | 给复用的 JS 服务补公开类型边界；原 JS 实现、schema 和运行行为未修改，未降低桌面 strict/checkJs 检查 |
| tests/regression/test_desktop_storage.js / test_desktop_repositories.js、tests/types/contracts.mts | 存储/恢复/关闭与类型契约回归，自动纳入现有测试 |
| tests/desktop/main.cjs / storage.cjs / restart.cjs、scripts/test-desktop.cjs | 真正的 IPC、窗口、DOM 编辑和新进程重启验证；保留阶段 2 的安全与资源检查并适配当前功能状态 |
| README.md、tests/README.md、本文 | 使用方式、结果、风险与阶段边界 |

桌面主题切换后调用原 positionMarginNotes 更新笔记颜色，修复截图发现的旧颜色残留；没有改动排版算法或原文/范围数据。

## 存储与安全不变量

- 保留 SQLite user_version=1、WAL、FULL 同步、外键和 BEGIN IMMEDIATE 事务。书籍/标注仍保存完整 JSON 和未知字段，章节 HTML 与 UTF-16 位置不重写。
- 保留 opId + canonical hash 去重、expected revision 冲突、generation 屏障、删除墓碑和恢复事务。前端原 pending/prerequisites 队列继续管理提交不确定时的同命令重放，没有整书双写缓存。
- 初始化复用原 migration 快照/校验机制，使用固定独立来源 `aurareader-desktop-v1` 记录明确创建；它只表示新桌面库的初始化，不表示浏览器数据已经迁移。初始化中断后如库尚无业务数据，只能再次明确点击继续；非空的其他来源数据库不会自动接管。
- 主进程验证命令顶层字段；记录内未知 JSON 字段继续保留。请求上限沿用 256MB；拒绝 undefined、Date、非有限数、循环引用、稀疏数组等无法无损保存的输入，过深嵌套返回 400。大小校验在 IPC 接收后执行，不声称避免了 Chromium 对大消息的复制成本。
- 每个 IPC 调用都验证 sender 与顶层 frame 的身份及完整 URL。错误使用普通数据信封，避免 Electron Error 传输丢失 status/details。Renderer 不能提交 sourceId、快照路径、SQL 或通用 action/channel。
- 内部在线备份输出到受控 backups 目录，仅返回文件名和校验结果；记录恢复仍是现有原子 restore。它们是服务能力，原生备份导出/导入 UI 尚未接入，不能据此声称阶段 4/5 已完成。
- 保留 nodeIntegration=false、contextIsolation=true、sandbox=true、webSecurity=true、CSP/导航/权限限制。IPC 按 [Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security)及 [ipcMain](https://www.electronjs.org/docs/latest/api/ipc-main)/[contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) 的边界实现。

## 关闭与恢复

主进程在关闭事件中先阻止窗口退出，向受信任页面发送带随机 requestId 的关闭请求。Renderer 暂停交互，完成实际内联编辑、等待队列与失败检查，并检查所有 pending 缓冲。只有均确认成功才回复；主进程还等待正在执行的本地服务调用完成，再允许关闭并释放 SQLite。

失败、仍有 pending、过期/伪造回执或超时都不授权退出。失败不清除缓冲，不强行增加版本，不静默以新内容覆盖冲突。恢复成功后由原 Repository 的确认机制移除对应 pending，关闭检查随之解除。冲突解决向导没有在本阶段实现，遇到 409 仍需保留现场和输入，不得清站点存储或重置数据库。

此握手只覆盖正常关闭。系统强杀、断电、Renderer 崩溃和操作系统关机会留待稳定性阶段验证，不能把正常关闭通过当成这些情况已经通过。

## 实际检查及证据

| 检查 | 结果与范围 |
| --- | --- |
| `npm test` | 在具备本机回环连接权限的执行环境通过：`Checks: 43, failed: 0`；6 语法、6 unit、31 regression，不删除或跳过原测试 |
| 严格类型与构建 | `npm run typecheck`、`npm run build` 均退出码 0；桌面 checkJs/strict 及新增编译期错误契约均执行 |
| 收尾定向回归 | 收尾修复后重新构建，运行 test_desktop_storage、test_desktop_repositories、test_inline_notes，均通过；启动重试补充断言也在重新构建后的 Repository 回归中通过 |
| 存储边界 | 显式建库前无目录/数据库、重复/并发初始化不重复种子、JSON 完整对象、CAS/幂等/墓碑/generation、校验、在线备份、恢复失败全部回滚、缺库/未知目录阻断均通过 |
| Repository 回归 | fetch 被设为失败函数，桌面读写仍通过；服务提交后丢响应安全重试、不丢 status/details、30 次快速输入、补写、恢复后解除阻断及无缓冲失败阻断均通过 |
| 真正的 Electron | `npm run test:desktop` 最终退出码 0；Electron 45.0.0 / Node 24.22.0 / SQLite 3.53.4 / win32-x64 |
| 真正的 IPC | 完整书籍/笔记往返、同 opId 重放/冲突、缺失或额外字段拒绝、备份、原 restoreRecords 成功恢复完整对象及失败回滚、伪造关闭拒绝；其他窗口及非精确 URL 返回 403 |
| 真正的 DOM 与文件 | 原 Coordinator 打开测试书，真实 textarea input 经 Repository → preload → IPC → SQLite；只读查询实际数据库核对换行、emoji 与未知字段 |
| 恢复与关闭 | 手动构造的不确定提交 journal 在重载后保留，并阻止关闭；原 Repository 成功补写后才清理；最后直接修改编辑器但不触发 input，再关闭窗口，由握手保存 |
| 新进程持久化 | 父进程在第一进程正常退出后启动全新 Electron 进程、使用同一测试 profile，读取并验证关闭前的最后输入；restart-results.json 为 passed/closeFlushPersisted=true |
| 原安全回归 | Node 未暴露、桥冻结、CSP、框架/localhost/file/弹窗/导航拦截、离线读取、资源/API 路由隔离及正常退出继续通过 |
| 图形检查 | 亮/暗截图已实际读取并人工检查，主题后的笔记颜色另有断言；截图为真实 Renderer 内容，不包含 OS 标题栏 |

GUI 最终证据：`.commandcode/desktop-tests/run-J4xKRp/`，包含 results.json、restart-results.json 和 shell-light.png / shell-dark.png；只使用该目录下的测试 profile/data 与 runtime-storage。原日常书库及普通桌面 profile 未被修改。SQLite 重启基线仍有原 Node 强杀测试，但本阶段没有对 Electron 做强杀验收。

环境与测试失败处理：外层沙箱的回环连接返回 EACCES，按约定只在所需权限下重试一次后完整回归通过；没有改端口策略、关类型检查或修改环境配置。新增测试最初试图从 executeJavaScript 返回含函数的桥对象，Electron 拒绝克隆；已改为检查桥的键和只读元数据，不向测试返回函数本身。测试中的故意保存拒绝和恶意 iframe 会产生预期错误日志，对应行为均有断言，不吞错判通过。

## 验收与下一阶段

阶段 3 验收满足：受限 IPC 与原 SQLite 服务已接入，数据根在安装目录外，浏览器基线保留，真实编辑落库、恢复、关闭等待、新进程重启与安全检查有实际运行证据；作为独立 Git Commit 提交。本阶段没有建立新的 UI 框架或重写阅读/标注/导出业务。

仍未交付/验证：系统字体枚举及字体导入、原生书籍文件选择、Markdown/HTML/ZIP/书籍备份的桌面原生保存与取消、旧浏览器或项目 data 迁移、数据库文件恢复 UI、完整离线 EPUB/ZIP、真实恶意 EPUB/备份、系统输入法、磁盘满/权限失效、长时与大消息性能、Renderer/系统强制终止、NSIS 安装升级卸载。当前只开放独立示例书库及其阅读/标注链路，不声称已是完整桌面产品。

阶段 4 前置条件：

1. 复核 fontStore/FontController、AppCoordinator 文件导入、exporters 和 BackupController 的实际调用及现有产物测试；继续使用当前 IPC 身份检查、数据根和关闭握手。
2. 字体与文件能力逐项暴露，主进程负责原生选择/保存及路径控制，保留原解析和内容生成；将取消、失败、真正写入成功传回 UI，不提前显示成功。
3. 字体二进制通过受限资源地址加载；补齐离线 JSZip 和必要资源/许可，验证不会回落到 localhost。
4. 验证实际 Windows 对话框、内容/范围不变、真实产物和现有浏览器回归；旧书库迁移和安装打包继续留在阶段 5。
