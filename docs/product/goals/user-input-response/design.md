# Goal 用户自输入：静态设计稿

日期：2026-11-09。

状态：用户已选择 02「区域图标＋水平分界线」。2026-11-10 已进一步融入原 Goal Sidebar，补充自输入 UX 状态，详见[交互与整合记录](interaction.md)。应用功能未实现。

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
