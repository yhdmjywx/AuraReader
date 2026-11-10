# Goal 用户自输入、内容分类 UI 与 Response：代码架构设计

日期：2026-11-10。状态：最初为实施前增量架构设计；后续已按用户授权接入源码，实际实现与验证见 [Response 实现记录](docs/product/goals/user-input-response/response-implementation.md)。下文保留设计时的依据和待确认事项，未确认的备份冲突优先级不因此启用。

## 1. 结论与范围

采用「保留现有自输入与统一内容链路，在其上增加独立 Response 操作、条目呈现与保存反馈」的方案。自输入已经完成，本设计说明如何复用和整合，不重新建设其编辑器、草稿或持久化服务。

本文件中的“分类 UI”具体指：父 Goal／子 Goal／统一内容区的组织，Highlight／Note／自写内容的来源类型识别，以及当前 Goal 内可选的 Response 身份。它不表示增加分类树、标签筛选、自定义标签或 Response 独立分组。

本轮设计覆盖阅读侧栏与现有完整 Goal 工作区。Home 入口继续延后；MVP 不置顶、不拖拽排序、不扩展其他标签，不修改阅读器文档子树、书中标注正文或既有 Goal 导航。

### 1.1 依据及证据边界

- 产品与交互：[feature-spec.md](docs/product/goals/user-input-response/feature-spec.md)，重点为第 4、5、7 节；[interaction.md](docs/product/goals/user-input-response/interaction.md)，重点为第 5、6 节。
- 现有实现与设计事实：[implementation.md](docs/product/goals/user-input-response/implementation.md)、[design.md](docs/product/goals/user-input-response/design.md)、[设计系统](docs/design/design-system.md)、[设计索引](docs/design/design-index.md)。
- 现有代码：下文列出的 domain、GoalController、GoalUI、repository 与共享服务端实现，均在本次只读核对。
- Figma 节点与近期修改以设计记录及本地 `.local-materials/response-ux-state.json` 为依据。本次尝试实时读取，仍收到 MCP Starter 调用额度上限；未取得新的画布、属性或截图证据。

原 [architecture.md](docs/product/goals/user-input-response/architecture.md) 是自输入实施前架构回复的历史存档；其中“尚无独立记录”“需要从 SQLite v4 升级”等描述不再代表当前源码。本文件不覆盖该历史文件。

## 2. 当前基础与真正的开发增量

| 层面 | 已存在的实现 | 本次架构增量 |
| --- | --- | --- |
| 数据 | `GoalInput`、`GoalSourceLink` 均已有 `order`、可选 `response`；全局 `contentSequence` 已存在 | 增加按明确内容身份设置／取消 Response 的领域动作，复用原字段 |
| 内容组织 | `goalContent()` 已将自写记录与材料按加入顺序合并，新者在上 | 增加统一条目外观及标签动作，不改变排序 |
| 自输入 | 多行记录、单活动编辑会话、IME、草稿、编辑／删除及失败恢复已实现 | 原组件增加一个局部动作插口，保留原编辑节点及动作 |
| 材料 | 类型图标、引文／评论、来源、定位、解除关联已实现 | 在原条目操作区增加标签入口，保留原内容和命令 |
| 保存 | `stageLibrary()`、冻结命令、串行 `flushLibrary()`、revision／opId、恢复缓冲已存在 | 为 Response 增加可归属到条目的写入上下文和确认反馈 |
| 服务端 | Response 元数据格式已校验，HTTP／IPC 共用 DataStore；SQLite 当前 v5 | 补齐关联材料的 Response 可编辑性保护及兼容检查 |
| UI 基础 | React、Base UI 菜单／按钮、原位文本组件、现有中性色与动效 | 独立标签操作组件、可切换菜单项、局部定位及样式适配 |

当前源码仍无完整的 Response 操作、选中菜单和按条目的标签保存反馈。预留元数据不等于功能完成；先前自输入构建与测试记录也不作为本次 Response 功能的验证证据。

## 3. Figma 与代码职责映射

