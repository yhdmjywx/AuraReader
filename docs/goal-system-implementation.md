# Goal 模块实现记录

2026-10-26。依据 [已确认实现计划](goal-system-implementation-plan.md) 与 [最终效果稿](prototypes/goals.html)。效果稿保持原样，SHA-256 为 `7b5d1c736e7bfdfdd127f833d9c0aeac7e56d38165639dc30b643a02d4a1dc0d`。

首版已提交为 `de72df0`。后续经用户确认，展示改为可调宽度的 Sidebar；该调整及验证见 [Sidebar 实现记录](goal-sidebar-implementation.md)。本页保留首版实现证据。

## 实际交付

- 新增同级 `features/goals`、Goal 纯数据模型及 repository/recovery；沿用现有 controller、协调器、SQLite、HTTP 与桌面 IPC。
- 单页左侧原位创建和编辑自由文字 Goal，多根、多层子 Goal、父级返回、完整树与章节相关子 Goal。Enter 换行，失焦、Escape、Ctrl/Cmd+Enter 结束；中文组合输入受保护。
- 原笔记操作区和原高亮浮条增加一个 `Goal` 动作，直接归入当前 Goal。选择或归入后自动展开相关摘录，点击走现有原文定位，解除关联保留标注。保留原有笔记点击编辑及高亮独立删除。
- Goal DOM 按节点保留，只维护一个 textarea，防止刷新丢失光标及失焦吞掉下一个按钮点击。笔记输入同步更新 Goal 摘录，不重建笔记编辑器。
- 复用阅读几何，正文仍为原来的 560px 单栏；Goal 宽最多 260px，距正文 40px。左侧不足 200px、双页和滚动模式隐藏。颜色跟随纸张及主题。
- SQLite schema 从 1 增量升级至 2，增加书内 Goal 表，不改写旧书与标注 JSON。保存复用同书队列、revision、generation 与幂等命令；输入同步保留待确认缓冲，ACK 后清理。关闭、切书、删除和导出纳入原协调流程。
- 删除标注时同事务清理所有对应 Goal 关联；书籍删除保留代次屏障。恢复合并后统一校验环、孤儿、跨书及悬空关联，失败整笔回滚。
- 每书 `.aurabackup` 升级为 1.1，包含 Goal 树及按既有选项决定的关联；省略 links 与空 links 分别处理。旧备份不清除 Goal，局部恢复支持引用目标库已有父节点。SQLite 一致性备份和完整性检查包含 Goal。

## 验证

自动用例位于 `tests/unit/test_goals.js`、`tests/regression/test_goal_interaction.js`、`test_goal_backup.js`、`test_sqlite_goals.js`，并扩展既有切书、类型契约和真实桌面测试。`scripts/test-desktop.cjs` 已注册 Goal 用例，稳定性测试纳入 Goal 写入、失败重试、Renderer 恢复及主进程终止后重开。

最终验证结果：

| 检查 | 结果 |
| --- | --- |
| `node scripts/build.cjs --check` | 严格 TypeScript、共享契约及桌面检查通过 |
| `npm test` | 54 项检查，0 失败；包括备份、未提交草稿恢复、延迟 ACK、冻结归入目标及 Goal 读取迟到的切书场景 |
| `node scripts/test-desktop.cjs` | 现有桌面功能、重启、笔记编辑和 Goal 交互全部通过 |
| `node scripts/test-stability.cjs 300` | 300 秒通过；146 轮笔记及 Goal 写入、只读失败重试、关闭阻止、Renderer 日志重放、主进程强制终止重开及损坏数据库保护 |
| `git diff --check` | 通过 |
| 效果稿 SHA-256 | 与计划基准一致 |

桌面证据：`.commandcode/desktop-tests/run-HOxak0/`，包括 `goal-results.json`、`goal-single.png`、`goal-default.png`、`goal-dark.png`。稳定性证据：`.commandcode/stability/run-zK8YmL/results.json`。完整回归日志：`.commandcode/goal-final-tests.log`。这些运行产物不纳入版本控制。

截图来自隔离测试书库中的真实阅读器窗口，测试通过真实鼠标事件操作按钮；未将原型整页缩放到产品。已检查单页和深色截图，中央正文与右侧笔记位置保持原布局。自动验收可复现交互及几何结果，不替代用户对最终产品体验的主观验收。

## 范围

本轮不提供 Goal 独立材料文字条目、点赞点踩、AI、拖拽、跨书共享、删除／移动／排序、完成度或期限；这些继续保留为后续方向。Goal 自身可编辑自由文字。

不重走安装器发布流程。故障测试使用隔离书库中的 SQLite 只读模式与页数限制、真实锁竞争和进程终止；不等同于物理磁盘耗尽、真实停电或 Windows 系统关机。浏览器与 Renderer 的未确认内容依赖本地恢复缓冲，不能保证尚未产生 input 事件或尚未落盘的按键。
