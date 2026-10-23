# Electron Windows 桌面迁移：阶段 1 审计与基线

审计日期：2026-10-23（Asia/Shanghai）。审计起点：`1f4063d`。
本阶段只形成代码审计、基线结果与后续准入条件；未安装 Electron、未实现 IPC、未生成安装包。

## 1. 运行环境与基线结果

| 项目 | 本次实际值 / 结果 |
| --- | --- |
| 平台 | Windows，`process.platform=win32`，`process.arch=x64` |
| Node.js / npm | `24.16.0` / `11.13.0` |
| Node 内置 SQLite | `process.versions.sqlite=3.53.0` |
| 依赖锁 | package-lock v3；TypeScript 5.9.3、jsdom 30.1.2、JSZip 3.10.1、fontkit 2.0.4 |
| `npm test` | 退出码 0；`Checks: 40, failed: 0`；构建先通过严格类型和类型契约检查 |
| 检查组成 | 6 个服务端 JS 语法检查、6 个 unit 脚本、28 个 regression 脚本；40 是脚本/检查数量，不是断言数量 |
| `npm run typecheck` | 退出码 0；`Strict TypeScript and contract checks passed.` |
| SQLite 能力探测 | 无额外实验标志即可加载 `node:sqlite`；`backup` 为函数；内存库 `timeout: 5000` 回读 `PRAGMA busy_timeout` 为 5000 |
| 独立 HTTP 冒烟 | 使用 `tests/helpers/sqlite.js` 的临时空书库与随机回环端口；HTML、构建 JS、CSS、字体 CSS/清单/二进制均 200 且 MIME/内容正确；health 为 ok、缺失资源 404、书库 API 返回空列表；退出码 0 |

`npm test` 已执行实际构建，无须再重复运行独立 build。测试使用现有 node_modules 和锁文件；本次没有重新执行 `npm ci`，不据此宣称干净机器安装已验证。HTTP 冒烟只请求本地资源，未验证 CDN 加载或视觉排版。SQLite 测试使用独立临时目录；字体单测使用自己的 `.commandcode/font-store-tests` 子目录，未对日常 `data/` 做迁移、备份、恢复或清理。

本阶段没有修改产品代码、依赖、数据库结构或测试，也没有删除/跳过测试。Git 初始工作区干净；Git fsmonitor 连接报错后，后续 Git 命令仅使用进程级 `-c core.fsmonitor=false`，未修改仓库或全局配置。

## 2. 当前模块和调用链

| 边界 | 实际入口 / 调用链 | 桌面复用位置 |
| --- | --- | --- |
| 启动与资源 | package.json `start` → prestart 构建 → `src/server/server.js:createServer`；默认 127.0.0.1:8095 | 保留浏览器入口；桌面建立独立 main/preload，不引用会启动 HTTP 的入口 |
| 构建 | `scripts/build.cjs` → tsconfig + tests/types/contracts.mts → dist/client；静态资源留在 src/client | 自定义本地协议统一映射已构建 JS 与 HTML/CSS/assets，不能只复制 dist 或只加载源码 HTML |
| 前端装配 | `index.html` → `main.ts:bootstrapApp/startApp` → Session、AppCoordinator、各 feature controller | 复用当前 DOM、CSS、控制器及领域引擎，不引入 UI 框架 |
| 书籍读写 | infrastructure/bookRepository.ts → storageClient.ts → HTTP storageApi.js → dataStore.js | 在存储传输边界接 IPC，保持 Repository 和领域行为 |
| 笔记读写 | AnnotationController → annotationRepository.ts → annotationRecovery.ts / storageClient.ts → dataStore.js | 保留逐书队列、待写缓冲、opId、版本与 generation |
| 阅读与定位 | domain/readerEngine.ts、chapterFlow.ts、readingLocation.ts、annotationRangeEngine.ts → ReaderController / paperRenderer.js | 直接复用；不得改变 HTML 原文、章节号和 UTF-16 标注偏移 |
| 导入 | AppShell/Shelf 文件输入 → AppCoordinator.importBook → File.arrayBuffer/text → infrastructure/epubParser.js → saveBookToDB | 文件字节交给现有解析器，避免重新解析既有 SQLite 书籍 |
| 导出恢复 | BackupController → infrastructure/exporters.js → Blob + 临时下载链接；恢复 → parseBackupFile → restoreRecords | 复用内容生成及恢复事务，适配选择文件、保存和取消结果 |
| 字体 | FontController → `/api/fonts`、`/system`、`/import`、`/files/<hash>.<type>` → fontStore.js | 固定能力 IPC + 受限字体资源协议；保留 fontkit 校验和内容哈希 |
| 旧数据 | initializeStorage → legacyMigration.js → storageApi 的 migration 路由 → migration.js | 浏览器原来源只读归档；桌面必须有独立的已迁移库导入入口 |
| 一致性备份 | storageMaintenance.js:backupDatabase / verifyDatabase → node:sqlite backup、只读完整性校验 | 在受信任进程复用；用户不应通过终端执行维护 |

