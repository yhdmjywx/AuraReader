# Electron Windows 桌面迁移：阶段 5 安装与打包

日期：2026-10-23（Asia/Shanghai）。起点：阶段 4 提交 `3827eeb`。本阶段仅实施 Windows x64 electron-builder / NSIS、包内容校验和安装生命周期验收，未进入阶段 6。按用户最新要求，不支持旧数据库迁移，保留现用 SQLite、备份恢复及浏览器模式。

## 审查与改动

实施前复核 main/preload/协议资源路径、SQLite 初始化与 schema、操作版本/幂等、关闭协调、字体服务、JSZip、字体/图标许可及阶段 4 测试。SQLite 来自 Electron 内置 Node，生产依赖均为 JS，无需为 SQLite 增加原生 addon 或重建数据库。

| 文件 | 修改与核心设计 |
| --- | --- |
| electron-builder.cjs | 固定 appId `org.aurareader.desktop`、产品/可执行文件名 AuraReader、Electron 45.0.0、Windows x64 NSIS；默认当前用户安装、可选目录、桌面/开始菜单快捷方式、默认保留用户数据；不配置云发布或自动更新 |
| package.json、package-lock.json | 固定 electron-builder 26.15.3；提供 dist:win、verify:package、test:install；保留所有原命令与 Electron/Node 约束 |
| src/desktop/main.cjs | 默认 `%APPDATA%\AuraReader` 保持不变；主进程尊重显式 `--user-data-dir=<绝对目录>` 以隔离验收/显式选择数据位置，拒绝相对路径或安装目录内位置；Renderer 不可设置；导出保护扩展到整个安装目录 |
| scripts/package-resources.cjs | 用代码生成蓝色书本 ICO；汇集现有生产依赖、内置字体许可及原始声明到 THIRD-PARTY-NOTICES；不下载新图形素材 |
| scripts/verify-package.cjs | 检查真实 ASAR 的必需资源、排除内容、安全 fuses 和许可；生成 package-verification.json 及安装包 SHA256 校验文件 |
| scripts/package-upgrade-fixture.cjs | 从相同代码构建仅供本机测试的 1.0.1 后继包，不修改源码版本、不上传或发布 |
| scripts/test-install.cjs | 已有产品安装检查、真实 NSIS 安装/升级/卸载/重装、登记和快捷方式验证、data 文件哈希核对；卸载前核对绝对目标始终位于当前专属测试目录 |
| tests/desktop/packaged.cjs、main.cjs | 外部启动实际打包/已安装 exe；受控 PATH、真实 Renderer/IPC/SQLite、资源、幂等、在线备份、编辑关闭、字体/偏好和跨进程持久化检查；源码回归报告明确安装验收为单独检查，测试代码不随产品分发 |
| .gitignore、README.md、tests/README.md、本文 | 排除生成物，更新安装使用、构建、实际证据及验收限制 |

