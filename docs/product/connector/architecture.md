# AuraReader 本地 Connector 代码架构设计

2026-11-23 · 架构设计 · 分支 `codex/connector-mvp` · [实现与验收](implementation.md)

本设计对应[已确认的 MVP](feature-spec.md)。本机 ChatGPT 或 Codex 启动一个独立的 MCP 标准输入输出进程。Connector 和 Electron 各自打开同一桌面书库，复用 AuraReader 的数据校验、事务和领域规则。读者关闭阅读器后，对话仍能读写。默认选择 Electron 书库是 MVP 中记录的实施假设。

## 1. 进程与代码边界

```text
本机 ChatGPT / Codex → stdio → Connector → 书库查询与命令 ─┐
                                                         ├→ 桌面存储层 → SQLite
AuraReader 渲染进程 → preload → 现有 Electron IPC ────────┘
        ↑                                │
        └──── 外部提交的变更通知 ────────┘
```

| 位置 | 设计职责 | 与现有代码的衔接 |
| --- | --- | --- |
| 拟新增 `src/connector/` | 注册 MCP 工具、校验输入、投影结构化结果、管理 stdio 进程生命周期。标准输出专用于协议 | 使用官方 MCP TypeScript SDK。Connector 独立构建，Electron、浏览器及 Vite 入口不引入 SDK |
| `src/server/`、`src/desktop/storage.cjs` | 通过有名的书库操作查询、保存和恢复。共享需要一致执行的应用命令 | 沿用桌面库身份检查、`createDataStore`、记录版本、书籍 generation、事务和备份校验。首先复用 `createDesktopStorage` 现有命令；仅为确需事务内计算的操作扩展存储层 |
| `src/client/domain/` 及可共享的导入导出逻辑 | 共用 Goal 生命周期、内容顺序、Response 身份、标注范围和阅读单元规则 | 独立编译无 UI 依赖的模块。遇到 Worker、DOM 或文件对话框依赖时，提取同一套转换函数并提供运行环境适配器 |
| `src/desktop/`、`src/client/infrastructure/` 和现有控制器 | 通知窗口书库有新提交，按对象更新书架、Goal 和标注，保留编辑及阅读状态 | 通过 preload 增加窄事件接口；保留现有 IPC 请求、浏览器 HTTP 协议、阅读器 DOM 边界及关闭保存流程 |