Figma 文件：`eib6b1sDBsFa7hTzY2Zmsi`，02 - Components。

| Figma 资源 | 当前记录状态 | 代码映射建议 |
| --- | --- | --- |
| [Goal Sidebar · 14:581](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-581) | 原五态及属性合同保留 | 继续使用 `goalUI.tsx` 中现有 GoalPanel 和导航 |
| [自输入审阅页 · 288:1835](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=288-1835) | 已有自输入状态基础 | 保留 `GoalUserInput.tsx`，不重做已完成编辑行为 |
| [Response Label · 299:2106](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=299-2106) | 展示标签，已有独立主件 | 新增纯展示 `ResponseLabel` |
| [Goal Content Item · 299:2117](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=299-2117) | Response Off/On × Default/Hover/Menu 六态 | 新增稳定的条目外层；React 中分别管理标签、开闭、焦点和保存状态 |
| [Goal Content List · 299:2118](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=299-2118) | 列表组合插槽 | 扩展现有 `GoalContentList.tsx`，不再造第二份列表 |
| [Goal Content Panel · 302:2180](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=302-2180) | 独立组合主件，未替换原 Sidebar | 作为现有 GoalPanel 的组合参考，不照搬成第二套应用控制器 |
| [Response Tag Control · 312:2418](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=312-2418) | 五态主件已写入 | 独立 `ResponseTagControl`，负责入口和选项菜单 |
| [Response Menu · 312:2443](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=312-2443) | 选中与高亮四态主件已写入 | 作为 TagControl 内部菜单组合，复用共享菜单基础 |
| [Response Save Feedback · 312:2461](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=312-2461) | 保存反馈四态已写入，组合绑定待修 | 独立 `ResponseSaveFeedback`，不借用正文错误冒充标签错误 |

重要限制：最新菜单 UX 组合页未创建，克隆变体的保存反馈属性连接、关闭过渡与视觉／原型验收未完成。旧 [302:2181](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=302-2181) 只证明初步结构与外观，不是完整菜单 UX 稿。代码可以按已确定的交互文档开发，但界面交付前必须补做这些核对。

Figma SLOT 映射为 React 的 `children` 或局部动作插口，不建立数据库 Slot、标签管理平台或与画布节点 ID 绑定的业务数据。

## 4. 分层与组件组合

```text
现有 GoalController ── GoalView / 明确内容动作 ── 现有 GoalUI / GoalPanel
       │                                         └─ GoalContentList
       │                                            ├─ 被动区域标识与新增入口
       │                                            └─ GoalContentItem（始终存在）
       │                                               ├─ ResponseLabel（按标记显示）
       │                                               ├─ GoalUserInput / 原材料条目
       │                                               │  └─ 既有行操作 + ResponseTagControl
       │                                               └─ ResponseSaveFeedback
       ↓
goalContentEngine.setGoalResponse → persist / stageLibrary → 原串行保存队列
                                                        ↓
                                         HTTP / IPC → DataStore → goal_library
```

### 4.1 组件职责

- **GoalContentItem**：负责整条浅底、展示标签及标签保存反馈。标记前后保留同一个外层和正文节点；不通过两棵完全不同的 React 树切换样式。
- **GoalUserInput**：保留 InputEditor、文本、IME、编辑／删除和原错误反馈。仅建议增加 `actionsBefore?: ReactNode`，把标签入口放进原操作区的编辑按钮左侧；不移动编辑／删除位置，不添加第二套工具栏。
- **材料条目**：可从现有列表小范围提取为 `GoalMaterialItem`，保留原 `.goal-item` DOM、`GoalMaterialText`、来源和 jump／unlink 命令；提供同类动作插口。提取是接入标签所需的局部重构，不重做 Link 主体。
- **ResponseTagControl**：一个图标入口和一个 Response 可切换选项；接收受控 checked／open／disabled，发出明确目标值，自己不保存 Goal 数据。
- **ResponseSaveFeedback**：独立表达 Saving、Error、错误已关闭但仍未保存。成功不显示额外通知；Retry 和关闭提示分开处理。
- **GoalContentList**：继续调用 `goalContent()`，生成稳定身份、组合条目与动作，并协调当前打开的菜单。新建空草稿继续走原有分支，不提供标签入口。

