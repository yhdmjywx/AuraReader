# 📖 AuraReader Workstation (75:25 Web 阅读工作台)

> **打造专属的高级 Web 阅读与知识卡片工作台**  
> 100% 纯前端 Local-First 架构 | 0 服务器成本 | 纯本地隐私安全 | 单/双页 4 种正交布局 | 纯净无重复 `==高亮==` Markdown 分章节导出与 `.aurabackup` 离线自主迁移

---

## ✨ 核心特性 (Key Features)

- 🎨 **75:25 黄金比例切分与单/双页 (Spread 对开) 4 种正交布局**：左侧阅读区、右侧笔记区，支持 25%-85% 弹性拖拽 Clamp 与双击折叠。单页 / 双页（Spread 对开）模式与侧边栏展开 / 收起正交组合成 4 种专注阅读体验；双页模式呈现左右对称实体书卷排版与中缝拟真立体书脊阴影，侧栏折叠时边缘浮现极简微型“召回把手”。
- 📐 **760px 可用宽度临界自适应降级与自动恢复**：当阅读视口可用宽度低于 760px（窗口缩窄、小屏幕或侧边栏展开挤占）时，系统非破坏性自动降级为单页，操作栏呈现降级提示状态；可用空间恢复（≥ 760px）时自动无感还原双页展开；内置零宽度容错与防抖自适应探测，底层用户偏好不被篡改，偶数页位置严格保真。
- ⚡ **EPUB NCX 132 规范目录解析与平滑锚点定位**：支持 EPUB 2/3 标准，智能提取 `content.opf` 与 `toc.ncx` 132 条规范目录，实现精准目录层级与锚点平滑跳转。
- 🖼️ **Base64 图片内联化与书内超链接拦截**：自动将相对路径 `<img>` 及 SVG `<image xlink:href>` 转换为 Base64 内联数据，彻底告别 404 破损图片；拦截书内 `<a href>` 实现工作台内部关联跳转。
- 🎯 **划线与随笔双色正交色彩语义与原地编辑**：纯划线黄色（琥珀色卡片边框）与深度随笔翡翠绿色（翡翠绿卡片边框）双色正交；正文高亮悬浮气泡支持直接“写随笔”与“移除”，笔记卡片支持原地【编辑】，追加随笔自动升级为绿色、清空感悟降级为黄色划线，选区重叠智能去重归并。
- 🔍 **跨段落容错划选与双页右页定位保真**：基于断行与标点智能切分的高级高亮引擎，完美支持跨段落、跨内联标签连续划选与精准标记；双页对开模式下右页选区精准绑定右页页码（`P+1`），杜绝错位串线。
- 👁️ **笔记侧栏划线过滤开关与计数**：默认纯粹专注呈现随笔感悟卡片，一键切换【显示划线 (N)】显示全量划线卡片，阅读思绪零干扰。
- ✍️ **独立快速随笔速记输入框**：笔记面板顶部内置快速随笔输入框，支持 Markdown 语法速记，无需选中文本即可直接记录当前章节感悟。
- 📝 **首行缩进多档控制与深度个性化排版**：顶部阅读工具栏内置 `0em` (无缩进)、`2em` (标准中文缩进)、`3em` (大缩进) 动态切换；支持字号缩放（12px-32px）、衬线宋体/无衬线黑体/系统默认字体、以及纯白/羊皮纸/墨黑纸张与暗黑模式。
- 🖥️ **全屏沉浸模式与示例经典图书切换**：顶部操作栏内置全屏切换按钮，一键进入无干扰全屏阅读；内置经典藏书（《危机时代》/《深度工作》）一键免上传切换体验。
- 🗄️ **IndexedDB 本地书房数据库 (`AuraReaderDB` v1)**：无需上传服务器，图书文件与所有划线笔记 100% 全自动落盘浏览器本地 IndexedDB，随时在“我的书库”抽屉中离线秒级还原。
- 📦 **4 种导出与离线备份格式**：
  1. 📦 **分章节 Zip 压缩包 (`.zip`)**：纯净无重复 `==高亮==` Markdown 分章节打包与 `00_目录概览.md`；
  2. 🌐 **双栏独立离线 HTML 电子书 (`.html`)**：单文件自适应双栏（75% 正文高亮 + 25% 随笔侧边栏 + TOC 目录抽屉），脱机双击独立运行；
  3. 📝 **划线随笔摘要文档 (`.md`)**：全书标注与随笔汇编 Markdown；
  4. 📥 **逐书备份文件 (`.aurabackup`)**：每本书对应一个文件，保存解析后的正文、目录及可选的高亮与笔记，不包含应用设置；支持跨设备、跨浏览器恢复。
