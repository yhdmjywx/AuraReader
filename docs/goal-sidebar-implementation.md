# Goal Sidebar 实现记录

2026-10-26。先按用户要求将首版 Goal 实现提交为 `de72df0`，再实现用户选定的 Sidebar 及宽度调整。

本文记录 `89defc4` 的 Sidebar 阶段。随后完成的跨书延续、独立 Goal 页面与全局存储见 [下一阶段实现记录](goal-cross-book-implementation.md)；当前顶部 `Goals` 用于页面导航，侧栏使用独立图标收放。

## 范围

用户确认本轮只做 Sidebar 与宽度调整，保持现有存储和备份规则。Goal 仍沿用现有书内数据；跨书独立 Goal 本轮未实施。高亮、笔记、导入、导出、数据库和备份模块没有改动。

## 展示与交互

- 左侧栏占用独立布局空间，使用应用背景和文字颜色，跟随应用明暗主题；正文与页边笔记仍使用原来的纸张主题。
- 默认宽度 280px，拖动右边界在 220–640px 之间调整，实际最大值同时保留至少 720px 阅读工作区。记住用户偏好，窗口暂时收窄时只限制实际宽度，不覆盖偏好。
- 顶部 `Goals` 收起／重新展开；结束 Goal 编辑并确认保存后才收起。单页窗口不足 940px、双页或滚动模式隐藏侧栏，保留原数据和宽度偏好。
- 分隔条可键盘聚焦：左右键每次调整 10px，Shift 加方向键每次 40px，Home/End 调至当前最小／最大宽度；双击恢复默认值。Escape 或 pointercancel 取消本次拖动。
- 拖动保留 Goal 编辑器和光标。笔记保留既有“点击外部结束编辑并保存”的规则，不修改笔记事件处理。
- 保留原树、原位编辑、归入后自动展开、选择后自动展开、回原文与解除关联。标题处的 `All goals`／`Current goal` 对应同一树切换。

实现位于 Goal 的布局／控制器、挂载 DOM、样式和 main 装配。现有阅读工作区使用剩余宽度；通过同一窗口 resize/refit 路径更新排版，未修改阅读、标注或导出算法。

## 验证

- 严格 TypeScript、共享契约与桌面检查通过。
- `npm test`：55 项检查，0 失败，包括既有高亮、笔记、导入、导出、备份及新增分隔条交互检查。
- 真实 Electron 验证拖动、Goal 光标保留、原笔记外部点击保存、宽度记忆与收放、宽侧栏使用原排版几何、窄窗与模式切换、主题、保存失败时阻止关闭及切书。
- 窄工作区的断言根据实际 DPI 下的工作区宽度计算，不假定 Windows 内容窗口一定精确落在请求的整数 CSS 像素上。

`node scripts/test-desktop.cjs` 完整桌面回归通过，证据位于 `.commandcode/desktop-tests/run-otQpwt/`，包含 `goal-results.json`、默认宽度 `goal-default.png`、宽侧栏 `goal-wide.png` 和深色 `goal-dark.png`。已检查默认和深色截图。完整回归日志为 `.commandcode/goal-sidebar-tests.log`、`.commandcode/goal-sidebar-desktop.log`，`git diff --check` 通过。

最终截图复核位于 `.commandcode/goal-targeted/run-DbT1gy/`，该次 Goal 桌面用例通过，并等待原有纸张颜色过渡和响应式排版完成后再捕获深色效果。

本轮未重跑 300 秒存储稳定性测试，存储模块保持首版提交原样。
