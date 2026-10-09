# AuraReader Workstation - Agent Development Guide (`agent.md`)

---

## 1. 项目身份与核心使命 (Project Identity & Core Mission)

**AuraReader Workstation** 是一款基于 Web 前端架构打造的 **75:25 黄金比例智能阅读与笔记工作台**。

- **核心使命**：为读者、研究者与知识卡片管理重度用户提供**零服务器成本、100% 隐私安全、离线全自动持久化、无冗余文本重复导出**的高性能阅读与笔记环境。
- **运行特征**：全前端架构（HTML5 + Vanilla CSS3 + Modern ES6+ JS），结合浏览器原生 `IndexedDB` 数据库与 `JSZip` 引擎，支持免联网离线运行。

---

## 2. 人机协同与自治修复契约 (Refined Collaboration Protocol)

在开发与测试协同中，严格执行以下**分级自治与呈报契约**：

1. **开发过程中的细小 Bug ➔ Agent 自行自治处理 (Autonomous Minor Fixes)**：
   - 在功能开发进行中，遭遇的语法拼写失误、局部变量未定义、DOM 事件解绑、CSS 样式微调等细微 Bug，由 Agent 自查自修、快速迭代，不打扰人类。
2. **工作被迫中断 ➔ 立即交由人类协助决策 (Interruption Handover)**：
   - 当遇到环境故障、权限拒绝、第三方 API 崩溃或需求冲突导致开发被迫中断时，Agent 必须立即整理现场信息并交由人类决策。
3. **阶段里程碑完成后的测试校验问题 ➔ 整理方案交由人类裁决 (Post-Milestone Handover)**：
   - 在完成整块功能开发并运行测试套件自检时，若发现排版差异、功能偏离或校验项失败，Agent 必须整理**根因诊断 + 方案选项**呈报人类，由人类决策授权后执行修复。

---

## 3. 技术栈规范 (Technology Stack)

- **UI 结构**：HTML5 语义化标签 (`<header>`, `<aside>`, `<article>`, `<main>`)
- **设计系统与 CSS**：Vanilla CSS 变量与设计 Token（双重主题：App 浅色/深色主题；纸张主题：纯白/羊皮纸/夜间墨黑）
- **核心逻辑引擎 (`app.js`)**：
  - **75:25 Resizer 分栏引擎**：双指针拖拽，25%-85% 范围限制，双击快速折叠/展开。
  - **EPUB / PDF / TXT 解析引擎**：包含 `META-INF/container.xml`、`content.opf` 及 `toc.ncx` 132 条规范目录提取与 `#anchor` 平滑锚点跳转。
  - **全量图片 Base64 转换引擎 (`processChapterImages`)**：处理相对路径 `<img>` 及 SVG `<image xlink:href>`，彻底消除 404 破损。
  - **书内超链接拦截器 (`interceptInTextLinks`)**：拦截 `<a href="...">` 链接，实现工作台内部页面与段落关联跳转。
  - **首行缩进引擎**：`--book-text-indent` CSS 变量驱动，支持 `0em` / `2em` / `3em` 多档切换与持久化。
  - **IndexedDB 本地存储引擎 (`AuraReaderDB` v1)**：包含 `books` 与 `notes` 存储桶，支持离线全自动持久化与“我的书库”管理。
  - **消除高亮重复 Markdown 导出引擎**：采用 standard `==高亮文字==` 行内无缝嵌入，有随笔时段下附 `> 💭 [随笔思考]` 引用块，绝对零原文重复。
  - **双栏离线 HTML 电子书导出引擎**：生成自适应单文件 HTML（75% 高亮正文 + 25% 随笔侧边栏 + TOC 目录抽屉）。

---

## 4. 项目目录结构 (Directory Structure)

```text
reader_workstation/
├── src/
│   ├── client/          # 客户端前端资源 (index.html, styles.css, app.js)
│   └── server/          # 服务端静态托管与健康探测服务 (server.js)
├── docs/                # 规范与设计文档 (prd_v0_5.md, workflow_architecture.md, agent.md, status.md, deploy_vps.md)
├── deploy/              # 生产部署与容器编排 (Dockerfile, docker-compose.yml, nginx.conf, deploy.sh)
├── tests/               # 测试套件 (fixtures/, unit/, regression/)
├── data/                # 本地数据目录 (已 gitignore)
├── .gitignore           # Git 版本控制忽略规则
├── package.json         # 项目元数据与脚本入口
├── package-lock.json    # 依赖锁文件
└── README.md            # 项目说明手册
```

---

## 5. Agent 开发与维护法则 (Operating Guidelines)

1. **语法自检**：开发过程中每次修改 `app.js` 后，执行 `node -c src/client/app.js`（或 `npm run test:syntax`）自行修正小语法错漏。
2. **拒绝代码重复与文本粘连**：导出 Markdown 时必须严格遵守 `==高亮==` 嵌入规范，绝对禁止生成 `💡 [划线随笔] 原文：“...”` 格式的重复文本。
3. **保持根目录干净**：所有临时测试脚本在验证完成后必须及时清理，勿将其提交入 Git 仓库。
4. **强缓存控制 (Cache Busting)**：修改 JS / CSS 时需同步更新 `index.html` 中的引用版本参数（如 `app.js?v=9`）。
5. **遵从同源隐私原则**：所有用户文件与划线笔记 100% 保存在本地 `IndexedDB` 与 `LocalStorage` 中。