条目外层采用轻量容器，不为材料额外增加重复 article 语义或导航点击。标签按钮与正文定位按钮是兄弟动作，不能把 button 嵌套在 button 内。

### 4.2 一份共享界面状态

侧栏与完整 Goal 工作区目前通过 `GoalController.updateReadingContext()` 移动同一个 Goal 面板，并共享 GoalUI 与控制器。沿用该机制，不建立两个 Response store。

列表持有 `openResponseKey: string | null`，一次只开一个菜单；切换 Goal、切换呈现容器或目标失效时关闭。锚点 HTMLElement／ref 只存在 React 展示层；新 Response 领域动作不传 DOM，更不触及 reader 的 DOM／Range。

## 5. 数据、身份与领域动作

### 5.1 沿用已有数据模型

当前 [goal.ts](src/client/domain/goal.ts) 已包含：

```ts
interface GoalContentMeta {
  order?: number;
  response?: { markedAt: string; sequence: number };
}
```

自写内容的标记保存在所属 `GoalInput`；材料的标记保存在当前 `GoalSourceLink`，不能写到 Annotation 或书籍全局标签上。取消时移除 `response` 字段，不能写 `null`，因为现有服务端不接受 null。

复用 `formatVersion: 2` 和 SQLite v5，不因启用已预留字段就升级数据库、增建表或引入新保存接口。若实施中另有字段契约变化，再单独评估迁移。

### 5.2 明确目标，防止作用到新关联

建议新增以下设计类型；它们不是已实现的 API：

```ts
type GoalContentTarget =
  | { kind: 'input'; goalId: string; inputId: string }
  | {
      kind: 'annotation'; goalId: string; bookId: string;
      generation: string; annotationId: string;
      associationOrder: number; // 本次加入关系的身份，来自现有 order
    };

setGoalResponse(state, target, enabled, now): GoalLibraryState
```

`annotationId` 或 `selected Goal` 都不足以单独作为操作目标。材料目标同时检查 Goal、书籍、generation、标注以及加入关系的 order；解除后重新加入即使复用相同材料 ID，也会分配新 order，旧菜单／旧回调不能标记新关系。

以有类型区分的 JSON 元组生成 UI／反馈 key。自写记录的 key 继续基于 Goal 与记录 ID；材料加入 order 表达关系实例。该 key 不用数组下标，也不包含 Response 值或更新时间，避免标记时重建编辑节点。

### 5.3 领域动作规则

在现有 [goalContentEngine.ts](src/client/domain/goalContentEngine.ts) 增加纯函数，复用 `normalizeGoalContent()`、可编辑性判断和 sequence 分配：

1. 校验 Goal 可编辑、目标存在且仍是同一条记录／同一次关联；不新建缺失条目，不从异步结束时重新读取 selected 作为目标。
2. 从未标记变为已标记时生成独立 `markedAt`／`sequence`，同步提升 `contentSequence`。
3. 已标记再设为 true、未标记再设为 false 为无变化操作，不刷新标记时间或重新分配顺序。
4. 取消只移除 response；不修改正文、来源、Goal 完成状态、输入文本更新时间或原 order。
5. `goalContent()` 继续仅按加入 order 排列；Response 的 sequence 为后续扩展保留，MVP 不用于置顶。

菜单受控回调使用 `setResponse(target, nextChecked)`，不在异步函数中使用“把当前值反转”的模糊命令，避免快速点击与重试重复翻转。

## 6. 交互接入与界面状态

### 6.1 状态分别管理

| 状态 | 所属位置 | 是否持久化 |
| --- | --- | --- |
| Response 当前目标值 | 现有 GoalInput／GoalSourceLink 元数据 | 是，复用全局 Goal 状态 |
| 当前展开菜单及锚点 | GoalContentList／ResponseTagControl | 否 |
| hover／焦点／按钮展开反馈 | CSS 与 Base UI | 否，不复制为领域枚举 |
| 正文编辑会话 | 现有 GoalController.edit／InputEditor | 沿用当前草稿策略 |
| Response 待保存、失败及提示关闭 | 控制器按内容 key 管理 | 待写状态由原恢复缓冲承载；提示是否关闭不表示确认保存 |

