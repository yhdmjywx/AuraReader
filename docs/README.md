# AuraReader 文档

[返回产品首页](../README.md)。README 介绍产品与使用入口；本目录承接使用细节、产品规格、数据维护和开发记录。

## 使用与维护

| 文档 | 内容 |
| --- | --- |
| [阅读、Goal 与导出](reading-guide.md) | 基本使用、Goal 导航、按键交互、页边笔记与导出规则 |
| [安装、开发与桌面验收](development.md) | 安装与源码运行、端口、构建测试、桌面阶段记录 |
| [数据与备份](data-and-backup.md) | 独立 SQLite 书库、一致性备份与恢复 |
| [当前状态与已知限制](known-limitations.md) | 平台、格式、离线范围、安装包及资源许可边界 |
| [产品演示](product-demo.md) | README 动画、Goal 跨书叙事、素材与更新方法 |

## 现行产品与设计依据

- [PRD](prd_v0_5.md)：产品定位、功能规格与验收要求。
- [Goal 定位](goal-positioning-correction-2026-10-27.md)：读者意图与产品原则。
- [Goal 用户自输入与 Response MVP](product/goals/user-input-response/feature-spec.md)：统一内容组织、保留 Link 组件、产品提供的可选 Response 标签；需求已确认，交互待设计，尚未实现。
- [Wiki 功能](product/wiki/README.md)：原词查询与手动切换词条语言版本的 MVP，含用户指定 Figma 设计、API 范围和验收；尚未实现。
- [设计系统](design/design-system.md)：唯一现行 UI/UX 规范，包含全局原则、局部约束和待确认问题。
- [设计索引](design/design-index.md)：Figma 入口、组件与交互状态索引、设计完成情况。
- [设计决策](product/decisions/README.md)：批准范围、变更记录与必要历史原因。
- [项目概况](agents/project-profile.md)：技术栈、命令、行为契约与文档位置。

## 历史记录

历史方案、实施记录和验收记录统一放入 [archive](archive/README.md)，按两类分目录，索引与每月清理规则见该页。

历史记录描述当时版本，不代表当前入口或最新验收结果。其中仍被现行规范引用的行为约定、未完成验收的证据继续保留；归档不使这些约定失效。
