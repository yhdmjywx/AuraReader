# Wiki MVP 实现与验证

更新：2026-11-06。实现分支：`codex/wiki-feature`。本记录描述源码与本地构建，不代表已生成、安装或发布新版安装包。

## 当前 Sidebar 实现与续接验证（2026-11-06）

- 已按独立主组件 `236:1614` 和默认／菜单展开状态实现 337×341 Sidebar，保留底线查询、16px 正文、六语言单选菜单、原文箭头与底部归属。没有修改 Figma 或原阅读 Screen。
- 运行时复用 margin notes 的横向几何，固定在 reader viewport 顶部下方 32px，使用 Wiki 自身的 337px 宽度；不跟随选区、不自动翻转到书籍左侧。打开时覆盖右侧笔记区域。
- 简繁中文通过同一中文站点的 `zh-hans`／`zh-hant` 显示变体请求；其他语言沿用文章真实关联标题。不可用版本保留禁用状态，切换不改写查询词。
- `npm run build`、Wiki 单元检查、reader runtime 与 mini tooltip 回归检查已通过。相关检查未因本次续接浏览器验证重复运行。
- 此前浏览器已验证简繁／英文切换、长导言独立滚动、Enter 查询、退出，以及笔记保存与重载。宽视口中 Wiki 与笔记区域左边缘差约 0.024px；原笔记内容未被替换或删除。
- 本次使用内置浏览器，仅补做连续滚动定位和最终截图。在 1348×952 视口，reader 实际从 0 滚动至 952.381px，书籍顶部从 92 移至 -860.381px；Wiki 前后均为 x=1003、y=92、337×341，确认书籍滚动时仍固定。截图：`.commandcode/wiki-ui/wiki-fixed-after-book-scroll.png`。临时浏览器视口覆盖已恢复。数据来自 8097 隔离测试库，没有写入用户现有书库。
- 最近一次 `test:reading-workflow` 完成行为断言并输出 PASS，但 Electron 退出仍触发启动器 90 秒超时，命令退出码 1；不能报告桌面基线整体通过。产物为 `.commandcode/desktop-tests/run-s0d7Q1/`。此前 `test:desktop` 的同类限制仍保留，未重复追查环境或修改业务代码绕过退出。
- 相关小修正：关闭旧 Wiki 时，仅在 reader 没有新选区的情况下隐藏选词工具栏，避免关闭旧查询同时隐藏新选区入口。没有改变注释保存或材料关系。
- 本次只验证源码构建的浏览器应用；没有构建、安装或发布新版安装包。字体按 Figma 指定 Noto Sans SC 并保留回退，尚未证明无该系统字体的机器能得到相同字形。

## 早期设计与实现记录（历史）

以下原弹窗尺寸及“代码尚未迁移”描述为当时记录，当前状态以上节为准。

后续设计状态：用户本日通过浏览器批注要求 Wiki 在运行时覆盖右侧笔记区域、输入只保留灰色底线、下拉限定六种语言；随后明确要求恢复原 Screen 并独立维护 Wiki。Figma Reading Interface `15:129` 已恢复，其 viewport 只保留原 Reader Paper `15:264`，几何与原参考一致。原 Wiki Frame `194:1665` 已转换为 `02 - Components` 下的独立 Wiki Sidebar 主组件 `236:1614`，没有新增阅读 Screen。现有三个嵌套容器、六行 Menu Item、底横线和展开／选择／收起的原型变量动作均保留。已检查恢复后的 Screen 与独立组件截图和结构，未实测原型点击。应用源码仍为下述原弹窗实现，本轮没有改业务代码或运行代码测试。

## 实现范围

设计补充（不属于应用代码更新）：用户重新设计 Wiki Sidebar 为 337×341 后，要求保留当前视觉、增加独立状态页面。已在组件页新增 `240:1654`（默认）、`240:1697`（菜单展开）、`240:1740`（加载）、`240:1783`（未找到）、`240:1826`（请求失败）五个 Frame；每个包含 `236:1614` 的实例。创建时核对了原组件几何、文本、字体、填充与子层级不变，并逐一截图核对状态画面。没有修改应用代码或阅读 Screen，也未为设计展示运行代码测试。

