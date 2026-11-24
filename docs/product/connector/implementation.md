# AuraReader 本地 Connector 实现记录

2026-11-23 · `codex/connector-mvp`

源码按 [MVP](feature-spec.md) 和 [架构](architecture.md) 接入。Connector 通过独立 MCP stdio 进程读写桌面书库。Electron 持有自己的连接，窗口可见时每 200 ms 检查其他连接的提交。应用没有安装插件时也能使用现有桌面和浏览器入口。

## 构建和接入

- `npm run build:connector` 编译共享转换模块和独立服务入口。
- `npm run pack:connector` 将 Node 运行时依赖装入 `dist/connector`，同时输出 `dist/aurareader-connector.zip`。包根目录带有 Agent Plugins 1.0 的 `plugin.json` 和 `mcp.json`。
- 服务需要 Node.js ≥ 24.15.0。Windows 默认使用 `%APPDATA%\AuraReader\data`。配置 `--profile` 时传 Electron profile 的绝对路径，Connector 在其下找 `data`。书库须先由 AuraReader 初始化并迁移到 schema 5。

Codex 可用同一个 stdio 入口。以下路径以解压后的包为例。默认书库省略 `--profile` 参数。

```toml
[mcp_servers.aurareader]
command = "node"
args = ['C:\Tools\AuraReader Connector\server\index.cjs', "--profile", 'C:\Profiles\AuraReader']
```

## 工具与行为

- `search_library`、`get_goal_context`、`get_book_contents`、`read_passage` 和 `find_quote` 提供对象 ID、Goal 路径、关系、目录、版本和定位。正文使用 UTF-16 位置，重复引文分别返回候选。游标失效后从新版本重新读。
- 新建、修改或删除标注、Goal 自输入和关系时使用 `opId`。重试沿用原参数。笔记区分作者原文和读者评论。Goal 文字和自输入编辑校验单个对象的读取版本，生命周期操作校验 Goal 图的 revision。材料 Response 校验具体 Goal 中的关联顺序和书籍 generation。
- EPUB／TXT 导入、笔记 Markdown、章节 Markdown ZIP、逐书备份及恢复、整库在线 SQLite 备份均可在桌面关闭时调用。文件导出使用绝对目标路径，先在同一目录生成完整文件，再用硬链接交付。目标卷须支持硬链接。对已存在的文件使用另一目标路径。整库文件替换按现有离线维护流程执行。
- 外部提交进入桌面后按版本更新相关书目、Goal 或标注。笔记编辑沿用打开时的 revision 和 generation。同一编辑链只用自己的提交回执推进基线。外部写入导致的旧草稿冲突沿用本地恢复和关闭保护。Goal 正在编辑时保留输入节点，可把仅修改当前行且尚未发出的编辑合入无关变更。已发出的命令保留原始版本和请求。

## 验证

- 通过 `npm run test:connector` 使用真实 MCP stdio 客户端检查工具发现、跨标签和代理对的正文、同名 Goal、未关联笔记、Response 关联身份、两进程重试、数据库繁忙、书库版本拒绝和文件往返。在移到另一目录的插件包中重连。
- 插件 ZIP 完整性检查通过。两个根目录清单通过 Agent Plugins 1.0 JSON Schema 验证。
- 在本机 Codex app-server 使用临时命令行配置发现 25 个工具，提交了隔离库中的 Goal，重启 app-server 后读回。会话为临时，使用合成数据。
- 专项 Electron 验收用 `npm run test:connector:desktop` 覆盖外部自输入即时显示、AuraReader 保存后 Connector 读回、保留当前页与滚动位置、重新渲染标注时保留选区、无关 Goal 写入保留编辑节点，以及笔记冲突的草稿和关闭保护。同一 EPUB／TXT 样本的桌面与 Connector 阅读单元及来源文本一致，EPUB 章节导出正文一致。Agent Desktop 在隔离 AuraReader 窗口中读到 Connector 新建的 Goal。
- 项目基线通过 `npm run build`、`npm test`（79 项）、`npm run test:migration`（16 项）、`npm run test:desktop`、`npm run test:reading-workflow` 和 `npm run test:stability`。稳定性测试在隔离 Electron 书库中运行 300 秒，确认了 147 次笔记写入，并验证 SQLite WAL 恢复。
- 验收脚手架修正了稳定性测试对 Vite 产物入口和旧编辑器接口的引用。HTTP 测试在临时端口被 Fetch 拒绝时重试一次，产品文案扫描跳过依赖目录。
- ChatGPT 桌面插件安装、在本地对话中调用及真实系统睡眠唤醒留待宿主验收。OpenAI 发布文档要求本地 MCP 提交方获批。 [OpenAI 桌面插件说明](https://developers.openai.com/plugins/deploy/desktop-only)
