# Electron Windows 桌面迁移：阶段 2 桌面外壳

日期：2026-10-23（Asia/Shanghai）。起点：阶段 1 提交 `f341924`。

## 范围与结果

已提供独立的 Windows x64 Electron 原生窗口，复用现有 index.html、styles.css、内置阅读字体和图标样式；不启动 localhost HTTP 服务。本阶段只交付外壳，界面明确提示“本地书库暂未接入”，书库、阅读、导入、导出等操作禁用，主题切换可用。

没有接入 SQLite 业务 IPC、打开生产数据库、初始化空书库或迁移旧数据。现有阅读、标注、导出算法及 HTTP 服务代码均未修改，`npm start`/`npm run dev` 继续独立运行浏览器模式。没有引入 UI 框架、账号、云服务、订阅、遥测或自动更新。

## 修改文件与核心设计

| 文件 | 设计 / 作用 |
| --- | --- |
| package.json / package-lock.json | main 指向桌面入口，新增 desktop/test:desktop；保留浏览器脚本；精确锁定 Electron 45.0.0、Remix Icon 4.6.0 |
| scripts/desktop.cjs | 启动真实 Electron；只在子进程环境移除 ELECTRON_RUN_AS_NODE，避免误用宿主 Node 模式；允许桌面窗口可见 |
| src/desktop/main.cjs | 独立生命周期；运行时门槛、固定应用身份、userData/sessionData、单实例锁、窗口/协议注册、失败显式报错及关闭退出 |
| src/desktop/runtime.cjs | 显式检查实际 Electron 的 Node >=24.15.0、win32-x64 及 node:sqlite 必需接口；不能用 npm/宿主 Node 版本代替 |
| src/desktop/assets.cjs | aurareader://app 固定来源，启动时建立允许资源清单；分离 dist/client JS 与 src/client 静态资源，设置 MIME、CSP、nosniff、no-store |
| src/desktop/security.cjs | 权限默认拒绝、请求来源限制、导航/跳转/新窗口/webview/下载拦截 |
| src/desktop/preload.cjs / desktop.d.ts | contextBridge 仅暴露冻结的只读元数据，没有 IPC、require、fs、SQL、Node 对象或本机路径 |
| src/desktop/renderer/shell.js / shell.css | 在原有界面中呈现不可用状态并禁用业务入口，不启动 HTTP storageClient 或旧数据迁移；局部外壳样式与主题交互 |
| tsconfig.desktop.json / scripts/build.cjs | 新增桌面代码使用 strict + checkJs=true 检查；原有客户端和契约检查继续执行，无类型检查降级 |
| tests/regression/test_desktop_assets.js | 自动纳入 npm test，检查实际资源响应、恶意路径、数据/源码排除及浏览器入口保持 |
| tests/desktop/main.cjs / runtime.cjs、scripts/test-desktop.cjs | 真实 Electron GUI + 现有 SQLite 服务在隔离测试目录运行；报告、截图、错误和超时非零退出 |
| README.md / tests/README.md / 本文 | 启动、验证方式、限制、阶段结果和下一阶段边界 |

窗口显式设置 `nodeIntegration=false`、worker/subframe Node 集成 false、`contextIsolation=true`、`sandbox=true`、`webSecurity=true`、`webviewTag=false`，不允许不安全内容，当前禁用 DevTools。不使用通用 invoke/send，不添加任意频道或任意路径能力。

自定义协议只允许固定来源 app；仅清单内的构建 JS、入口、CSS、字体和图标资源可以读取。拒绝其他来源、凭据、端口、畸形编码、反斜杠和解码后的穿越路径；读取前再校验 realpath 仍在资源根目录内。TS 源码、server 模块、package.json、data、API 路径不暴露。错误返回明确的 403/404/405，文件读取异常有主进程日志。

桌面入口在响应时去除浏览器 HTML 的远程资源标签，替换为专用 shell 脚本和本地 Remix Icon。源 HTML 与浏览器入口不变；入口变化无法匹配时显式失败，避免误启 HTTP 客户端。Google 界面字体在外壳中使用已有系统字体回退，JSZip 在外壳不加载；完整阅读/导出资源在阶段 4 接入。Remix Icon 沿用原界面相同版本，来源及 Apache-2.0 许可保留在 `node_modules/remixicon/LICENSE`，阶段 5 打包必须保留其许可及 Electron/Chromium 的第三方声明。

