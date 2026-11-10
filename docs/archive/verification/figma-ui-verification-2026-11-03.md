# Figma 页面差异与验证

日期：2026-11-03。交付范围：本地源码与 Vite 生产构建；未打包、安装或发布。

## 设计依据与改动

来源：[Product UI Extraction — Goal & Reading](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi/Product-UI-Extraction---Goal---Reading?node-id=15-348)。
通过 Figma 设计上下文及截图核对页面实例和组件：

| 范围 | 设计节点 | 当前差异及处理 |
| --- | --- | --- |
| Local Library | 13:253、15:718 | 移除书目结构元信息、行分隔线及底部服务提示；书目行收紧至 36px；标题栏 38px；关闭按钮 28px、SVG 16px。保留 300px 面板、搜索、真实书目、导入、示例书、打开和移除确认。最大高度按设计限制为 370px，并继续适应视口及较短列表。 |
| Reading Settings | 7:275、15:542 | W/S/D 文本按钮改为设计中的无字纸张色块，保持 40px、12px 圆角和原命令；字号读数改用界面字体。其他布局、值、字体菜单、缩进和阅读模式不变。 |
| Menu Item | 4:188 | 原行高约 32px，补齐 1.4 行高后约 34.2px。保留中性高亮、危险色和键盘操作。 |
| Goal Row | 4:152 | 首轮未修改；后续复核发现编辑/更多按钮重叠及整行状态遗漏，已修正，见下方补充。 |
| Book Toolbar / At rest | 15:348、7:232 | 首轮只检查了显隐和占位；后续发现透明工具栏露出灰色底，已修正，见下方补充。 |

设计中的六条书目和设置数值属于示例数据，未写入应用或改作默认值。
图标复用已有 ActionIcon 和本地 Remix Icon 字体；无临时 Figma 资源 URL 或新依赖。
未修改 reader DOM/Range 边界、控制器、存储仓库、Goal/书籍/材料关系。
无额外的附近功能修复。同步调整了既有书目结构回归测试中已撤销的书库元信息断言；备份及导出结构统计断言保留。

## 自动检查

| 检查 | 结果 |
| --- | --- |
| `npm run build` | 通过，严格类型和契约检查通过，Vite 生产构建完成 |
| `npm run test:migration` | 15/16 通过；书库、Goal 交互、跨书、导航、字体、导出等检查通过 |
| `node tests/regression/test_book_structure_export.js` | 通过，覆盖书目、备份统计及真实章节 ZIP 导出 |
| `git diff --check` | 通过 |