- 🛡️ **100% Local-First 纯本地隐私安全**：彻底移除 AI 与云同步，0 外部未授权网络请求，废弃同步路由安全隔离返回 404，图书与思考数据 100% 掌握在用户手中。

---

## ⌨️ 常用快捷键 (Keyboard Shortcuts)

| 快捷键 | 功能说明 | 交互说明 |
| --- | --- | --- |
| `D` | 切换单页 / 双页（Spread 对开）阅读模式 | 工具栏按钮同步响应；受 760px 宽度临界自适应保护 |
| `B` | 收起 / 展开笔记与工作台侧边栏 | 折叠后右边缘显示微型召回把手，点击亦可即时展开 |
| `←` / `→` | 上一页 / 下一页 | 单页步进 ±1，双页步进 ±2；偶数页切换位置保真 |
| 双击分割条 | 展开 / 折叠笔记侧边栏 | 双击工作台 75:25 拖拽分割条直接切换侧边栏展开状态 |

> 💡 **快捷键安全互锁**：当用户在输入框、随笔文本域（`<input>`, `<textarea>`）内输入文字或激活弹窗对话框时，全局翻页与布局快捷键自动静默互锁，绝不误触翻页或折叠。

---

## 🚀 快速开始 (Quick Start)

项目采用现代轻量级技术栈打造（HTML5 + Vanilla CSS3 + Modern ES6+ JS），内置 Node.js 原生 HTTP / 静态资源与探针托管服务，无需打包编译，即开即用！

### 1. 本地启动运行：

```bash
# 启动内置 Node.js Web 服务器（默认端口 8095）
npm start
# 或者: node src/server/server.js

# 浏览器访问
http://localhost:8095
```

### 2. 运行自动化测试套件：

```bash
# 1. 一键运行全量自动化测试（静态语法校验 + 单元测试 + 全链路回归测试）
npm run test:all

# 2. 运行 JavaScript 语法静态校验（严格检测服务端与前端全部 37 个核心模块）
npm run test:syntax

# 3. 运行核心算法与领域模型单元测试（NCX 132 目录解析、ReadingLocation、ReaderEngine 等）
npm run test:unit
# 或者: npm test

# 4. 运行全链路回归测试套件（自动化批处理 13 项深度回归测试）
npm run test:regression
# 或者直接调用测试执行器: node tests/regression/run_all.js
```

### 3. VPS 生产环境一键 Docker 部署：

```bash
# 进入部署脚本目录并一键执行
chmod +x deploy/deploy.sh && ./deploy/deploy.sh
```

👉 **详细 VPS 部署、域名绑定与 HTTPS 证书配置指南见：[docs/deploy_vps.md](docs/deploy_vps.md)**

---

## 📂 项目文件架构 (Directory Architecture)

