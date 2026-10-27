# Goal 生命周期验证记录

日期：2026-10-27。验证工作区源码，不代表安装包已经重新制作或验收。

## 验证范围

- 父 Goal 完成时向下完成全部后代，包括已归档后代；子 Goal 完成不影响父级，重新开启仅作用于自身。
- 完成、归档相互独立；归档分支及恢复保留层级、完成状态和单独归档的后代。
- 共享的三点菜单、右键菜单、确认框和撤销；Library 中的归档、最近删除、搜索、原路径与完成状态筛选。
- 删除进入最近删除；恢复原位置、连同必要祖先恢复、恢复到根层级、永久删除分支。
- 永久删除只清除 Goal 和相关关联，原始书籍、高亮、笔记及其他 Goal 的关联继续保留。
- 归档或删除当前意图时清除 Goal 选择，保留当前书籍和阅读位置；恢复不自动选择意图。
- SQLite 保存、服务重开、Renderer 重载、每书备份图中的生命周期字段、写入失败后的恢复缓冲与重试。

## 本轮发现并修复

1. 菜单、确认框的方向键会冒泡到全局阅读快捷键。改为在控件内处理并阻止传播；原生筛选框也不触发正文翻页。
2. 首页把生命周期操作中的临时忙碌误当作不可用，成功后残留错误提示。改为只根据真实禁用状态或保存错误显示错误与重试。
3. 尚未确认的书籍关联可能被新归档或删除的 Goal 挡住。操作前检查分支的恢复缓冲：已保存的关联清理确认记录，未保存的关联先保留并要求恢复关联后重试。
4. 新增筛选框在桌面键盘导航中使用了过细的浏览器默认焦点轮廓。补齐与现有 Goal 控件一致的焦点样式。

桌面测试还修正了设备缩放下的窗口宽度取整、缩放完成等待，以及 200% 页面缩放时真实鼠标输入的坐标转换；这些修改只在测试代码中。

## 验证结果

- `npm test`：63 项，0 失败；包含严格 TypeScript 和类型契约检查。
- `tests/unit/test_goal_lifecycle.js`：完成方向、重开、新子 Goal、归档继承、恢复、永久删除、字段校验及 12,000 节点树通过。
- `tests/regression/test_goal_lifecycle.js`：真实 HTTP/SQLite、菜单和撤销、搜索及原路径、归档材料只读、服务重开、备份图、失败写入重试、待确认书籍关联及键盘隔离通过。
- 真实 Electron 首页回归通过，含长书名、800px 窗口、200% 缩放、暗色主题和书籍关联失败恢复。
- 真实 Electron 生命周期专项通过，含真实右键与鼠标、完成和撤销、归档、恢复确认、最近删除、Renderer 重载、永久删除及原始数据逐项比对。
- `npm run test:desktop`：最终完整套件通过，退出码 0。主流程、进程重启、批注交互、Goal 交互与可见性、首页、先导入书籍流程和生命周期专项共 8 份报告的 `passed` 均为 `true`。最终证据目录为 `.commandcode/desktop-tests/run-nMeHcE/`。

代码回归日志：[goal-lifecycle-regression.log](../.commandcode/goal-lifecycle-regression.log)。

完整桌面日志：[goal-lifecycle-desktop.log](../.commandcode/goal-lifecycle-desktop.log)。

最终生命周期报告：[lifecycle-results.json](../.commandcode/desktop-tests/run-nMeHcE/lifecycle-results.json)。

生命周期专项报告及截图：[lifecycle-results.json](../.commandcode/desktop-tests/run-AXzipY/lifecycle-results.json)、[窄窗暗色 200% 菜单](../.commandcode/desktop-tests/run-AXzipY/lifecycle-menu-narrow-dark-200.png)、[删除确认框](../.commandcode/desktop-tests/run-AXzipY/lifecycle-confirm-narrow-dark-200.png)。截图已人工检查。

## 当前交付边界

最近删除已支持逐条恢复及永久删除；此前方案中的批量清空入口仍未实现。本次验证不将其算作已交付，也没有制作或验证新版安装包。

所有数据与桌面测试均使用隔离临时书库，未操作日常书库。工作区原有 README、PRD 和市场调研变更未被覆盖。
