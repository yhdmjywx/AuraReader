# Electron Windows 桌面迁移：阶段 4 字体、书籍文件和导出

日期：2026-10-23（Asia/Shanghai）。起点：阶段 3 提交 `f6d1043`。本阶段只接入字体、书籍文件和导出，未实施 electron-builder/NSIS。

范围以用户本轮要求为准：保证当前 SQLite 正常运行，旧数据库无需支持。桌面不提供旧项目数据库、浏览器 IndexedDB 或旧 profile 自动迁移，不删除原存储或浏览器模式的既有能力。阶段 1–3 文档中“下一阶段将支持旧数据迁移”的描述为历史计划，由此范围替代。

## 模块审查与核心设计

开始实施前检查了现有 AppCoordinator.importBook → parseEpub/parseTxt → bookRepository → storageClient → SQLite 调用链，FontController → fontStore 的元数据及字体存储，exporters → BackupController 的四种内容生成与备份恢复，以及已有 EPUB/目录、选区偏移、Markdown/HTML/ZIP、字体、SQLite 和桌面回归。保留现有阅读、分页、标注和导出内容算法。

| 文件 | 修改与作用 |
| --- | --- |
| src/desktop/files.cjs、dialogs.d.ts | 主进程原生选择/保存服务；DI 只供主进程测试，不向 Renderer 提供路径或对话框替身入口 |
| src/desktop/ipc.cjs、preload.cjs、shared/desktop.ts | 固定 files/fonts/window 能力，结构化 saved/canceled/failed 结果；沿用登记窗口、主 frame、精确 APP_URL 身份检查，并在文件对话框/读取后重查身份 |
| src/desktop/main.cjs | 默认使用有父窗口的真实 dialog；派生 userData/data 和受保护目录；正常退出前等待正在进行的文件服务 |
| src/desktop/assets.cjs、package.json、package-lock.json | 从本地生产依赖提供固定版本 JSZip 3.10.1；桌面生成入口加载该资源；导入字体通过专用哈希地址提供，不增加 HTTP 服务 |
| src/server/fontStore.d.ts | 为复用的 fontStore 补类型边界；原 fontStore.js 未改写 |
| src/client/infrastructure/desktopFiles.ts、features/shelf/shelfController.js、app/contracts.ts、main.ts | 把系统选择结果构造为原 File 输入，交给原 Coordinator；浏览器继续使用原 input |
| src/client/features/reader/fontController.js | 桌面通过具体 IPC 枚举/导入字体；保留搜索、偏好、字体准备和回退逻辑；浏览器保留原 HTTP 路径 |
| src/client/infrastructure/exporters.js、features/backup/backupController.js | 保留内容生成，只切换下载出口；桌面等待实际磁盘写入，逐书保存并准确报告部分成功；当前书籍备份继续原 parseBackupFile/restoreRecords |
| src/client/app/appShell.ts | 桌面全屏通过单一窗口能力切换，浏览器保留原行为 |
| src/client/desktop.ts、desktop/storage.cjs | 去掉阶段 4 功能门禁及旧库迁移承诺；建库后恢复控件原有 disabled 状态，原书字体等未支持选项仍禁用；不清空未知数据库 |
| tests/regression/test_desktop_files.js、test_desktop_export_feedback.js、test_desktop_assets.js | 文件边界、真实临时磁盘、字体持久化、保存结果与批量反馈测试；保留浏览器入口及安全回归 |
| tests/desktop/main.cjs、storage.cjs、files.cjs、restart.cjs | 真实 Electron/IPC、原控制器、实际产物、SQLite 和新进程重启回归 |
| tests/desktop/native-dialogs.cjs、scripts/test-native-dialogs.cjs、package.json | 独立交互验收入口 `npm run test:desktop:native`；不注入原生对话框结果 |
| README.md、tests/README.md、本文 | 更新使用方式、证据、风险和下一阶段边界 |

## 文件与数据边界

- 书籍只选 EPUB/TXT，备份只选 `.aurabackup`，字体只选 TTF/OTF/WOFF2。主进程从原生对话框取得路径，校验扩展名、普通文件、非空和读取上限。书籍/备份 256MB，字体 64MB；读取过程中仍检查上限，防止文件增长绕过初次 stat。
- Renderer 只能收到文件名和字节，不能指定任意本机读取路径。保存请求只接受 filename 与 Uint8Array；输出扩展名限 MD/HTML/ZIP/aurabackup。文件名清理 Windows 非法字符与保留名；保存位置完全由系统对话框决定。
- 保存启用覆盖确认，拒绝应用/书库受保护目录、符号链接及非普通文件；在目标目录写入独占临时文件，sync、rename 后才返回 saved。取消不写入；异常保留现有文件并返回失败，不报告成功。每次只允许一个文件对话框。
- 多书备份逐个等待保存结果，取消/失败即停止后续保存；显示真实已保存 X/N。浏览器提示仅表示已发起下载，不声称已写入磁盘。
- 字体继续存放于 `%APPDATA%\AuraReader\data\fonts`，复用原 fontkit 格式校验和 SHA256 ID；资源仅允许已登记的哈希文件，校验真实目录和文件内容哈希。损坏资源不可读取，阅读器保留原字体回退逻辑。
- 当前 SQLite 仍位于 `%APPDATA%\AuraReader\data\aurareader.sqlite`。schema、完整 JSON、UTF-16 范围、版本冲突、opId 幂等、generation、原子恢复、WAL 和在线备份机制均未改变。未知目录、缺失/损坏数据库不会静默初始化。
- Electron 仍固定 45.0.0；本机实际运行 Node 24.22.0 / SQLite 3.53.4 / win32-x64。严格类型检查与 sandbox/contextIsolation/webSecurity 继续启用，Renderer 没有 Node、SQL、通用 IPC 或 shell 能力。

