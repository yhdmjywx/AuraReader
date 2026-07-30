# 📖 AuraReader Workstation (75:25 AI 智能 Web 阅读工作台)

> **打造专属的高级 Web 阅读与知识卡片工作台**  
> 100% 纯前端架构 | 0 服务器成本 | IndexedDB 本地离线持久化 | 纯净无重复 `==高亮==` Markdown 分章节导出

---

## ✨ 核心特性 (Key Features)

- 🎨 **75:25 黄金比例切分布局**：左侧 75% 高清排版纸张阅读区，右侧 25% 划线卡片与 AI 洞察面板，支持 25%-85% 弹性拖拽与双击快捷折叠。
- ⚡ **EPUB NCX 132 规范目录解析**：支持 EPUB 2/3 标准，智能提取 `content.opf` 与 `toc.ncx` 132 条规范目录，实现 `#anchor` 锚点平滑跳转。
- 🖼️ **Base64 图片内联化与超链接拦截**：自动将相对路径 `<img>` 及 SVG `<image xlink:href>` 转换为 Base64 内联数据，彻底告别 404 破损图片；拦截书内 `<a href>` 实现工作台内部关联跳转。
- 📝 **首行缩进多档智能控制**：顶部阅读工具栏内置 `0em` (无缩进)、`2em` (标准中文缩进)、`3em` (大缩进) 动态切换，自动作用于正文 `<p>` 并保持标题居中。
- 🗄️ **IndexedDB 本地书房数据库 (`AuraReaderDB` v1)**：无需上传服务器，图书二进制与所有划线笔记 100% 全自动落盘浏览器本地 IndexedDB，随时在“我的书库”抽屉中离线还原。
- 📦 **纯净无重复 Markdown 分章节导出 (`==高亮==`)**：正文原位嵌入 `==高亮文字==` 标记，仅对有感悟的划线生成 `> 💭 [随笔思考]` 引用块，**彻底解决引文重复粘贴**。一键输出包含 `00_目录概览.md` 与分章节 `.md` 的 Zip 压缩包。
- 🌐 **双栏独立离线 HTML 电子书导出**：生成单文件自适应双栏（75% 正文高亮 + 25% 随笔侧边栏 + TOC 目录抽屉），离线双击即可独立打开。
- 🤖 **AI 核心洞察萃取**：一键提取当前章节的核心观点与关键要点，支持打字机流式展现与自定义大模型 API Key（DeepSeek / OpenAI / Gemini / Ollama）。

---

## 🚀 快速开始 (Quick Start)

项目采用纯前端技术栈打造（HTML5 + Vanilla CSS3 + Modern ES6+ JS），无需复杂的 Node Build 构建依赖，即开即用！

### 1. 本地预览运行：

```bash
# 进入项目目录
cd e:/dp/reader_workstation

# 使用任意静态 HTTP 服务器启动（例如 http-server）
npx -y http-server -p 8095

# 浏览器访问
http://localhost:8095
```

### 2. VPS 生产环境 1 键 Docker 部署：

```bash
# 赋予脚本执行权限并一键部署
chmod +x deploy.sh && ./deploy.sh
```

👉 **详细 VPS 部署、域名绑定与 HTTPS 证书配置指南见：[deploy_vps.md](file:///e:/dp/reader_workstation/deploy_vps.md)**

---

## 📂 项目文件架构 (Directory Architecture)

```text
e:\dp\reader_workstation\
├── index.html               # 主应用 UI 布局、工作台 DOM 结构
├── styles.css               # 全局设计系统、纸张主题 Token 与响应式样式
├── app.js                   # 阅读引擎、IndexedDB 数据库与导出逻辑主程序
├── README.md                # 项目说明文档 (本文件)
├── prd_v0_5.md              # -0.5 版（核对升级版）产品需求文档 (PRD)
├── workflow_architecture.md # 全流程 Agent 与人类协同工作流落地架构
├── agent.md                 # Agent 架构规范与人机契约指南
├── status.md                # 当前项目运行与工程交付状态
└── .gitignore               # Git 版本控制忽略配置
```

---

## 📚 完善的项目文档索引 (Documentation Index)

- 📋 **[prd_v0_5.md](file:///e:/dp/reader_workstation/prd_v0_5.md)**：包含全量 10 个阶段沟通对照的完整 PRD 规范与测试矩阵。
- 🏗️ **[workflow_architecture.md](file:///e:/dp/reader_workstation/workflow_architecture.md)**：详细记录了 5 阶段工作流架构、分级受控修复与 Antigravity 斜杠命令共生促进矩阵。
- 🤖 **[agent.md](file:///e:/dp/reader_workstation/agent.md)**：Agent 开发与架构指南，包含“开发过程小 Bug 自治，阶段测试问题受控呈报”的契约规范。
- 📊 **[status.md](file:///e:/dp/reader_workstation/status.md)**：项目实时工程状态、Git 提交记录与校验测试报告。

---

## 🛡️ 隐私与数据安全 (Privacy & Data Safety)

AuraReader Workstation 遵循 **100% Local-First** 隐私原则：
- 所有导入的图书文件（EPUB/PDF/TXT）与产生的划线随笔仅保存在您本地浏览器的 `IndexedDB` 数据库中。
- 不会将您的图书与阅读记录上传至任何第三方云端服务器。