`core/`、`adapters/`、`repositories/`、`ui/` 下存在兼容转出入口，迁移应跟随 main.ts 的实际 import 图，不批量替换或重写这些兼容层。`tsconfig` 当前只编译 client/shared，`allowJs=true, checkJs=false`；严格 TS 检查通过不等于已有全部 JS 或未来 main/preload 都有类型覆盖。

## 3. 必须保持的数据语义

SQLite `PRAGMA user_version=1`；连接启用 foreign_keys、WAL、synchronous=FULL，写事务使用 BEGIN IMMEDIATE。

| 表 / 文件 | 结构与不变量 |
| --- | --- |
| books | id、完整 JSON payload、revision、generation、deleted；pages 为原始章节 HTML 字符串数组，未知字段保留 |
| annotations | id、book_id 外键、完整 JSON payload、revision、deleted；quote/comment/location 及历史未知字段保留 |
| operations | opId 主键、命令 canonical SHA-256、原始结果；相同命令重放返回同一结果，同 ID 不同内容报冲突 |
| migrations | source_id、snapshot_id、manifest；同来源同快照重试安全，不允许不同快照静默覆盖 |
| storage-installed.json | 已建立书库标记；数据库缺失/为空时阻断启动，不能自动重建空库；高于支持版本的库拒绝降级 |
| migration-snapshots | 原始 indexedDB/caches/pending/builtins、来源、内容哈希、manifest/冲突记录；先持久化原始快照，再事务合并校验 |
| fonts | 字体二进制与元数据，内容哈希去重；不在 SQLite 一致性备份里 |

写入使用 expected revision；删除保留墓碑，删书关联删除标注并递增版本；重新导入更换 generation，阻止旧笔记回写。IPC 必须继续传递这些字段，不能把请求改成无版本的覆盖保存。错误要保留 status/details（尤其 409 冲突、423 未迁移、413 过大），不能让 IPC 序列化丢掉后被误判为成功。

Book/Annotation 类型见 domain/book.ts、domain/annotation.ts；传输契约见 src/shared/storage.ts。领域规范化不等于可以丢弃持久化对象的未知字段。`.aurabackup` 每文件一本书，含解析后的书籍和可选标注，不含全局设置、字体文件或原始 EPUB 字节。原 EPUB 当前不另行存储，迁移不能声称可恢复原文件。

## 4. Electron 与 node:sqlite 版本判断

现有 package.json 和 server.js 明确要求 Node >=24.15.0。本阶段保留该要求，不通过绕过 server.js 的版本检查声称旧 Electron 已兼容。

截至审计日，官方发布资料提供如下对照（资料依据，不是本机 Electron 实测）：

| Electron | 内置 Node | 判定 |
| --- | --- | --- |
| 39.0.0 | 22.20.0 | 不满足项目当前门槛 |
| 40.0.0 | 24.11.1 | 不满足项目当前门槛 |
| 41.0.0 | 24.14.0 | 不满足项目当前门槛 |
| 42.0.0 | 24.15.0 | 版本数字达标，但官方排期列出的支持期已于 2026-10-20 结束，不作为新发行起点 |
| 45.0.0 | 24.22.0 | 阶段 2 的优先候选；正式选定前必须在实际 Electron win32-x64 中验证内置 SQLite |

