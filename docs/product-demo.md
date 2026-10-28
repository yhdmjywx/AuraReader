# 产品演示：一个 Goal 如何随着阅读发展

README 复用现有 **AuraReader · Friendship** Remotion 作品，展示从建立目的、关联书籍及笔记，到重新表达目的的完整过程。它是经过镜头取舍和字号放大的界面动画重建，不是桌面录屏或逐键操作教程。

## 当前演示

[查看完整循环动画](assets/goal-lifecycle.gif)：39 秒，1280 × 720，15 fps，585 帧，无限循环，约 16.3 MiB。仓库内保留这份可直接展示的副本，README 不依赖本机被忽略的 `out/` 目录或临时服务。

1. 建立 `I want to make a new friend.`。
2. 添加《Anne of Green Gables》与《The Art of Conversation: Twelve Golden Rules》两本书。
3. 在两本书中分别高亮、写页边笔记，再由读者主动把笔记归入同一个 Goal；不演示系统自动判断关联。
4. 回看跨书材料，将同一个 Goal 改写为 `Find a friend I can talk about books with.`。
5. 平等展示不同后续方向；不替读者选择，也不承诺交友结果。

本片展示的是阅读目的的发展。完成、归档、最近删除等当前源码能力另见 [生命周期验证](goal-lifecycle-verification-2026-10-27.md)，不应暗示它们都出现在这支影片中。README 与演示周围的产品文字必须明确 **Goal 完全可选**，未建立 Goal 时仍可自由阅读、高亮和记笔记。

## 素材与更新

- [最终分镜](remotion/friendship-final-plan.md)、[制作说明](remotion/friendship-production.md)。
- [Remotion 工程与导出方法](../videos/aurareader-friendship/README.md)。
- [书籍、摘录、虚构笔记与许可来源](remotion/friendship/README.md)。笔记是为影片创作的用户内容；原书、封面和字体沿用各自的来源与许可，不一并改为项目代码许可。

2026-10-28 从已有导出复用 GIF，未重新制作或重新渲染影片。原导出记录为 `out/exports/export-checks.json`：39 秒、GIF 585 帧、MP4 1170 帧，两个文件均曾通过 FFmpeg 完整解码检查；这些是既有导出的证据，不表示本次重新验收产品或安装包。复制后的 GIF 应与原导出 SHA-256 一致。

需要更新时，在 Remotion 工程目录执行已有 `npm run export:media`；核对时间、尺寸、帧数、关键画面和完整解码后，再用新的 720p GIF 更新 `docs/assets/goal-lifecycle.gif`。保持书名、原文、主动关联和 Goal 改写前后关系一致；媒体失效时先如实标记状态，不保留断链或把尚未交付的能力写成现成功能。

## README 的组织依据

首页按“产品定位 → 演示 → 核心价值 → 能力概览 → 使用入口 → 文档 → 许可”组织，规格、开发日志与数据库维护进入文档。参考的是组织方式，产品内容以 AuraReader 实际能力为准。

- [Cap README](https://github.com/CapSoftware/Cap)：先产品价值和使用入口，再开发与许可。
- [MarkText README](https://github.com/marktext/marktext)：简短定位、截图、能力概览与安装入口。
- [LocalSend README](https://github.com/localsend/localsend)：快速说明是什么、能做什么及如何开始。
- [Puter README](https://github.com/HeyPuter/puter)：清晰愿景，并区分用户与开发者关心的内容。
