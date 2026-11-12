# Electron 构建与资源兼容性修复（2026-11-12）

本次为本地调查、修复和验证任务，不执行安装、升级、卸载或 GitHub Release。开始时保留工作区已有的项目 profile、Response 设计记录、`.electron-release/` 和 `release-fixed/`。

## 配置依据

先读取 AGENTS.md、项目 profile 与 `.electron-release/project-profile.json`。档案的 14 个来源 SHA256 在修改前全部匹配。当前配置为 AuraReader 1.0.0、npm 11.13.0、Node v24.16.0、Electron 45.0.0、electron-builder 26.15.3、Windows x64 NSIS；未升级依赖或修改产品 UI／行为。

## 问题、根因与修复

| 问题 | 环境与根因 | 修复及证据 |
|---|---|---|
| Readium CSS 使 Node 测试中断 | chapter flow 测试直接导入 ReaderController；架构测试经 AppCoordinator 导入阅读器。两条路径继续到 `publicationDocument.ts` → `readiumStyles.ts`。TypeScript 原样输出 Vite `?raw` 导入，Node 按 CSS 扩展名加载时报错 | `scripts/build.cjs` 在测试模块 emit 时将默认 raw 导入转换为依赖文件完整 UTF-8 字符串。源码与 Vite 处理不变。`tests/unit/test_build_assets.js` 对四种方向、三层样式共 12 份文本逐字节比对 |
| 编译后的 Worker URL 指向源扩展名 | `epubImport.ts` 的 `new URL('./epubImport.worker.ts', import.meta.url)` 在 Vite 下正常，但逐模块输出只有 `.js` 文件；Node 默认无 Worker 的 fallback 隐藏了该路径 | 同一 emit 转换把相对 TypeScript URL 改为 `.js`。新增测试以真实 Node worker_threads 桥接浏览器消息 API，执行编译后的 Worker 并验证 ZIP／XML、共享 ESM 模块、传输语义和原始归档 |
| 字体测试仍检查旧状态 | P1 已经接通 Book font；旧测试还要求禁用按钮和仅三个选项 | `tests/unit/test_fonts.js` 同步已批准行为，并新增 original 模式、选中状态及持久化断言 |
| EPUB 导入／恢复测试仍假设旧数据形态 | P1 保留源图片 URL，阅读时按需获取，导出时展开；可选 viewport 的 undefined 不属于持久化 JSON | `test_epub_publication.js` 检查原始路径、读取资源、导出 Data URL 的实际图片字节、未选页及原记录不变；恢复与往返比较采用真实备份／HTTP 的 JSON 形态，保留严格桌面数据校验 |
| 章节导出测试缺少资源服务 | Node fetch 没有浏览器相对 URL 基准，且测试的 Alice 书未保存到资源服务对应书库 | `tests/helpers/sqlite.js` 提供浏览器 URL 基准适配；章节 ZIP 测试将真实解析的书保存至独立 SQLite，随后从真实 HTTP／ZIP Worker 导出，未伪造资源或跳过导出断言 |
| 包验证遗漏 Worker 与动态依赖 | 原验证器只遍历静态本地 require 和 HTML 入口，未追踪 publication Worker、其动态 `.mjs` 导入及懒加载 renderer 资源 | `scripts/verify-package.cjs` 增加 Worker、ESM 导入／再导出、动态 import 追踪，要求 zip.js Node 入口及共享模块，并逐字节核对本轮全部 renderer 产物。`test_package_dependencies.js` 对缺失 Worker、动态模块与再导出依赖分别验证必须失败 |

`electron-builder.cjs` 已列出 publication Worker、client 及共享 `.mjs`，本次未发现需要扩大显式源码清单的遗漏。生产依赖继续由 electron-builder 收集。浏览器入口和 Wiki UI 的副作用 CSS 继续由 Vite 负责，现有 Node 测试不执行 renderer bootstrap；未将其替换为空模块。

## 源码验证

- `npm ls --depth=0`：通过。
- `npm run typecheck`：通过；独立日志 `.local-materials/compatibility-2026-11-12-typecheck.log`。
- package.json／package-lock.json 两个版本字段：一致，均为 1.0.0。
- 初次修复后完整测试：77 项，3 个旧测试失败；证据为 `.local-materials/compatibility-2026-11-12-tests.log`。
- 最终 `npm test`：79 项、0 失败，包含严格类型、契约、桌面类型检查与 Vite 构建。日志：`.local-materials/compatibility-2026-11-12-tests-final.log`。
- `npm run test:migration`：16 项、0 失败。日志：`.local-materials/compatibility-2026-11-12-migration.log`。
- `npm run test:desktop`：通过，renderer 控制台 error 为空。覆盖 EPUB、IME、Goal、跨书定位、保存、导出／备份、键盘及重载。日志：`.local-materials/compatibility-2026-11-12-desktop.log`；独立 profile 与截图：`.commandcode/desktop-tests/run-Yu8biK/`。此脚本调用 `app.exit(0)`，不单独证明正常关闭握手。

