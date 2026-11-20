# Goal 用户自输入：静态设计稿

日期：2026-11-09。

状态：用户已选择 02「区域图标＋水平分界线」。2026-11-10 已进一步融入原 Goal Sidebar，补充自输入 UX 状态，详见[交互与整合记录](interaction.md)。随后已完成侧栏与现有工作区的源码接入，验证边界见[实现记录](implementation.md)。

Response 补充（2026-11-10）：用户选择「浅底内容块＋加强标签」，并授权先搭建独立组件与组合结构。Figma 初步组件已建立，见下文。随后明确「标签图标 → 左侧 Response 选项菜单」的功能与交互需求，并开始 UX 组件搭建；因 Figma MCP Starter 额度上限，状态组合与视觉验收未完成，见本文末节。本次已依据用户提供的图及需求文档接入应用源码，未修改 Figma，见 [Response 实现记录](response-implementation.md)。

## Figma 入口

- [静态稿：Goal Sidebar / User input — 02 region icons](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=265-1744)。
- 页面：02 - Components。Frame 位于原 Goal Sidebar 组件左侧，画布位置为 x=1460、y=80。
- [原 Goal Sidebar 组件](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-581)：初稿由其 Expanded 状态复制；2026-11-10 已按用户要求整合原组件，初稿 Frame 继续保留。
- [自输入状态审阅页](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=288-1835)与[独立记录组件](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=284-1877)：本轮 UX 入口。
- 当前 Frame 约 339.42 × 467.15，保留原面板宽度，内容使用自动布局。

## 本次设计范围

1. 保留原导航、创建 Goal 的 `+`、父 Goal 和子 Goal 行。
2. 去掉新稿中的 Linked 分组标识，在子 Goal 与统一内容区之间放置细水平分界线。
3. 子 Goal 区顶部使用分支图标；内容区顶部左侧使用叠层文档图标、右侧使用“文档＋”新增入口，采用 02 的图标与组织方式，不显示模块标题文字。
4. 下方展示一条自写内容示例，再展示原有材料实例，体现新加入内容在上的顺序。
5. 保留 Highlight、Note 相关的 Link 组件及原有示例内容；未改动材料主组件。
6. 父 Goal 不使用目标图标，沿用原 Figma 的 16px Medium（500）文字；子 Goal 和内容字体也沿用原稿。
7. 移除贯穿父内容区域的竖向导引线，不使用树枝连线或左侧括线；已有引文自身的竖线保留。
8. 自写内容前使用文字类型图标，与现有 Note、Highlight 类型图标共同识别内容来源。

本节描述 2026-11-09 的平面稿：当时没有原型连线，也没有 Response 标签或置顶视觉设计。2026-11-10 的自输入交互状态及局部状态连接见[交互记录](interaction.md)。示例文字不构成产品默认内容。

## 样式与检查

- 复用既有导航 Action Button、Goal Row、Linked Material 实例；新入口沿用原 Action Button 的容器样式，图标使用安装包中 Remix Icon 的 SVG 路径。
- 复用现有背景、文本、分界线和间距变量，保留父内容的 16px 缩进。
- 字体沿用来源组件中的 Inter 与 Noto Sans SC；中文仍使用文件现有的临时替代字体，未宣称解决字体替代问题。
- 完成 02 静态截图检查，修正新图标文字行的宽度约束；自写内容与现有材料共用相同内容宽度。
- 核对保留文字的字体、字号和文字样式均未变化；现有材料实例的属性未变化。
- 当前 Frame 含 54 个可编辑节点（含 Frame 自身），没有整页位图或图片填充，原型反应数量为 0。
- 本次没有应用代码变更，未运行应用构建或界面交互测试。

产品要求见[功能需求文档](feature-spec.md)；本轮已形成自输入交互约定，未涵盖的事项仍按需求文档保留为待明确。

## 模块标识 HTML 对比样稿

[打开三方案静态对比](../../../prototypes/goal-content-identifiers.html)。同一页面并排展示树枝连线、区域图标、左侧括线三种方案，共用示例内容和配色，面板内尽量使用图标与线条。

HTML 保留三个候选的比较过程，没有新增、编辑或导航交互。用户现已采用 02，Figma 按其图标和组织方式更新；“文档＋”图标入口替代此前选择的文字入口。

选择前，用户要求第二方案的父 Goal 以 Figma 为准：取消目标图标，使用 16px、Medium（500）字重和 40px 行高区域；该要求已在采用的 Figma 静态稿中保留。HTML 的其他两个候选保持原样。

