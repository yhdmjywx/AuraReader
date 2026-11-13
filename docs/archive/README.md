# 历史方案、实施与验证记录

本目录收纳阶段性过程文档。归档日期：2026-11-03。现行使用与设计依据见 [文档首页](../README.md)。

## 方案与实施记录

- [Electron Windows 桌面迁移：阶段 1 审计与基线](plans-and-implementation/electron-desktop-audit.md)
- [Electron Windows 桌面迁移：阶段 2 桌面外壳](plans-and-implementation/electron-desktop-stage2.md)
- [Electron Windows 桌面迁移：阶段 3 SQLite 与 IPC](plans-and-implementation/electron-desktop-stage3.md)
- [Electron Windows 桌面迁移：阶段 4 字体、书籍文件和导出](plans-and-implementation/electron-desktop-stage4.md)
- [Electron Windows 桌面迁移：阶段 5 安装与打包](plans-and-implementation/electron-desktop-stage5.md)
- [Electron Windows 桌面迁移：阶段 6 本地验证](plans-and-implementation/electron-desktop-stage6.md)
- [AuraReader 字体设置实现说明](plans-and-implementation/font_settings_implementation.md)
- [Goal 创建与选书：实现和桌面验收](plans-and-implementation/goal-books-implementation.md)
- [Goal 添加书籍：最小模块设计](plans-and-implementation/goal-books-module-design.md)
- [跨书 Goal 与独立页面实现记录](plans-and-implementation/goal-cross-book-implementation.md)
- [Goal 下一阶段实施计划：跨书延续与独立 Goal 页面](plans-and-implementation/goal-cross-book-sidebar-plan.md)
- [Goal Sidebar 实现记录](plans-and-implementation/goal-sidebar-implementation.md)
- [Goal 模块代码实现计划（以最终效果稿为准）](plans-and-implementation/goal-system-implementation-plan.md)
- [Goal 模块实现记录](plans-and-implementation/goal-system-implementation.md)
- [Goal UI 渐进优化指导](plans-and-implementation/goal-ui-refinement-guide.md)
- [Goal 可视性与操作可辨识改进方案](plans-and-implementation/goal-visibility-improvement-plan.md)
- [统一首页与导航：改动计划](plans-and-implementation/home-navigation-change-plan-2026-10-28.md)
- [AuraReader 阅读区域排版优化实现文档](plans-and-implementation/reader_layout_implementation.md)
- [TypeScript migration](plans-and-implementation/typescript-migration.md)
- [AuraReader 产品影片最终制作计划：I want to make a new friend.](plans-and-implementation/friendship-final-plan.md)
- [AuraReader 交友主题影片：首版制作记录](plans-and-implementation/friendship-production.md)

## 验收与验证记录

- [Electron 关闭生命周期修复与验证 — 2026-11-13](verification/electron-lifecycle-2026-11-13.md)
- [Electron 构建与资源兼容性修复 — 2026-11-12](verification/electron-compatibility-2026-11-12.md)
- [Windows unpacked desktop package verification — 2026-10-30](verification/desktop-package-verification-2026-10-30.md)
- [产品文案统一英文：实现与验证](verification/english-ui-verification-2026-10-30.md)
- [Figma 页面差异与验证](verification/figma-ui-verification-2026-11-03.md)
- [Goal 生命周期验证记录](verification/goal-lifecycle-verification-2026-10-27.md)
- [首页与导航实施及验证记录](verification/home-navigation-verification-2026-10-28.md)
- [阅读导航与 Goal 引用展示验证](verification/reading-ui-verification-2026-11-03.md)

## 保留与每月清理

- 每月复核一次，默认每月 1 日 10:00（Asia/Shanghai）。新增阶段记录直接放入对应子目录并更新本索引。
- 仍被现行文档引用的行为约定继续有效，尤其是 Goal 首版契约、跨书与共享编辑器方案、书籍关系设计；迁移目录不代表废止。
- 未完成验收、未解决缺陷、独有实现依据及唯一验证证据继续保留，不按文件年龄直接删除。
- 仅清理已被替代、无现行引用且无独有约定或未结事项的重复过程记录。删除前确认文件已进入 Git 历史；同步修正引用与索引，检查链接。
- 不清理现行规范、研究、原型、演示素材和业务数据；不推送或发布。

本次仅归档和修正路径，未删除历史内容，也未重新执行历史产品验收。
