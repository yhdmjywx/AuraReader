# 阅读导航与 Goal 引用展示验证

日期：2026-11-03。范围：本地源码与 Vite 生产构建；未生成或安装新版安装包。

## 本次实现

- Goal 关联材料在首页、阅读侧栏与完整 Goal 页共用 `GoalMaterialText`，展示保存的原文和笔记正文。原文在前，以中性文字和竖线区分，不增加引用标题。
- 空白原文不生成引用框；只有原文时不生成空正文块。保留换行。紧凑视图中原文、正文分别沿用三行预览，完整 Goal 页不限制行数。
- 原文来自已有 annotation.quote，不复制材料或修改关联关系。保留回跳、解除关联、保存和跨书读取。
- 分页整组并入既有书名工具栏，与书名、右侧操作同一行；工具栏仍为 52px，不新增一栏，底部不保留重复实例。保持现有按钮、标识、页数含义与控制器。
- 顶部书名单行限制最大宽度 18ch，超出省略，空间不足可进一步收缩。完整书名仍是原始文本，悬停可见；关闭书籍时清除旧提示。
- 本次样式检查修正了按钮默认 flex 导致引用和正文横排的问题，使用局部块布局；没有额外修改其他组件的视觉规则。

批准规则已更新至 `product/ui-ux-design.md` 与
`product/2026-10-29-workspace-ui-decision.md`。18ch 是显示宽度，非截取 18 个字符。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 修改前 `npm run test:desktop` | 通过，保留对照截图 |
| 修改后生产构建与严格类型检查 | 通过（最终 `npm run test:desktop` 包含 `npm run build`） |
| `npm run test:migration` | 15/16 通过；唯一失败为下述既有异步清理问题 |
| 新增 Goal 原文/正文、缺失原文、只有原文、换行及首页展示回归 | 通过（test_goal_interaction.js、test_goal_home.js） |
| 最终 `npm run test:desktop` | 通过 |
| 顶部分页位置、单实例、实际前后翻页及第一页禁用 | 通过，真实 Electron 生产入口 |
| 短/长英文、混合语言、无空格书名布局 | 通过，验证溢出、省略及完整书名 hover 属性 |
| 最小桌面窗口 800×600 | 通过，书名与邻近操作不重叠，分页按钮在容器内 |
| Goal 侧栏/完整页原文与正文纵向排列 | 通过，真实几何断言及截图检查 |
| Goal 关联、跨书回跳、编辑、SQLite 保存与重载后原文 | 通过，隔离测试书库 |
| `git diff --check` | 通过 |

### 回归套件的已知失败

`tests/regression/test_goal_lifecycle.js` 的功能断言全部完成，但测试销毁
JSDOM 后，`GoalActions.notice` 的 2600ms 提示定时器仍调用 render，导致
`ReferenceError: window is not defined` 并令进程退出码为 1。

临时将编译后的 Goal 材料展示恢复为修改前的 `comment || quote`，再次运行
同一测试仍复现相同错误；随后已恢复编译输出，并通过最终生产构建重新生成。
本次未改动 GoalActions 或生命周期测试清理。不能将本轮完整回归套件宣称为通过。
测试过程中还存在 React act 提示；这些提示未导致其他 15 项失败。

## 截图证据

使用同一 Electron 工作流、相同示例书和隔离临时书库。已人工查看修改前后阅读页、
关联笔记、完整 Goal 页，以及修改后的首页材料、长书名和最小窗口截图。

- 修改前：`../.commandcode/desktop-tests/run-Tuggw9/`
- 最终修改后：`../.commandcode/desktop-tests/run-fEaqN7/`
- 可比较的截图：`reader-workspace.png`、`goal-content-after.png`、`goal-workspace.png`。
- 补充截图：`reader-long-title.png`、`reader-minimum-window.png`、`home-linked-materials.png`。

以上截图记录首次实现；同一行修正及浏览器验证见下方补充。
未运行安装器、打包、长时间稳定性或存储故障注入专项验证。

## 同日补充：分页必须在既有顶部同一行

用户澄清不能新增一栏。已将翻页器移入现有 reader-toolbar，在书名与右侧操作之间；
移除正文前的独立分页行。书名按可用宽度收缩，避免窄窗口下覆盖上一页按钮。
保存状态宿主随工具栏迁移，使用浮层位置，不占额外行高。同步修正产品规范和几何断言。

- `npm run build`：通过，包含严格类型检查。
- `test_html_and_dom_audit.js`、`test_reader_runtime.js`：通过。
- `node scripts/test-desktop.cjs`：最终通过；验证同一行 52px 工具栏、零额外行高、
  单一分页实例、实际翻页、长书名及 800×600 窗口中各控件不重叠。证据：
  `../.commandcode/desktop-tests/run-ZrDYCg/`。
- 内置 browser-use：使用隔离 HTTP 服务及书库 `http://127.0.0.1:8097/`，
  通过界面导入示例 EPUB 与长书名副本，验证下一页、上一页、键盘右箭头及阅读设置打开/关闭。
  翻页后页码和正文变化；长书名省略。重载构建后重新打开书籍并复验。
- 浏览器最终 DOM 几何：toolbarHeight=52、extraRowHeight=0、paginationCount=1、
  sameRow=true、noOverlap=true。同时检查了默认窄视口与显示 Goal 侧栏的布局。
- 浏览器截图导出路径失败，未将其作为保存的图片证据；最终外观截图采用上述 Electron
  产物。交互验证仍由内置 browser-use 实际操作完成。
- 本次修正未重跑完整 migration 套件；上一轮 15/16 及其既有清理问题的记录仍保留。

## 工作区边界

### 顶部悬停弹出栏补充

先提交当前源码与文档快照 `3ecb5f9`，再按用户确认只增加顶部工具栏的悬停显隐。
实现仅增加局部 CSS，保留原有样式、52px 占位、控件与功能，鼠标点击后的焦点不阻止收起；
键盘可见焦点和已展开面板保持工具栏可见，无悬停设备保持可访问。

- `npm run build`：通过。
- 内置 browser-use 在用户标注的 `http://127.0.0.1:5173/` 实际操作验证：
  顶部悬停 opacity=1，移到正文 opacity=0，两种状态工具栏 height=52、viewportTop=60，正文不跳动。
- 点击下一页后移开仍隐藏；点击上一页返回原封面。设置打开时保持可见，Escape 关闭后
  键盘焦点仍可见；点击正文后恢复隐藏。未修改用户的笔记、Goal 或阅读设置。
- 本次未重跑完整回归或桌面专项；此前记录的测试结果仅代表各自对应版本。

工作区原有 Goal 层级/动作、样式、打包与验证脚本等未提交改动保留。
本次仅在所需视图、阅读控制器、样式、相关测试及文档上补充修改，未创建提交或推送。