## Response：独立组件与初步组合（2026-11-10）

用户确认先独立开发组件，再统一组合；当前以结构、插槽和已有内容整合为主。所选外观为整条浅灰内容块，顶部使用略深灰底的 `Response` 小标签。此记录只描述 Figma 设计交付，不改变应用实现记录。

### 组件入口

以下主件均位于 02 - Components，x=5000 附近；主件与审阅实例分开放置。

| 主件 | 职责 |
| --- | --- |
| [Response Label · 299:2106](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=299-2106) | 仅呈现固定产品标签；Inter Medium、12px／20px，深灰底、4px 圆角；不代表完成、选中或置顶 |
| [Goal Content Item · 299:2117](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=299-2117) | `Response=Off/On` 两个变体；外层负责浅底、标签及上下留白，`Content` 插槽承载现有内容实例 |
| [Goal Content List · 299:2118](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=299-2118) | `Items` 插槽组织条目，沿用 4px 间距和原有顺序；不承担筛选或置顶 |
| [Goal Content Panel · 302:2180](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=302-2180) | 复用现有导航、父子 Goal、区域标识和内容列表，提供可实例化的组合模块 |

组合关系：`Goal Content Panel → Goal Content List → Goal Content Item → Content（既有 Goal User Input / Linked Material 实例）`。采用 Figma 原生 SLOT 保存既有实例的文字、状态和样式覆盖；不是复制正文为普通文本，也没有将内部编辑状态扩展成外层变体矩阵。空插槽是主件的有意占位，实际内容在实例中组合。

新增专用 `Goal Response` 变量集合，包含两种局部颜色的原始值与语义别名；浅底为 `#ececef`，标签底色为 `#dcdce2`。新增 `Goal/Response label` 文字样式；文字颜色、间距、圆角继续绑定已有兼容变量。这些仅适用于本模块，不建立全局视觉规则或新的应用 CSS 接口。

### 既有设计的保留与整合

- 原 [Goal Sidebar · 14:581](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-581) 的五个变体 ID、尺寸和 `User input` 属性保持有效。直接放入嵌套插槽会断开该属性连接，因此本轮没有用新组合模块替换原 Sidebar 的内容层级。
- 为恢复并验证上述连接，原 Sidebar 中六个内容实例已按原主件和原属性重建，实例 ID 变化；文字、字体、状态、尺寸及原型连接的签名与整合前一致。`Goal User Input` 和 `Linked Material` 两个主组件未改动。
- 既有 [自输入 UX 审阅页 · 288:1835](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=288-1835) 中的 14 条内容已放入新条目／列表实例，默认仍为未标记；原场景、顺序、父容器尺寸与内容属性保留。插槽重组会生成新的嵌套实例 ID。
- 不更改导航、区域图标、来源关系、编辑／删除语义；没有新增第二套行操作，也没有为现有材料自动添加 Response。

### 审阅与验证

[Response 组合审阅页 · 302:2181](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=302-2181)，位于 x=5000、y=1120，约 750.83 × 1056.15。

- 上方以同一个 Panel 主件的两个实例比较未标记与 Response；下方用独立条目实例展示既有 Hover、Editing、Error、Disabled 状态。
- 比对原 Sidebar 与旧审阅页共 20 条内容：正文、字体、样式、状态、尺寸、原型连接及内容属性全部一致；两个既有内容主件签名不变，10 个相关父容器的尺寸不变。
- 临时实例验证通过：原 Sidebar 的 `User input` 属性可切换到 Hover 主件；Response On／Off 切换保留插槽正文属性。临时实例均已删除。
- 新审阅页含 207 个可编辑后代节点，无图片填充或整页位图；字体为既有 Inter、Noto Sans SC。已截图检查并修正组合实例的背景覆盖，最终截图完成检查。
- 本地证据：`.local-materials/response-figma-review.png`、`response-figma-state.json`、`response-figma-preservation.json` 及相关结果记录；这些本地文件不纳入 Git。

### 当前交付边界

本轮完成独立组件、内容占位和组合样例；原 Sidebar 尚未切换到新 Panel 主件。Response 标记／取消入口、保存与错误处理、键盘和无 hover 操作仍需后续设计与实现。继承的 Figma 编辑／删除状态连接不构成真实输入、删除或持久化验收；删除记录应移除整个条目，不能只留下外层标签。

没有修改应用代码，没有运行应用构建、浏览器或桌面功能验证，没有制作或发布安装包。MVP 仅标记、不置顶的产品规则继续有效。

