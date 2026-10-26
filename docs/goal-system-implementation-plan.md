# Goal 模块代码实现计划（以最终效果稿为准）

日期：2026-10-25。代码基线：`c48695d`。2026-10-26 已按本计划接入 Goal 模块；实际交付与验证记录见 [实现记录](goal-system-implementation.md)。

2026-10-26 后续确认：用户选择 Sidebar 与可调宽度，替代下文原定的页边留白呈现。本次只调整展示；书内 Goal 存储、标注和备份规则保持不变，详见 [Sidebar 实现记录](goal-sidebar-implementation.md)。下文保留为首版实现基线。

唯一 UX 基准：[最终效果稿](prototypes/goals.html)。本计划替代此前的探索方案；实现时按该稿接入现有 AuraReader，不再重新设计 Goal 的入口、面板或操作流程。

效果稿 SHA-256：`7b5d1c736e7bfdfdd127f833d9c0aeac7e56d38165639dc30b643a02d4a1dc0d`。本次不修改效果稿；后续若用户调整效果稿，再同步修改计划与验收项。

## 1. 本轮范围

Goal 表达阅读者自己的目的、问题或期待，在没有高亮和笔记时也能独立存在。高亮和笔记作为读者主动归入的相关材料，不决定 Goal 的含义，不自动生成或分类 Goal。

本轮实现最终稿已经呈现的闭环：多个根 Goal、多层子 Goal、原位编辑、章节相关子 Goal、完整树导航、已有高亮／笔记直接归入、自动展开相关内容、回到原文、解除关联，以及可靠保存和书籍备份恢复。

以下后续方向保留在产品讨论中，不在本轮加入口或预建系统：Goal 内独立文字条目、点赞点踩、AI、拖拽、跨书共享 Goal、Goal 删除／移动／排序、完成度与期限、底部常驻面板、双页和连续滚动适配。Goal 自身的自由文字编辑属于本轮；独立文字条目是另一项后续能力。

代码继续沿用 `main.ts → AppCoordinator / feature controller → domain / repository → storageClient → DataStore`。新增同级 Goal 功能模块；保留现有 DOM、TypeScript、SQLite 和桌面 IPC，不引入框架、通用内容引擎、事件总线或第二套数据库。

## 2. 最终稿的行为契约

| 场景 | 必须实现的行为 | 对应原型位置 |
| --- | --- | --- |
| 无 Goal | 左侧保留 `Goals` 与新建 `+`；可以直接阅读 | `.goal-header` |
| 新建根 Goal | `+` 打开一个原位输入框；不选类别、不打开对话框 | `startGoalEdit('root')` |
| 原位编辑 | 点击当前 Goal 文字，用 textarea 替换原文字，保留换行；无 Save/Cancel | `.goal-title`、`.goal-editor` |
| 结束编辑 | 失焦、Escape、Ctrl/Cmd+Enter；Enter 换行；IME 组合输入期间不结束 | `finishGoalEdit()` |
| 空白输入 | 新 Goal 空草稿丢弃并回到先前视图；已有 Goal 清空后恢复最近非空内容，不解释为删除 | `previousAllGoals` 与空白判断 |
| 新建子 Goal | 当前 Goal 旁 `+` 原位输入；记录当前章节上下文；保存后选中新节点 | `.goal-current` |
| 常态阅读 | 显示当前 Goal、单行直接父级、与当前章节相关的直接子 Goal | `.goal-parent`、`.goal-children` |
| 完整树 | 点 `Goals` 在同一左侧区域切到完整树；分支箭头只展开／收起，文字按钮选择节点；不画关系线 | `.goal-tree` |
| 选择 Goal | 从父级、子 Goal 或树选择后，回到该 Goal，并自动展开它已有的高亮和笔记 | `choose()`：`itemsOpen=true` |
| 直接归入 | 笔记原操作区、高亮原操作浮条各加一个 `Goal` 动作，目标是左侧当前 Goal；不弹 Goal 列表 | `linkCurrent()` |
| 归入反馈 | 回到当前 Goal 视图并自动展开相关内容；按钮显示勾，计数更新；不增加成功 toast | `allGoals=false; itemsOpen=true` |
| 展开／收起 | 回形针＋非零数量；允许手动收起；再次选择或归入时重新展开 | `.goal-items-toggle` |
| 关联内容 | 显示类型图标和最多两行摘录；高亮用 quote，笔记用 comment；不重复显示章节／时间／来源行 | `.goal-item` |
| 原文定位 | 点击摘录走现有 `jumpToAnnotation(id)`；不再实现一套引文定位 | `locate()` 的产品接入 |
| 解除关联 | 条目旁 `×` 只移出关联，原标注仍保留 | `Unlink` |
| 既有笔记／高亮 | 笔记仍点击内容进入原位编辑；高亮仍显示原操作浮条并独立删除 | 原有 annotations 功能 |
| 快捷操作 | 子 Goal `+`、解除关联 `×` 在 hover/focus 时出现，触屏常显；保留英文可访问名称与原生键盘操作 | 最终稿 CSS 与 aria 属性 |

