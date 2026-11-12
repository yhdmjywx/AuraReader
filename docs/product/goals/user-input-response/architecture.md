# Goal 用户自输入与区域 UI：代码架构设计

记录日期：2026-11-10。

本文原样存档上一条代码架构回复，正文中的状态描述对应回复当时。后续用户确认单独记录，不改写原文。

**最新用户确认：自写内容不进入逐书备份。** 此确认取代原文第七部分中建议随逐书备份携带自写内容的建议；其余未确认项保持原状态。

## 架构回复原文

建议采用 **“扩展现有全局 Goal 数据与保存链路，新增独立自写记录，统一内容展示”** 的架构。自写内容作为 Goal 自己拥有的数据；高亮、笔记继续引用原标注。这样能实现当前 Figma 的统一布局，同时保留原有来源、跳转和解除关联行为。

已对照 [UX review](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=288-1835)、[Goal Sidebar](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-581)及当前功能文档。以下是结合现有代码形成的架构草案，尚未写入项目或修改代码。

**一、整体接入方式**

现有项目已经具备这条链路：

```text
GoalUI（侧栏、完整 Goal 页共用）
    ↓ 用户动作
GoalController
    ↓ 修改状态
goalLibraryRepository
    ↓ 本地待写缓冲、串行队列、revision / opId
DataStore → goal_library（SQLite JSON）
```

这条链路可以继续承担新增内容的保存，不需要另建一套数据库或独立保存服务。依据是现有 [GoalController](E:/dp/reader_workstation/src/client/features/goals/goalController.ts:23) 和 [goalLibraryRepository](E:/dp/reader_workstation/src/client/infrastructure/goalLibraryRepository.ts:51)。

建议增加两个明确的边界：

- **领域层**负责自写记录的创建、修改、删除、排序和完整性规则。
- **展示层**把自写记录与关联材料合成为统一列表，但不改变它们各自的数据身份。

---

**二、数据模型：独立记录，共用排序规则**

当前 [GoalLibraryState](E:/dp/reader_workstation/src/client/domain/goal.ts:20) 只有 Goal、材料关联和书籍关联。建议扩展为下面的结构，示例省略未变化的既有类型定义：

```ts
interface GoalContentMeta {
  order: number;
  response?: {
    markedAt: string;
    sequence: number;
  };
}

interface GoalInput extends GoalContentMeta {
  id: string;
  goalId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

type GoalSourceLinkV2 = GoalSourceLink & GoalContentMeta;

interface GoalLibraryStateV2 {
  formatVersion: 2;
  contentSequence: number;
  goals: Goal[];
  links: GoalSourceLinkV2[];
  bookLinks: GoalBookLink[];
  inputs: GoalInput[];
}
```

这几个字段分别解决不同的问题：

| 字段或关系 | 作用 |
|---|---|
| `inputs` | 保存多条独立、可换行的自写记录 |
| `goalId` | 明确记录属于哪个 Goal，不依附书籍或原文 |
| `order` | 记录加入当前 Goal 的顺序，供统一列表按新者在上排列 |
| `updatedAt` | 表示编辑时间，不参与内容位置排序 |
| `response` | 为已确认的 Response 规则预留关系信息 |
| `contentSequence` | 为新增内容和标记事件分配稳定递增顺序，避免只靠时间戳出现同值或时钟变化问题 |

自写内容只有一个所属 Goal，Response 可以保存在该记录上；同一标注可以关联多个 Goal，因此它的 Response 信息保存在各自的 `GoalSourceLink` 上。取消某个 Goal 下的标签，不影响其他 Goal。

MVP 展示仍只按 `order` 排列。以后启用 Response 优先展示时，再使用独立的标记顺序，避免现在把两种排序耦合。

**旧材料关联目前没有加入时间。** 升级时应按现有 `links` 数组次序生成稳定顺序，明确这是兼容顺序，不伪造真实时间；新版加入的内容使用新序号。

---

**三、UI 结构：共享一个列表，保留两种条目行为**

建议将现有 `GoalPanel` 调整为：

```text
GoalPanel
├─ 原导航、父 Goal
├─ 子 Goal 区
│  ├─ 分支区域图标
│  └─ 原子 Goal 行
└─ 内容区
   ├─ 水平分界线
   ├─ 叠层文档区域图标、文档＋按钮
   └─ GoalContentList
      ├─ GoalUserInput
      └─ 原有材料条目
```