Node／React 测试仍有已有的 act 包装警告，以及故障注入测试预期的错误输出；未屏蔽日志。完整测试的退出码和失败计数为判断依据。

## 本轮安装包与静态验证

`npm run dist:win` 与随后独立执行的 `npm run verify:package` 均退出 0。日志分别为 `.local-materials/compatibility-2026-11-12-package.log`、`compatibility-2026-11-12-verify-package.log`。

| 产物 | 实际结果 |
|---|---|
| `release/AuraReader-Setup-1.0.0-x64.exe` | Windows x64 NSIS，131652584 bytes；SHA256 `eb34daea22a299d05401ca0a7c200672dc54cb2b1605f1171521289bc64e620e` |
| 同路径 `.exe.sha256` | 已生成，并重新读取安装包核对一致 |
| `release/win-unpacked/resources/app.asar` | 84875926 bytes；SHA256 `16e3a15a9181b0613486a9fe131bcaf93d5c0426fdb9fcbb5fe9e00d240ec4df` |
| `release/package-verification.json` | `passed: true` 表示静态包检查通过：8094 条目、15 项必需资源、20 个本地模块、66 个 renderer 文件逐字节一致，许可证及安全 fuses 通过；不包含运行退出结果 |

已核对生成的 THIRD-PARTY-NOTICES 包含 Readium、xmldom、zip.js 的许可证段。Authenticode 检查显示主程序与安装包均未签名；electron-builder 的 signtool 日志本身不代表签名成功。

## 打包运行：资源通过，正常退出失败

运行 `node tests/desktop/packaged-epub.cjs`。该测试使用真实 `release/win-unpacked/AuraReader.exe`、新建独立 profile、非项目根目录的独立测试工作目录、没有 Node 的 PATH，并关闭网络。实际通过以下阶段：

- 原生 Web Worker 存在，并完成 EPUB 导入、ZIP／XML 解析和 IPC 保存；无 Worker 缺失 fallback。
- app.asar 内 Node ZIP Worker 能使用 zip.js CJS 入口并动态导入共享 `.mjs`，出版物嵌套 CSS 生效，段落颜色为 `rgb(12, 88, 166)`。
- 字体实际通过 `document.fonts.load` 返回 1 项；图片状态 200 且原 SVG 字节正确；阅读文档 Readium before 样式为 15214 字符；保存的归档为 532520 个 Base64 字符。
- 重载后可重新打开书籍并加载图片。

**最终正常退出断言失败，整条打包运行测试未通过。** 首次 CDP `Browser.close` 和第二次实际应用 `window.close` 都未结束进程，均被 90 秒 watchdog 终止，exitCode=null、signal=SIGTERM。未将 watchdog 终止当作成功，也未加入强制退出的产品代码。

资源中间证据：`.commandcode/packaged-epub/run-8VX3Wj/resources.json`。两次失败报告和进程日志分别保留在该目录及 `run-rRS3Kn/`；顶层命令日志为 `.local-materials/compatibility-2026-11-12-packaged-epub.log`、`compatibility-2026-11-12-packaged-epub-window-close.log`。

关闭对照检查限定为本机当前 Electron 与当前项目：

| 探针 | 结果 |
|---|---|
| 项目源码、打开 EPUB、调用原生 BrowserWindow.close | 已触发 window-all-closed／before-quit／will-quit／quit，但进程仍存活，15 秒后终止 |
| 项目源码、新建空书库、不导入 EPUB／不启动出版物资源 Worker | 同样失败，排除故障仅由 EPUB 或该 Worker 引入 |
| 空书库，内存中临时延后 app.quit | 同样失败；未修改实际业务文件 |
| 空书库，临时撤销 aurareader 协议 handler | 同样失败；未修改实际业务文件 |
| 不加载任何项目代码的最小 Electron BrowserWindow | app.quit 正常退出 0 |

原生关闭探针与日志保留在 `.local-materials/compatibility-close-probe.cjs`、`compatibility-minimal-electron.cjs` 及 `compatibility-2026-11-12-close-*.log`、`compatibility-2026-11-12-minimal-electron.log`。结论仅支持项目集成关闭路径仍有问题；尚未定位完整根因，不能认定为权限／helper／沙箱失败，也不能归因于本次 CSS 转换或 Node Worker。未采用缺乏根因依据的业务改动。这与 P0 已保留的退出待验项有关，但本轮证据不能说明它在所有机器上的表现。

## 交付边界

本轮产物是完成静态校验的本地候选包，**未达到完整运行通过或可发布结论**。正常退出仍是阻断项。真实安装／升级／卸载、向导、干净 Windows、签名、旧专项稳定性和完整 EPUB 样书矩阵均未执行；不使用历史安装记录替代。本轮未创建 GitHub Release，也未发布。