新增区域及关联动作采用最终稿的简短英文文案，真实书籍和用户输入保持原语言。原型中省略的现有书库、字体、目录、导出等控件继续保留；这次不做全站翻译。

原型只作为 Goal 的视觉和行为基准：不能把 `#stage` 的 1613×928 整页缩放、固定横坐标、演示数据、模拟章节切换或整块 DOM 重建直接复制到产品。

## 3. 现有代码复用与新增文件

| 位置 | 本轮工作 |
| --- | --- |
| 新增 `src/client/domain/goal.ts` | Goal、书内 Goal 状态与关联类型 |
| 新增 `src/client/domain/goalEngine.ts` | 创建／编辑、树与路径查询、章节相关子节点、关联／解除、完整性校验；纯函数，不含 DOM/数据库 |
| 新增 `src/client/features/goals/goalController.ts` | 当前书数据、选择／树／展开／编辑状态、串行保存与错误状态；对外暴露选择、编辑、归入和 flush 方法 |
| 新增 `src/client/features/goals/goalUI.ts` | 按最终稿增量渲染 Goal 行、树、同一 textarea 和关联摘录；只发出动作，不调用存储 |
| 新增 `src/client/features/goals/goalLayout.ts` | 从既有阅读几何和实际 DOM 计算左侧位置／可见性；不改变正文尺寸 |
| 新增 `src/client/infrastructure/goalRepository.ts` | 读取／保存 Goal 状态、版本接受与恢复重试；复用 storageClient |
| 新增 `src/client/infrastructure/goalRecovery.ts` | Goal 专用待确认写入缓冲；复用笔记的恢复策略，不重构成通用框架 |
| `src/client/index.html`、`styles.css` | 挂载一个 `.goal-panel`，移植最终稿 Goal 专属样式；原笔记操作区与高亮浮条各补一个动作 |
| `src/client/main.ts`、`app/elements.ts`、`app/contracts.ts` | DOM 引用、Goal callbacks 类型、同级控制器装配及跨模块连接 |
| `app/appCoordinator.ts`、`app/session.ts` | 沿用书籍 session；在现有任务协调中安装／切换 Goal 数据、定位原文，不增加全局状态库 |
| `features/annotations/notesUI.js`、`annotationController.ts` | 复用 note-card、原位编辑、焦点和保存流程；增加归入回调与内容变更通知 |
| `features/annotations/selectionController.ts`、`selectionTooltipUI.js` | 沿用 activeAnnotationContext、原浮条定位／关闭、文本选择保护；新增同浮条内的归入动作 |
| `features/layout/marginNotesLayout.js`、`layoutController.js` | 复用 marginGeometry 和模式状态；在已有布局更新之后刷新 Goal 位置 |
| `infrastructure/storageClient.ts`、`src/shared/storage.ts` | 扩展既有请求分发、同书队列、Goal revision 与命令类型 |
| `server/dataStore.js`、`dataStore.d.ts`、`storageApi.js` | 增量 schema、Goal 读写、服务端校验、同事务清理与恢复 |
| `src/shared/desktop.ts`、`desktop/preload.cjs`、`ipc.cjs`、`storage.cjs` | 同时补齐桌面方法白名单、输入验证与共享 DataStore 调用 |
| `src/client/desktop.ts` | 将 Goal flush、失败检查和恢复缓冲纳入现有关闭握手 |
| `features/backup/backupController.js`、`infrastructure/exporters.js`、`server/storageMaintenance.js` 及相关声明 | 扩展书籍备份、原子恢复和 SQLite 完整性核验 |

`annotationRenderer.js`、`annotationRangeEngine.ts`、章节分栏／翻页算法继续沿用；新增关联不改 quote、comment、color、timestamp 或 location。旧 `core/`、`repositories/`、`ui/` 兼容入口不再各建一套 Goal 实现。

