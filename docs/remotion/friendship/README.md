# 交友主题素材包

对应 [最终制作计划](../friendship-final-plan.md) 和 [Remotion 工程](../../../videos/aurareader-friendship/README.md)。

## 书籍与内容

1. **Anne of Green Gables — L. M. Montgomery**，使用第 VIII 章 `Anne’s Bringing-up Is Begun`。核心摘录：`do you think that I shall ever have a bosom friend in Avonlea?`。演示笔记：`I want someone I can really talk to.`
2. **The Art of Conversation: Twelve Golden Rules — Josephine Turck Baker**，使用 `Golden Rule Number VII`。核心摘录：`Choose subject of mutual interest.`。演示笔记：`I could ask her what she’s reading.`

摘录是英文原文；笔记是为影片创作的虚构用户内容，不是作者观点或真实用户成果。两本书的笔记归入同一个 Goal，不建立子 Goal。

## 来源

- [Anne 官方书目／免费 EPUB](https://www.gutenberg.org/ebooks/45)
- [Conversation 官方书目／免费 EPUB](https://www.gutenberg.org/ebooks/63995)
- [Project Gutenberg 许可说明](https://www.gutenberg.org/policy/license.html)

官方目录标明两本英文作品在美国属于公版。`sources/` 保留完整官方 EPUB、原版权说明、书目页面和许可页面；SHA-256 见 `source-manifest.json`。未添加现代译文或第三方商业封面。不同发布地的法律适用不由美国公版标注统一替代。

## 导入快照

在隔离演示书库中使用以下文件，不混入日常书库。原书 EPUB 与备份选择一种导入，避免同一本书出现两个副本。

- `imports/00-clean/`：两份逐书备份，只有原书，无 Goal、无高亮、无笔记，用于从头演示创建及阅读。
- `imports/01-after-anne/anne.aurabackup`：第一本读后状态，初始 Goal、一条高亮、一条笔记，笔记已关联。
- `imports/02-final/`：先后导入两份逐书备份，恢复为同一个已改写 Goal、两条跨书笔记；每书仍有独立高亮。两本书都具有添加镜头中明确演示的主动书籍关联。

这些备份是场景定位素材。再次导入早期快照不会保证删除后来新增的所有内容；倒拍、重拍请使用新的隔离演示书库。

`demo-content.json` 包含每条摘录的真实源文档页、字符偏移和上下文。Anne 在所下载 EPUB 的源文档第 10 页，Conversation 在第 2 页；源文档编号不等同于第 VIII 章／第 VII 条规则。

## 重建与验证

项目根目录运行：

```powershell
node docs/remotion/friendship/prepare-materials.cjs
```

脚本复用当前 AuraReader EPUB 导入器，验证精确引文范围，并在独立临时 SQLite 库中验证两书备份恢复与完整性，不接触日常数据库、不启动 HTTP 服务。结果见 `validation.json`。
