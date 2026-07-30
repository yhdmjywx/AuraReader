# AuraReader Workstation - Agent Development Guide (`agent.md`)

---

## 1. 项目身份与核心使命 (Project Identity & Core Mission)

**AuraReader Workstation** 是一款基于 Web 前端架构打造的 **75:25 黄金比例 AI 智能阅读工作台**。

- **核心使命**：为读者、研究者与知识卡片管理重度用户提供**零服务器成本、100% 隐私安全、离线全自动持久化、无冗余文本重复导出**的高性能阅读与笔记环境。
- **运行特征**：全前端架构（HTML5 + Vanilla CSS3 + Modern ES6+ JS），结合浏览器原生 `IndexedDB` 数据库与 `JSZip` 引擎，支持免联网离线运行。

---

## 2. 技术栈规范 (Technology Stack)

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

## 3. 项目目录结构 (Directory Structure)

```text
e:\dp\reader_workstation\
├── index.html        # 主应用 UI 布局与组件结构
├── styles.css        # 全局设计系统、主题 Token 与组件样式
├── app.js            # 阅读引擎、IndexedDB 数据库与导出主逻辑
├── .gitignore        # Git 版本控制忽略规则
├── agent.md          # Agent 开发与架构指南文档 (本文件)
└── status.md         # 项目最新运行与工程状态文档
```

---

## 4. Agent 开发与维护法则 (Operating Guidelines)

1. **语法校验优先**：每次修改 `app.js` 后，必须执行 `node -c app.js` 验证 0 语法错误。
2. **拒绝代码重复与文本粘连**：导出 Markdown 时必须严格遵守 `==高亮==` 嵌入规范，绝对禁止生成 `💡 [划线随笔] 原文：“...”` 格式的重复文本。
3. **保持根目录干净**：所有临时测试脚本在验证完成后必须及时清理，勿将其提交入 Git 仓库。
4. **强缓存控制 (Cache Busting)**：修改 JS / CSS 时需同步更新 `index.html` 中的引用版本参数（如 `app.js?v=9`）。
5. **遵从同源隐私原则**：所有用户文件与划线笔记 100% 保存在本地 `IndexedDB` 与 `LocalStorage` 中。