迁移检查唯一失败是 `test_goal_lifecycle.js`：JSDOM 销毁后，
GoalActions 的提示定时器仍触发 React 渲染，导致 `window is not defined`。
该问题已在 [此前验证记录](reading-ui-verification-2026-11-03.md#回归套件的已知失败)
中复现并记录；本次未改动 GoalActions、生命周期业务或该测试的清理。
套件还有 React act 警告，不将完整迁移检查宣称为通过。

## 浏览器交互与外观

使用 ChatGPT 内置 browser-use 工具在 Chrome 的 `http://127.0.0.1:5173/`
实际操作并检查结果：

- 打开书库；搜索“危机”仅保留匹配书目，清空后恢复五本真实书籍。
- 点击移除显示确认对话框；取消后重新打开书库，书籍仍存在。
  未实际删除用户书籍；真实移除路径由隔离书库自动回归覆盖。
- Escape 关闭书库并将焦点返回工具栏入口；打开阅读设置会关闭书库。
- 实测书库宽 300px、标题栏高 38px、书目行高 36px、关闭按钮 28px。
- 三种纸张色块均为 40×40px，无可见文字，保留可访问名称。
  Sepia/Dark/White 切换实际更新 reader-panel 纸张类；字号增加显示 19px。
- 重载后字号和纸张按已有行为恢复为 18px/White；源码原先不持久化这两项。
  本次未新增持久化。最终恢复原有 Literata、18px、2em、White、Page。
- 字体菜单仍显示已选 Literata，Escape 返回字体触发器。
- 进入父 Goal 后，在子 Goal 原行打开编辑，父 Goal 和关联材料保持原位；
  不改文字，以 Ctrl+Enter 完成编辑。
- Goal 菜单方向键高亮及 Escape 关闭正常；最终条目高度约 34.19px。
- 工具栏静止时 opacity=0，高 52px；指针进入顶部后 opacity=1。
  两种状态下正文区域 y=60 不变。指针位于侧栏时，键盘焦点进入翻页按钮，
  工具栏仍可见。打开书库或设置时也持续可见。
- 人工查看最终书库与设置截图，与 Figma 对照确认。

本次未运行完整 `npm test`、Electron 专项、安装器或稳定性检查；没有
Electron 专属逻辑改动。导入文件及确认移除用户数据未在浏览器中执行。

## 本地截图

保存在 git 忽略的 `../.commandcode/figma-ui-2026-11-03/`：

- `local-library.png`、`local-library-detail.png`
- `reading-settings.png`、`reading-settings-detail.png`
- `goal-menu.png`
- `reading-at-rest.png`、`reading-toolbar.png`

截图只证明最终外观；交互证据为上面的实际操作及其可见结果。
书目数量、书籍正文和阅读位置来自真实本地数据，不以设计示例替换。

## 用户复核后的补充修正

用户确认 Local Library 和 Reading Settings 已完成，本轮保持这两部分不动。
重新读取 Figma `4:188`、`4:152`、`13:173`、`15:348`、`15:278`，并在
ChatGPT **内置浏览器 iab** 中检查，替代首轮仅核对部分状态的结论。

### 找到并修复的遗漏

- Goal Row 的通用定位规则比编辑按钮偏移规则优先级高，造成 edit/more
  都落在 `right:4px`。DOM 实测两者 x 坐标完全相同。提高原偏移规则的
  选择器优先级，保留 edit `right:36px`、more `right:4px`，两个 28px
  按钮间有 4px 间隔。未新增按钮、编辑器或命令。
- 将子 Goal 的 hover/focus/open-menu 背景放到整行上，指针移到动作按钮
  后整行反馈仍保留。补齐整行禁用透明度，避免文字重复变暗。
- Goal 菜单按 Figma 展示 `complete`、`Archive`、`Delete`；保留各项的
  `data-operation`、确认逻辑、Undo 和数据关系。分隔线上下无额外间距，
  底部留白按参考调整；实测菜单高 123.10px、条目高 34.19px。
- 阅读工作区容器原本透明，隐藏整栏工具栏后露出灰色应用底。容器改用
  现有 `--bg-panel`，与 At rest 设计的连续白色工作区一致；没有修改阅读
  正文、纸张选项、分页实例、工具栏高度或显隐触发规则。
- 本轮没有范围外的附近修复。编辑按钮重叠本身属于 Goal Row 遗漏修正。

### 内置浏览器验证

- 以设计桌面视口检查，使用真实鼠标移动和坐标点击。280px 是新浏览器
  配置的默认侧栏宽度；Figma 记录的 339.4167px 是已有配置值，不改默认宽度。
- 修复后父、子 Goal 的两个按钮中心分别命中自己，互不遮挡。侧栏中通过
  实际坐标点击父/子编辑按钮都打开了正确的行内 textarea；没有改动文本。
- 输入时动作隐藏，Ctrl+Enter 正常结束。子编辑保留当前父 Goal 与材料。
  完整 Goal 页也验证了真实点击子编辑、Escape 完成及返回阅读。
- 菜单方向键正常高亮，Escape 关闭。点击 Delete 显示原删除确认，Cancel
  后子 Goal 和材料仍存在，未执行真实删除或更改完成状态。
- 工具栏静止 opacity=0、顶部悬停 opacity=1，均保持高 52px，正文 y=60。
  静止状态背后的工作区为 rgb(255,255,255)，不再露灰。
- 指针位于正文时，键盘 Tab 进入翻页按钮，工具栏 opacity=1；设置面板
  打开后指针离开顶部，工具栏仍为 opacity=1。
- 禁用整行样式未通过实际加载中的短暂禁用状态单独截图；无 hover 设备未
  在本轮实机验证。保留原无 hover 的动作访问规则。

### 本轮检查与证据

- `npm run build`：通过，包含严格类型、契约检查及生产构建。
- 下列五项针对性回归均通过：`test_goal_interaction.js`、
  `test_goal_cross_book.js`、`test_goal_home.js`、`test_html_and_dom_audit.js`、
  `test_app_navigation.js`。导航检查仍有既有 React act 提示。
- `git diff --check`：通过。
- 未重跑完整迁移套件、完整 npm test、Electron、打包或安装器；上方首轮
  15/16 及生命周期清理失败记录仍属首轮结果，不将其改写为本轮全套通过。
- 最终截图位于 `../.commandcode/figma-ui-followup-2026-11-03/`：
  `goal-child-hover.png`、`goal-parent-hover.png`、`goal-child-editing.png`、
  `goal-menu-final.png`、`goal-menu-detail.png`、`reading-at-rest.png`、
  `reading-toolbar-visible.png`。
  菜单最终图已人工查看，截图不替代上述实际交互验证。

## Goal Row 跨状态排版对齐与提交（61b7d12，尺寸结论已被后续纠正）

用户再次指出跨状态对齐未实现，本轮补齐文字与行高，而非只调整操作按钮。

- 默认标题与原位编辑共用行级排版变量：字号、字重、行高、10px 水平内缩、
  垂直居中及最小行高。侧栏单行父目标约 41.12px，子目标 40px。
- 完整 Goal 页保留父目标 26px/39px、子目标 16px/22.4px 的现有层级；
  父目标进入编辑不再回落到 18px。
- 编辑采用与显示文字相同布局的不可见测量文本，原生 textarea 叠在同一
  网格位置。保留原生选择、IME、事件和保存流程；新建草稿仍走原高度逻辑。
  测量文本 aria-hidden，不重复朗读。避免 scrollHeight 整数取整引起的跳动。
- 显示和编辑均保留末尾换行。真实父目标 `hawkjfda\n` 因而显示两行空间，
  编辑前后高度均为 70.69px；没有裁剪或修改保存内容。
- 用内置浏览器加载真实 GoalUI 和实际 CSS 的隔离状态检查页，覆盖侧栏/
  完整页 × 短文本/长文本换行/末尾换行 × 默认/父编辑/子编辑/禁用，共
  48 个行实例。各状态的文字 x/y、宽度、高度、字体及整行高度差值均为 0。
  另验证悬停不移动文字，禁用透明度 0.45；多行输入时 textarea 与测量高度
  均为 103.57px、scrollTop=0。
- 在实际书库页面验证父/子编辑、Ctrl+Enter、Escape、完整 Goal 页及返回。
  真实父目标在侧栏和完整页的编辑前后，文字起点、字号、行高、行高占位及
  邻行 y 坐标均完全一致。没有修改用户文本、Goal 层级或材料关系。
- `npm run build` 通过。六项相关回归通过：Goal interaction、Home、跨书、
  HTML/DOM 审计、书库弹层、书目结构导出。Goal interaction 新增测量文本
  随原生输入同步和 aria-hidden 检查；原 IME、光标、保存检查仍通过。
- 本轮不宣称完整 npm test 或 Electron 专项通过；它们未运行。首轮已知
  生命周期测试清理问题仍按上文记录。
- 状态测量与截图保存在 git 忽略目录
  `../.commandcode/goal-row-alignment-2026-11-03/measurements.json` 与
  `sidebar-states.png`；隔离检查页为 `../.commandcode/goal-row-alignment.html`。
  以上检查页和证据不进入生产构建或 Git 提交。

## 根目录与行框尺寸纠正

上节仅比较状态之间一致，未验证页面实例覆盖，错误地保留了较小的根目录字体，
并将历史末尾空行计入显示行数。该结论不能作为视觉验收通过的依据。

- 本次重新读取并查看 Figma 的 Root `14:380` 与 Expanded `14:241` 实例。
  根目录行覆盖为 16px Medium、40px 高；进入后的父目标也为 16px Medium、
  40px 高；子目标为 14px Regular、40px 高。按这些实例覆盖修正实现。
- 移除末尾空行强制撑高显示行的处理。原生编辑初始显示同一紧凑文本，
  未改动时通过既有视图适配器返回原始存储值。原目标 `hawkjfda\n` 的
  根目录、父目标及两者的编辑状态实测全部 40px，不再是 70.69px。
  内部换行保留；用户实际输入的新换行仍正常增高。
- 在 ChatGPT 内置浏览器的真实书库中验证根目录→原位编辑→进入目标→父目标
  编辑→返回根目录。根目录/父目标均实测 16px、字重 500，子目标 14px；
  初始编辑 scrollTop=0，完成后原始末尾换行仍保留。未修改目标内容或关联关系。
- 生产构建与严格检查通过。Goal interaction、Goal Home、跨书三项回归通过；
  新增根/子展示标识、紧凑显示及未改动编辑保留原始末尾换行的回归检查。
  本轮未运行完整套件或 Electron 专项。
- 实际页面截图：`../.commandcode/goal-row-correction-2026-11-03/root-goals.png`
  和 `entered-goal.png`。临时状态矩阵不是这次视觉结论的依据。