## 4. 最小数据与保存协议

采用一书一份小型 Goal 状态，与当前完整 JSON 存储方式一致。Goal 不嵌进 `Book` payload，也不作为 `AnnotationKind` 的新种类。

```ts
interface Goal {
  id: string;
  parentId: string | null;
  text: string;
  origin: null | {
    sourcePage: number; // 1-based 源文档，不是屏幕栏号
    sectionId: string;
    chapter: string;    // 仅来源快照，不作为关联主键或常驻 UI 标签
  };
  createdAt: string;    // ISO 时间
  updatedAt: string;
}
interface GoalLink { goalId: string; annotationId: string }
interface BookGoalState {
  bookId: string;
  goals: Goal[];
  links: GoalLink[];
}
// StoredRecord 沿用 src/shared/storage.ts
// 每本书一条，record.id = record.bookId
// GoalStateRecord = StoredRecord<BookGoalState> & { bookId: string }
```

根 Goal 的 origin=null；子 Goal 记录创建时 reader 的源文档位置。本轮章节相关性按该书源文档编号匹配，sectionId 辅助定位；不把显示栏号或章节标题作为稳定 ID，同一源文档内多个 TOC 小节不伪装成精确分节筛选。完整树始终可找到其他章节的节点。

数组保持创建／归入顺序，不增加排序入口。链接以 `(goalId, annotationId)` 去重，允许同一标注经用户明确操作分别归入不同 Goal；数量只计算当前 Goal 的直接关联，不隐含汇总后代。

保存到 `goal_states(book_id PRIMARY KEY REFERENCES books(id), payload, revision, deleted)`，复用 `mutate`、`opId`、expected revision 和 book generation：

```ts
'goals/query': {
  request: { bookIds: string[] };
  response: { records: GoalStateRecord[] };
};
'goals/save': {
  request: {
    opId: string; expected: number; generation: string;
    state: BookGoalState;
  };
  response: { revision: number };
};
```

没有记录表示空状态、revision=0；读取失败不是空状态，不能据此保存空文档。Goal ID 在书内唯一，parent 必须存在且无环；迭代遍历深树。text 保留原始换行，空白只用于判断有效性；渲染使用 textContent。所有链接必须指向同一有效书籍中的现存标注。服务端在一个事务中完成整份状态的校验与保存，拒绝孤儿、跨书引用、重复节点和不合法版本。

### 4.1 数据库与双端接入

当前 `createDataStore()` 拒绝 user_version>1，且每次打开都写 user_version=1。实现时改为明确的新库 v2 与现用 v1→v2 加表升级；schema 修改和版本提升放在同一事务中。失败回滚，保留更高版本拒绝及数据库丢失保护，不清库、不重写旧书／标注、不重新解析 EPUB。

保持 DataStore 同步打开约定，不在同步构造函数中塞入未等待的异步备份。升级验证前通过现有 `storageMaintenance.js backup` 对测试副本做一致性备份；SQLite 日常备份与校验需同时覆盖新表，并验证 JSON 内 parent/link 的逻辑完整性。

HTTP 增加两条路由；桌面增加 `queryGoals`、`saveGoals` 两项明确能力，从 preload、IPC、storage 校验到共享 DataStore 逐层注册。保持现有发送者验证和 JSON 字段限制，不开放任意通道或 SQL；更新 `.d.ts` 与 `tests/types/contracts.mts`。

### 4.2 写入、恢复及删除

