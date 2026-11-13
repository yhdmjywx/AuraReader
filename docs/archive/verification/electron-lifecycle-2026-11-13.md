# Electron 关闭生命周期修复（2026-11-13）

## 范围与行为保持

本次修复窗口销毁后的清理及同类异步竞态。沿用原有保存确认、恢复缓冲、IPC 来源校验、文件操作授权与阅读器边界。未修改界面、EPUB 排版、数据库 schema、Goal／Response 语义、字体选择规则或依赖版本。保留工作区原有 Response 设计记录、对应 profile 段落与 `release-fixed/`。

## 问题与修复

1. **Wiki 清理访问已销毁窗口。** `main.cjs` 在 `closed` 中调用 `removeWikiHandlers`，该函数重新读取 `window.webContents`，抛出 `Object has been destroyed`，中断关闭清理。新增单元回归在修改前直接复现 `ipc.cjs:46` 的异常，见 `.local-materials/lifecycle-2026-11-13-before.log`。`registerWikiIpc` 现保存原 WebContents 引用，取消未完成请求、移除监听及 IPC，允许重复清理。
2. **迟到的关闭回调。** 崩溃分支的 `storage.settle().then(...)` 与成功确认后的 `setImmediate` 原先可能再次操作已销毁窗口。`coordinateClose` 现复查存活／释放状态，释放时清空待确认请求、计时器与窗口监听；保存等待完成后再次校验来源和请求有效性。失败保存、伪造请求和原有超时保护继续有效。
3. **清理链被单项异常中断。** 主窗口现逐项执行独立清理，记录异常并继续释放其余资源。源码桌面 runner 和打包回归均将 `Desktop cleanup failed` 视为失败，不能仅凭进程退出掩盖错误。
4. **资源 Worker 关闭后可重新启动。** 服务加入终止状态，关闭时拒绝活动／排队请求，拒绝关闭后的新请求，并忽略旧 Worker 的迟到消息。正常运行时的并发、读取、异常后恢复与缓存策略不变。

## 测试覆盖与现有行为

- `test_desktop_lifecycle.js`：销毁后的清理、Wiki 请求取消、重复清理、重复关窗、失败保存、伪造确认、存储等待期间销毁及已排队关闭期间销毁。
- `test_publication_worker_lifecycle.js`：真实 ZIP 读取、四个活动加排队请求关闭时均完成拒绝、重复关闭以及关闭后禁止重建 Worker。
- 默认 `test:desktop` 继续原有完整阅读／IME／Goal／跨书／导出／备份／重载断言，成功末尾改用 `window.close()`，由父进程要求自然退出 0。
- 新的原生 `lifecycle.cjs` 检查空书库关闭、Wiki 未完成时取消、重复关闭、实际 SQLite 锁竞争拒绝关闭、恢复缓冲与末次编辑保留、解锁后恢复及关闭后的 SQLite 完整性／内容。
- 现有文件对话框后的授权复查、renderer 保存顺序及笔记／Goal 恢复保护均未移除。已有 Node 回归继续覆盖只读、CAS、响应丢失、恢复、导入导出及业务关系。
- 打包 EPUB 回归将 exe 与 app.asar 复制至独立临时目录，避免回退到仓库 node_modules；没有 Node 的 PATH、离线执行。除既有真实资源外，还检查末次编辑的关闭写入、磁盘 SQLite、重新启动、整条 Book／EPUB 记录及版本、Goal 记录与字体偏好保持一致，以及两次自然退出。临时程序副本在结束后删除，独立书库和报告保留。

### 相关测试设施调整

首次完整桌面回归在最后反馈截图阶段达到旧 60 秒 watchdog，尚未进入关闭检查，renderer error 为空；最后成功截图为 `reader-success-feedback`。保留原断言和截图，仅将内部限时调至 80 秒，外层 90 秒进程上限继续有效。失败证据：`.local-materials/lifecycle-2026-11-13-desktop.log`；后续通过证据见最终验证日志。

## 验证记录

- `npm run typecheck`：通过。
- `npm test`：81 项、0 失败；日志 `.local-materials/lifecycle-2026-11-13-tests.log`。
- 源码真实桌面回归通过：`.local-materials/lifecycle-2026-11-13-desktop-final.log`，独立产物 `.commandcode/desktop-tests/run-D62TtC/`。后续 runner 输出捕获和拒绝清理错误也纳入最终复验。
- 最终 `npm run test:migration`：16 项、0 失败，日志 `.local-materials/lifecycle-2026-11-13-migration.log`。
- 最终 `npm run test:desktop`：完整阅读流程、空书库、实际写入受阻与恢复全部通过，三个子进程均自然退出 0。日志 `.local-materials/lifecycle-2026-11-13-desktop-verified.log`；独立产物 `.commandcode/desktop-tests/run-UH9vaf/`。
- `npm ls --depth=0`：通过；Node v24.16.0、npm 11.13.0、版本及 lock 一致性通过。
- `npm run dist:win`、独立 `npm run verify:package`：通过，日志分别为 `.local-materials/lifecycle-2026-11-13-package.log`、`lifecycle-2026-11-13-package-verified.log`。20 个 ASAR 本地模块逐字节匹配当前源码，66 个 renderer 文件匹配当前构建。
- `node tests/desktop/packaged-epub.cjs`：通过，日志 `.local-materials/lifecycle-2026-11-13-packaged-verified.log`；报告 `.commandcode/packaged-epub/run-ckKgBU/results.json`。两次真实 exe 自然退出码均为 0，关闭末次输入已落入 SQLite，冷启动后笔记、整条书籍及版本、Goal 记录和原书字体偏好保持一致。

打包测试新增笔记步骤曾暴露两项测试设施问题：直接返回 React DOM 给 CDP 导致对象链序列化失败；程序化更新笔记模型后立刻结束编辑可能读到尚未同步的 textarea。已将共用等待条件改为布尔值，并通过现有兼容保存入口建立基线笔记、使用现有全书笔记范围，再检验真实编辑器末次输入。未修改业务代码、笔记过滤规则或关闭写入断言。诊断状态保留在 `.commandcode/packaged-epub/run-8Om3Tg/failure-state.json`，早期失败日志为 `.local-materials/lifecycle-2026-11-13-packaged*.log`。

## 本轮产物

| 文件 | 验证结果 |
|---|---|
| `release/AuraReader-Setup-1.0.0-x64.exe` | 131652006 bytes，SHA256 `5c6f1c0b708529642ad4a5d01d574ee7bfac3faa7e8892f4f820dcbec78dabdb` |
| `release/AuraReader-Setup-1.0.0-x64.exe.sha256` | 与重新读取安装包得到的散列一致 |
| `release/win-unpacked/resources/app.asar` | SHA256 `15f90b8448110d81ca9a3003c26b510f67946daf74c639f68521f14ef4be10b3` |
| `release/package-verification.json` | 静态检查通过，8094 条目、15 项必需资源、20 个本地模块、66 个 renderer 文件及 fuses／许可证 |
| `release/runtime-verification.json` | 本轮 ASAR 的仓库外、离线、正常关闭／冷启动及数据保持检查通过，与上述 ASAR 散列一致 |

主程序和 NSIS 安装包经 Authenticode 检查均为 NotSigned。

安装、升级、卸载不属于本轮自动执行范围；真实安装和正式发布仍需单独授权。历史失败报告保留，不覆盖旧产物散列的验证记录。
