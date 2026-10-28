# AuraReader 文档

[返回产品首页](../README.md)。README 介绍产品与使用入口；本目录承接使用细节、产品规格、数据维护和开发记录。

## 使用与维护

| 文档 | 内容 |
| --- | --- |
| [阅读、Goal 与导出](reading-guide.md) | 基本使用、Goal 导航、按键交互、页边笔记与导出规则 |
| [安装、开发与桌面验收](development.md) | 安装与源码运行、端口、构建测试、桌面阶段记录 |
| [数据与备份](data-and-backup.md) | 独立书库、IndexedDB 迁移、SQLite 一致性备份与恢复 |
| [当前状态与已知限制](known-limitations.md) | 平台、格式、离线范围、安装包及资源许可边界 |
| [产品演示](product-demo.md) | README 动画、Goal 跨书叙事、素材与更新方法 |

## 产品与技术实现

- [PRD](prd_v0_5.md)：产品定位、Goal 可选性、功能规格与验收要求。
- [Goal 书籍模块](goal-books-implementation.md)：Library、书籍关联与文件夹式导航。
- [跨书 Goal](goal-cross-book-implementation.md)：材料关联、数据与历史迁移。
- [Goal 生命周期验证](goal-lifecycle-verification-2026-10-27.md)：完成、归档、最近删除与当前交付边界。
- [Goal 侧栏](goal-sidebar-implementation.md)、[界面细化](goal-ui-refinement-guide.md)、[可见性规则](goal-visibility-improvement-plan.md)：交互演进与实现约束。
- [阅读布局](reader_layout_implementation.md)、[字体设置](font_settings_implementation.md)、[TypeScript 迁移](typescript-migration.md)：具体实现与运行边界。

## 桌面阶段与历史记录

Electron [审计](electron-desktop-audit.md)、[阶段 2](electron-desktop-stage2.md)、[阶段 3](electron-desktop-stage3.md)、[阶段 4](electron-desktop-stage4.md)、[阶段 5](electron-desktop-stage5.md)、[阶段 6](electron-desktop-stage6.md) 保留各阶段设计、检查证据和未验收项。

阶段记录、旧规划和 [历史状态记录](status.md) 描述当时版本。旧 HTML／章节 ZIP 导出、旧笔记侧栏和已被替代的首页布局不代表当前入口。阅读中的紧凑书库 Popover 与 Library 首页仍各自保留。当前使用规则见使用文档，源码与安装包的差别见已知限制；本次文档更新不重写历史验收结果。
