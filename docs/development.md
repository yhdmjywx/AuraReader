# 安装、开发与桌面验收

日常使用入口见 [README](../README.md#get-started)；本页保留完整运行、构建与验收说明。阶段记录描述当时的源码／安装包，不代表最新源码功能已全部进入候选安装包。

2026-10-30：当前源码的产品界面与应用提示已统一英文，首次创建书库按钮为 `Create local library`；本文中文功能名称仍用于说明。书籍与用户内容保留原语言。实现范围、截图与验证见 [英文统一记录](archive/verification/english-ui-verification-2026-10-30.md)。本次未生成新版安装包。

## 安装与启动

Windows x64 桌面候选版使用 `AuraReader-Setup-1.0.0-x64.exe` 安装，安装后从桌面或开始菜单的 AuraReader 快捷方式启动。应用自带 Electron、Node.js 与 SQLite，日常使用无需另装 Node.js、打开浏览器或运行终端。首次启动点击“创建独立桌面书库”，随后导入 EPUB/TXT。候选安装包和 SHA256 校验文件由下方 `npm run dist:win` 生成在 `release/`，未发布到在线下载服务。

桌面默认数据位置为 `%APPDATA%\AuraReader`，其中 `data/aurareader.sqlite` 保存书籍及笔记，`data/fonts/` 保存导入字体；正常升级和卸载保留数据。当前只支持现用 SQLite 和当前书籍备份，不提供旧数据库自动迁移。安装包目前**未签名**；实际 NSIS 静默安装、版本升级、卸载和重装已经验证，安装向导逐页操作、纯净 Windows 虚拟机以及签名后的系统信任流程尚未验收。具体证据与限制见 [阶段 5 记录](archive/plans-and-implementation/electron-desktop-stage5.md)。

浏览器模式继续提供源码运行方式，已在 Windows 和 Node.js 24.16.0 上验证。此模式要求 **Node.js >= 24.15.0**，使用内置 `node:sqlite`，并建议使用近期版本的 Chrome 或 Edge。本地服务只监听 `127.0.0.1`。

下载项目并解压，或克隆仓库，然后在项目根目录打开终端：

```powershell
npm ci
npm start
```

在浏览器中访问 [http://localhost:8095/](http://localhost:8095/)。使用期间保持终端和本地服务运行；在终端按 `Ctrl+C` 停止服务。

如果默认端口被占用，可以在 PowerShell 中指定其他端口：

```powershell
$env:PORT = '8096'
npm start
```

随后访问 `http://localhost:8096/`。服务从项目的 `data/` 目录打开 SQLite 书库，连接这份项目的不同浏览器或端口共用该书库。阅读偏好仍按浏览器访问地址保存。旧浏览器数据的范围见 [数据与备份](data-and-backup.md#浏览器启动与旧版数据)。

## 开发与测试

Electron Windows 桌面迁移已进入阶段 6 的本地验证，保留 Windows x64 NSIS 候选安装包，暂不发布。运行 `npm run desktop` 也可从源码创建独立桌面书库，通过 Windows 原生对话框导入 EPUB/TXT、阅读并保存高亮和笔记；可读取系统字体、导入 TTF/OTF/WOFF2，以及保存 Markdown、章节文件夹和每书 `.aurabackup`，并恢复当前书籍备份。旧阶段记录中的带标注 HTML 与章节 ZIP 属于历史验收能力，当前菜单不再提供这些导出入口。文件取消与保存失败会明确反馈，多书备份显示实际保存数量。桌面资源与 JSZip 随应用提供，离线运行不使用 localhost 服务。

首次创建桌面书库需明确点击。桌面 SQLite 和导入字体位于安装目录之外的 `%APPDATA%\AuraReader\data`。桌面支持 SQLite 读写、版本校验、幂等重试、备份与恢复，未知或缺失的数据库会阻断启动。阶段 6 增加实际 SQLite 容量、只读和锁竞争故障、Renderer/主进程终止恢复、大书与持续读写、打包程序及安装生命周期验证，并修复容量错误掩盖与页面关闭漏保存。发布验收仍有未验证项；最新证据与限制见 [阶段 6 记录](archive/plans-and-implementation/electron-desktop-stage6.md)，安装设计见 [阶段 5](archive/plans-and-implementation/electron-desktop-stage5.md)，文件功能见 [阶段 4](archive/plans-and-implementation/electron-desktop-stage4.md)，历史记录见 [阶段 3](archive/plans-and-implementation/electron-desktop-stage3.md)、[审计](archive/plans-and-implementation/electron-desktop-audit.md)和[外壳记录](archive/plans-and-implementation/electron-desktop-stage2.md)。

源码位于 `src/client/` 和 `src/server/`。前端使用 React + Vite：`entry.tsx` 先挂载 `WorkbenchShell`，再按运行环境载入浏览器／桌面应用。首页、完整 Goal 页面、阅读 Goal 侧栏、书库列表、选区操作和页边笔记均由 React 展示；偏好和导出面板也由 React 创建，原有 controller 继续执行字体、布局、保存和文件命令。

`npm start` 会先检查类型并构建，再启动服务。`dist/renderer/` 是浏览器与 Electron 共用的 Vite 产物，包含带 hash 的 JS/CSS、本地图标和字体；`dist/client/` 保留逐模块编译输出，供现有测试导入，不随桌面版发布。依赖安装后，可以运行：

测试模块构建会将 `?raw` 默认导入转换为依赖文件的完整 UTF-8 文本，并将 `new URL(...ts, import.meta.url)` 转为编译后的 `.js` 路径。源码仍交由 Vite 处理，开发页面与生产 renderer 保留原资源导入和 Worker 构建方式。`test_build_assets.js` 核对全部 Readium CSS 原文，并实际执行编译后的 EPUB 导入 Worker。

```powershell
npm test                 # 语法、单元和回归检查
npm run dev              # 启动 API (8095) 和 Vite 开发页面 (5173)，支持 React 热更新
npm run build            # 严格类型检查、测试模块输出和 Vite 生产构建
npm run build:modules    # 只编译现有测试使用的模块
npm run typecheck        # 只检查类型
npm run test:unit        # 单元测试
npm run test:regression  # 回归检查
npm run test:syntax      # JavaScript 语法检查
npm run test:migration   # React 迁移相关的 16 项核心检查，包含生产构建
npm run desktop          # Windows x64 桌面预览，书库通过 IPC 访问，不启动 HTTP 服务
npm run test:desktop     # 当前 Vite/Electron 核心流程、正常关窗及失败保存保护，使用独立临时书库
npm run test:reading-workflow # 同一条流程：首页/选书、IME 笔记、Goal/回跳、偏好/导出、键盘弹层及重载后的数据
npm run test:stability   # 独立 profile 的故障、异常终止恢复、大书及默认 300 秒持续读写；可附 -- 600
npm run test:packaged:stability # 复验已有 win-unpacked 的真实 exe；先运行 dist:win
npm run test:desktop:native # 交互验收真实 Windows 文件对话框，按终端提示选项目测试素材
npm run dist:win          # 构建 Windows x64 NSIS 候选包，并校验资源、许可和安全 fuses
npm run verify:package    # 核对已有 win-unpacked，并生成安装包 SHA256 与检查报告
node tests/desktop/packaged-epub.cjs # 发布前：仓库外副本的 EPUB/资源/关闭写入/冷启动/退出检查，不安装
npm run test:install      # 构建候选/升级测试包，真实安装、升级、卸载和重装（需无现有 AuraReader 安装）
```

包验证会追踪桌面本地 require、ESM 导入／再导出、动态导入及 Node Worker 入口，并逐字节核对 app.asar 中的全部 renderer 资源与当前 `dist/renderer/`。因此验证旧包前需使用对应构建，不能把不同源码生成的 renderer 当作其验证基准。发布前再执行 `packaged-epub.cjs`：将真实 exe／app.asar 复制到仓库外临时目录，避免回退到项目 node_modules；移除 PATH 中的 Node、关闭网络并使用独立 profile，覆盖 ZIP Worker、动态共享模块、Readium CSS、出版物 CSS／字体／图片、关闭末次输入、冷启动数据保持及两次正常退出。临时程序副本在结束后删除，测试书库和报告保留；不替代安装器生命周期验收。

2026-11-12 兼容性检查中，源码测试、打包与静态校验通过，正常退出断言当时失败，见 [兼容性记录](archive/verification/electron-compatibility-2026-11-12.md)。2026-11-13 修正窗口销毁后的清理及异步关闭竞态后，源码正常关闭、失败保存保护，以及新打包 exe 的关闭／冷启动与数据保持均通过，见 [生命周期修复记录](archive/verification/electron-lifecycle-2026-11-13.md)。安装／升级／卸载尚未执行。

阅读器现在通过 `features/reader/readerRuntime.ts` 提供 `mount`、`setBook`、`setAnnotations`、`setLayout`、翻页、`subscribe/getSnapshot` 和 `destroy`；当前应用也使用这个入口挂载。React 界面可直接使用 `readerReact.tsx` 中的 `ReaderSurface` 与 `useReaderSnapshot`。React 管理容器和周边界面，阅读器独占正文子节点；快照只包含普通数据，不传出 DOM 或 Range。卸载会移除阅读与选区监听、排版任务和尺寸观察；重新挂载保留书籍与源文档位置。业务数据保存仍由原有 repository/controller 负责。

核心业务界面位于 `features/workbench/ReadingWorkbench.tsx`，通过 `WorkbenchStore` 订阅现有阅读、笔记、Goal 和导航状态。选书、创建/编辑笔记、关联 Goal 和回跳使用统一命令，继续调用原有 controller/coordinator 的保存与导航逻辑。页边笔记使用稳定的 React 节点，排版模块只测量和定位，不移动或重建这些节点。

`features/goals/goalHome.tsx` 管理首页展示和浏览命令；`goalUI.tsx` 是完整 Goal 页与阅读侧栏共用的 React 视图，切换页面时保留同一挂载容器。原有 controller 通过 `renderSurface` 更新稳定的 React 根，避免同时维护原生和 React 两套展示。React 外壳保持容器不变；正文、目录排版和选区仍是阅读器专属 DOM 边界，字体和导出列表则使用各自的 React 展示适配器。

公共基础组件在 `components/ui/`：采用 shadcn 的源码归属和变体组织方式，以 Base UI 的 Button、Menu、Dialog 为基础，用现有 CSS 变量统一按钮、输入框、菜单、对话框、明暗主题、焦点环及短动效；当前没有引入 Tailwind 或运行 shadcn CLI。菜单支持方向键、Escape 和焦点返回，对话框管理焦点并支持 Escape；系统减少动态效果偏好会关闭这些过渡。Goal 菜单、书库移除确认、首页选书和备份选择共用弹层基础组件。

日常前端开发访问 `npm run dev` 输出的 `http://127.0.0.1:5173/`，API 请求由 Vite 转发至本地服务。生产预览仍使用 `npm start` 的 8095 端口；直接运行 `node src/server/server.js` 前需先构建。浏览器偏好按页面访问地址隔离。

Electron 此阶段继续通过 `aurareader://app/index.html` 加载 Vite 构建资源，不启用桌面 HMR，也不改 IPC 来源校验。桌面改动后重新执行 `npm run desktop`。

日常验证先运行 `npm run test:migration`，再运行 `npm run test:desktop`。前者检查 React 挂载、阅读器边界、首页/Goal/书库/导出交互及 Vite 资源；后者直接加载带 hash 的实际生产入口，验证 EPUB、IME 笔记、SQLite 保存、Goal 关联、跨书回跳、键盘弹层，并重载 renderer 确认书籍、笔记和 Goal 仍可读取。本阶段不新增故障注入、长时间压力或安装器验收。

`tests/helpers/react-workbench.cjs` 从真实 `WorkbenchShell` 创建测试 DOM，使用 React `act` 等待更新；原生引擎的静态 DOM 检查也从这个外壳生成快照。Node/JSDOM 模块测试仍使用 `dist/client/`，不再假设 `index.html` 内已有工作台，或 Goal 编辑器始终存在。旧桌面专项脚本保留在原目录，`scripts/test-desktop.cjs --legacy` 对应历史整套入口；它们仍有固定模块 URL 和旧 DOM 假设，未纳入本次通过范围。默认桌面入口已切到当前 React 核心流程；完整旧测试集、专项稳定性套件及安装包不在本阶段通过声明之内。

测试素材 `tests/fixtures/test.epub` 是 Project Gutenberg 的英文版《爱丽丝梦游仙境》，保留书内原始声明与许可。素材来源见 [测试素材说明](../tests/fixtures/README.md)。嵌套目录另由自写测试样例验证。

## 后续源码验收

Goal 生命周期已在 2026-10-27 完成源码与真实 Electron 验证，未制作或验证新版安装包。具体范围见 [Goal 生命周期记录](archive/verification/goal-lifecycle-verification-2026-10-27.md)。本次文档整理未重新执行这些历史验收。