## 实际测试与结果

| 检查 | 实际结果 |
| --- | --- |
| `npm test` | 退出 0，`Checks: 45, failed: 0`，6 syntax + 6 unit + 33 regression；现有浏览器、阅读/标注、迁移和 SQLite 测试全部保留执行 |
| 严格类型与构建 | `npm run typecheck` 与多次 `npm run build` 退出 0；桌面 checkJs/strict 未放宽 |
| 收尾定向检查 | 增补覆盖替换文件和批量实际数量断言后，重新构建并执行 test_desktop_files、test_desktop_export_feedback，均通过 |
| 主进程文件服务 | 真实临时文件字节、取消、不支持类型/额外路径字段、大小限制、受保护目录、覆盖替换、缺失父目录失败、临时文件清理、并发对话框拒绝和 settle 等待均通过 |
| 字体 | 真实 WOFF2 导入/重新打开、哈希协议读取、未知/篡改字体拒绝；Windows 系统字体枚举及 Chromium FontFace 离线加载通过 |
| 导出反馈 | 保存完成前无成功提示；取消、失败和实际 1/3、0/3 数量断言通过；取消/失败后不继续弹框 |
| `npm run test:desktop` | 最终退出 0，真实可见 Electron 窗口、SQLite 运行时、IPC、离线导入/导出、全屏与新进程重启通过 |
| 实际文件产物 | Markdown 包含已确认笔记/emoji，HTML 包含正文；ZIP 实际解压核对章节及笔记；`.aurabackup` 保留完整书籍未知字段、笔记内容，恢复后再次查询 SQLite 核对未知字段/范围 |
| 数据持久化 | 导入 EPUB 经原解析器/Repository 落入真实 SQLite，完整性 ok；新 Electron 进程仍有导入书籍和字体偏好，关闭前最后输入保留 |
| 安全回归 | 主窗口 Node 不可见、桥冻结、CSP/localhost/file/外部导航/弹窗/权限拒绝继续通过；其他窗口与非精确 URL 不可访问存储及新增文件能力；原未支持字体选项保持禁用 |
| `npm run test:desktop:native` | 退出 0；在实际 Windows 桌面操作系统对话框选择项目 EPUB、选择 WOFF2、保存 Markdown、取消 ZIP；没有注入 DialogPort，保存文件和 SQLite integrity_check=ok 均核对通过 |
| 图形观察 | 实际观察打开/字体/保存对话框及取消后阅读器反馈；保留真实 Renderer 截图。没有用 jsdom 或注入对话框结果替代原生操作验收 |

自动化 Electron 证据：`.commandcode/desktop-tests/run-QUtRkk/`，含 results.json、file-results.json、restart-results.json、亮/暗截图和四种实际导出文件。文件测试在主进程注入对话框返回值，其余链路均为真实 Renderer/IPC/文件系统/SQLite。

原生操作证据：`.commandcode/desktop-native/run-3rYvtA/`，含 results.json、native.md、native-reader.png 与隔离 profile；`nativeDialogs=true`、`injectedDialogs=false`、`sqliteIntegrity=ok`。仅使用项目测试素材和专属测试书库，未打开、导入或清理日常用户数据库。

测试中的故意 ENOENT 写入失败、拒绝保存、CSP/iframe 违规会输出预期错误日志，结果有对应断言。新 Electron 测试最初误以为 EPUB 标题来自元数据，已按原解析器的文件名标题规则修正预期；公开零参数文件能力会忽略额外参数，测试改为确认额外路径不能控制实际选择。没有为获得通过而改变解析器、删除测试、吞掉异常或重置用户数据。

## 验收、风险与下一阶段

阶段 4 验收满足：桌面文件、字体与四种导出已接入原业务，原生选择/保存/取消有实际 Windows 证据，当前 SQLite 和浏览器回归通过；作为独立 Git Commit 提交。

尚未覆盖的风险：实际磁盘满/ACL 拒绝/杀进程时的写入、接近 256MB 的 IPC 复制与内存、超大 EPUB 解压、多书批量备份峰值内存、复杂/恶意 EPUB 与字体语料、长时间阅读、系统输入法、解析/生成期间强制退出，以及 Electron 崩溃/断电仍留待稳定性阶段验证。缺失父目录是实际写入失败验证，不代替磁盘满或 ACL 验收；WOFF2 已实际导入，TTF/OTF 的全部字体变体尚未逐一 GUI 验证。当前 `.aurabackup` 恢复已验证，数据库文件恢复向导尚未提供；`.aurabackup` 不包含字体文件及全局偏好。原生覆盖确认的选项与文件覆盖行为分别有测试，系统覆盖确认弹窗本身尚未实测。

阶段 5 前置条件：

1. 复核打包资源清单，包含 dist/client、桌面入口、原服务模块、fontkit、JSZip、Remix Icon 和字体；本地 JSZip 选择 MIT 许可，保留 node_modules/jszip/LICENSE.markdown 及其依赖许可、既有图标/字体/Electron 许可。
2. 引入 electron-builder，生成 Windows x64 NSIS；打包后实测 Electron 内置 Node 与 node:sqlite，不能仅依赖开发机 Node 或 package engines 判断兼容。
3. 验证安装、启动、升级、卸载对当前 userData/SQLite/字体/偏好的保留；无 Node、浏览器或终端的用户环境实际运行，逐项记录系统集成状态。

用户已免除旧数据库支持，阶段 5 聚焦安装和打包，不再以旧库迁移为前提。本轮未开始阶段 5，尚不能宣称已交付安装版。
