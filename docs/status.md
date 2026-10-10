# AuraReader Workstation - 项目当前状态文档 (`status.md`)

---

## 1. 当前运行状态概览 (Current Operational Status)

- **整体状态**：**🟢 全部功能上线运行中 (FULLY OPERATIONAL & PRODUCTION READY)**
- **Web 服务状态**：后台 Daemon 服务在线运行
  - **访问地址**：👉 **`http://localhost:8095`**
- **Git 版本库状态**：
  - **分支**：`master`
  - **最新 Commit**：`403b3dd` (fix(layout): resolve unresponsive page mode and sidebar toggle buttons and add zero-width fallback)
  - **工作区**：干净（Working tree clean）

---

## 2. 已完成核心里程碑功能矩阵 (Completed Feature Matrix)

| 功能模块 | 实现描述 | 状态 |
| --- | --- | --- |
| **终极架构解耦 (三层六类职责)** | 落地 Bootstrap (`main.js`) + App 协调层 (`appCoordinator.js`/`session.js`/`appShell.js`) + 五大功能控制器 (`readerController`/`annotationController`/`selectionController`/`shelfController`/`backupController`/`layoutController`) + 纯业务领域内核 (`domain/`) + 基础设施适配 (`infrastructure/`)。`app.js` 彻底瘦身为薄门面（Thin Facade）并统一单例权威，彻底消除双实例与 DOM 侵入，通过全量回归测试。 | ✅ 100% |
| **75:25 可分栏工作台** | 左侧 75% 阅读区 + 右侧 25% 笔记区，支持 25%-85% 弹性拖拽 Clamp 与双击快捷折叠。 | ✅ 100% |
| **EPUB NCX 132 目录解析** | 支持提取 EPUB 2/3 132 条规范目录，实现 `#anchor` 锚点平滑跳转。 | ✅ 100% |
| **图片 Base64 自动转换** | 兼容相对路径 `<img>` 及 SVG `<image xlink:href>`，彻底消除 404 破损图片。 | ✅ 100% |
| **书内超链接拦截** | `interceptInTextLinks` 拦截电子书内部 `<a href>` 链接，实现工作台内部关联跳转。 | ✅ 100% |
| **首行缩进多档调节** | 顶部工具栏支持 `0em` (无缩进)、`2em` (标准缩进)、`3em` (大缩进) 动态切换与持久化。 | ✅ 100% |
| **IndexedDB 本地书房** | 接入 `AuraReaderDB` v1 数据库 + “我的书库”抽屉，导入图书与笔记刷新免重复选取。 | ✅ 100% |
| **选文中 Tooltip 精简** | 移除与高亮功能重叠的“重点”按钮与 AI 归纳，仅保留纯粹的“高亮”🟨与“笔记”✍️。 | ✅ 100% |
| **划线与随笔颜色正交规范** | 划线保持黄色 (`mark.hl-yellow` / `.pure-highlight-card` 琥珀色)，随笔感悟恢复为原始翡翠绿 (`mark.hl-green` / `.hl-green-card` 翡翠绿)，支持原地编辑智能颜色流转。 | ✅ 100% |
| **双模式 4 组合弹性布局系统** | 支持单页/双页 (Spread) 与侧边栏展开/收起 4 种正交布局，双页左右对称微质感书脊，右侧微型召回把手，宽度不足时非破坏性自动降级与恢复。 | ✅ 100% |
| **划线随笔 Modal 修复** | 修复 Modal 按钮事件绑定误置于局部解析函数的 Bug，全量全局绑定生效。 | ✅ 100% |
| **消除高亮重复 Markdown 导出** | 采用 `==高亮文字==` 行内无缝嵌入，无随笔 0 追加，有随笔仅追加感悟块，绝对零原文重复。 | ✅ 100% |
| **📦 分章节 Zip 包导出** | 一键打包输出 `00_目录概览.md` 以及按章节切分的 `01_第一章.md`，适配 Obsidian/Logseq。 | ✅ 100% |
| 🌐 双栏离线 HTML 导出 | 生成独立单文件 HTML 网页，左侧 75% 带高亮正文，右侧 25% 随笔卡片列，双击离线打开。 | ✅ 100% |
| **🐳 VPS Docker 一键部署包** | 内置 `Dockerfile`、`nginx.conf` (预置 Gzip/SSL)、`docker-compose.yml`、`deploy.sh` 自动化脚本及 `deploy_vps.md` 指南。 | ✅ 100% |
| **需求规格文档产出** | 产出完成 PRD v-1 及基于全量对话匹配对照的 PRD v-0.5 文档。 | ✅ 100% |

