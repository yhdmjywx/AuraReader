# 首页与导航实施及验证记录

日期：2026-10-28。依据：[改动计划](home-navigation-change-plan-2026-10-28.md)。源码已落地，自动回归通过；完整桌面总回归未通过，剩余绘制验收见下文。

## 已落地行为

- 已建库启动／刷新统一进入 Library，不自动选择书籍或安装示例；首次桌面建库使用独立状态面板。浏览器初始化失败提供可见的重试按钮，失败后可重新执行启动。
- `app/navigation.ts` 统一首页、阅读与 Goal 全页的状态；首页浏览状态、阅读 Goal、书籍与位置分别保留原归属。兼容的 `home.active`、`goals.page` 为派生值。
- 首页开书在正文、笔记加载成功后才提交阅读 Goal 与页面，根层开书进入无 Goal 阅读；失败保留原上下文。继续阅读和 Goal 全页返回复用现有正文与锚点。
- 导航请求使旧开书／导入请求失效；过期导入不能取消新开书，迟到的标注定位不能在离开正文后弹出菜单或滚动正文。切页会关闭临时浮层、应用工具栏状态并移交焦点。
- 删除当前书清空运行时正文并回首页，不重建示例书；恢复备份后回首页，替换当前书时不能继续旧正文。保存与恢复缓冲、Goal 与原文关联规则保留。
- 本批未实现跨重启阅读进度，不改双页能力、数据库格式或安装包。

## 自动检查

`npm test` 最终退出 0：**64 项检查、0 失败**，包含 strict TypeScript／契约构建，以及新增 `tests/regression/test_app_navigation.js`。最终日志：`.commandcode/home-navigation-tests.log`。

新增用例执行真实应用装配、实际控制器和隔离 SQLite 服务，覆盖有书冷启动、阅读／Goal 往返、健康首屏、失败开书、失效跨书标注、保存阻断、迟到开书、过期导入与新请求竞争、草稿不自动提交、当前／其他书删除及真实备份恢复。原有章节跳转单元测试补充其依赖的 Session；既有数据与保存回归断言保留。

`git diff --check` 通过。日志中的只读库、导出目标缺失等报错属于故障注入用例，以断言与最终退出码判定，未删减故障断言。

## 真实 Electron 证据与边界

- 早期专项 `npm run test:desktop -- goal-home.cjs` 退出 0，证据在 `.commandcode/desktop-tests/run-tn9ww8/`。检查了真实指针操作、首页／阅读／Goal 往返、锚点、焦点、开书失败保留、关联失败重试、窄窗口与缩放。随后从截图发现并修复健康首页残留的初始化提示；因此该次早期成功不替代最终版本全量验收。
- 最终版本总回归使用已构建源码执行 `node scripts/test-desktop.cjs`。`.commandcode/desktop-tests/run-CaP0v1/` 的 `results.json`、`restart-results.json`、`note-interaction-results.json`、`goal-results.json` 均为通过。覆盖实际主程序、冷启动首页、进程重启与关闭前保存、笔记及 Goal 交互；主程序的 CSP／权限断言通过，安全策略未改动。
- 同轮首页检查通过了健康首屏、实际选书、返回首页浏览另一个 Goal后继续阅读、Goal 全页返回、正文锚点和阅读 Goal 保持、焦点及开书失败保留。`home-welcome.png`、`home-resumed-reading.png`、`home-open-failed.png` 已目视检查。该轮在 200% 缩放截图等待时未完成，不能把完整桌面命令记为通过；日志为 `.commandcode/home-navigation-desktop-final.log`。
- 对截图等待补充阶段截止时间后，最终专项在 `.commandcode/desktop-tests/run-d8F1XW/` 明确报出 `Capture home-existing-reader.png stalled: initial frame`：绘制帧请求 5 秒内未回调。日志为 `.commandcode/home-navigation-desktop-focused-final.log`。截图等待现在允许有限动画正常取消，不等待无限动画；没有放宽产品行为断言或修改 Electron 隔离配置。

因此，**最终完整首页截图矩阵、独立 import-first 重载分支、Goal 生命周期桌面分支仍待补验**；自动回归中的导入、恢复、生命周期与持久化检查已通过。已建库进程重启首页由主程序／restart 用例验证；不得据此宣称所有 GUI 分支已验收。

按全局环境失败约定停止继续改业务代码和反复 GUI 尝试。恢复可交互绘制环境后，先运行约定的 `docs/scripts/codex-win-health.ps1` 或 `docs/scripts/Start-CodexClean.ps1 -Restart`，再执行 `npm run test:desktop`。当前仓库没有这两个维护脚本，应从用户维护的脚本位置运行，不在本批自行创建替代脚本。

所有测试使用独立临时库／profile，未读取或覆盖日常书库。本轮未打包、安装、提交、推送或发布。