“已标记”和“菜单已展开”必须独立：入口只使用 `aria-expanded`；菜单项使用 checkbox 选中语义，不能用图标按钮的深色填充或 `aria-pressed` 代替标签状态。

### 6.2 菜单基础的最小扩展

现有 [dropdown-menu.tsx](src/client/components/ui/dropdown-menu.tsx) 只暴露普通 Item，Positioner 固定 align=end、sideOffset=5，传给 Content 的其余属性落到 Popup。不能直接把 side=left 当作当前组件已经支持的能力。

建议在同一基础文件中补充已安装 Base UI 提供的 `Menu.CheckboxItem`／`Menu.CheckboxItemIndicator`，并为 Content 显式区分 Positioner 与 Popup 属性。增加可选 side／align／offset／碰撞配置，原菜单默认行为保持不变。具体签名以已安装包类型为准；本次已检查其 checkbox item 与 Positioner 声明。

Response 专用组合设置左侧、垂直居中、5px 间距及约 128px 紧凑宽度，只有一项 Response。使用 Portal 避免侧栏裁切，左侧不足时进行右侧碰撞回退；不硬编码相对整页的位置。

复用现有 140ms motion token、opacity 和 .97→1 的缩放，原点跟随实际弹出方向，系统减少动态效果时直接显隐。样式只作用于 Response 菜单，不把全局 `.ui-menu` 的 200px 最小宽度或所有菜单的角色选择器一起改掉。

### 6.3 编辑与焦点保护

- 对应条目处于新草稿或正文编辑时隐藏入口；材料加载中、来源不可操作及全局禁用时禁止标记。Goal 归档／删除不自动移除已保存标签。
- 普通状态下入口与原动作一起在 hover、focus-within 或菜单展开时显示；无 hover 设备保持可访问。操作覆盖匹配的行背景，不缩窄正文。
- 继续沿用 GoalPanel 的 blur／finish 与 IME 防提前提交约定。标签组件不自己提交 textarea，也不更换输入节点；选项提交时控制器先完成必要的既有编辑收尾，再重新校验冻结目标。
- 由 Menu.Trigger 与菜单基础处理焦点进入、Enter／Space、Escape、Tab 和外部点击；不新增全局键盘监听或 Readwise 的 T 快捷键。只阻止已处理按键传播到阅读器命令。
- 正常关闭将焦点归还仍存在的入口；外部点击保留点击目标，切换 Goal／移除目标时不抢回旧焦点。菜单不能因为指针离开正文 hover 区而消失。

外层已标记背景通过局部 row-surface 变量传递给正文和操作覆盖区，避免旧 hover 背景把 Response 身份完全遮掉。保留正文的原字体、类型图标、引文竖线和来源；完整工作区沿用其原字号，不照抄侧栏像素。

## 7. 控制器、写入确认与恢复

### 7.1 复用写入主链路

扩展 [GoalController](src/client/features/goals/goalController.ts) 的 GoalView／Actions，建议增加：

```ts
setResponse(target: GoalContentTarget, enabled: boolean): void;
retryResponse(key: string): void;
dismissResponseError(key: string): void;
// GoalView 增加只读 responseWrites 映射；不把菜单 DOM 状态写进控制器。
```

调用领域函数后立即把目标状态写入控制器 state，经原 `persist → stageLibrary → flushLibrary` 保存，再统一 render。标签动作不新增 input 草稿，不误加到 `changedInputs`；`dirty`、关闭／导出检查和现有冲突保护继续生效。

### 7.2 为什么需要按条目的写入上下文

目前控制器只有全局 serial／failure 与 `changedInputs`；repository 的 ACK 清理草稿，未向 UI 暴露 Response 条目的确认归属。仅检查“ACK 中布尔值与现在一样”不够：用户可在旧的未标记快照尚未确认时，连续执行标记→取消；旧快照同样是 false，却不能证明最新取消已保存。