具体文件职责建议如下：

| 位置 | 架构调整 |
|---|---|
| [goal.ts](E:/dp/reader_workstation/src/client/domain/goal.ts) | 增加记录、排序元数据和新版状态类型 |
| 新增 `goalContentEngine.ts`，位于现有 domain 目录 | 实现记录增删改、顺序分配、统一内容描述查询等纯函数 |
| [goalController.ts](E:/dp/reader_workstation/src/client/features/goals/goalController.ts) | 协调编辑会话、保存、错误和导航；继续作为统一状态的写入入口 |
| [goalUI.tsx](E:/dp/reader_workstation/src/client/features/goals/goalUI.tsx:59) | 整合区域图标、分界线和新增入口，移除 Linked 分组开关 |
| 新增 `GoalContentList.tsx`、`GoalUserInput.tsx`，位于现有 goals feature 目录 | 分别负责统一列表及自写记录展示、编辑、行操作 |
| [GoalMaterialText.tsx](E:/dp/reader_workstation/src/client/features/goals/GoalMaterialText.tsx) | 保留引用与笔记展示能力，继续复用原来源跳转和解除关联动作 |

统一列表的展示模型应使用两种明确的条目类型：`input` 和 `annotation`。React 的 key 分别使用记录 ID、完整材料关联身份，避免输入或材料刷新时重建编辑节点。

区域图标渲染为非交互标识；“文档＋”使用现有 `Button`，提供 `Add text` 的可访问名称和 tooltip。现有 `itemsOpen` 及 Linked 折叠动作退出本次内容区逻辑，不给区域图标挂上旧折叠行为。

侧栏与完整 Goal 页继续共用这些组件；Figma 的侧栏宽度、字号不直接套用到完整 Goal 页。

---

**四、编辑架构：一个编辑会话，明确区分编辑对象**

当前控制器的 `edit` 只处理 Goal 标题。如果为自写内容再并列加入一套独立编辑状态，容易出现两个编辑器同时打开、切换时只保存其中一个的问题。

建议将编辑状态改为带类型标识的联合结构：

- **Goal 编辑会话**：保留现有根 Goal、子 Goal、标题编辑模式。
- **Input 编辑会话**：包含 `goalId`、`inputId`、新建或编辑模式、当前文字、最近非空文字。

同一时间只维护一个活动会话。原 Goal 编辑行为保持，自写内容新增这些动作：

```ts
beginInput(goalId)
beginInputEdit(goalId, inputId)
updateInputDraft(text)
finishEditing()
deleteInput(goalId, inputId)
retrySave()
dismissSaveError()
```

动作必须携带发起时的 `goalId`，不能在异步结束后读取“后来选中的 Goal”作为保存目标。

编辑器可以从现有 [GoalEditor](E:/dp/reader_workstation/src/client/features/goals/goalUI.tsx:25) 提取 Goal 区专用的原位编辑基础组件，复用 `Textarea`、IME 保护、焦点和键盘处理。它不需要演变成全应用通用编辑框架。

Figma 状态映射到实际代码时：

| Figma 状态 | 实际来源 |
|---|---|
| Default | 普通记录展示 |
| Hover | CSS hover、focus-within 等呈现行操作 |
| New / Editing | 编辑会话类型 |
| Disabled | Goal 不可编辑、生命周期操作繁忙或冲突状态 |
| Error | 未确认写入失败及其反馈状态 |
| Deleted | 数据中移除该记录，不保存一个“Deleted 条目” |

---

**五、保存与恢复：沿用队列，补充自写草稿保护**

建议继续使用 [stageLibrary / flushLibrary](E:/dp/reader_workstation/src/client/infrastructure/goalLibraryRepository.ts:51)，让标题、关联关系和自写记录共享同一条版本化保存链路。

需要补齐以下处理：

1. **新建记录**  
   输入先进入可恢复草稿；结束编辑后，非空内容正式加入列表。草稿与正式记录沿用同一个 ID，避免切换时重复生成记录。

2. **编辑已有记录**  
   非空修改进入当前状态及待写缓冲，复用现有合并发送机制。清空后的保护行为按交互文档执行。

3. **删除记录**  
   先结束对应编辑会话，再明确移除记录并保存，避免延迟的输入事件把已删除内容写回来。

4. **保存确认**  
   以服务端 ACK 为准。旧 ACK 只能确认对应版本，不能清除后续输入或覆盖更新的工作状态。

