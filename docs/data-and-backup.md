# 数据与备份

桌面与浏览器模式各有独立的 SQLite 书库。桌面数据位于 `%APPDATA%\AuraReader\data`，下文的项目 `data/` 和命令行维护适用于 Node.js 本地服务与浏览器模式。桌面范围见 [开发与桌面验收](development.md)。

## 存储与备份边界

- 书籍解析结果、高亮和笔记由本地 Node.js 服务保存在 **`data/aurareader.sqlite`**。书籍和标注分别保存完整 JSON 对象，标注关联书籍；该目录不纳入 Git。应用不提供云同步或 AI 服务。
- 阅读偏好仍保存在浏览器 localStorage；保存失败时只保留尚未确认的操作作为短期恢复缓冲，成功后清理，不维持整书缓存或第二套主数据库。遇到保存冲突时，输入会保留在本机，请保留页面并处理冲突，勿清理站点数据。
- 用户导入的字体由本地服务保存到项目的 `data/fonts/`，该目录不纳入 Git。迁移应用目录时，如需保留这些字体，应一并复制该目录。
- `.aurabackup` **每个文件对应一本书**，保存解析后的正文、目录、相关 Goal 根树，以及可选择包含的高亮和笔记。批量选择多本书会分别生成文件。1.3 版在全局 Goal 图中增加本文件书籍的主动关联；逐本恢复保留其他书的关联。取消“包含高亮与笔记”时仍备份 Goal 文字、层级和主动添加的书籍关系，只省略材料关联。兼容旧 1.0–1.2；旧文件缺少字段不会清空已有关系。
- 完全没有书籍来源、材料或主动书籍关联的独立 Goal，由 **SQLite 一致性备份**覆盖，不包含在任意每书 `.aurabackup` 中。SQLite v4 扩展已有全局 Goal JSON；原 v2 书内 Goal 仍按稳定 ID 事务式迁移，书籍和标注 JSON 不重写。删除书籍清理其材料及书籍关联，删除笔记只清理对应材料关联；保留 Goal 文字与树。历史实现见 [跨书 Goal 实现记录](archive/plans-and-implementation/goal-cross-book-implementation.md)。
- 书籍备份不包含全局阅读设置、自定义字体文件，也不是原始 EPUB 文件的逐字节副本。建议另行保留原始 EPUB。
- Goal 自写内容属于全局 Goal，不进入逐书 `.aurabackup`。逐书恢复保留目标库已有自写记录；SQLite 一致性备份覆盖全部已保存记录。当前 SQLite v5 在事务中扩展 Goal JSON，保留旧命令的 `opId` 与重放身份；不重写书籍、标注正文。旧版本拒绝打开更高版本数据库的保护继续生效。未确认保存的自写草稿仍在本机恢复缓冲中，不等于已进入数据库备份。见[实现记录](product/goals/user-input-response/implementation.md)。
- 更换设备或替换项目目录前，请导出书籍备份，或完成 SQLite 一致性备份并妥善保留整个 `data/` 目录。清理浏览器数据不会删除已确认写入 SQLite 的书库，但会删除阅读偏好和尚未写入成功的恢复缓冲。

### 浏览器启动与旧版数据

浏览器通过本地会话直接打开 SQLite 书库，旧 IndexedDB 及其历史迁移状态不参与启动。只存于旧 IndexedDB 的书籍和标注仍留在原浏览器数据中。

### 数据库校验与备份

```powershell
node src/server/storageMaintenance.js verify
node src/server/storageMaintenance.js backup
```

`backup` 使用 SQLite 在线备份接口，在 `data/backups/` 生成可独立打开并通过完整性校验的 `.sqlite` 文件，包含备份时已提交的数据。不要只复制正在运行的主文件而遗漏 WAL。

恢复备份前先停止服务，保留现有 `data/` 整体副本，在隔离目录验证备份后再替换数据库；不要覆盖运行中的库或遗留旧的 WAL/SHM 文件。`storage-installed.json` 用于识别已建立的书库；若数据库丢失／为空，服务会停止，避免悄悄新建空库。可用 SQLite 一致性备份恢复整库，或用书籍备份恢复单本书。

## Goal 生命周期数据

当前源码已保存 Goal 完成、归档、最近删除及恢复相关状态；每书备份图的验证范围见 [生命周期记录](archive/verification/goal-lifecycle-verification-2026-10-27.md)。每书备份仍不能替代覆盖无书籍来源独立 Goal 的 SQLite 一致性备份。