建议对原恢复队列 Entry 增加可选的本地 `responseIntents` 上下文，并由 repository 发出写入结果事件。它不是第二条网络队列，也不进入服务端命令或数据库模型。

每条上下文至少包含内容 key／目标、唯一 intentId、最新目标值和必要的关联 order。controller 维护最新 intentId；成功／失败结果只能更新仍匹配的 intent。一次快照可同时覆盖多条内容，成功后逐项确认；“A 保存中，B 已保存”不依赖一个全局布尔开关。

### 7.3 对现有队列的兼容约束

1. `stageLibrary` 可增加可选上下文并返回本次 version；当前调用点集中在 GoalController，原调用忽略返回值仍可工作。
2. 每次 stage 都携带该 state 中尚未确认的最新 Response 上下文，防止随后一次正文编辑合并掉标签的确认归属。现有未发送快照合并时，state 与上下文一起更新。
3. 已冻结 Entry 的 `command`、opId、expected、原 state 不得改写。失败重试仍按原 opId 精确重放已发命令，再写后续快照；界面始终保持用户最新选择，不把旧命令结果重新应用为可见状态。
4. repository 在原保存成功／失败处报告 version、revision 和该 Entry 的上下文。控制器据 intentId 确认，而非依据菜单开闭、文本是否相同或当前 selected。
5. 上下文随原本地恢复缓冲持久化；旧 Entry 缺少它时沿用现有全局恢复提示，不虚构精细确认。重载后已确认状态读数据库；仍待保存的标签从队列最新快照及上下文恢复。
6. 本地缓存写入失败时保留内存中的未保存状态并反馈错误，不能承诺刷新可恢复。既有关闭／导出检查继续拦截未确认写入。

### 7.4 错误和竞态

- Response 单独失败时显示 `Couldn’t save Response.`、Retry 和关闭；关闭只改变提示可见性，未确认状态继续可识别。Retry 排出最新意图，遵守上面的冻结命令重放约束。
- 保留现有正文错误，不能复用它冒充标签保存错误。`GoalContentList` 的通用 GoalSaveError 回退需识别“已由 Response 行反馈覆盖的错误”，避免标签失败时再出现一条同源全局错误；真实正文失败仍保留。
- 409 等冲突继续采用既有全局禁用／保留待写／重新加载策略，不能当普通 Retry 无限覆盖远端。
- 切换 Goal 关闭菜单，写入仍针对原 Goal；解绑／删除后清理该目标的局部展示状态。旧 ACK、旧失败及旧菜单回调不能重建已移除条目，不能作用到新加入的同材料关系。
- 组件卸载只取消订阅，不丢弃原恢复队列或全局未确认写入。销毁或关闭依然经过现有保存检查。

## 8. 服务端校验与版本边界

现有 [goalLibrary.js](src/server/goalLibrary.js) 已检查 response 的时间和 sequence，以及源书籍 generation／标注存在性。输入记录的内容变化也已有 Goal 可编辑性保护；材料关联的 response 变化尚无同等的生命周期检查，不能仅依赖按钮 disabled。

增量校验应覆盖：

- 对仍存在的材料关联，新增／改变／移除 response 前检查所属 Goal 的有效可编辑状态；新关联直接携带 response 也须检查。保持现有格式和 source 校验。
- 不将“整条关联因来源删除被清理”误当成非法取消标签，否则现有删除书籍／标注的 prune 会被归档 Goal 阻塞。
- 受信任的逐书恢复入口需要允许恢复历史归档关系及其合法元数据，与交互修改区分。若为 write 增加内部恢复上下文，只由原 restore 路径提供，不接受普通保存命令自带绕过标志。
- 新的取消操作经规范化后保留 order，删除 response 后不能被 `upgradeContent` 当作旧数据缺字段又补回。旧冻结命令按原协议处理，不能为保护标签而修改其 hash／opId。
- 普通保存中的缺省 response 表示未标记；旧备份缺字段的处理属于恢复策略，不能用一个无条件“补回旧值”同时处理取消和备份兼容。

