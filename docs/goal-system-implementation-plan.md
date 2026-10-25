# AuraReader Goal 模块实现计划

日期：2026-10-25。以当前工作区代码为依据；这是实现计划与交互提案，Goal 业务尚未接入。

交互修订：笔记保持点击内容原位编辑，不增加“编辑／完成”按钮。高亮保持现有操作浮条，不把点击高亮改成打开 Goal 面板。归入只增加一个动作，目标统一由左侧当前选中的 Goal 决定。

## 1. 产品边界与交付物

Goal 是现有阅读器中的新功能模块，沿用 `main.ts → AppCoordinator → feature controller/UI → repository → storageClient → SQLite`，不引入框架、状态库、图数据库或另一套阅读工作台。

- 自由输入 Goal；不设置目标／问题／体验类型，不弹分类选择，不自动生成阅读意图。
- 支持多个根 Goal、子 Goal 及继续建立更深层子 Goal。允许完整树，但阅读界面只展示有用的一小段结构。
- 高亮、笔记沿用现有记录，以 ID 关联；一条标注可以关联多个 Goal，用户每次只需选择一个归入位置。
- 首轮只做用户主动选择的**单页分页模式**，验证左侧空白区域。双页及连续滚动不展开 Goal 面板，也不改其现有布局；切回单页保留当前 Goal。不借本次实现新增刷新后恢复阅读位置。
- 无 AI、完成率、优先级、状态看板、任务期限、知识图谱或强制整理流程。

效果稿：[prototypes/goals.html](prototypes/goals.html)。UI 与示例内容统一为英文，直接引用当前 `src/client/styles.css`、本地字体和 Remix Icon。移除演示工具栏、说明文案与底部位置切换，只展示单页左侧方案；所有交互仍仅在内存中，不读写真实书库。

## 2. 当前代码事实与复用方式

旧文档可能描述笔记侧栏；当前产品实际已是沉浸式页边笔记，应以源码为准。

| 当前实现 | Goal 如何复用 | 需要补的部分 |
| --- | --- | --- |
| `domain/annotation.ts`、`domain/annotationEngine.ts` | `Annotation` 已区分 `note` 与 `highlight`；沿用 id、bookId、quote、comment、location | 不把 Goal 塞进 Annotation，不复制引用或重新创建笔记 |
| `features/annotations/annotationController.ts` | 仍是高亮／笔记的唯一管理者；通过 `getNotes()` 查全书已保存标注 | 增加已保存、已删除通知及关联动作；草稿不能作为持久化关联目标 |
| `features/annotations/notesUI.js`、`noteCaret.js` | 沿用点击笔记内容进入原位 textarea、输入保存、失焦／Escape／Ctrl+Enter 结束编辑、中文输入保护及编辑节点保留 | 不加“编辑／完成”按钮；只在既有笔记操作区补“归入 Goal”。Goal 用独立轻量行组件，不照搬依赖 quote 的 Note 校验 |
| `features/annotations/selectionController.ts`、`selectionTooltipUI.js` | 保留点击已有标注后的原有小操作浮条、目标 ID、激活样式、选文保护及定位方式 | 在原浮条内追加“归入 Goal”，点击时直接关联左侧当前 Goal；不另弹 Goal 列表或新面板 |
| `features/reader/annotationRenderer.js`、`visibleAnnotations.js` | 保留范围定位、高亮颜色及当前可见笔记判定 | Goal 不增加原文渲染标记，不修改选区偏移算法 |
| `AppCoordinator.jumpToAnnotation()` | 点击 Goal 关联条目后直接定位原文 | 不另写引文检索、分页或跳转实现 |
| `features/layout/marginNotesLayout.js` | 读取已有 `_marginGeometry`、`readingLeft`、`readingWidth`、`noteWidth` 等实际尺寸 | 增加左侧 Goal 几何计算；不挤占右侧 notes lane |
| `main.ts` 与 `features/layout/layoutController.js` | 沿用页面、视口、布局回调及 `rememberAnchor → refitChapter` | 注入 Goal Controller；连接现有回调，不覆盖原回调逻辑 |
| `app/session.ts`、`app/appCoordinator.ts` | 保留当前书籍上下文及 `openBookRequestId` 防串书机制 | 同一次打开请求准备 notes、goals 后一起安装；切书前提交 Goal 编辑 |
| `infrastructure/storageClient.ts` | 复用 HTTP／桌面分发、`enqueue(bookId)`、`operationId`、`drainStorage` | 增加 Goal 路由及 revision 缓存；不新建 HTTP 或 IPC 客户端 |
| `infrastructure/annotationRecovery.ts` | 复用“待确认操作缓冲、ACK 后清理、版本化重试”的策略 | 它绑定 note 命令与缓存键，不能直接用于 Goal；增加小型 Goal 恢复模块，不先重构成通用存储框架 |
| `server/dataStore.js` | 共用数据库、`mutate` 幂等、事务、expected revision、book generation | 为现用库做显式增量 schema 升级并新增 Goal 文档表 |
| `infrastructure/exporters.js`、`features/backup/backupController.js` | 扩展现有每书 `.aurabackup` 和原子 restore | 保存／恢复 Goal 树与关联；有 Goal 的备份必须包含其依赖标注 |
| `src/shared/desktop.ts`、`desktop/preload.cjs`、`ipc.cjs`、`storage.cjs` | 沿用白名单能力、JSON 校验及共享 DataStore | 每个新增方法逐层注册；不能只实现浏览器 HTTP 路径 |
| `src/client/desktop.ts` | 沿用关闭前完成编辑、排空存储、失败保留窗口的握手 | 同时检查 Goal 编辑与 Goal 恢复缓冲，否则 `drainStorage` 本身不能证明保存成功 |

