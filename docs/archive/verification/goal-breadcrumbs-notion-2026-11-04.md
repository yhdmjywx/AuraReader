# Goal 路径模块实现与验收

日期：2026-11-04。

后续状态：用户于同日要求用 Git 回退到原设计。路径模块的代码和测试已撤销，恢复 Home／上一级导航；本文保留为该次探索的历史验收记录，不代表当前实现。远程 Figma 未随 Git 回退修改。

回退核验：相关源码和原有桌面测试脚本与 `75c832e` 一致；生产构建、`test_goal_interaction.js` 和 `test_goal_home.js` 通过。内置浏览器已确认 Home／上一级按钮恢复，进入子 Goal 后点击上一级可返回父 Goal。此前保存的需求与设计文档保留，并将当前设计状态更新为原导航；其他工作区改动保留。

本轮只替换共享 Goal 工作区中的 Home／上一级导航，采用 Notion 的点击进入、悬停查看同级方案。侧栏布局、内容区、创建和材料操作保持原样。原始需求文档保留为历史记录；本轮批准的行为已更新到 Design System 和 Design Index。

## 实现

`GoalBreadcrumbs.tsx` 使用现有 Button、ActionIcon、Base UI Popover 和 Goal 父子关系。命名路径项共用一个同级列表；沿用 Library／ongoing 范围。Goals 点击返回根列表，没有悬停树。列表允许鼠标移入、选择，离开后关闭。路径点击经 `GoalController.navigateGoal` 检查保存；失败时保留原选择和可编辑内容。没有增加数据库结构或依赖。

Figma 插件复用原基底 `97:5543` 和选择器 `97:6051`，改为平面同级列表；原布局、正文和其他组件未重设计。旧局部交互总览改为三个路径示例，没有复制整张工作区形成状态矩阵。

- [Figma 三个路径示例](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=122-1756)
- [Figma 交互原型](https://www.figma.com/proto/eib6b1sDBsFa7hTzY2Zmsi?node-id=105-1769&starting-point-node-id=105%3A1769)

## 简单验收

1. 悬停当前项和祖先项，分别出现正确的同级列表；移入列表保持打开，移出关闭，悬停不改变编辑焦点。
2. 点击路径文字或列表中的 Goal，列表收起，路径、标题、子 Goal 和材料同步更新；Goals 返回根列表。
3. 编辑中执行路径导航，先保存再切换；模拟保存失败，保留原 Goal 与编辑内容，恢复保存后可以重试。

内置浏览器对真实本地应用完成前两项及实际编辑保存流程；第三项的失败恢复由真实控制器、React 视图和 SQLite 专项回归验证。本地应用使用独立临时数据库，不连接日常书库。刷新后重新打开书籍，仍能看到保存后的 `Listening revised`。

Figma 原型使用实际鼠标完成同级选择、祖先列表、返回根层级和路径项之间的连续悬停；确认当前项标记随选择更新。应用验收主要依据 DOM 和可见状态；Figma 画布以实际鼠标操作后的画面确认。截图仅保留结果。

## 检查结果

- `npm run build`：通过，包含严格类型检查。
- `node tests/regression/test_goal_breadcrumbs.js`：通过。覆盖同级范围、指针保持、输入焦点、直接进入、保存失败和恢复后的 SQLite 数据。
- `node tests/regression/test_goal_interaction.js`：通过。
- `node tests/regression/test_goal_home.js`：通过。
- `node tests/regression/test_goal_lifecycle.js`：功能断言输出 PASS，但随后 `GoalActions` 提示定时器在 jsdom 已关闭后调用渲染，产生 `ReferenceError: window is not defined`，进程退出码为 1。重复单独执行可复现。该提示／销毁模块本轮未改动；未将它记为通过，也未扩展修复。
- Electron 检查未运行；两个受旧导航选择器影响的桌面脚本已随控件替换更新。没有构建或安装桌面安装包。

交付为源代码、生产 Web 构建与 Figma 路径模块，未提交、推送或发布。