**插件接入。** 使用包根目录的 `plugin.json` 和 `mcp.json`，由后者声明本机 `stdio` 启动命令。发布物包含 server 及其依赖，运行时必须满足项目的 Node SQLite 版本要求；源代码调试和打包后的独立启动分别验收。Codex 可先直接配置同一个 stdio 入口。ChatGPT 的验收目标是支持本地执行的桌面对话。官方提供 `plugin-creator` 辅助生成兼容清单，本设计采用官方可移植格式。工具声明按实际行为设置只读、破坏性等提示；宿主自己的调用策略仍生效，AuraReader 不增加一层确认流程。[插件打包](https://developers.openai.com/plugins/build/plugins) · [本地 MCP 插件](https://developers.openai.com/plugins/deploy/desktop-only) · [Codex MCP 接入](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

**书库与进程生命周期。** 启动时采用与 Electron 相同的桌面 profile 规则，默认定位 Windows 当前用户的 AuraReader 数据目录；自定义 profile 由启动配置明确提供，工具调用不能改变书库路径。只连接已经初始化、身份和版本兼容的桌面库。当前 `createDataStore` 打开数据库时也会初始化或迁移，实施时应在进入该入口前以只读方式检查标记、SQLite application ID 和受支持版本；迁移交给对应版本的应用。关闭一个客户端只回收其自身连接。Connector 收到 stdio EOF 时等候在途提交完成，再释放连接与 worker。[桌面路径及生命周期](../../../src/desktop/main.cjs) · [桌面库校验](../../../src/desktop/storage.cjs)

## 2. 对话工具与数据契约

下表是建议的工具划分。名称可在实现阶段定稿。以读者要完成的动作为单位声明输入、输出和副作用，工具端接收对象 ID。名称或引文有多个命中时，查询返回路径、章节和候选位置供后续调用使用。[OpenAI 工具设计](https://developers.openai.com/plugins/plan/tools) · [MCP server 构建](https://developers.openai.com/plugins/build/mcp-server)

| 用户动作 | 工具示例 | 契约重点 |
| --- | --- | --- |
| 搜索书库、浏览 Goal | `search_library`、`get_goal_context` | 支持无书 Goal、未关联标注、目标路径和子节点。分别返回主动书单、材料来源、Goal 自输入和关联上的 Response，保留显示顺序 |
| 读书、查引文 | `get_book_contents`、`read_passage` | 目录给出阅读单元和来源文档标识；正文可分段连续取完。游标绑定书籍版本、来源文档和文本偏移，结果含下一段位置、引文和出处 |
| 写笔记、自输入、高亮 | `create_note`、`add_goal_input`、`create_highlight` 及各自的编辑、删除操作 | 原文笔记绑定来源区间；Goal 自输入绑定 `goalId`。编辑沿用读到的版本，保留未知存储字段。高亮支持原有操作，开发顺序排在笔记之后 |
| 管理目标、关系与 Response | 创建／改写 Goal，完成／重新打开、归档／恢复、删除／彻底删除，添加／移除书籍或材料，设置／取消 Response | 子 Goal 指定父 ID。材料关联携带书籍 generation；操作 Response 时验证当前关联身份与加入顺序，避免误标后来重新加入的材料 |
| 书籍与文件 | 导入 EPUB／TXT、删除书籍、导出笔记和章节、逐书备份／恢复、整库一致性备份 | 指定源或目标路径，返回对象 ID 或生成文件。复用现有逐书恢复事务及完整性检查。整库 SQLite 文件替换遵循现有离线维护流程，执行前所有持库进程均须关闭 |

读操作返回模型可用的结构化字段。正文与标注分别表达作者原文、读者评论和出处；长列表与正文分段返回。新增和修改操作的结果含对象 ID、提交版本和受影响对象。区分未找到、匹配不唯一、书籍已换版本、保存冲突、存储暂时繁忙等结果，使助手可以正确决定是否重读。新建和保存各自有明确命令，外部调用方无需构造整份 Goal 图或提交 SQL。

**例：从引文创建笔记。** `read_passage` 返回 `bookId, generation, bookRevision, sourcePage, sectionId, start, end, quote`。偏移基于现有来源文本的 UTF-16 坐标。创建工具在保存前用同一文本模型验证区间和引文，再调用标注命令；书籍修订或 generation 已变则返回重新定位所需的信息。遇到重复句子，依据来源区间区分。无界面代码必须与阅读器在空白、实体、跨标签文字和代理对上得到相同偏移。Goal 自输入走单独的命令，参数只需目标、正文和写入身份。

## 3. 一次写入如何完成

1. 使用现有 `opId`、`expected` 和适用的 `generation`。同一逻辑写入在超时或断线后使用相同操作 ID 和冻结的请求重试。新建对象的 ID、时间等值也需稳定。存储层在一个事务内记下操作摘要与结果，同 ID 不同内容返回冲突。
2. 标注沿用现有数据仓储操作。Goal 目前以一份带 revision 的全局图保存。Connector 对外提供“向这个 Goal 添加一条自输入”等小命令；在 `mutate` 的事务内部读取最新图、验证目标、应用共用领域函数并写回。操作摘要取自稳定的命令输入，提交时间和派生快照只在首次实际执行时生成。避免在已有事务里嵌套调用另一个自行开事务的保存方法。
3. 更新已有文字时带上读者看到的基线；同一目标已变就返回冲突。对不同对象的独立添加可在最新图上执行。删除书或标注及其关联的清理、逐书恢复的整组写入沿用现有原子操作。关联 Response 的校验仍由领域规则和存储层执行。
4. 文件操作单独处理。导入和逐书恢复用稳定操作 ID 标识已提交结果。导出先在目标卷生成临时产物，完整写入后再交付最终路径；重试须能识别已完成产物。整库备份保留现有 SQLite 在线备份与完整性校验。读出多表组成的 Goal 上下文或备份时使用一致读快照，跨页游标遇到版本变化时要求重新读取。

对应实现可查[存储事务与重放](../../../src/server/dataStore.js)、[Goal 图校验](../../../src/server/goalLibrary.js)、[Response 身份与顺序](../../../src/client/domain/goalContentEngine.ts) 和[备份范围](../../data-and-backup.md)。

## 4. 双向同步与编辑保护

**阅读器 → 助手。** 工具调用从数据库读取已提交版本。MCP 进程的查询缓存若有使用，必须按记录 revision 和书籍 generation 校验。阅读器的草稿、IME 组合输入及待确认 outbox 继续归其创建端管理。

**助手 → 阅读器。** 在桌面主进程现有书库连接上比较 `PRAGMA data_version`，将其作为其他连接已提交的信号。MVP 建议先用窗口可见时约 200 ms 检查一次的轻量方案，通过实测决定最终间隔。首次订阅与窗口重新获得焦点时补查；暂停或重启后从已保存状态重建。订阅时先取得基线，再读对象版本清单，然后复查信号，避免丢掉初始化期间的提交。该值只在同一连接的两次采样间比较。[SQLite data_version](https://www.sqlite.org/pragma.html#pragma_data_version)

信号变化后比较 Goal 图、书目和标注的轻量版本清单（含删除标记）；合并通知并按 ID 重读受影响记录。单次恢复涉及书籍、标注、Goal 三者时作为同一轮更新。界面只重绘受影响的内容，保留阅读器实例、位置、选区和编辑节点。数据库信号只代表“需要检查”，不等于某一行有变更。桌面窗口关闭后销毁定时器与订阅。

**必须补齐的两个保护点。**

- 笔记仓储目前在组装提交命令时从缓存取 revision，刷新可能提前推进缓存。进入编辑时就记录基线 revision 和 generation；第一次提交传递基线，连续自动保存只允许同一编辑链上已确认的回执推进它。发现外部更新时保存草稿及其基线。旧草稿保存得到冲突，已冻结的命令按原 outbox 规则恢复。[笔记仓储](../../../src/client/infrastructure/annotationRepository.ts) · [笔记恢复队列](../../../src/client/infrastructure/annotationRecovery.ts)
- 现有 Goal 控制器在编辑期间收到整图更新会禁用操作。新同步路径按实体区分远端改动与正在编辑的目标。无关改动更新到已确认视图，保留输入焦点；若存在待写的旧整图，仍用原基线提交，或根据明确的本地操作意图合并。禁止仅把旧快照的 expected 升至最新 revision。对旧版队列里无法可靠重建的意图保留原冲突恢复行为。[Goal 仓储](../../../src/client/infrastructure/goalLibraryRepository.ts) · [Goal 控制器](../../../src/client/features/goals/goalController.ts)

## 5. 原应用兼容与实施顺序

| 顺序 | 交付与验证 |
| --- | --- |
| 1. 本机只读链路 | 在隔离桌面库启动独立 stdio 服务，通过 MCP 客户端实际调用工具发现、Goal 查询和连续读取正文。覆盖空库、无书 Goal、同名项、未关联笔记、桌面窗口关闭和路径含空格。浏览器继续使用原 HTTP 路由 |
| 2. 写入与即时同步 | 先打通“向 Goal 添加自输入”和“在引文处写笔记”两条链路，同时实现版本基线与局部刷新。实测跨进程即时可见、旧草稿、丢失响应后的重放、两个 connector、睡眠唤醒、数据库繁忙、窗口正常关闭及待写保护 |
| 3. 补齐全部操作 | 覆盖其余 Goal 生命周期、Response、关系、高亮、书籍管理、导出及备份恢复。EPUB 导入的 Web Worker 与浏览器 DOMParser、章节导出的 DOM 和下载层需与转换逻辑分离。用同一 EPUB／TXT fixture 对照桌面与 connector 生成的阅读单元、来源文本、标注定位及导出内容，再接入无界面文件适配器 |
| 4. 回归与宿主联调 | 运行 `npm run build`、`npm test`、`npm run test:migration`、`npm run test:desktop`、`npm run test:reading-workflow` 和 `npm run test:stability`。以隔离书库执行 MVP 五个验收场景，在本机 Codex 和 ChatGPT 桌面本地执行环境分别测试干净安装、断开重连和独立启动；运行打包版时另验其 SQLite 运行时、worker、资源和正常退出 |

浏览器和 Electron 的原入口需在未安装插件时独立通过回归。实施时优先增加能复现新风险的测试，例如固定编辑基线、无关 Goal 改动保留草稿、重导入后旧引文失效。复用已有[桌面存储回归](../../../tests/regression/test_desktop_storage.js)、[Goal 恢复回归](../../../tests/regression/test_goal_library_recovery.js)与[阅读流程](../../../tests/desktop/reading-workflow.cjs)。

## 设计阶段验证边界

在该分支使用 Node 24.16.0 运行现有桌面存储回归，通过。另用临时桌面书库、两个独立 Node 进程及一条观察连接验证：另一进程提交后可读新值、观察连接的 data_version 变化、同一请求重放只增加一次 revision、旧 revision 保存返回 409、重新打开保留已提交内容。本轮验证的是现有存储基础。插件宿主接入、同步时延、编辑器草稿保护、完整导入导出等价性及应用全量回归留待实现阶段验收。