`src/client/core/`、`repositories/`、`ui/` 等旧入口主要用于兼容，新增实现放在现有 `domain/`、`features/`、`infrastructure/`，不要在新旧目录各写一套。

## 3. Lean UX — current prototype

The UI uses English. Reader-written Goal text remains unrestricted, including multiline text and any language. This revision changes presentation only; the data model and reuse boundaries below still apply.

### 3.1 One place for each task

| Task | Entry point | Behavior |
| --- | --- | --- |
| Create a root Goal | + beside Goals | A single inline text field; no type, template, category, or dialog |
| Switch Goals / inspect the full tree | Goals | Reuse the same left region for a collapsible outline; selecting a node returns to reading view and expands its linked highlights and notes |
| Edit the current Goal | Its text | Replace the text with an inline field; no duplicate heading or editor panel |
| Add a subgoal | + beside the current Goal | Show the action on hover or keyboard focus; always visible on touch devices; record the current chapter internally |
| Return to the parent | One short parent row | Move up one level; do not repeat the entire ancestor path |
| Review linked content | Paperclip + count | Only present when nonzero; selecting a Goal or linking content automatically expands its short excerpts; manual collapse remains available |
| Return to the source | A linked excerpt | Use the existing jumpToAnnotation behavior |
| Unlink content | × on an expanded excerpt | Available on hover or focus and on touch; preserve the original annotation |

Reading view shows the current Goal and its relevant direct children. Full-tree navigation uses modest indentation and expand/collapse controls, with no relationship lines, arrows between cards, badges, or repeated paths. Deeper trees remain supported. User text wraps instead of being rewritten into system-generated short labels.

The current Goal is the association destination. Do not automatically change it when turning a page or changing chapters. Other branches remain reachable through Goals. Chapter origin stays in the data, without a permanent Created in chapter label.

### 3.2 Remove interface copy, retain capability

Remove the prototype review toolbar, explanatory paragraphs, Single page label, placement/theme comparison controls, created-in metadata, separate All structure / Back controls, repeated New Goal rows, persistent Subgoal action text, Save/Cancel button pair, zero-content counts, and routine success toasts.

Goal editing follows the existing note pattern: click text, type, finish on blur / Escape / Ctrl+Enter. Enter inserts a newline; IME composition must not finish an edit. Empty new drafts disappear; clearing an existing Goal does not silently delete it. Real persistence still uses the queued autosave and recovery rules in section 5.3; the local prototype commits its in-memory draft when editing ends.

Keep icon buttons accessible through English names, focus styles, native keyboard activation, and short tooltips. Quiet quick actions remain in the keyboard order and become visible on focus. The English UI does not constrain how a reader expresses a Goal.

### 3.3 Keep existing notes and highlight behavior