继续使用 `goals/library/save`，由共享 DataStore 服务 HTTP 与 Electron IPC。当前字段已在 v5 中存在，预计无需数据库迁移；缓存上下文的兼容验证与数据库 schema 升级分开处理。

## 9. 解除关联与备份恢复：建议策略，待确认

上一轮给出的保留规则是建议，用户尚未单独确认。本文件将其作为架构建议，不能将它们悄然写成已批准产品行为或在 UI 接入时顺带更改恢复政策。

| 场景 | 建议 | 当前实现与接入点 |
| --- | --- | --- |
| 解除后重新加入 | 移除旧关联及其 Response；重新加入默认未标记，不建立隐藏记忆 | 当前 unlink 移除关系，addGoalSource 为新关系分配 order；新增迟到结果保护 |
| Goal 归档／删除后恢复 | 恢复原关系及其标记；彻底删除随关系清理 | 复用 `operateGoal()` 对 inputs／links 的既有保留和 purge 行为 |
| 逐书导出 | 已包含的 Goal—材料关联携带其 Response；自写内容继续排除 | `goalGraphsForBooks()` 直接导出 links，已有元数据可携带；不增加 inputs |
| 逐书恢复新增关系 | 按备份导入合法标记，旧备份缺字段视为未标记 | 在原 restore 范围及 generation 重新绑定中处理，校准 contentSequence |
| 逐书恢复匹配关系 | 建议本地当前 Response 状态优先，包括本地明确未标记；旧备份不清空本地标签 | 当前 restore 会替换范围内 links，尚未实现该完整策略；实施前须确认 |
| 整库恢复 | 沿用整库快照还原已保存的关系和标记 | SQLite 已包含 Goal JSON；本地未确认缓存不是数据库备份 |

若确认“匹配关系本地优先”，只为恢复后的匹配 link 合并 Response 元数据，不把整个 Goal、正文或全部关联的恢复规则改为本地优先。备份合并按稳定的 Goal／book／annotation 身份匹配，再绑定恢复后的 generation；普通运行时操作仍严格检查 generation 和本次关联 order。

本地匹配关系存在但 response 缺省，也应保留本地“未标记”，不能写成 `local.response ?? incoming.response`，否则会把已取消的标签恢复回来。旧备份缺字段、普通取消和新关系必须分清。

现有 restore 的顺序兼容分支可能补回部分历史元数据，但不等于已有完整冲突政策。保留本地高 sequence 的策略也需纳入 contentSequence 最大值计算。该决策未确认前，可以开发核心标签交互及保存能力，不能宣称备份冲突场景已交付。

## 10. 文件级变更建议

以下为后续实施清单，本轮未执行代码修改。

| 文件 | 处理方式 |
| --- | --- |
| `src/client/domain/goal.ts` | 保留现有持久化字段；增加或引用明确内容 target 类型，不引入通用 Tag 实体 |
| `src/client/domain/goalContentEngine.ts` | 新增设置／取消 Response 纯函数、目标 key／关系匹配；排序继续复用 |
| `src/client/features/goals/goalController.ts` | 明确目标动作、按条目写入状态、队列结果订阅、重试／关闭反馈和失效清理 |
| `src/client/features/goals/goalUI.tsx` | 扩充 GoalView／Actions；保留现有 GoalPanel、编辑和共享界面合同 |
| `src/client/features/goals/GoalContentList.tsx` | 组合稳定外层、来源条目与标签动作；协调单菜单与错误回退 |
| `src/client/features/goals/GoalUserInput.tsx` | 增加局部动作插口；保留编辑器、IME、草稿、编辑／删除及原错误行为 |
| 新 `GoalContentItem.tsx`、`ResponseLabel.tsx` | 条目外观与固定展示标签；可将很小的 Label 与外层同文件导出，避免为占位拆空壳 |
| 新 `ResponseTagControl.tsx` | 图标、受控左侧菜单及唯一可切换项；不另建数据服务 |
| 新 `ResponseSaveFeedback.tsx` | 标签保存中、失败／提示关闭及重试展示 |
| 可选新 `GoalMaterialItem.tsx` | 仅提取列表中原材料条目，保留命令和 DOM／CSS 合同 |
| `src/client/components/ui/dropdown-menu.tsx` | 补可切换菜单项与明确的 Positioner 可选属性，保持旧默认值 |
| `src/client/components/ui/action-icon.tsx` | 按现有 SVG 图标机制接入安装包中的标签图标，不混用另一图标家族 |
| `src/client/components/ui/workbench.css` | Response 局部外观／行操作／菜单角色样式与减少动态效果；不全局重置按钮或菜单 |
| `src/client/infrastructure/goalLibraryRepository.ts` | 为原 Entry 增可选写入上下文及结果通知，复用冻结与串行保存语义 |
| `src/server/goalLibrary.js` | 元数据变更保护、受信任恢复上下文与经确认的恢复合并；不新增平行 API |

