# Goal 自输入与区域 UI：实现及验证

日期：2026-11-10。

状态：侧栏与现有完整 Goal 工作区的自输入、统一内容列表和 02 区域 UI 已接入源码。生产构建、浏览器操作和相关自动检查完成；桌面回归的功能断言完成，但进程退出超时，不能记为桌面整体验收通过。未制作、安装或发布新安装包。

## 范围及用户确认

- 实施前已提交已有工作区改动，基线 commit：`98c73a7`，`chore: checkpoint workspace before goal user input implementation`。包含原有 Wiki、桌面接口、文档整理及本模块设计文档；`release-fixed/` 构建产物未纳入提交。
- 本轮增加 Goal 所属的多条独立多行文字记录，并与 Highlight、Note 在子 Goal 下方共同显示，新加入当前 Goal 的内容在上，编辑不改变加入顺序。
- 采用 Figma `14:581`、`288:1835` 及独立记录状态 `284:1877`：被动区域图标、水平分界线、文档＋入口、文字类型图标、原位编辑、hover/focus 行操作和错误反馈。
- 用户确认：归档、删除、恢复 Goal 时保留和恢复自写内容；彻底删除 Goal 时清除所属记录。未增加自写内容的独立回收站或 Undo。
- 用户确认：自写内容不进入逐书备份。
- 用户确认：本轮只实现侧栏与现有完整 Goal 工作区，Home 打开该工作区的入口留待后续。没有增加 Home 菜单项，也没有改变其进入 Goal 文件夹的导航路径。
- Response 的操作与视觉继续待设计。本轮仅保留 Goal 内的 Response 元数据结构和独立顺序能力，没有新增标签控件、自动标记或置顶行为。

## 实现结构

| 文件 | 职责 |
| --- | --- |
| [goal.ts](../../../../src/client/domain/goal.ts) | `GoalInput`、独立草稿、统一顺序及 Response 元数据；扩展全局状态 |
| [goalContentEngine.ts](../../../../src/client/domain/goalContentEngine.ts) | 自写记录增删改、材料加入顺序、统一内容查询、兼容旧关联顺序 |
| [goalController.ts](../../../../src/client/features/goals/goalController.ts) | 一个活动编辑会话区分 Goal 与自写记录；冻结所属 Goal；协调保存、恢复、删除及反馈 |
| [GoalContentList.tsx](../../../../src/client/features/goals/GoalContentList.tsx) | 统一列表、区域入口；复用材料展示、跳转和解除关联动作 |
| [GoalUserInput.tsx](../../../../src/client/features/goals/GoalUserInput.tsx) | 多行原位输入、IME 保护、编辑/删除、Retry 和关闭错误提示 |
| [goalLibraryRepository.ts](../../../../src/client/infrastructure/goalLibraryRepository.ts) | 复用版本化保存队列，新增专用自写草稿缓冲；按匹配 ACK 清理 |
| [goalLibrary.js](../../../../src/server/goalLibrary.js) | 共享 HTTP/IPC 校验、兼容旧命令、全局状态迁移及来源清理保护 |
| [goalLifecycle.ts](../../../../src/client/domain/goalLifecycle.ts) | 彻底删除 Goal 分支时清理所属自写记录；其他生命周期保留 |

界面复用现有 React、Base UI Button/Textarea、CSS 变量及 Remix SVG 路径。没有引入 UI 框架、字体依赖或临时 Figma 资产 URL。Highlight、Note 的 Link 组件及 `GoalMaterialText` 保持原实现。删除了 Linked 折叠入口及控制器中的 `itemsOpen` 状态。

相对架构草案的兼容细节：公共 `GoalLibraryState` 的新增字段允许缺省，以承接旧快照、既有调用与冻结命令；加载和服务端迁移后规范化为 `formatVersion: 2`。原 Goal 标题编辑器保留其尾部空行处理，独立文字编辑器复用同一区域的基础组件、键盘约定和控制器写入链路，没有将 Goal 标题特例扩大到所有文字记录。

## 保存、恢复与备份边界