- Notes still enter inline editing by clicking their content. Keep input saving, blur / Escape / Ctrl+Enter, IME protection, and the existing delete icon. There is no Edit or Done button.
- Highlights retain their existing activation, selection protection, color/range rendering, delete action, small toolbar, and closing rules. Do not open a Goal picker when a highlight is clicked.
- Add only one compact Goal action to each existing annotation action location. It directly links to the Goal selected on the left. Select a different destination on the left, rather than adding a second picker at the source.
- Successful linking changes the existing action to a check, updates the count, and automatically expands the linked excerpts below the current Goal. If the full outline is open, return to the existing current-Goal view so the result is visible. Do not change the selected Goal, scroll the reader, or move focus to an excerpt. Readers can still collapse the content manually; adding another item opens it again. Announce the result to assistive technology without adding another visible toast or sentence.
- Editing a note updates its linked excerpt without rebuilding either active textarea. Association does not change annotation content or turn every new annotation into an automatic link.
- Duplicate associations are ignored; unlinking preserves the annotation. Deleting an annotation retains the existing independent deletion semantics and removes its links.
- Enable the source action only for a unique annotation target. Ambiguous overlapping contexts retain current behavior; do not silently batch-link them or introduce another disambiguation panel in this prototype.

Drag and drop remains an optional later comparison, using the same association command. All required actions remain available without dragging.

### 3.4 Geometry and scope

Read the actual marginGeometry result. Keep the existing 560px single-page text, right-hand notes, and reading anchor. Trial left-rail width is 200–260px, with 24px outer clearance and 40px from the body. Available space is readingLeft − 24 − 40; do not squeeze the body to fit a Goal rail.

The prototype focuses on the left-side option. The final placement decision remains open; removing the bottom comparison button is not a data-model decision. Small-window recall, double-page support, and continuous-scroll support must not be improvised as part of this cleanup. Follow the previously scoped single-page implementation and record the remaining layout verification separately.

### 3.5 Design references

These references inform the reduction, not a new component library or framework:

- [Apple — Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus): keep actions relevant to the object and avoid clutter.
- [IBM Carbon — Menu guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/menu/guidelines): disclose secondary actions when needed and keep labels short.
- [Microsoft Fluent 2 — Tree](https://fluent2.microsoft.design/components/web/react/core/tree/usage): distinguish branch disclosure from selection, wrap content, and keep quick actions few and accessible.

## 4. 最小数据模型

建议一书一份轻量 Goal 文档：树与关联在同一 JSON 中原子保存，符合现有书籍／标注完整 JSON 的存储习惯。比首轮同时新增 Goal、边、层级排序等多套表和 API 更小；代价是同一本书的并发 Goal 修改共享一个 revision。正常阅读量下先采用此方案，不为尚无证据的规模问题增加架构。

```ts
interface GoalOrigin {
  sectionId: string;
  sourcePage: number; // 1-based 源文档编号，不是屏幕栏号
  chapter: string;    // 显示快照，不用章节标题充当唯一 ID
}
interface Goal {
  id: string;
  parentId: string | null;
  text: string;
  origin: GoalOrigin | null;
  createdAt: string; // ISO 时间，仅用于记录，不增加 UI 字段
  updatedAt: string;
}
interface GoalLink { goalId: string; annotationId: string }
interface BookGoalState {
  bookId: string;
  goals: Goal[];     // 数组顺序是兄弟节点的稳定创建顺序
  links: GoalLink[]; // (goalId, annotationId) 去重
}
// 持久化包装沿用 StoredRecord<T>；state 不内嵌 revision。
```

不加 `type`、`progress`、`priority`、`status` 等字段。根 Goal 默认 `origin=null`；阅读中创建子 Goal 时取 reader 当前位置。一个源文档含多个 TOC 锚点时优先使用 sectionId，缺乏稳定子章节 ID 时退回 sourcePage 相关性，不使用屏幕页号或标题匹配冒充精确关联。

`selectedGoalId`、展开状态、左侧／浮层开关属于呈现状态，由 Goal Controller 按书保留在内存；不进入书籍备份，不污染 Goal 树。新一轮打开可显示第一个根 Goal，刷新后如何恢复选择暂不扩范围。

核心约束同时在纯函数与存储边界校验：

- Goal ID 唯一，parent 存在，不能以自己或后代为父节点，不接受环；迭代遍历，避免深树递归溢出。
- 空白内容不能创建；已有 Goal 编辑为空时取消这次清空并恢复原内容，删除走明确动作。支持纯文本与多行，渲染用 `textContent`。
- link 的两端必须存在，并且 annotation 属于同一 active book；重复归入为无操作。
- 选择父 Goal 时关联数默认只计算直接归入内容；后代内容逐层查看，避免隐含汇总与重复计数。
- 删除 Goal 的推荐语义：只删除该 Goal 及其直接关联，直接子 Goal 提升到其父级，其他标注不动。通过就地确认明确告知子 Goal 将保留；不默认级联删除整棵树。原型暂不承诺完整删除流程。
- 删除标注时清除所有相关 GoalLink；删除书籍时一起清除其 Goal 文档；恢复、重导入后不得留下对旧 generation 的待写命令。

## 5. 文件与接口变更

### 5.1 新增的模块

| 文件（拟新增） | 最小职责 |
| --- | --- |
| `src/client/domain/goal.ts` | 上述 Goal／GoalState 类型 |
| `src/client/domain/goalEngine.ts` | 创建、编辑、提升子节点删除、路径／子节点查询、关联与解除；纯函数 |
| `src/client/features/goals/goalController.ts` | 当前书的 GoalState、选择、编辑草稿、写入状态与 callbacks |
| `src/client/features/goals/goalUI.ts` | 左侧轻量 Goal 行、原位输入、局部层级和关联摘录；目标在左侧选择，无数据库调用 |
| `src/client/features/goals/goalLayout.ts` | 只读取既有阅读几何，决定左侧位置／空间不足的召回 |
| `src/client/infrastructure/goalRepository.ts` | 读取／保存 GoalState，使用既有队列、版本、generation 与 transport |
| `src/client/infrastructure/goalRecovery.ts` | 独立命名的待写缓冲和 ACK 清理，不储存整本书或标注副本 |

这些文件只按现有边界拆分，不为一次动作新增 service 层、依赖注入容器或事件总线。UI 继续用现有 DOM 渲染方式。

### 5.2 存储协议与数据库

新增 `goal_states(book_id PRIMARY KEY REFERENCES books(id), payload, revision, deleted)`，每书一行。新增两项协议即可覆盖首轮所有 Goal 动作：

```ts
'goals/query': {
  request: { bookIds: string[] };
  response: { records: GoalStateRecord[] };
};
'goals/save': {
  request: { opId: string; expected: number; generation: string; state: BookGoalState };
  response: { revision: number };
};
```

`GoalStateRecord` 为 `StoredRecord<BookGoalState> & { bookId: string }`，令 id=bookId；无行表示空 GoalState、revision=0。清空最后一个 Goal 保存空文档，不另增删除接口。文档按书保存，但不能修改 `Book` payload，否则每次编辑 Goal 都会重写整本书。

需要同步修改 `src/shared/storage.ts`、`src/shared/desktop.ts`、`storageClient.ts`、`dataStore.js` 及 `dataStore.d.ts`、`storageApi.js`、`desktop/preload.cjs`、`ipc.cjs`、`storage.cjs`。桌面方法为 `queryGoals`、`saveGoals`，沿用逐方法白名单和严格字段校验；同时更新现有 `.d.ts` 与类型契约测试。

**现用库升级是必要工作：** 当前 DataStore 拒绝 `user_version>1`，且每次启动执行 `PRAGMA user_version=1`。应改成明确的 v1→v2 事务式加表升级，新库建立 v2；不清库、不重建 annotations、不重新解析 EPUB。对未知更高版本继续拒绝，不无条件降版本。原始旧数据库／IndexedDB 自动迁移仍不扩大范围。升级前使用现有 `backupDatabase` 在连接可用时完成一致性备份，失败则不进入升级。

所有 Goal 保存仍走 `mutate`、expected、activeBook generation；原子校验整棵树和全部 link 后再写入。冲突保留本地草稿和最后的已确认基线，提示重载处理，不盲目把旧全文配上最新 revision 重发覆盖别人修改。

**删除标注涉及两种数据：** 在已有 `deleteNote` 事务中同步删 link 并增加 GoalState revision；不能依靠 UI 回调最终清理。响应增加可选的最新 `goalState`，客户端接收并刷新已确认状态。若有尚未提交的本地 Goal 操作，以已确认基线为准重放可确定的编辑／归入意图，去除已删除目标；存在文本或结构冲突则保留草稿并停写，不能直接覆盖。重试同一 opId 返回旧响应时，不用较低 revision 覆盖较新缓存。仅当 link 确实变化才增加 Goal revision。

`deleteBook` 同事务将 GoalState 置删除标记并提高 revision，客户端清理其版本／待写缓冲。恢复已删书籍后旧 generation 命令仍应拒绝。服务端校验与事务不能用前端防误操作代替。

### 5.3 打开、输入与关闭流程

1. 切书前完成当前笔记和 Goal 编辑。依照现有打开请求令牌读取书籍，再并行读取该书 notes 与 goals；每次 await 后检查令牌。只有最新请求才能同步安装 session、reader、annotations、goals 并渲染。Goal 读取失败需明确提示并禁止空状态覆盖数据库，不能伪装为“没有 Goal”。
2. Goal 原位输入沿用笔记的可见编辑方式和 IME 互锁。新增 Goal 的空草稿只在内存；有内容后的输入先写待确认缓冲，随后以短暂合并写入提交，失焦／Ctrl+Enter／切书时立即 flush。Escape 结束编辑，不把已 ACK 的文字伪装为撤销。
3. 不重建当前 textarea，不因 notes 更新或 Goal 计数变化丢失光标与中文组合输入。输入 Goal 时左右键、D 等不会触发翻页／模式切换；扩展 `AppShell` 的现有输入互锁判断。笔记仍按现有点击内容进入编辑及结束编辑的规则运行。
4. 归入已有笔记前等待该笔记最新已发起写入成功；空草稿不能归入。建立关联不改 note 的 timestamp、颜色、quote、comment 或 location。
5. `main.ts` 将 `onNotesChanged` 同时连接 reader 的现有刷新与 Goal 摘录刷新；`onPageRendered`／`onViewportChange` 更新章节上下文与几何，但仅布局变化不保存 GoalState。
6. 桌面关闭握手：完成两种编辑 → 检查两种未确认失败 → `drainStorage()` → 检查两种恢复缓冲 → ACK。浏览器退出前尽量 flush，但不能依赖异步 unload；待确认内容靠同步写入的小缓冲恢复。

## 6. 备份、恢复与导出

这一部分属于可用模块的完整性，不应等到用户积累 Goal 后再补。

- `.aurabackup` 新版本建议为 `1.1`，保持当前 type、books、notes 包络，增加 `goalStates`。新程序读取没有该字段的 1.0 备份时按“未提供 Goal 数据”处理，不能清除现有 Goal。
- 当前备份可选择不含标注。若导出 Goal，必须同时带齐所引用标注；首轮推荐有 Goal 时该书备份包含全部高亮／笔记，并在现有备份 UI 明确显示依赖，不静默导出悬空关联。
- `restoreRecords` 与 RestoreCommand 增加可选 `goalStates`；桌面 `command()` 目前严格校验字段数，必须显式同时支持旧／新两种形状。
- 保持现有恢复的合并语义：没有 goalStates 就保留已有 Goal；有时按 Goal ID upsert、保留未出现在备份中的现有 Goal。备份中出现的同 ID Goal，以备份的节点及其直接关联为准替换；其余节点及关联保留，然后验证合成树与 link。ID 跨书冲突、孤儿、环或依赖不完整时整体拒绝，不静默丢条目或重命名。
- 书籍、标注、Goal 一次 restore 事务落库；中途任何验证／写入失败全部回滚。恢复前完成编辑、处理未确认写入，恢复后刷新 Goal revision 与选中状态；已不存在的选择回到首个根 Goal。
- SQLite 一致性备份自然覆盖新表，但需要补查验新表与 JSON 中树／link 的逻辑完整性；`PRAGMA foreign_key_check` 无法发现 JSON 内的孤儿引用。
- 首轮默认交付可逆备份。按 Goal 导出 Markdown 可作为下一小步：复用现有下载／桌面保存通道和标注格式，将 Goal 层级、直接关联高亮／笔记及章节来源导出，便于用户自行交给 AI；不新增 AI 服务。本次不为章节导出额外塞入一份重复的全树。
- 旧程序当前可能忽略未知备份字段；不能宣称 1.1 在旧版本中无损往返。文档明确 Goal 数据需新版恢复；若要强制阻止旧端导入，需要额外格式策略，不能靠 version 字段自动实现。

## 7. 实施顺序与阶段验收

| 阶段 | 代码工作 | 阶段完成条件 |
| --- | --- | --- |
| 1. 单页效果验证 | 用效果稿确认左侧真实尺寸、原位创建、局部层级与归入流程；笔记与高亮逐项对照当前交互 | 看得到左侧效果；笔记没有新增编辑按钮，高亮没有新增 Goal 面板；原有操作入口保持 |
| 2. 数据闭环 | goal 类型／纯函数／repository／recovery；现用库升级；HTTP、桌面 IPC；备份／恢复与删除清理 | 创建／编辑／关联刷新后保留；旧库数据不变；桌面和浏览器同样可用；故障和恢复无悬空引用 |
| 3. 接入阅读界面 | GoalController、UI、布局计算；接入 main/coordinator；同书选择与章节相关子 Goal；复用笔记与高亮归入入口 | 完整完成“建 Goal → 子 Goal → 归入已有标注 → 回看原文”，不重排正文，不抢输入焦点 |
| 4. 核验与收尾 | 补针对性测试与人工验收；更新 README、存储／备份说明 | 必要自动检查通过，完成下表；未完成项明确记录，不将原型等同上线 |

第 2 阶段的数据结构不依赖左侧、底部或拖拽的具体实现；界面反馈可局部调整，不引发架构迁移。

## 8. 必要测试与人工验收

沿用当前 `tests/unit`、`tests/regression` 与 `tests/desktop` 运行方式。只测试行为和数据风险，不给每条 CSS 写镜像断言。

| 验证项 | 关键检查 |
| --- | --- |
| Goal 纯函数 | 自由文本、多层树、重复 link、环／孤儿拒绝、删父节点提升孩子、跨书目标拒绝 |
| SQLite 与协议 | v1→v2 保留原书／标注完整 JSON；反复打开不重复升级；revision 冲突、同 opId 重放、旧 generation 拒绝；HTTP 与桌面都能读写 |
| 删除与恢复 | 删除一个标注清除它在多个 Goal 的 link；删除书籍清理；恢复缺失字段保留现有 Goal；合并后验证环；无效备份整笔回滚；新备份往返完全一致 |
| 恢复缓冲 | 成功 ACK 清理，网络失败／磁盘满保留内容，409 不覆盖，写入顺序不倒退；关闭时失败拦截、重新打开可恢复 |
| 切书竞态 | 扩展 `test_open_book_race.js`：A 的迟到 Goal 响应／写入结果不能覆盖 B；读取失败不能被当空数据保存 |
| 编辑连续性 | 点击笔记内容直接编辑，无新增编辑／完成按钮；中文输入、换行、D／方向键、点击归入、notes 重渲染均不丢光标；输入期间不触发阅读快捷键 |
| 交互复用 | 高亮点击仍显示原删除操作浮条；只追加直接归入动作，不弹 Goal 选择面板。笔记归入不触发编辑，左右两处删除都保留各自语义 |
| 原有回归 | 高亮颜色与范围、笔记编辑与当前页筛选、导出、原文定位、阅读位置保持继续通过 |

建议先跑 `npm run typecheck`、针对新增纯函数与存储的测试，再跑 `npm test`；涉及桌面白名单、关闭握手与新 schema，必须跑 `npm run test:desktop`，涉及保存故障的项目接入现有 stability 测试。测试通过后再做人工阅读体验验收，不把 JSDOM 当几何与拖拽验收依据。

人工验收以约 1613×928 内容窗口的真实 EPUB 单页为主：

1. 无 Goal 可直接阅读；创建“时间是什么？”时没有分类框。长文本、多行与中文输入正常。
2. 在章节内建子 Goal；前后翻页不切走当前 Goal；换章节可简洁找到相关子 Goal；多根与深层树也可返回查看。
3. 先在左侧选 Goal，再从原文高亮的原操作浮条或右侧笔记操作区直接归入；不出现额外 Goal 面板或笔记编辑按钮。重复归入不重复，移出保留原标注，重叠目标不明时不误归入。
4. 点击 Goal 中的跨章摘录能定位原文；右侧笔记仍显示当前可见正文，已有编辑体验不变。
5. 展开结构、编辑 Goal、展开相关内容前后，正文宽度、左上方句子、右侧笔记位置不变。
6. 缩窄窗口后 Goal 召回不挤正文与笔记；双页／滚动无 Goal 覆盖，切回单页状态仍在。
7. 刷新后重新从书库打开：Goal 与关联保留。不要把当前未实现的“自动恢复上本书及位置”当作本模块验收条件。
8. 导出新书籍备份，在隔离书库恢复：树、关联、高亮、笔记全部保留；故障时无半份数据。

## 9. 需要通过体验再确定的少量决定

左侧是首轮效果验证位置，不将底部方案从设计上排除；局部层级与全部结构如何切换、是否增加专用拖动把手，需要在真实阅读中比较。数据层只依赖树和 annotation ID，因此这些选择均为 Goal 模块内部调整。

当前按第 3 节的精简英文效果稿落地：左侧统一管理 Goal、原标注操作处直接归入；不添加常驻说明、重复入口或新的标注面板。笔记、高亮、阅读引擎与存储仍沿用现有功能边界。