备份策略若获确认，再定位相关备份入口进行最小适配；不以此次架构文档授权重构整个备份系统。

## 11. 实施分段与验收

1. **领域和写入确认**：先补纯函数、身份／关联实例匹配、队列上下文与服务端保护。证明标记不重排、各 Goal 独立、旧结果不覆盖新选择。
2. **共享 UI 接入**：接入标签按钮／菜单、稳定条目外层和反馈；保留自输入与材料动作。侧栏和现有完整工作区使用同一控制器和组件。
3. **关系与恢复**：按确认的决策实现重关联与备份元数据政策，验证旧数据／旧命令与恢复边界；不能默认采纳建议后跳过验收。
4. **真实交互与视觉验证**：与文档及可读取的 Figma 状态核对，补齐三类内容、窄窗口、键盘／IME、错误和持久化证据。

| 验证层 | 必须覆盖的场景 |
| --- | --- |
| 领域 | 三类内容、重复设值幂等、取消、不可编辑／失效目标、不同 Goal、加入顺序不变、解除重加 order 变化 |
| 控制器／队列 | 标记→取消→标记、旧 false ACK 不确认新取消、多条独立反馈、失败重试、隐藏错误仍待保存、切 Goal、删除／重关联期间迟到结果 |
| 服务端／恢复 | 材料标签归档保护、普通取消不被兼容分支补回、历史恢复、非法 sequence／日期／generation、冻结命令精确重放、经确认的备份冲突策略 |
| 界面 | 图标仅打开菜单、唯一 Response 选项、选择后关闭、已选可取消、正常左开 5px 与右侧回退、单菜单、焦点、减少动态效果、无 hover 可访问 |
| 既有功能回归 | 自输入多行／IME／草稿／清空保护、来源跳转／解除关联、Goal 导航和编辑、侧栏／完整页共享、刷新重开与关闭保护 |

复用并扩展现有 `tests/unit/test_goal_content.js`、`tests/regression/test_goal_input.js`、`test_goal_input_storage.js`、`test_goal_library_recovery.js` 和 `test_goal_backup.js`；Response 新测试按实际边界增加，不以复制实现的静态断言代替用户行为测试。

实际代码修改后运行 `npm run build`、相关自动检查和内置浏览器的真实操作验证；涉及 Electron 关闭／IPC 时再运行对应桌面检查。已有全量测试记录中的 Wiki 文案扫描失败、桌面退出超时要分别报告，不能当作新功能通过，也不以改业务代码绕过环境问题。

## 12. 本次交付与待定事项

本次交付仅为当前工作目录中的这份新架构设计文件。未修改业务代码、未写入 Figma、未运行构建或功能测试，也未制作／安装／发布应用包；现有工作区未提交改动保留。

进入实施前需确认第 9 节的重关联及备份冲突策略；进入界面交付前需完成菜单 UX 的组合、属性修正和视觉／交互验收。无需重新讨论已完成自输入的基本功能，也无需等待 Home、自定义标签或后续置顶功能设计完成。