CSP 禁止脚本内联、外部脚本、框架、对象、worker、表单及任意连接；样式为复用原界面的行内样式保留 unsafe-inline，脚本没有此豁免。协议未设置 bypassCSP；权限默认拒绝。系统浏览器外链尚未接入，阶段 2 一律拦截，不声称已实现外链功能。设计依据：[Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security)、[协议 API](https://www.electronjs.org/docs/latest/api/protocol)。

## 数据位置与启动

```powershell
npm ci
npm run desktop
```

开发者需要 Node >=24.15.0 来构建源码。安装包最终会自带 Electron/Node，但目前尚未打包，不能声称最终用户已经无需 Node。

普通桌面入口将 userData 和 sessionData 固定到 `app.getPath('appData')/AuraReader`（Windows 通常为 `%APPDATA%\AuraReader`），与安装目录和工作目录分离。阶段 2 此处只有 Electron profile，尚无应用 SQLite 数据库；阶段 3 应从 userData 派生统一数据根，继续显式注入服务，不使用项目 data/。现有浏览器 `data/` 不被打开、移动或共享。

测试显式注入 `.commandcode/desktop-tests/run-*/profile`，不会接触普通桌面 profile。SQLite 能力探测使用同一测试运行目录下的 runtime-storage，目录及其在线备份都是测试专用数据。本阶段未验证普通 AppData 路径在所有 Windows 权限/用户名组合下的行为。

Electron 45 首次使用时会按需下载二进制，需要网络；这是开发环境依赖准备，不是运行后应用请求远程服务。浏览器正式运行仍使用 `npm start` 后访问本机 HTTP 地址。

## 实际测试及结果

| 检查 | 实际结果 |
| --- | --- |
| `npm test` | 退出码 0；`Checks: 41, failed: 0`，全部现有测试及新增资源回归执行 |
| `npm run typecheck` | 退出码 0；新增桌面文件已包含在严格检查中 |
| `npm run test:desktop` | 最终退出码 0；真实可见 Windows BrowserWindow，不使用 headless、jsdom 或关闭安全沙箱的参数 |
| 实际 Electron 运行时 | Electron 45.0.0 / Node 24.22.0 / SQLite 3.53.4 / win32 / x64 |
| 内置 SQLite | 使用项目 createDataStore、backupDatabase、verifyDatabase；WAL、5000ms timeout、外键、完整 JSON、事务回滚、opId 幂等和冲突、在线备份只读校验、重开均通过 |
| 隔离与状态 | Renderer 中 require/process/Buffer 均 undefined；桥对象冻结、仅元数据；未接入操作禁用；profile/sessionData 为测试目录 |
| 资源与界面 | 入口、构建 JS、CSS、本地图标、更纱/Literata 字体加载通过；正常启动无 Renderer 错误或警告；资源记录无 HTTP/API 请求；亮/暗截图非空，人工检查通过 |
| CSP / 权限 | 实际插入内联 script、iframe、请求 localhost/file、地理位置、弹窗均被拒绝；外部导航不能替换窗口 |
| 资源隔离 | 实际协议请求源码/数据/package/API 路径被拒绝；非法来源/编码/穿越等由实际 handler 回归覆盖 |
| 离线和退出 | Electron 网络离线模拟下外壳 reload 成功；最后窗口关闭触发正常退出，父进程收到成功状态 |
| `npm ls --depth=0` | 退出码 0，依赖完整 |
| Git 差异检查 | 无空白错误 |

最终 GUI 证据目录：`.commandcode/desktop-tests/run-hAHeO5/`，包含 results.json、shell-light.png、shell-dark.png。截图为真实 BrowserWindow 的 Renderer 内容，不包含操作系统标题栏；并非模拟 UI。该目录受已有 .gitignore 排除，供本机复核。

测试过程中的失败均明确记录并处理：

- 首次下载二进制时沙箱默认缓存 rename 返回 EPERM，按约定仅重试一次，将临时/缓存目录放入工作区后安装成功；没有删除 Electron 或修改环境配置文件。
- 外层执行沙箱中原生进程在测试入口前退出；在允许原生进程的权限下运行后成功启动，Electron 自身 sandbox 始终开启。
- 测试发现 Windows 启动器的 windowsHide 隐藏应用窗口，已修复为可见的交互式窗口；未删除可见性断言。
- 第一次过早 capturePage 返回 UnknownVizError，已等待实际绘制帧；暗色截图还等待 CSS 过渡结束并断言最终背景色，重新运行通过。没有吞掉截图错误或跳过检查。
- 恶意 iframe 测试故意触发 `ERR_BLOCKED_BY_CSP`，终端可见该预期拦截日志；正常入口无此错误。检查会断言相应 CSP violation，并非用忽略日志获得通过。

## 验收、风险与下一阶段前置条件

阶段 2 验收满足：独立原生窗口、现有界面资源复用、无 HTTP 桌面服务、安全隔离、运行时 SQLite 兼容性、本地资源、实际 GUI 截图和正常退出均有运行证据。浏览器基线无回归，本阶段作为独立 Git Commit 提交。Electron 版本选择已由实际运行确认；[官方版本明细](https://releases.electronjs.org/release/v45.0.0) 仅作为选型依据。

仍未验证或交付：真实书库 IPC、来源/字段校验、旧数据迁移、编辑中关闭保存、字体枚举/导入、原生文件选择/保存与取消、多书导出、真实恶意 EPUB/备份、系统输入法、单实例的多进程竞争、最小化/恢复/多显示器/长时运行、干净 Windows、NSIS 安装/升级/卸载/签名和完整离线阅读。离线模拟的外壳 reload 不能代替完整应用的断网冷启动。本次不是发布候选版。

阶段 3 进入前重新检查 storageClient、shared/storage、dataStore、migration 与恢复缓冲测试，实施下列边界：

1. 从固定 userData 派生并注入数据根，复用 SQLite 服务，保留现有 schema、CAS/generation/opId、删除屏障、备份及拒绝静默空库行为。
2. preload 逐项暴露具体存储能力；每个 handler 校验登记窗口、顶层 senderFrame、准确来源与字段/大小限制；保留 status/details，不提供通用 IPC、SQL 或文件路径接口。
3. 在原存储边界选择 HTTP 或 IPC，接入现有应用装配；明确桌面新 profile 的初始化与迁移状态，不能以“新来源为空”绕过旧数据安全迁移；旧书库迁移仍按阶段 5 单独实施。
4. 在实际 Electron 中验证读写、冲突、响应异常、恢复缓冲和关闭等待，再运行现有回归。字体/原生文件/导出留在阶段 4，安装/旧数据迁移留在阶段 5。