依据：[Electron 发布排期](https://releases.electronjs.org/schedule)、[Electron 45.0.0 发布明细](https://releases.electronjs.org/release/v45.0.0)。阶段 2 应复核最新受支持稳定补丁并锁定精确版本及 lockfile，不使用浮动 latest 作为发布约束。Electron 45 的 sandbox preload 移除了 Buffer 等部分全局，不能将现有 Node 模块直接搬入 preload。

实际依赖的 SQLite 能力为 DatabaseSync、timeout/readOnly、exec、prepare/get/all/run 和异步 backup。Node 文档显示 timeout 在 24.0.0 已提供，SQLite 在 24.15.0 进入 release candidate；本项目没有调用 24.15 新增的 limits。因此“部分 API 更早存在”和“满足项目运行门槛”是两件事，不能据前者放宽后者。[Node 24.16.0 SQLite 文档](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html)。

阶段 2 的运行时门槛：在实际 Electron 主进程记录 process.versions.electron/node/sqlite、platform/arch；探测 node:sqlite 加载及 timeout；对临时库完成建表、写入、WAL、事务、在线备份、完整性校验和重开。只有版本表达标不够，宿主 Node 24.16.0 测试通过也不能替代此门槛。本阶段未下载或运行 Electron，兼容性仍待实测。

## 5. 桌面最小接入设计（后续阶段实施）

- 主进程拥有本地服务和路径；Renderer 保持 Web 环境。显式设置 nodeIntegration=false、contextIsolation=true、sandbox=true、webSecurity=true，禁用 webview 及子框架 Node 集成。
- preload 仅暴露具体业务函数（例如 books.list/save/delete、notes.query/save/delete、backup.restore、fonts.list/import、files.choose/save）；不暴露 require、fs、SQL、ipcRenderer 或接受任意 channel/path 的 invoke/send。服务端使用字段白名单与值校验，HTTP token/CORS 校验不能代替 IPC sender 校验。
- 每个 IPC handler 检查已登记窗口、顶层 senderFrame 与准确的受信任页面 URL；非预期窗口、子框架、导航后的页面全部拒绝。保持 HTTP 与 IPC 共用业务服务；IPC 不调用 localhost，也不伪造 HTTP 请求来复用 storageApi。
- 使用固定应用本地协议加载已打包资源，并校验解码后路径的目录边界及资源范围；字体协议只接受已登记哈希。协议处理静态资源，数据库、字体枚举/写入等服务走具体 IPC。保留浏览器 HTTP 适配器及 npm start。
- 严格 CSP、阻止任意导航和新窗口，权限默认拒绝；外链仅在主进程校验协议后交给系统浏览器。策略以 [Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security) 为依据。
- 桌面数据根目录基于 app.getPath('userData')，与安装目录、ASAR、工作目录分离；SQLite、标记、快照、字体、备份都从同一根目录显式注入。桌面只开一个写入实例，浏览器原书库保持独立，避免误把不同安装/来源当成同一个来源。
- 正常退出前完成内联编辑并等待 drainStorage，再关闭 SQLite；失败需明确告知并保留待写数据。只依赖 Renderer pagehide 的异步保存不足以保证 Electron 关闭安全。

这些是审计产生的实现边界，尚不是已交付能力。阶段 2 的壳验收只包含窗口、隔离、资源和运行时探测；完整书库可用须等阶段 3 接入，不能用新建空库掩盖尚未接入的服务。

## 6. 已发现的适配点与风险

| 风险 / 证据 | 后续要求 / 阶段 |
| --- | --- |
| dataStore 的默认目录来自项目；server.js 的 fontStore 在模块顶层固定为 data/fonts，createServer({dataDirectory}) 不会改变字体根 | 阶段 3 注入数据根；阶段 4 显式注入字体根，不能把现有 createServer 参数视为全部数据隔离 |
| 构建 JS 和静态资源分属 dist/client 与 src/client，带查询参数 | 阶段 2 协议映射、MIME、根路径、编码/穿越检查及最终资源打包 |
| index.html 使用 Remix Icon CDN、Google Fonts（Inter/Fira Code）和 CDN JSZip | 阶段 2 建立受控资源策略，阶段 4 完成本地分发及许可；断网冷启动/EPUB/ZIP 必须实际验收；当前不具备完整离线启动 |
| FontController 校验导入字体 URL 必须匹配 /api/fonts/files；fontStore 元数据也保存该 URL | 阶段 4 统一在适配边界转换资源地址，不能只把 fetch 改成 IPC 后仍请求旧 HTTP 字体 |
| EPUB parser 只移除 script/style/link 和 style 属性，章节/备份 HTML 经 innerHTML 插入；外部图片 URL 仍保留 | 阶段 2 先限制 CSP/导航/框架/远程请求；阶段 4 对恶意 EPUB/备份做实际验证。书籍内容不可信，不能因 Node 隔离而允许事件属性、嵌入对象或任意远程加载；不得在持久化数据中静默清洗导致范围偏移 |
| 点击外部书籍链接沿用浏览器默认行为；浏览器全屏 API 由 AppShell 使用 | 阶段 2 窗口级拦截，阶段 4 真实全屏/外链/快捷键验证 |
| Blob 下载函数同步返回，BackupController 可能立即显示“已导出” | 阶段 4 将保存成功/取消/拒绝/磁盘错误传播回控制器，真实写入完成才报成功；多书备份逐文件结果需保留 |
| legacyMigration 依赖原来源 localStorage 的 sourceId、IndexedDB、crypto.subtle、navigator.locks | 阶段 5 从原浏览器完成旧迁移，再通过受控导入切换；桌面新 profile 不能读取 Chrome/Edge 的旧来源，不能自动扫描/复制浏览器 profile 充当迁移 |
| 待写缓冲和偏好仍在浏览器 localStorage；桌面 profile 是新来源 | 阶段 5 明确迁移偏好/待写操作的范围；有未提交修改须先恢复或归档，不能仅复制 SQLite 后宣称全部迁移 |
| SQLite backup 不含 fonts 和原始迁移快照；恢复目前为维护流程，没有桌面全量迁移 UI | 阶段 5 区分书籍备份/数据库备份/整套数据迁移；在线源使用一致性备份，校验目标和附属资源后再切换，源保留，禁止复制活跃主库而漏 WAL |
| 同步 SQLite 和大 JSON/IPC 复制可能阻塞主进程；HTTP 原上限 256MB，字体 64MB | 阶段 3 保留输入上限和错误语义；阶段 6 实测大书/快速输入/关闭时延，再据证据决定服务是否隔离到 worker/utility，不能预先声称无卡顿 |
| 当前无 electron-builder、图标/Windows 安装元数据、NSIS 配置或安装回归 | 阶段 5 打包 win x64 NSIS，明确应用身份/卸载保留数据；阶段 6 在无 Node 的干净 Windows 验证安装、升级、卸载重装及从开始菜单启动 |

NSIS 目标以 [electron-builder 官方配置](https://www.electron.build/nsis/) 为后续依据，本阶段没有选择或安装 electron-builder 版本，也没有配置签名、自动更新或系统文件关联；不添加账号、云服务、订阅或遥测。

## 7. 已有测试覆盖与局限

| 行为 | 已实际执行的覆盖 |
| --- | --- |
| 解析/阅读/目录/标注范围 | unit 下 chapter_flow、decoupled_architecture、toc_hierarchy；regression 下 volume_title_flow、cross_paragraph_highlight、annotation_colors、page_layout_system、visible_notes、selection_fix_verification |
| SQLite 完整对象、CAS、幂等、删除屏障、来源权限 | test_sqlite_api、test_sqlite_annotation_roundtrip、test_local_persistence_pipeline、audit_user_backup_flow |
| 迁移归档、冲突、中断恢复、未知字段 | test_sqlite_migration、test_sqlite_cache_recovery |
| 笔记编辑、响应丢失、快速输入、恢复缓冲、切书竞争 | test_sqlite_repositories、test_annotation_recovery、test_inline_notes、test_unified_note_editing、test_open_book_race |
| 正常/强制终止重启、备份恢复、拒绝静默空库 | test_sqlite_process_restart（真实 Node 子进程）、test_sqlite_restore_drill（真实 SQLite 在线备份和隔离目录恢复） |
| Markdown/HTML/ZIP/每书备份 | test_book_backup、test_chapter_zip、test_book_structure_export；包含产物解析和完整内容断言 |
| 字体 | test_fonts：字库哈希、字形回退、格式/内容校验、重复导入、重开、菜单及语言选择 |
| 入口 DOM 与面板交互 | test_html_and_dom_audit、test_export_panel、test_shelf_popover、test_toc_drawer、test_mini_tooltip_interaction、test_immersive_notes |

inspect.js / test_ncx.js 包含测试自写的 EPUB 元数据解析，不能单独作为实际解析器正确性的证据；实际解析器另由 toc_hierarchy、fonts、章节导出等测试覆盖。静态 DOM/源码约束不是桌面安全验收。

尚未覆盖：实际 Electron main/preload/IPC、恶意文件在 Chromium 下执行、真实字体显示/排版、系统输入法、物理断电、磁盘满/权限异常、长时间内存与句柄、Windows 原生文件对话框、NSIS 安装/升级/卸载、无 Node/断网启动。本次没有打开真实 Windows 图形界面，历史 README 测试记录不计为本次实测。已有 jsdom 几何与合成 IME 测试不能代替上述实测。

## 8. 阶段结论与阶段 2 前置条件

阶段 1 验收满足：已确认实际模块/数据结构/调用链、形成运行时版本判断和风险清单、完整基线与独立类型检查通过、浏览器资源/API 冒烟通过，并将本报告纳入独立 Git Commit。没有任何测试失败需要绕过。最终桌面目标尚未完成，阶段 2–6 均未实施。

进入阶段 2 时仅执行以下范围：

1. 复核并锁定受支持 Electron 精确版本，在真实 win32-x64 Electron 主进程跑 SQLite 能力探测；失败则修复或重新选择版本，不降低项目 Node 门槛。
2. 添加独立桌面 main/preload/资源入口和必要构建脚本，使用上述隔离、协议、CSP、导航策略；保留 npm start 和现有测试入口。
3. 真实运行桌面窗口，检查资源加载、隔离与退出；记录仍待阶段 3 的存储接入，重跑相关检查并独立提交。

阶段 3 负责业务 IPC/SQLite；阶段 4 负责字体/书籍文件/导出；阶段 5 负责旧数据安全迁移与 NSIS；阶段 6 负责完整桌面回归和发布验证。各阶段实施前重新检查其涉及的代码与测试，不能把本报告当作提前完成后续验收。