- 所有 Goal 写入使用现有 `enqueue(bookId)`，与同书笔记／书籍写入共用顺序；有实际数据变化才保存，选择／翻页／展开不写数据库。
- 小型待写缓冲使用独立 `aura_goals_pending_` 前缀，仅保存未确认 Goal 状态／操作和必要版本，不缓存整书或标注正文副本。输入先同步进入缓冲，再提交 SQLite；数据库 ACK 后按本地写入版本清理，旧 ACK 不能清掉新输入。
- 创建的空草稿只在内存，首次非空后进入可恢复草稿缓冲；新节点结束编辑前不写入已确认树，重开时恢复同一草稿，不擅自变成已创建 Goal。结束时为空则清理该草稿，非空则保存节点，ACK 后清理缓冲，避免新建后又清空需要额外的 Goal 删除操作。已有 Goal 输入先进入待写恢复，清空时保留最近非空内容，结束编辑恢复它。可短暂合并尚未发送的输入；失焦、切书、切模式、备份和关闭立即 flush。不要照搬原型“只在 blur 时写内存”的可靠性边界。
- 同 opId 重试保留相同命令；已发送但未收到 ACK 的命令不能随意修改。409 保留本地输入与已确认基线，停止盲目重发，复用现有错误反馈；不将旧全文换上新 revision 后覆盖。
- `deleteNote` 在原事务中清除该 annotationId 的全部 GoalLink，且仅在关联变化时提升 Goal revision；响应扩展为 `{ revision, goalState? }`。不能只靠前端回调最终清理。客户端只接受不低于当前版本的记录；有冲突草稿时保留草稿，显式暂停受影响的后续保存，不自动覆盖。
- 同书正常操作先结束当前 Goal 编辑并按队列提交，再删除标注，减少自身操作冲突；笔记清空删除等原路径也由服务端兜底。无论从哪个入口删除，都保证库内不留悬空关联。
- 删除书籍时同事务将 Goal 状态置删除标记并提升 revision；成功后清理该书 Goal 版本、呈现状态和恢复缓冲。重建书籍后旧 generation 的写入继续拒绝。

## 5. 控制器、编辑与阅读集成

### 5.1 Goal 状态和动作

GoalController 保存已确认状态、当前编辑草稿，以及仅在内存按书保留的 selectedGoalId、完整树开关、树分支展开集合、itemsOpen。UI 状态不进入书籍备份。首次打开已有 Goal 时选择第一个根节点；有相关内容时采用选择 Goal 的自动展开规则，不恢复整书阅读位置。

最小动作：`setStateForBook`、`selectGoal`、`toggleTree`、`toggleBranch`、`beginEdit`、`updateDraft`、`finishInlineEdit`、`linkAnnotation`、`unlinkAnnotation`、`updateReadingContext`、`flush`、`assertWritesSaved`。具体命名可按代码风格调整，行为契约不能变化。

`selectGoal` 必须同步选中并令 itemsOpen=true；成功归入必须 allGoals=false、itemsOpen=true。手动收起只影响当前展示，再次选择／归入重新展开。关联全文来自 annotations 的全书集合，不受当前可见页笔记筛选影响；笔记条目更新 comment，高亮条目读取 quote。

### 5.2 输入与 DOM 保留

复用现有 notesUI / noteCaret 的编辑方式与 IME 保护，Goal 校验独立，不调用笔记 requireQuote。只维护一个当前 Goal textarea，保留选区、光标、滚动和组合输入。普通文字键、D、左右键在 textarea 中由现有输入互锁保护；Enter 换行，Escape 结束编辑，不额外赋予撤销已保存文本的含义。

原型的 `replaceChildren()` 会拆掉编辑节点，不能照搬。Goal UI 按 ID 保留行与编辑器；文字输入只更新草稿和高度，关联数量／笔记文字变化只更新对应条目。失焦保存后，用户点击子 Goal `+`、树节点、父级或关联内容的同一次操作必须继续生效，不能因 blur 重建目标按钮而吞掉点击。

当前 `AnnotationController.updateInlineNote()` 不会在每次输入时调用 onNotesChanged。增加轻量的 `onAnnotationContentChanged(note)` 通知，用于定点更新 Goal 摘录；不为此重建 notesList 或重刷正文。create/delete 仍串联既有 onNotesChanged，不能覆盖 reader.refreshAnnotations 的连接。

### 5.3 归入动作与异步边界

笔记归入按钮和原删除按钮一样 stopPropagation；卡片点击过滤该按钮，Enter/Space 激活按钮也不能触发卡片编辑。原位编辑时沿用现有隐藏操作区的规则。

高亮动作使用已有 activeAnnotationContext。单一明确 annotationId 才显示可用归入；重叠多个目标时保持原删除能力，不猜测、不批量关联、不增加选择面板。原浮条的选文／拖动保护、重复点击、激活边框与关闭行为继续保留。无当前 Goal、相关写入未可靠保存、该模式不提供 Goal，或已关联时，动作隐藏／禁用按原型反馈，不额外弹面板。

发起归入时冻结 bookId、generation、goalId、annotationId；等该标注已发起写入成功后再保存关联。编辑中的新笔记草稿不能入关联。await 期间切书或切 Goal，不得把材料归入后来选中的目标；完成后仅在界面仍对应原书／原 Goal 时展开，不能用旧响应覆盖新界面。