自写草稿应有明确的类型和所属 Goal，不能直接塞进现有 `GoalDraft` 后让恢复流程误建成子 Goal。可以在现有 repository 内增加专用草稿缓冲，继续共用正式写入队列。

另外，当前保存失败主要是控制器的全局错误。为对应 Figma 的行内 Error 状态，需要记录受失败写入影响的条目；**关闭提示只改变反馈可见性，不清除失败状态或待写内容**。切换、关闭和导出仍需检查这些未确认写入。

---

**六、服务端与版本兼容必须一起改**

现有 [goalLibrary.js](E:/dp/reader_workstation/src/server/goalLibrary.js:47) 接收整份 Goal 状态写入。这次不能只给前端类型加一个数组，否则旧写入、恢复或清理操作可能遗漏新数据。

建议：

- 扩展 `validateLibrary`：检查记录 ID 唯一、所属 Goal 存在、文字有效、顺序合法。
- 区分“允许保留归档／删除 Goal 的历史内容”与“允许向该 Goal 新增或编辑内容”。
- 复用现有 `goals/library/save` 和桌面 IPC 路径，不新增重复的保存接口。
- 数据库版本由当前的 4 升级，事务内补齐新字段，并保持旧版本拒绝降级打开的保护。
- 冻结在恢复队列里的旧命令保留原 `opId` 和原命令身份；不能为了补字段直接改写已发送命令。无法安全兼容时停止并保留数据。
- 服务端清理书籍、标注时，只移除相应来源关联，自写内容继续属于 Goal。

HTTP 与 Electron 都落到同一个 DataStore，因此验证规则应在共享服务端逻辑实现，避免两端行为不同。

---

**七、两个产品规则需要在实施前确认**

架构可以容纳下面的方案，但不能把它们当作已经批准的行为：

| 问题 | 建议 |
|---|---|
| **所属 Goal 被归档、删除、恢复、彻底删除时怎么办？** | 自写记录随 Goal 保留和恢复；只有彻底删除 Goal 时清除所属记录。需要扩展现有 [purge 分支](E:/dp/reader_workstation/src/client/domain/goalLifecycle.ts:53)，防止留下孤立记录 |
| **自写内容是否进入逐书备份？** | 建议随备份中已包含的 Goal 一起携带，作为 Goal 内容处理；旧备份缺字段时保留当前内容。完全无书关联的 Goal 仍由整库备份覆盖 |

目前 [goalGraphsForBooks](E:/dp/reader_workstation/src/client/infrastructure/goalLibraryRepository.ts:121) 和备份导出器都只认识既有字段，扩展数据类型不会让它们自动包含自写内容。恢复还需要按稳定 ID 合并，明确重复记录和冲突的处理，避免多本书携带同一 Goal 时重复导入。

Response 的数据接口可以按已确认规则预留；它的操作入口和视觉仍缺设计，本轮架构不据此创造新 UI。

---

**实施时建议按三组交付验收**

1. **数据与持久化**：记录纯函数、统一顺序、校验、迁移、保存恢复及备份适配。
2. **界面整合**：区域标识、统一列表、原位编辑、行操作及错误反馈，保留既有材料行为。
3. **完整验证**：IME、失焦连续点击、编辑后重开、延迟 ACK、删除竞态、旧数据升级、备份恢复，以及桌面关闭时的未保存保护。

本轮完成的是架构分析，没有改文件、业务代码或 Figma，也没有运行构建和功能测试。

## 后续用户确认

2026-11-10，用户对“自写内容是否进入逐书备份？”批注：“不进入”。

- 自写内容不进入逐书备份。
- 原文第七部分中建议逐书备份携带自写内容的方案不再适用；其后关于多本书携带自写记录、按记录 ID 合并的推演也不作为本功能的逐书恢复要求。
- 此次确认不涉及所属 Goal 的归档、删除、恢复和彻底删除规则；该项仍待确认。

### 实施阶段补充确认（2026-11-10）

- 用户确认：所属 Goal 归档、删除、恢复时，自写内容随 Goal 保留和恢复；彻底删除 Goal 时清除所属自写内容。此确认取代上段“该项仍待确认”的历史状态。
- 用户确认：本轮只实现侧栏与现有完整 Goal 工作区，Home 打开完整工作区的入口留待后续，不增加菜单项。
- 原文保持不变；源码实现范围、与草案的细节差异及验证结果见[实现记录](implementation.md)。