---

## 3. 校验套件结果 (Verification Results)

- **JavaScript 语法静态校验 (`npm run test:syntax` / `node --check src/server/server.js && node --check src/client/app.js`)**：PASSED (0 Syntax Errors)
- **依赖与包管理健全性校验 (`npm ls`)**：PASSED (`devDependencies`: `jszip@3.10.1`, `ssh2@1.17.0` 正常锁定，0 extraneous 孤立依赖)
- **单元测试套件 (`npm test` / `npm run test:unit`)**：PASSED (132/132 NCX 目录解析与 OPF 263-href 映射验证，解耦架构单元测试通过)
- **全链路回归测试套件 (`npm run test:regression` / `node tests/regression/run_all.js`)**：PASSED (13/13 项全部通过，包含退出码硬断言校验与高亮颜色规范校验)
- **页面布局系统 4 组合与自适应降级回归**：PASSED (单页/双页切换、侧栏收起召回、双页对称间距、双页笔记查重防重复)
- **一键全量自动化测试 (`npm run test:all`)**：PASSED (语法 + 单元 + 回归一体化自动化通过)
- **静态资源安全与路径穿越防御**：PASSED (URL 解码容错、客户端根目录严格边界与路径规范化加固)
- **HTML 结构与标签平衡校验 (`node tests/regression/test_html_and_dom_audit.js`)**：PASSED (377 标签闭合，66 DOM ID 100% 匹配)
- **AI 模块彻底剥离与孤立依赖检查**：PASSED (0 孤立选择器与 AI 残余)
- **云同步废弃 API 路由隔离校验**：PASSED (/api/sync/pull 与 /api/sync/push 均精确返回 404)
- **历史残存 LocalStorage 键防御性清除**：PASSED (`aura_sync_secret`, `aura_sync_last_time`, `aura_api_key` 启动自动清除)
- **本地服务探针探测 (`http://localhost:8095/api/health`)**：PASSED (200 OK, JSON 探针健康正常)
- **生产与容器部署规范 (`deploy/` 目录)**：PASSED (Dockerfile, docker-compose.yml, deploy.sh, deploy_vps.md 路径 100% 对齐)

---

## 4. 后续演进建议 (Next Steps)

1. **更多格式增强**：可进一步增加电子书书签（Bookmark）跨章比对视图。
2. **全文搜索**：基于 IndexedDB 正文索引提供全书/全书库关键字搜索支持。

---

## 5. 待合并 / 暂缓实施清单 (Pending / Backlog Items)

| 规划项 | 现状说明 | 最终处理方案 | 状态 |
| :--- | :--- | :--- | :--- |
| **☁️ SQLite Cloud Sync 功能** | 彻底放弃并清理跨端云同步相关 API、前端同步引擎及 UI 表单。 | 全面收敛并回归 **100% Local-First** 隐私架构：IndexedDB 本地持久化 + `.aurabackup` 离线备份迁移。 | 🗑️ **已彻底移除 (Removed)** |
| **🤖 AI 辅助与结构化总结功能** | 彻底移除浮动气泡 AI 归纳、笔记区 AI 一键整理、AI 结构化总结 Tab、设置面板 AI API 配置及流式业务逻辑。 | 回归纯粹无干扰的沉浸式 Local-First 阅读与笔记体验；后续若需重新引入将重新进行产品设计与架构规划。 | 🗑️ **已彻底移除 (Removed)** |