- 选区工具栏新增 Wiki；复制 `ReaderSnapshot.selection` 的纯文本后发请求，不创建笔记、高亮或 Goal 关系。弹窗打开时保留原入口，点击同一入口、Escape 或弹窗外退出。切书、离开阅读或新选区会关闭旧查询。
- 查询只清理首尾空白；按 Enter 在当前显示的百科站点查完整标题，接受 Wikipedia 自身规范化和重定向。未找到、消歧义、章节重定向和空导言分别反馈。
- 正文优先显示；语言关联单独加载并读取 continuation。只在用户选择后查询关联标题，切换失败保留原文章、语言和外链。原查询词不随语言切换而改写。
- 按 Figma `194:1665` 的完整上下文与截图实现 300×370 弹窗、20px 查询文本、13px 正文、独立滚动和段首 `2em` 缩进。两个 SVG 从 Figma 下载到本地；许可归属位于正文末尾。
- HTTP 和 Electron IPC 共用 Node 百科服务。请求限定 Wikipedia HTTPS 站点，正文按纯文本渲染；带超时、取消、旧响应失效和 Retry-After 冷却。桌面外链仅允许经过校验的 Wikipedia 文章及 CC BY-SA 许可地址，由系统浏览器打开。未放宽 CSP。
- 无数据库迁移、语言偏好、查询历史或新增依赖；未移植 WikiLens 源码。

## 代码入口

| 位置 | 职责 |
| --- | --- |
| `src/shared/wiki.ts`、`wikiSites.js` | 查询契约、初始站点映射与 URL 校验 |
| `src/server/wikiService.js`、`wikiApi.js` | 标题导言、许可、语言关联及 HTTP 适配 |
| `src/desktop/ipc.cjs`、`preload.cjs` | 受限 read/cancel/openExternal 能力 |
| `src/client/infrastructure/wikiClient.ts` | HTTP／桌面通道和取消适配 |
| `src/client/features/wiki/` | 临时查询状态、Base UI 弹层与局部样式 |
| `src/client/features/workbench/workbenchStore.ts` | 选区与书籍生命周期接入 |

## 验证结果

- `npm run build`：通过，含严格 TypeScript、契约检查和 Vite 生产构建。
- `node tests/unit/test_wiki.js`：通过。覆盖完整标题和竖线编码、初始语言、重定向与特殊页面、API 错误、语言分页、限流、语言切换失败与重试、正文先显示、取消及迟到响应。
- `node tests/regression/test_reader_runtime.js`、`node tests/regression/test_mini_tooltip_interaction.js`：通过，检查 reader 边界与现有选区／注释入口。
- `npm run test:reading-workflow` 和随后一次 `npm run test:desktop`：两次均完成全部行为断言并输出 PASS，包括新增的 Wiki IPC 非法站点、危险外链拒绝和取消检查。但 Electron 在 `app.exit(0)` 后没有正常结束，启动器 90 秒超时，命令退出码均为 1，**不能报告桌面基线整体通过**。按项目环境失败约定停止重试，未为绕过退出问题修改业务逻辑或运行配置。
- 内置浏览器控制真实页面：在 8097 端口的隔离测试书库验证选词“蛋壳”→中文导言→手动 English→英文 Eggshell，原查询词保留；`↗` 实际打开 `https://en.wikipedia.org/wiki/Eggshell`。改词 Enter 查询 Earth，长导言可键盘滚动，顶部控件及书籍阅读位置不动；完整短语未找到时保留输入并禁用原文箭头；原入口退出及 Escape 已检查。
- 真实 API：中文“蛋壳”返回非空导言与 27 个关联版本；中文许可地址带 `deed.zh` 后缀，已按真实返回校验。上述内容和关联数量只记录当次观察，不作为固定线上断言。
- 最终构建的浏览器几何核对：弹窗为 300×370，输入字体 20px、边框 0px；两个本地 SVG 均成功加载并分别保持 12×8、10.05×10.05。中文“地球”呈现 5 个段落，各段首行缩进 26px（13px 字号的 `2em`），正文内容高于独立滚动容器。
- 浏览器文件上传受扩展权限限制；未更改权限，改为在隔离测试库准备自建正文素材。没有写入用户现有书库。

桌面流程产物：`.commandcode/desktop-tests/run-xCKJzE/`、`.commandcode/desktop-tests/run-yFIbT4/`。测试数据及截图位于 `.commandcode/wiki-ui/`，均为本地忽略产物。

## 边界与待验证项

- 未生成新版安装包；打包应用的真实 Wikipedia 网络和系统浏览器打开仍需安装包验收。桌面 IPC 已编译并通过拒绝非法输入的检查，不能等同于打包联网验证。
- 桌面自动化退出超时原因尚未定位，未据此推断 Wiki 或原有桌面退出逻辑已通过。
- 断网／超时提示、无其他语言版本等状态有实现；浏览器没有穷举所有故障和语言。没有扩大为全套测试或压力测试。
- 本轮没有额外邻近功能修复。输入样式隔离、段落换行拆分及 Escape 处理均属于 Wiki 本身的实现修正；未修改其他组件视觉规则。