- SQLite `user_version` 从 4 升至 5，在现有初始化事务中补充全局 Goal JSON；不改变书籍、标注正文。保留高版本库拒绝降级打开的保护。
- 新建文字先保存专用本地草稿，结束编辑时将非空内容加入列表；新草稿为空则丢弃。已有记录清空不删除，恢复最近非空文字；删除须使用明确动作。
- Enter 换行；失焦、Escape、Ctrl/Cmd+Enter 结束编辑。IME 期间不提前提交；编辑节点与选区在视图刷新时保持稳定。
- 继续使用 `stageLibrary` / `flushLibrary`、revision、`opId` 和串行队列。旧命令保留原身份；缺少新字段的旧快照保留已存自写内容，无法保持所属完整性时拒绝写入。
- 只有匹配内容的 ACK 清理对应草稿；旧 ACK 不清除之后输入的新文字。失败保留待写内容；关闭提示不确认保存，导出/关闭检查仍会发现未确认写入。
- 逐书 `goalGraph` 不含 `inputs`。逐书恢复不导入自写记录，也不删除目标库已有的记录。整库 SQLite 一致性备份覆盖已保存的自写内容；本地未确认草稿不等于数据库备份。
- 删除书籍或原标注只清理来源关联，保留 Goal 自写内容。

## 验证结果

| 检查 | 结果与范围 |
| --- | --- |
| `npm run build` | 通过严格 TypeScript、契约检查及生产构建；最终 CSS 间距调整后再次通过 |
| `npm test` | 73 项检查，72 通过、1 失败。唯一失败为基线已有 `test_english_ui.js`：Wiki 的“简体中文 / 繁體中文”选项被英文扫描判定不合规。已核对这些字符串在基线 `98c73a7` 中存在，本轮未改动 Wiki |
| 新增领域检查 | `test_goal_content.js` 通过：独立多行记录、所有权、统一顺序、编辑不重排、Response 不置顶、生命周期保留与清理 |
| 新增交互/恢复检查 | `test_goal_input.js` 通过：无书依赖的控制器与编辑器、IME/选区、连续点击、空内容保护、失败/重试/关闭反馈、延迟 ACK、生命周期、逐书排除与恢复草稿 |
| 新增存储检查 | `test_goal_input_storage.js` 通过：真实 SQLite v4→v5、旧命令精确重放与新数据保留、非法记录回滚、归档写入限制、来源删除及整库备份 |
| 既有 Goal 检查 | 全量测试中 Goal 创建/编辑、跨书材料、来源跳转、解除关联、备份、恢复、生命周期检查通过；旧折叠和加入顺序断言按已批准需求更新 |
| 内置浏览器操作 | 在隔离本地库中实际创建/编辑多行文字、Ctrl+Enter、Escape、连续点击新建子 Goal、键盘进入编辑、清空保护、完整工作区共享、刷新重开均验证；区域不是按钮，16px 父标题及 13px 自写正文保留；分界处和记录间距均为 4px |
| Electron `reading-workflow.cjs` | 增加真实 IPC 保存、IME 保护、清空保护、记录顺序及重载后自写内容断言。两次运行均输出完整流程 PASS，随后测试进程未退出并触发 90 秒超时；整体命令不能判为通过。一次复核后停止环境重试，未修改业务代码绕过退出问题 |
| `git diff --check` | 通过 |

浏览器验证使用独立测试库，不修改用户现有书库。最终界面截图位于本地 `.local-materials/goal-input-qa/goal-sidebar-final.png`。构建与测试日志在 `.local-materials/goal-input-*.log`；这些本地证据不纳入 Git。

必要的相关测试修正：Goal 测试夹具在销毁 DOM 前取消既有反馈计时器，避免生命周期通知延迟回调访问已销毁的 `window`；没有改变产品的通知时长或操作行为。

## 交付边界

- 本轮交付源码及验证记录，没有制作、安装或发布新安装包；已有 `release-fixed/` 不代表包含本次实现。
- Home 入口按用户决定延后。无书籍记录已在控制器/编辑器层验证，但没有完成无书籍用户从 Home 进入该内容模块的完整界面路径。
- Response 元数据不是已完成的标签功能；标记入口、标签视觉与后续联动置顶继续未启用。
- 真实中文输入法候选窗、触屏和所有窄窗口组合未作完整验收；组合事件的防提前提交已通过自动检查。
- 桌面进程正常退出、桌面关闭时未保存内容保护的端到端验收、安装包及安装后验证仍未完成。