文件清单只包括编译后的前端 JS、现有 HTML/CSS/字体、桌面入口与所需四个服务模块，以及生产依赖。没有把项目 data、测试 EPUB、测试脚本、文档、TypeScript 源码或 HTTP Server 打入桌面应用。ASAR 的原布局与资源提供路径一致，未重写 EPUB、排版、高亮、笔记或导出算法。使用 Electron 官方支持的 [ASAR 文件访问](https://www.electronjs.org/docs/latest/tutorial/asar-archives)，配置依据 electron-builder 的 [应用内容](https://www.electron.build/v26/docs/contents/)与 [NSIS](https://www.electron.build/docs/nsis/)说明。

产品以 ASAR 加载并校验嵌入完整性，关闭 RunAsNode、NODE_OPTIONS 环境注入和 Node CLI inspector fuses；包校验读取实际二进制确认状态。原 sandbox、contextIsolation、webSecurity、受限 IPC 和 CSP 保留。安装生命周期测试临时用启动参数开启 Renderer CDP，正常产品入口没有调试端口或 HTTP 服务代码，没有增加测试 IPC 或通用 Node 通道。

许可汇集保留了生产依赖的 LICENSE/COPYING/NOTICE，以及字体 OFL、Electron 与 Chromium 许可。部分现有 npm 包（brotli、dfa、fontkit、isarray）仅在 README 声明 MIT：保留其 README、作者元数据与标准 MIT 许可正文；Brotli 原始 Google 解码器的 Apache 2.0 头部与全文另外保留。JSZip 采用其 MIT 许可选项。尚未把这项机械汇集声称为完整的第三方版权法律审计。

## 产物与使用

- `release/AuraReader-Setup-1.0.0-x64.exe`：Windows x64 NSIS 候选安装包。
- 同目录 `.exe.sha256`：SHA256 校验值；`package-verification.json`：资源、ASAR、安全 fuses、大小和哈希报告。
- `release/win-unpacked/`：同一候选包的解包目录，可用于诊断，面向用户交付安装器。
- `.commandcode/upgrade-package/AuraReader-Setup-1.0.1-x64.exe`：只供升级测试，不是另一个正式版本。

安装后从桌面或开始菜单的 AuraReader 快捷方式启动，用户无需安装 Node.js、打开浏览器或启动终端。首次启动明确创建书库，然后导入 EPUB/TXT；桌面通过 IPC 访问 SQLite。普通数据根为 `%APPDATA%\AuraReader`，其中 data 保存 SQLite、字体与一致性备份，阅读偏好位于该 profile 内。正常升级/卸载保留它，重装可读取当前书库。旧数据导入不在范围内；未知/缺失数据库的原阻断机制保留，不能静默重置。

当前候选包没有 Authenticode 签名，Get-AuthenticodeSignature 实际返回 NotSigned。构建日志出现 signtool 步骤不表示已取得签名；本阶段未配置证书、在线上传、GitHub Release 或自动更新服务。

## 实际验证

| 检查 | 结果及界限 |
| --- | --- |
| `npm test` | 退出 0，45 项、0 失败（6 syntax / 6 unit / 33 regression），保留现有浏览器和 SQLite 测试 |
| 严格类型与构建 | dist:win / test:desktop / npm test 均执行原 strict/checkJs 与契约检查并通过，未禁用类型检查 |
| `npm run test:desktop` | 退出 0；Electron 45.0.0 / Node 24.22.0 / SQLite 3.53.4 / win32-x64；原文件/字体/导出、IPC、安全、编辑与重启全部通过 |
| `npm run dist:win` | 成功生成实际 NSIS exe；使用安装的固定 Electron 分发，不假定任意 Electron 都符合 Node >=24.15.0 |
| `npm run verify:package` | 实际 ASAR 的 16 项必需资源、4,208 个条目、安全 fuses、生产资源和许可文件通过，私有目录/用户数据/测试/HTTP Server 未入包 |
| 打包程序启动 | 实际 AuraReader.exe 使用仅有 Windows 系统目录的 PATH，NODE_OPTIONS 注入无效；无需找到宿主 Node；真实 Renderer 中 Node 不可见，IPC 可用 |
| 包内资源 | 实际协议读取 CSS、JSZip、Remix Icon、Literata、更纱 WOFF2，均 200 且非空；离线模拟下可读取并加载字体 |
| 当前 SQLite | 通过实际已安装程序建立当前库，完整书籍/笔记和未知字段、opId 重放、在线备份通过；应用关闭前直接改动真实编辑器，正常应用退出后只读查询最后输入、换行/emoji 和完整性均正确 |
| 进程重启与升级 | 1.0.0 退出后从新进程重开；真实 NSIS 替换为 1.0.1 测试版本，再从新版本读取书籍、笔记、未知字段、字体和偏好均通过 |
| 实际卸载和重装 | NSIS 静默卸载后所有 data 文件逐字节哈希一致；重装 1.0.0 再验证内容、字体和偏好，最后卸载测试程序，测试 profile 留作证据 |
| 系统集成 | 验证 HKCU 当前用户的实际安装版本、稳定 GUID 和独立 InstallLocation 登记，以及桌面/开始菜单 `.lnk` 的 TargetPath；没有声称已实测快捷方式双击或文件关联 |
| 图形证据 | 已安装的可见原生窗口实际运行，外部 CDP 捕获 fresh/reopen/upgrade/reinstall 的 Renderer 截图；纯普通启动的补充窗口观察遇到 Computer Use 应用授权超时，明确不算通过 |

最终构建/安装链路：`npm run test:install`，按顺序重建候选包、检查包、生成升级测试包并执行完整 NSIS 生命周期。测试结果和最终 SHA256 在同目录报告记录，不手工维护可能过时的校验值。

最终源码 GUI 回归证据：`.commandcode/desktop-tests/run-AftJgs/`。最终安装回归目录：`.commandcode/install-tests/run-57eSwy/`，包含 results.json、fresh/reopen/upgrade/reinstall JSON/日志/截图和 profile；仅使用专属工作区安装目录与新建当前书库。前一完整通过的安装证据另保留在 `run-lmVpW5/`。实际卸载已清理本轮产品登记，没有打开或清理日常桌面书库，也不触及已有 Chrome PWA。

验收脚本最初错误地按无版本的 DisplayName 查找登记，并误将安装路径当作卸载键字段；已按 builder 实际的稳定 GUID 与独立安装位置键修正，同时检查 HKCU/HKLM，有现存产品就停止。初次残留只在验证属于本轮绝对测试路径后卸载。外部调试协议在应用关闭时可能先断开连接，最终必须同时满足进程退出码 0 与真实 SQLite 最后内容，未把连接断开单独视为通过。最初 Renderer page-close 方式不作为正常应用关闭的验收替代；最终走 Browser.close 并检查实际落盘。没有删除失败断言、降低类型要求或重置用户数据库。

## 验收与阶段 6 前置条件

阶段 5 的包生成、资源隔离、真实 NSIS 静默安装/升级/卸载/重装和当前 SQLite 保留验收通过。交付的是可安装候选版；完整图形安装和正式发布验收仍未全部满足，不能称为全部六阶段完成。

尚未验证：逐页安装/卸载向导、自定义目录的人工选择、快捷方式双击、纯净无 Node Windows VM、其他 Windows 版本/普通非管理员账户、签名与系统信任流程、真实安装中断/重启、占用文件升级、文件关联、系统关闭与 Renderer 发起关闭的所有路径、大文件/磁盘满/ACL 故障和长时间稳定性。额外普通窗口观察因 Computer Use 授权超时而未完成，没有绕过授权或据此修改业务行为。现有主进程默认 profile 路径已保持，安装测试为保护日常数据使用显式隔离 profile。

阶段 6 前置条件：保留本次可复现构建与安装证据，在可用交互桌面/隔离 VM 补齐向导和普通快捷方式启动；验证现用 SQLite 的正常关闭、异常关闭和一致性恢复，跑大书与长时测试；完成安装器签名策略、许可复核和最终发布清单。旧数据库迁移不重新纳入范围。本轮不实施阶段 6。
