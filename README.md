# 📖 AuraReader Workstation (75:25 Web 阅读工作台)

> **打造专属的高级 Web 阅读与知识卡片工作台**  
> 100% 纯前端架构 | 0 服务器成本 | IndexedDB 本地离线持久化 | 纯净无重复 `==高亮==` Markdown 分章节导出

---

## ✨ 核心特性 (Key Features)

- 🎨 **75:25 黄金比例切分布局**：左侧 75% 高清排版纸张阅读区，右侧 25% 划线卡片与笔记面板，支持 25%-85% 弹性拖拽与双击快捷折叠。
- ⚡ **EPUB NCX 132 规范目录解析**：支持 EPUB 2/3 标准，智能提取 `content.opf` 与 `toc.ncx` 132 条规范目录，实现 `#anchor` 锚点平滑跳转。
- 🖼️ **Base64 图片内联化与超链接拦截**：自动将相对路径 `<img>` 及 SVG `<image xlink:href>` 转换为 Base64 内联数据，彻底告别 404 破损图片；拦截书内 `<a href>` 实现工作台内部关联跳转。
- 📝 **首行缩进多档智能控制**：顶部阅读工具栏内置 `0em` (无缩进)、`2em` (标准中文缩进)、`3em` (大缩进) 动态切换，自动作用于正文 `<p>` 并保持标题居中。
- 🗄️ **IndexedDB 本地书房数据库 (`AuraReaderDB` v1)**：无需上传服务器，图书二进制与所有划线笔记 100% 全自动落盘浏览器本地 IndexedDB，随时在“我的书库”抽屉中离线还原。
- 📦 **纯净无重复 Markdown 分章节导出 (`==高亮==`)**：正文原位嵌入 `==高亮文字==` 标记，仅对有感悟的划线生成 `> 💭 [随笔思考]` 引用块，**彻底解决引文重复粘贴**。一键输出包含 `00_目录概览.md` 与分章节 `.md` 的 Zip 压缩包。
- 🌐 **双栏独立离线 HTML 电子书导出**：生成单文件自适应双栏（75% 正文高亮 + 25% 随笔侧边栏 + TOC 目录抽屉），离线双击即可独立打开。

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
# 运行单元测试（NCX 目录与 OPF 解析）
npm test

# 运行全链路回归测试套件
node tests/regression/test_html_and_dom_audit.js
node tests/regression/test_advanced_highlight_engine.js
node tests/regression/test_local_persistence_pipeline.js
node tests/regression/audit_user_backup_flow.js
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
├── src/
│   ├── client/          # 客户端前端资源 (index.html, styles.css, app.js)
│   └── server/          # 服务端静态托管与健康探测服务 (server.js)
├── docs/                # 规范与设计文档
│   ├── prd_v0_5.md              # 产品需求文档 (PRD v-0.5)
│   ├── workflow_architecture.md # 5 阶段工程工作流落地架构
│   ├── agent.md                 # Agent 开发与人机协作契约
│   ├── status.md                # 实时工程状态与校验记录
│   └── deploy_vps.md            # VPS 节点与 HTTPS 部署手册
├── deploy/              # 生产部署与容器编排
│   ├── Dockerfile               # Node 20 容器构建镜像
│   ├── docker-compose.yml       # Docker Compose 编排文件
│   ├── nginx.conf               # Nginx 生产反向代理与 Gzip 缓存配置
│   └── deploy.sh                # VPS 一键部署与环境巡检脚本
├── tests/               # 测试套件与测试夹具
│   ├── fixtures/        # 测试电子书等测试资产 (test.epub)
│   ├── unit/            # 核心算法与解析单元测试 (test_ncx.js, inspect.js)
│   └── regression/      # 静态审计与交互回归测试套件
├── data/                # 本地临时数据目录 (已配置 .gitignore 忽略)
├── .gitignore           # Git 忽略配置
├── package.json         # 项目元数据与脚本入口
├── package-lock.json    # 依赖锁文件
└── README.md            # 项目说明手册 (本文件)
```

---

## 📚 项目文档索引 (Documentation Index)

- 📋 **[prd_v0_5.md](docs/prd_v0_5.md)**：包含全量 10 个阶段沟通对照的完整 PRD 规范与测试矩阵。
- 🏗️ **[workflow_architecture.md](docs/workflow_architecture.md)**：详细记录了 5 阶段工作流架构、分级受控修复与 Antigravity 斜杠命令共生促进矩阵。
- 🤖 **[agent.md](docs/agent.md)**：Agent 开发与架构指南，包含“开发过程小 Bug 自治，阶段测试问题受控呈报”的契约规范。
- 📊 **[status.md](docs/status.md)**：项目实时工程状态、Git 提交记录与校验测试报告。
- 🚀 **[deploy_vps.md](docs/deploy_vps.md)**：VPS 生产部署、反向代理与 HTTPS / SSL 证书配置指南。

---

## 🛡️ 隐私与数据安全 (Privacy & Data Safety)

AuraReader Workstation 遵循 **100% Local-First** 隐私原则：
- 所有导入的图书文件（EPUB/PDF/TXT）与产生的划线随笔仅保存在您本地浏览器的 `IndexedDB` 数据库中。
- 不会将您的图书与阅读记录上传至任何第三方云端服务器。