本地可立即预览归入结果并展开；成功状态仍以 SQLite ACK 为准。保存失败时保留待写恢复和当前内容，复用错误反馈，不能把未确认关联当成已可靠保存用于备份。

### 5.4 打开、导航、模式与关闭

在 AppCoordinator 现有 openBookRequestId 机制内：先结束旧书两种编辑，再读书籍，先完成该书 notes 的加载和未确认操作恢复，再读取／恢复 Goal 状态，避免笔记补写／删除改变 Goal 版本后安装了先前的旧快照；每次 await 后检查请求令牌。准备完成后同步安装 reader、session、annotations、goals，再渲染；A 的迟到读取／失败不得覆盖 B。Goal 读取失败明确报错并禁写，不能显示空状态后覆盖原数据。

沿用 `onPageRendered`、`onPageChange`、`onViewportChange` 与布局回调更新上下文和左栏位置；翻页只更新章节相关子 Goal，不改用户当前选择。Goal 展开、切树和归入不调用 refitChapter 或 renderPage，点击关联摘录除外，直接交给现有 `AppCoordinator.jumpToAnnotation()`。

`beforeNavigate`、切书、切模式、beforeRestore 以及导出备份前，都结束两种编辑并 flush。桌面关闭仍走现有握手：结束编辑 → 检查笔记与 Goal 失败 → drainStorage → 检查两种缓冲 → completeClose；失败保留窗口。浏览器不能依赖异步 unload，输入恢复由同步缓冲保证。

## 6. 左侧布局与可见范围

复用 `marginGeometry()` 和实际正文容器矩形，保证读到的是现有正文最终位置，不把原型的 left=226.5 等数字写死。

参考 1613×928 内容窗口：正文560px，readingLeft≈526.5；Goal 宽260px，距正文40px，左侧起点≈226.5。顶部与最终稿相同，Goal 内部独立滚动，不挤正文或右侧笔记。文字、背景和状态色跟随现有纸张／主题 token；参照页边笔记从 paper 读取文字颜色，避免 sibling Goal 区拿不到 reader-panel 内的纸张主题变量。保持原书字体、字号、缩进和真实工具栏。

只在用户选择的单页分页模式且左侧可用宽度至少200px时显示，Goal 宽度为 `min(260, readingLeft - 40 - 24)`。应用窗口当前允许800px宽，不能假定左侧一直足够。空间不足时提交编辑并隐藏 Goal 区及其归入动作，保留数据和选择，恢复空间后重新显示；不压缩正文、不自动滚动，也不新增底部召回按钮或浮层。

双页、滚动及双页自动降级状态不在本轮提供 Goal UI；不改原模式行为。若用户后续要求窄窗或其他模式入口，以新效果稿为准，当前不自行补设计。

## 7. 备份与恢复

沿用现有每书 `.aurabackup`、现有“包含高亮与笔记”选项和单次原子 restore，不增加 Goal 专用备份控件。版本升级为1.1，保留原 type、books、notes 包络，新增可选 goalStates。

- 正常包含标注的备份：保存完整 Goal 树及全部链接，确保链接指向同文件中的标注。
- 用户明确不包含标注：仍保存 Goal 的文字和树，省略每份 Goal 状态的 links 字段；不复制高亮／笔记，也不保存悬空引用。备份类型可定义为 `GoalBackupState = Omit<BookGoalState, 'links'> & { links?: GoalLink[] }`。
- 恢复时区分 links 缺失和空数组：缺失表示该备份未提供关联，不清除目标书已有链接；空数组表示备份中的该部分确实没有链接。新库中缺失 links 按空关联安装。
- 旧1.0备份没有 goalStates 时保留现有 Goal；有 goalStates 时按书内 Goal ID upsert，保留备份之外的节点。提供 links 时替换备份包含节点的直接关联，其余节点保留；未提供时保留这些节点已有链接。最后统一验证合成树和所有链接。
- RestoreCommand、BackupData、restoreRecords 及桌面严格命令校验同步支持可选 goalStates；不能只让导出器写出字段而导入器忽略。先准备完整书／标注／Goal，再在一个事务中恢复；环、孤儿或写入失败全回滚。
- 导出前等待未确认写入，避免漏掉刚输入的 Goal 或刚归入的材料；恢复后刷新所有版本并清理／校正失效选择。
- SQLite 在线备份包含新表，恢复核验需比较 Goal 树与链接。旧客户端可能忽略新备份字段，不能宣称旧版无损恢复1.1。