```text
reader_workstation/
├── .gitignore                   # Git 忽略配置文件
├── README.md                    # 项目说明手册 (本文件)
├── package.json                 # 项目元数据与脚本入口
├── package-lock.json            # 依赖锁定文件
├── src/
│   ├── client/                  # 客户端前端源代码
│   │   ├── app/                 # 应用协调层 (appCoordinator, session, appShell)
│   │   ├── domain/              # 纯业务领域模型 (readerEngine, annotationEngine, readingLocation)
│   │   ├── features/            # 垂直功能控制器与 UI 展示层
│   │   │   ├── annotations/     # 标注控制器与笔记 UI (annotationController, notesUI, selectionController, selectionTooltipUI)
│   │   │   ├── backup/          # 备份与导出控制器 (backupController, backupModalUI)
│   │   │   ├── layout/          # 布局控制器 (layoutController)
│   │   │   ├── reader/          # 阅读器控制器与纸张渲染 (readerController, paperRenderer, tocUI)
│   │   │   └── shelf/           # 本地书库控制器 (shelfController, shelfUI)
│   │   ├── infrastructure/      # 基础设施适配 (bookRepository, annotationRepository, epubParser, exporters)
│   │   ├── core/                # 核心兼容门面层 (向后兼容导入)
│   │   ├── ui/                  # UI 兼容门面层 (向后兼容导入)
│   │   ├── repositories/        # 仓库兼容门面层 (向后兼容导入)
│   │   ├── adapters/            # 适配器兼容门面层 (向后兼容导入)
│   │   ├── index.html           # 前端应用入口 HTML
│   │   ├── styles.css           # 响应式排版与主题样式表
│   │   ├── main.js              # 应用启动装配入口 (Bootstrap)
│   │   ├── app.js               # 兼容门面代理与状态对外接口
│   │   └── package.json         # 客户端子包配置 (ESM 模块定义)
│   └── server/                  # 服务端轻量托管服务
│       └── server.js            # Node.js 静态文件托管与健康探测服务
├── docs/                        # 规范与设计文档
│   ├── prd_v0_5.md              # 完整落地产品需求文档 (PRD 规范版)
│   ├── workflow_architecture.md # 5 阶段工程工作流落地架构
│   ├── agent.md                 # Agent 协作契约规范
│   ├── status.md                # 实时工程状态与校验报告
│   └── deploy_vps.md            # VPS 节点与 HTTPS 部署手册
├── deploy/                      # 生产部署与容器编排
│   ├── Dockerfile               # Node 20 容器构建镜像
│   ├── docker-compose.yml       # Docker Compose 编排
│   ├── nginx.conf               # Nginx 生产反向代理与 Gzip 缓存配置
│   └── deploy.sh                # VPS 一键部署与巡检脚本
├── tests/                       # 测试套件与测试夹具
│   ├── fixtures/                # 规范测试电子书 (test.epub)
│   ├── unit/                    # 核心算法与领域模型单元测试
│   │   ├── test_ncx.js          # NCX 132 目录解析测试
│   │   ├── test_decoupled_architecture.js # 解耦架构核心模块单元测试
│   │   └── inspect.js           # OPF / NCX 深度检查
│   └── regression/              # 全链路回归测试套件 (13 项自动化测试)
│       ├── run_all.js           # 回归套件全量批量运行器
│       ├── audit_user_backup_flow.js         # 备份与恢复全链路测试
│       ├── test_advanced_highlight_engine.js # 高级高亮定位测试
│       ├── test_annotation_colors.js         # 黄色纯划线 vs 绿色随笔颜色规范测试
│       ├── test_cross_paragraph_highlight.js # 跨段落划选测试
│       ├── test_html_and_dom_audit.js        # HTML 与 DOM 健全性测试
│       ├── test_local_persistence_pipeline.js# IndexedDB 本地持久化测试
│       ├── test_mini_tooltip_interaction.js  # 浮动工具栏交互测试
│       ├── test_page_layout_system.js        # 单双页 4 组合布局与 760px 降级测试
│       ├── test_selection_event_flow.js      # 选区事件流测试
│       ├── test_selection_fix_verification.js# 选区修复验证
│       ├── test_separated_highlights_and_notes.js # 划线与随笔分离显示测试
│       ├── test_toc_drawer.js                # 目录抽屉交互测试
│       ├── test_unified_note_editing.js      # 原地编辑与合并去重测试
│       └── inspect_vps_status.js             # VPS 环境探测脚本
└── data/                        # 本地临时数据目录 (已配置 .gitignore)
```

---

## 📚 项目文档索引 (Documentation Index)

- 📋 **[prd_v0_5.md](docs/prd_v0_5.md)**：包含全量演进对照的完整落地 PRD 规范与 18 项测试用例矩阵。
- 🏗️ **[workflow_architecture.md](docs/workflow_architecture.md)**：记录了 5 阶段工作流架构、分级受控修复与协作促进规范。
- 🤖 **[agent.md](docs/agent.md)**：Agent 协作契约规范。
- 📊 **[status.md](docs/status.md)**：项目实时工程状态、Git 提交记录与全量回归校验报告。
- 🚀 **[deploy_vps.md](docs/deploy_vps.md)**：VPS 生产部署、反向代理与 HTTPS / SSL 证书配置指南。

---

## 🛡️ 隐私与数据安全 (Privacy & Data Safety)

AuraReader Workstation 遵循严格的 **100% Local-First** 隐私原则：
- 所有导入的图书文件（EPUB/PDF/TXT）与产生的划线随笔仅保存在您本地浏览器的 `IndexedDB` 数据库中。
- 不会将您的图书与阅读记录上传至任何第三方云端服务器。
- 彻底移除了所有外部云端 AI 接口调用与中心化同步机制，0 外部未授权网络通信。
- 换设备或换浏览器时，可通过 `.aurabackup` 离线备份文件自主迁移全量数据。
