# Electron Windows 桌面迁移：阶段 6 本地验证

日期：2026-10-23（Asia/Shanghai）。起点：阶段 5 提交 `f2f6f31`。本轮执行自动化回归、当前 SQLite 故障与恢复、大书、短时持续读写、实际打包程序和 NSIS 生命周期验证；按用户要求暂不发布。未推送、上传、创建 Release、配置自动更新或增加遥测。旧数据库/IndexedDB 的桌面迁移继续不在范围内。

## 审查与核心改动

实施前复核 SQLite 的 transaction/mutate、annotations/books/operations 表、版本与 generation、操作幂等、在线备份、启动标识、Repository 待写 journal、实际编辑器 finishInlineEdit、关闭握手、主进程文件服务、包内容和阶段 1–5 的测试。沿用现有持久化含义、EPUB/阅读/排版/标注/导出逻辑，不更换 SQLite、UI 技术或生产依赖。

| 文件 | 核心设计 |
| --- | --- |
| `src/server/dataStore.js` | 事务失败仅在 `db.isTransaction` 为真时回滚，保留 SQLite 已自动回滚后的原始错误；无 schema 或版本/幂等语义变化 |
| `src/client/desktop.ts`、`src/shared/desktop.ts`、`src/desktop/preload.cjs`、`src/desktop/ipc.cjs` | 增加固定、无参数的 lifecycle.requestClose；页面 window.close 进入原生关闭/保存握手；仍校验精确已登记窗口与主 frame URL，不暴露通用 IPC/Node |
| `src/desktop/ipc.cjs` | Renderer 已崩溃时等待现有服务完成后允许退出，保留已确认 SQLite 与恢复日志；query-session-end 先阻止会话结束并走关闭握手 |
| `tests/regression/test_sqlite_faults.js` | 真实 SQLITE_FULL / READONLY / BUSY；完整对象、版本、操作数量、同命令恢复、重开及在线备份 |
| `tests/desktop/storage.cjs` | 其他窗口、非精确 URL 无权调用关闭请求 |
| `tests/desktop/close-path.cjs` | 真实 Electron 页面关闭、崩溃后关闭、模拟会话结束；读磁盘验证末次编辑 |
| `tests/desktop/stability.cjs`、`scripts/test-stability.cjs` | 故障/日志/关闭阻断、Renderer 强制终止后显式重载、未提交 WAL 事务的主进程强制终止恢复、损坏库阻断、大书与可配置持续读写 |
| `tests/desktop/packaged-stability.cjs`、`tests/desktop/packaged.cjs` | 复用外部 CDP 测试连接，实际 hardened exe 的第二写连接故障、恢复、杀进程、页面关闭和当前 SQLite 备份恢复；不向包中加入测试通道 |
| `package.json`、`README.md`、`tests/README.md`、本文 | 增加两条单独运行的验收命令，记录实际证据与发布保留条件 |

本轮通过失败测试发现并修复了两个产品问题：

1. 实际 SQLite 页容量耗尽时，SQLite 已自动回滚，旧代码再次执行 ROLLBACK，原 SQLITE_FULL（13）被“no transaction is active”（1）掩盖。现在保留原始错误，并验证未产生部分书籍/笔记、版本或操作记录；恢复容量后同一命令仅提交一次。
2. 实际 Renderer 调用 window.close() 时可以跳过 BrowserWindow 的 close 事件，未触发 input 的最后编辑没有落库。失败样本曾得到 `nativeCloseEvents=0`、SQLite 无该笔记。现在页面关闭通过受限请求进入同一保存握手；正常关闭落盘，保存失败保留窗口和日志。崩溃页无法完成 Renderer 握手，另走服务收尾退出路径；不承诺恢复仅存在于崩溃进程内的原始按键。