本轮不新增按 Goal 导出 Markdown 的菜单；既有章节、笔记摘要等导出继续保持原功能。

## 8. 五步实施与完成条件

| 顺序 | 可执行工作 | 完成条件 |
| --- | --- | --- |
| 1 | 添加 Goal 类型、纯函数、协议；事务式 v1→v2；同步实现 HTTP、桌面能力与 repository/recovery | 隔离库中可保存／重读树与关联；版本、幂等和故障保留通过；旧书／标注 JSON 不变 |
| 2 | 实现 GoalController、增量 UI、左侧布局并装配 main/coordinator | 用真实书显示最终稿交互：原位创建／编辑、多层树、章节子 Goal、选择后展开；正文几何不变 |
| 3 | 在原笔记操作区／高亮浮条接入同一归入动作；联动内容、原文跳转及删除清理 | 归入后立即看到内容；点击 Goal 自动展开；无新增编辑按钮或 Goal 选择面板；输入焦点与删除语义保留 |
| 4 | 补齐切书竞态、未确认输入恢复、关闭握手、书籍备份恢复 | 刷新重开、异常终止和隔离恢复不丢 Goal／关联，失败不静默覆盖或误报成功 |
| 5 | 执行必要自动测试和真实桌面视觉验收，更新 README 的新增行为／范围 | 对照固定效果稿签出下列验收清单；记录结果及限制，未验证项不写成通过 |

不再安排“选左侧还是底部”“拖拽还是新面板”等探索步骤，不把后续能力混入本轮变更。

## 9. 验证清单

自动测试新增建议：`tests/unit/test_goals.js`（纯模型）、`tests/regression/test_goal_interaction.js`（DOM 行为）、`test_sqlite_goals.js`（存储）、`tests/desktop/goal-interaction.cjs`（真实窗口）。文件名可按现有运行器调整；unit/regression 的 `.js` 自动发现，新增 desktop 用例必须在 `scripts/test-desktop.cjs` 显式注册。

| 验证面 | 必须覆盖 |
| --- | --- |
| 模型 | 无标注可创建；多根与深层树；文本／换行保留；环／孤儿／跨书引用拒绝；重复归入无重复；只计直接关联 |
| 最终稿行为 | 根 `+`、子 `+`、编辑结束／空草稿、父级／子级／树选择均正确；选择和归入自动展开；手动收起后再次操作重新展开；零计数隐藏；解除保留原标注 |
| 输入与事件 | 中文 IME、选区和光标保留；D／方向键不翻页；blur 后紧接的按钮点击不丢；笔记编辑时 Goal 摘录更新且不重建 textarea；归入不触发笔记编辑 |
| 原标注 | 高亮颜色／范围、选文保护、浮条关闭和独立删除不变；重叠目标不明时不误归入；草稿和失败保存不能当可靠材料 |
| 存储与竞态 | v1数据完整升级；更高版本拒绝；同opId重试、409、旧ACK不覆盖新输入、旧generation拒绝；同书多条关联清理原子；切书迟到响应不串书 |
| 故障与恢复 | 磁盘满／只读／锁竞争、缓冲不可写及异常终止；关闭前flush包含Goal；有未可靠保存内容时不能确认关闭 |
| 备份 | 1.0读取、1.1完整往返、不含标注时省略links；缺失与空数组语义不同；合并后的环／断链整笔回滚；SQLite一致性备份含新表 |

先运行 `npm run typecheck` 和针对性测试，再运行 `npm test`、`npm run test:desktop`。将新 Goal 读写加入现有 `npm run test:stability` 的故障／终止恢复场景；本轮不要求重走安装器发布流程。文档撰写本身不视为上述实现测试已执行。

人工验收以同一真实 EPUB、约1613×928的内容窗口对照最终稿，再核验当前默认1440×960窗口、窄窗安全隐藏、纸张主题和模式切换。检查单页正文与右侧笔记位置、原阅读句子、长文本、深树、跨章回看、创建后归入及关闭重开。JSDOM或原型整页缩放不能代替实际几何与阅读连续性验收。

完成标准：最终稿的每个 Goal 交互在真实书籍上可用，用户意图与关联能够可靠保存和恢复，原有阅读、高亮、笔记、导出继续工作；没有顺带加入尚未出现在最终稿中的用户入口。