## Response 菜单需求补充

用户随后选择 Readwise Reader 风格的标签操作：入口只显示标签图标，点击后向左弹出仅含 Response 的可切换菜单；选择后添加／取消，沿用浅底内容块与加强标签。此选择取代此前建议的「点击行内图标直接切换」路径。

入口、选中状态、定位、动效、键盘与保存反馈已补入[功能需求第 5.6—5.9 节](feature-spec.md#56-标签入口与适用对象)和[交互约定第 5 节](interaction.md#5-response-标签入口与菜单需求补充)。5px 间距与 140ms 动效取自项目既有基础，不作为 Readwise 精确视觉数据。本次没有改动 Figma；上节关于现有组件与验证的记录仍仅覆盖初步结构和外观。菜单 Figma 状态及实际应用能力继续待实现。

## Response 菜单 UX 搭建：未完成（2026-11-10）

用户随后授权按上述文档更新 Figma。已写入 02 - Components 的主件如下；它们尚未完成组合与截图验收，不能标记为 UX 完成。

| 主件 | 已写入内容 |
| --- | --- |
| [Response Tag Control · 312:2418](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=312-2418) | Default、Hover、Focus、Open、Disabled 五态，复用 Action Button；图标来自已安装 Remix 的 price-tag-3-line，独立图标主件为 312:2380 |
| [Response Menu · 312:2443](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=312-2443) | Selected Off/On × Default/Highlighted 四态，复用 Menu Item；128px 宽，仅有 Response，右侧显示选中指示 |
| [Response Save Feedback · 312:2461](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=312-2461) | Saved、Saving、Error、Dismissed 四态；含 Retry／关闭连接，重试后的成功为原型模拟，不是真实保存 |
| [Goal Content Item · 299:2117](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=299-2117) | 扩展为 Response Off/On × Default/Hover/Menu 六态，原 Off/On 主件 ID 保留；提供保存反馈实例及可见性属性，主件移至 x=6740、y=80 |

已写入本地 hover、打开菜单、点击菜单选择后切换角色、再次点击／Escape 关闭、Enter／Space 选择和 140ms 过渡的原型连接。四个新增变体的 Content 插槽已恢复绑定；原自输入、材料、原 Sidebar 和 Response Label 主件未作为本轮修改目标。

**中断原因**：Figma MCP 返回 Starter 计划调用额度已达上限，后续一次调用也被拒绝；没有提供恢复时间。中断后未再调用 Figma。当前待完成项：

- 四个克隆变体的保存反馈实例尚需恢复 `Save feedback`／`Show save feedback` 属性引用；关闭态 Hover 菜单的透明度与缩放过渡仍需补齐。
- 三类内容的 UX 组合页尚未创建，焦点、保存失败／取消失败、错误关闭、禁用、编辑隐藏、无 hover 和边缘回退样例仍待组合；旧 `302:2181` 仅作为前一阶段的结构与外观审阅页。
- 正文覆盖保留、完整原型路径、左右间距、字体、遮挡及截图均待最终检查。原型不验证浏览器焦点、自动碰撞避让、系统减少动态效果或持久化。

本地续作记录：`.local-materials/response-ux-state.json`、`response-ux-baseline.json`、`response-ux-review-build.js`。未改应用代码，未运行应用构建、浏览器或桌面功能测试。

## Response UX 续作进度（2026-11-11）

本轮 MCP 批量写入被 Starter 额度限制拒绝，随后通过 Figma 中的 Scripter 插件继续处理。

- 已读取并确认六个 Goal Content Item 变体的保存反馈实例均连接 `Save feedback#313:12` 与 `Show save feedback#313:15`。
- 已确认 Default／Hover 关闭态菜单透明度均为 0，Menu 展开态透明度为 1。缩放修正已在脚本中执行，仍需结合最终画面检查过渡。
- 新的 [Response UX review · 325:2747](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=325-2747) 当前为部分生成稿，只有 Text 上下文。完整组合脚本已修正为从 Panel 的 Items 插槽创建条目，尚待执行和验收。
- 重试、关闭和 Saving 到 Saved 的原型连接已提交到插件脚本，完整原型走查、三类内容与九种状态的组合及截图检查仍待完成。

浏览器自动化无法稳定触发插件内的运行操作，已请求用户点击 Scripter 中 `Untitled 1` 的 Run 后继续检查。此时不能将该审阅稿标记为完成。本地脚本与进度保存在 `.local-materials/response-ux-complete-native.js` 和 `response-ux-state.json`。