会话结束事件与崩溃处理依据 Electron 的 [BrowserWindow 事件](https://www.electronjs.org/docs/latest/api/browser-window)和 [WebContents](https://www.electronjs.org/docs/latest/api/web-contents) API。测试只是模拟 query-session-end，并未实际注销/关机；Renderer 恢复测试由测试显式调用 reload，产品尚未提供崩溃恢复按钮或自动重载 UI。

## 执行证据

| 实际运行 | 结果及覆盖边界 |
| --- | --- |
| `npm test` | 退出 0；46 项、0 失败（6 syntax / 6 unit / 34 regression），包含原浏览器、SQLite、恢复与导出测试及新增真实 SQLite 故障测试 |
| `npm run test:desktop` | 退出 0；实际 Electron 45.0.0 / Node 24.22.0 / SQLite 3.53.4 / win32-x64；严格类型检查、IPC 身份、安全隔离、资源、字体、文件/四种导出、备份恢复、关闭保存与新进程重开通过 |
| `npm run test:stability` | 真实 SQLite 故障、关闭三路径、Renderer 终止/显式重载、实际未提交 WAL 主进程终止/新进程恢复、损坏库阻断、大书及 300 秒持续写读通过；性能数据及界限见下节 |
| `npm run test:packaged:stability` | 退出 0；实际 hardened AuraReader.exe，PATH 仅有 Windows 系统目录，模拟断网；第二写连接造成真实 BUSY，保留输入/拒绝关闭/恢复，40 次已确认写入经主进程强制终止保持完整，重开和页面关闭末次输入、当前 SQLite 在线备份在新 profile 恢复、损坏库不重置均通过 |
| `npm run dist:win` / `verify:package` | 实际包资源、安全 fuses、ASAR 和排除规则通过；16 项必需资源、4,208 条目；未将 HTTP Server、测试、用户数据打包；构建参数为 `--publish never` |
| `npm run test:install` | 退出 0；实际 NSIS 当前用户安装 1.0.0、升级 1.0.1 测试版本、卸载、重装 1.0.0，再卸载；完整当前书籍/笔记/未知字段、字体、偏好保留，卸载前后 data 文件哈希一致；非安装向导逐页操作 |
| 新脚本 `node --check` 与 `git diff --check` | 通过；不关闭 strict/checkJs，不删除失败测试 |

基础桌面证据：`.commandcode/desktop-tests/run-g7ej3R/`。首次 300 秒完整故障与持续读写证据：`.commandcode/stability/run-1sP2I6/`。补录请求耗时/窗口状态的最终完整通过证据：`.commandcode/stability/run-welkhm/`，所有三种关闭路径的结果均在断言通过后写入。

实际包证据：`.commandcode/packaged-stability/run-YGpk13/`，含 results.json、四次启动日志、独立 profile、当前 SQLite 备份、恢复 profile、损坏样本及 busy-recovered.png。截图是实际可见 Renderer，由外部调试连接捕获，已目视检查正文/笔记及失败关闭提示。测试 PATH 不含宿主 Node，只说明包不依赖 PATH 中的 Node，不等于纯净无 Node Windows 虚拟机已验收。

初次打包补测失败于 Chromium 首屏 execution context 替换，并非通过删断言处理：只在启动截止时间内重试明确的 context-destroyed 导航竞争；其余异常继续失败。另一次损坏库测试原错误文案断言写成“数据库”，实际安全错误为“本地书库操作失败，原数据未清除”；修正为现有文案，并继续要求 IPC 500、原损坏字节完全保留。产品没有重置数据库、静默吞错或把保存失败称为成功。

## 大书与持续验证的界限

使用本地生成的 EPUB：128 章，正文解压后 8,997,032 字节（约 8.58 MiB）；通过原 EPUB 解析器、SQLite、阅读器及实际章节 ZIP 导出。ZIP 解压断言 128 篇章节和 1 篇索引 Markdown。这只是合成多章大书，未代表复杂出版排版、数百 MiB、损坏压缩包或全部用户书库。

首轮 300 秒完成 144 次已确认 Unicode 笔记写入并逐次完整读回，保留未知字段，每 5 轮切书/章节/主题。导入耗时 809 ms；所有 Electron 进程工作集求和采样约 494–787 MiB，最后约 633 MiB；主进程 JS heap 约 26–129 MiB，最后约 76 MiB。内存会回落，但本轮不能证明长时间无泄漏，也未设置或声称满足内存产品预算。

首轮 50 ms Renderer 定时器最大记录间隔约 60 秒，期间主进程驱动的 Repository 写读仍完成。可能涉及后台窗口节流，但没有据此断言原因或前台流畅性通过。补测记录每轮请求耗时、document.visibilityState 和窗口焦点，保留原始计时器数据；不通过关闭生产后台节流或隐藏坏样本“修复”指标。

补测同为 300 秒、144 次写读，导入 1,118 ms；每轮完整的 Renderer/Repository 写读及可能的切书/主题操作最大耗时 628 ms，样本 P95 为 416 ms。144 个采样中 73 次有焦点，visibility 同时出现 visible/hidden，定时器最大间隔约 59,996 ms。全进程工作集约 491–793 MiB，末次约 559 MiB。记录对应当前 Windows 会话且期间有安装测试窗口活动，不是受控前台性能基准；没有依据这组数据声称前台动画、IME 或后台计时精度验收通过。

SQLITE_FULL 由真实 SQLite `max_page_count` 产生，READONLY 使用 `query_only`，BUSY 使用真实第二连接持有写锁。它们没有覆盖物理磁盘耗尽、NTFS ACL、杀毒软件阻拦或设备 I/O 故障。WAL 终止为真实测试进程强杀，已确认事务与未提交事务分别核对，但不是机器断电。Renderer 崩溃前特意等待恢复日志刷盘，不保证尚未刷盘的按键存活。

所有故障、恢复、测试安装和模拟损坏都在独立 `.commandcode`/临时目录内；未打开、清理或转换日常书库。备份恢复写入新的独立 profile，没有覆盖运行中的源库。测试卸载前校验绝对目录属于该次专属安装目录。

## 本轮验收与后续条件

当前 SQLite 的读写、版本/幂等、错误保留、故障后恢复、当前备份恢复、已确认数据经进程终止保持一致、页面关闭保存及损坏库不静默重建，均有实际运行证据。自动化与本地候选包验证的已执行部分通过；完整阶段 6 发布验收仍有下列未验证项，不将六阶段全量验收标为通过：

- 安装/卸载向导逐页交互、自定义目录人工选择、快捷方式双击，以及纯净无 Node 的 Windows 虚拟机。
- 其他 Windows 版本、普通非管理员账户、真实系统注销/关闭、占用文件升级、安装中断/重启、物理断电/磁盘满/ACL 与设备故障。
- 原生中文输入法候选窗、前台连续帧延迟、数小时或多日稳定性、复杂/恶意 EPUB 内容语料。
- Authenticode 签名和系统信任流程；当前候选包未签名。第三方许可机械汇集通过，完整发布许可复核待做。
- 产品崩溃恢复 UI 尚未实现；已验证的 Renderer 重载是测试行为。文件关联未实现/未验收，不能视为已支持。

后续无需新增“第 7 阶段”。若继续收尾阶段 6，先具备可交互的隔离 Windows 环境、补齐上述发布相关验收并确定签名策略；正式发布还需用户明确改变“暂不发布”的要求。本轮只保留本地 1.0.0 候选安装器及 1.0.1 升级测试包，不把解包目录描述为正式便携版。

## 最终收尾记录

候选包的 `archiveSha256` 为 `821babc0244cefdd027a034248b9b89cdd5ba6ff84020a0ab7cd7d8c857516d7`；已断言与实际打包稳定性测试所测 ASAR 一致。最终安装器为 `release/AuraReader-Setup-1.0.0-x64.exe`，126,586,435 字节，SHA256 为 `95ea35018bd78b7cd9b8cbd46596131d4985abffd7aed6ec4254c61a0f8713f6`。`Get-AuthenticodeSignature` 返回 `NotSigned`。对应 `.exe.sha256` 与 `release/package-verification.json` 保留机器可读结果；只保存在本地，不作为已发布产物。

本轮 NSIS 测试目录为 `.commandcode/install-tests/run-59E28T/`，最终退出 0、`results.json.passed=true`；fresh/reopen/upgrade/reinstall 的真实 Renderer 日志/截图/JSON 及隔离 profile 均保留。已验证当前用户注册、桌面/开始菜单快捷方式目标、重启与版本替换、数据逐字节保留，最后卸载了测试安装。1.0.1 仅为本机升级测试构件；没有改变源码 1.0.0 版本或发布它。

本轮结论：已执行的回归、故障/恢复、两轮各 300 秒持续读写、打包程序和安装生命周期检查通过；仍保留上节人工/环境验收缺口及用户的暂停发布约束。后续应继续收尾阶段 6 的发布前验证，不能以本报告代替尚未完成的验收。
