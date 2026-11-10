# Response 实现与验证

日期：2026-11-10。状态：已接入源码中的阅读侧栏和现有完整 Goal 工作区；未打包、安装或发布。

## 本轮交付

- Highlight、Note 和已保存的自写记录共用图标入口，菜单仅含一个可切换的 `Response`，默认向左展开。入口本身只开关菜单；选择后关闭并自动保存。
- 已标记条目显示浅灰内容块和加强标签。Note 的引文、评论与来源作为一个整体；标记、取消、编辑均不改变加入顺序，也不自动完成 Goal。
- 继续使用原自输入编辑器、IME／多行规则及编辑、删除动作。材料继续使用原展示、跳转和解除关联动作。Home 工作区入口仍延后，没有增加其他标签或筛选。
- 保存期间显示 `Saving…`；失败保留最新选择，提供 `Couldn’t save Response.`、Retry 和关闭。关闭后显示 `Not saved`，不清空待保存数据。
- 菜单支持鼠标、键盘、Escape、外部点击、焦点返回和碰撞避让；切换 Goal、进入编辑、条目消失或禁用后清理失效菜单。

## 已确认的关联规则

用户本轮明确：**Response 跟随当前 Goal 下的关联保存；恢复原关联时保留，新建关联时重新判断。**

- 自写记录：保存在该 Goal 拥有的 `GoalInput.response`。
- 材料：保存在当前 Goal 的 `GoalSourceLink.response`，不写入原标注；同一材料在另一 Goal 中独立判断。
- 解除关联移除该关联及标记，原标注保留。通过关联入口再次加入时分配新的加入顺序，默认没有 Response；旧菜单的 Goal／书籍／版本／标注／加入顺序身份不能命中新关联。
- Goal 归档、删除及恢复保留原记录和关联的 Response；彻底删除沿用原分支清理规则。
- 逐书备份沿用现有 `goalGraph.links` 保存关联及其 Response；恢复备份中的原关联时保留标记，按原恢复逻辑绑定恢复后的书籍版本。未新增独立标记库、按文本猜测匹配或自动继承。
- 自写记录仍不进入逐书备份；整库 SQLite 备份覆盖已保存的自写记录和关联。没有另行修改备份冲突优先级。

## 实现位置

| 文件 | 职责 |
| --- | --- |
| `src/client/domain/goalContentEngine.ts` | 固定内容身份、幂等设置／取消、新关联清除旧角色；保持原排序和正文时间 |
| `src/client/features/goals/GoalResponse.tsx` | 独立标签菜单、条目外观和行内保存反馈 |
| `GoalContentList.tsx`、`GoalUserInput.tsx` | 统一组合和局部动作插口，保留原编辑器与操作 |
| `goalController.ts`、`goalUI.tsx` | 共享动作、乐观状态、固定目标、重试和反馈 |
| `src/client/infrastructure/goalLibraryRepository.ts` | 在原待写队列条目附加 Response 意图身份，按匹配 ACK 清理；重启恢复待写状态 |
| `src/server/goalLibrary.js` | 校验归档／删除 Goal 中的标记变更；受信任的备份恢复保留历史标记 |

Response 意图只属于本地恢复队列，不改变存储请求协议。冻结的 `opId`、请求体和重试规则保留；先幂等确认旧冻结命令，再提交最新快照，旧回包不会覆盖界面中的最新选择。未引入第二套保存队列或新数据库迁移。

## 验证

- `npm run build`：通过，含严格 TypeScript 和契约检查。
- `npm test`：74 项中 73 项通过；唯一失败为原有 `test_english_ui.js`，指向 Wiki 中的 `简体中文`／`繁體中文` 语言名称。本轮未修改 Wiki。
- 最后补充菜单失效清理及恢复检查后，重新构建并运行 `node tests/regression/test_goal_response.js`：通过；追加归档原关联恢复／取消写保护检查后，`node tests/regression/test_goal_input_storage.js` 通过。
- 新增 Response 回归覆盖三类内容、菜单只展开不标记、Escape 焦点返回、整条 Note、原编辑节点和选区、侧栏／工作区共享、延迟 ACK、断网／关闭错误／重试、恢复队列重载、跨 Goal 隔离、新关联无标记、旧目标失效、逐书恢复原标记和 Goal 生命周期。
- 扩展领域测试覆盖幂等标记／取消、不排序／不完成及归档限制；扩展真实 SQLite 测试覆盖归档材料的 Response 写保护。现有 Goal、自输入、恢复、备份、来源删除及共享菜单相关回归通过。
- 内置浏览器使用独立 SQLite 测试库验证鼠标、Space／Enter、Escape、外部点击、左侧菜单位置、刷新后保留、失败取消保持最新选择、关闭后 `Not saved`、Retry、三类内容及共享工作区、编辑隐藏操作与原正文保留。菜单宽度 128px，左侧约 5px，垂直居中。
- 同一浏览器将侧栏缩至 240px 后，菜单回退右侧且保持在视口内，没有横向溢出；验证后恢复至 280px。最终隔离库截图：`.local-materials/response-implemented.png`（本地验证材料，不进入产品资产）。
- 自动检查存在已有 React `act(...)` 提示，不影响断言结果。未运行 Electron 专项、未生成新安装包。

## 设计证据边界

本轮依据用户提供的 Figma 总览图、功能需求及已确认交互文档实现。尝试读取菜单 `312:2443` 时仍触发 Figma MCP Starter 调用额度上限，未取得新的实时画布证据，也未修改 Figma。Figma 自身未完成的组合和属性修正仍以 [design.md](design.md) 为准；源码完成不等于 Figma 全部状态稿完成。
