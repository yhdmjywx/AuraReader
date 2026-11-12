# 当前状态与已知限制

当前交付为 Windows x64 Electron 候选版与本地服务／浏览器源码模式，尚未公开发布安装包。桌面候选包未签名，安装向导逐页操作、纯净 Windows 虚拟机及签名后的系统信任流程仍未验收，详见 [安装阶段](archive/plans-and-implementation/electron-desktop-stage5.md) 与 [稳定性阶段](archive/plans-and-implementation/electron-desktop-stage6.md)。

## 阅读、资源与许可边界

当前源码仅支持单页和连续滚动，双页及其自动降级／恢复已移除，历史双页偏好启动时转为单页。此改动未重新制作安装包。

- 当前支持 EPUB 和 TXT。虽然文件选择器包含 PDF 扩展名，但尚未实现 PDF 正文解析，不应将其视为支持的阅读格式。
- “原书字体”选项暂未启用；当前 EPUB 解析流程不会完整保留出版方的样式和字体规则，复杂排版与原书可能存在差异。
- 本机字体读取已在 Windows 本地服务下验证；其他环境取决于浏览器能力和授权，无法读取时仍可导入字体文件。
- 浏览器模式的界面图标、界面字体和 JSZip 仍引用外部 CDN，不能保证完整离线启动。桌面模式使用本地图标、内置正文精选字体与 JSZip，历史阶段已验证断网启动、EPUB 导入及 ZIP 导出；当前多章导出保存为文件夹，HTML 与 ZIP 入口已撤下。
- 页边笔记排版主要在桌面窗口验证；手机等小屏设备和复杂 EPUB 尚需进一步测试。
- 启动或刷新统一进入 Goal／选书首页，不自动打开书籍。“继续阅读”仅返回本次会话已打开的正文；跨重启的阅读位置恢复尚未实现，重新选书仍从开头阅读，书籍和笔记保持保存。
- 项目代码采用 [Apache License 2.0](../LICENSE)，版权声明为 Copyright © 2026 yhdmjywx。内置字体遵循各自许可证，来源与原文见 [字体资源说明](../src/client/assets/fonts/README.md) 和其 `licenses/` 目录；第三方依赖遵循其各自许可证。测试书籍的原始声明与许可保留在 EPUB 内，不纳入项目代码的 Apache-2.0 许可范围。

## 源码与安装包的范围

Goal 侧栏与现有完整工作区的自输入及区域 UI 已接入源码；Home 打开该工作区的入口按用户决定留待后续。Response 操作与视觉仍待设计。自写内容不进入逐书 `.aurabackup`，由 SQLite 整库一致性备份覆盖。验证结果和安装包边界见[实现记录](product/goals/user-input-response/implementation.md)。

源码已支持统一首页导航及 Goal 完成、归档与最近删除；批量清空最近删除未实现，现有安装包未据此重新制作和验收。见 [生命周期交付边界](archive/verification/goal-lifecycle-verification-2026-10-27.md#当前交付边界)。

浏览器不支持文件夹保存能力时，多章 Markdown 导出提示使用桌面版，不自动回退 ZIP。`.aurabackup` 不含全局阅读设置、字体文件或原始 EPUB，也不覆盖无书籍来源的独立 Goal；见 [数据与备份](data-and-backup.md)。
