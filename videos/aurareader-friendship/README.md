# AuraReader · Friendship

39 秒产品动画预览工程。1920 × 1080，30 fps，1170 帧。按 [最终分镜](../../docs/remotion/friendship-final-plan.md) 制作。

## 预览

在本目录运行：

```powershell
npm run dev
```

Studio 默认预览地址：<http://localhost:3000/AuraReaderFriendship>。已有 Studio 时以终端打印地址为准。主片是 `AuraReaderFriendship`；`Scenes` 下七个分镜各有独立时间线。

工程提供无配乐的可播放动画预览，并可导出 MP4 和循环 GIF。所有动画由帧驱动；播放、暂停、拖动时间线都得到确定的状态。界面为按产品配色、导航及实际功能制作的动画重建，经过镜头取舍和字号放大，不是桌面录屏。

## 视频与 GIF 导出

```powershell
npm run export:media
```

输出到 `out/exports/`：

- `AuraReader-Friendship-1080p.mp4`：1920 × 1080、30 fps、H.264、39 秒、无音轨。
- `AuraReader-Friendship-720p.gif`：1280 × 720、15 fps、完整 39 秒、无限循环。
- `export-checks.json`：容器时长、帧数、尺寸与完整解码检查记录。

脚本使用独立无头 Chrome 渲染 MP4，再用本机 FFmpeg 的调色板流程生成 GIF，并完整解码检查两个输出；不依赖 Studio 是否正在运行。完成后可直接分享这两个文件。

## 文件

- `src/Film.tsx`：七段时间线。
- `src/scenes/`：七个分镜，分别注册为独立 composition。
- `src/design.tsx`：共用 Goal 组件、产品外壳、品牌、材料及光标。
- `src/Reader.tsx`：真实摘录、高亮、页边笔记和主动归入动作。
- `src/layout.ts`：1440 × 960（3∶2）应用窗口与正文栏的共用几何。
- `src/reading-pages.json`：每本书连续的原文片段，自然排版约 15 行；无手工换行。
- `src/content.json`：已核对来源的摘录与演示笔记。
- `public/fonts/`：Inter、Lora 及各自的 OFL 许可证，预览不依赖在线字体。
- `public/covers/`：两本对应官方 EPUB 中声明的原始封面，以及来源文件、作者和哈希记录。运行 `npm run prepare:covers` 可重新提取。
- `out/review/`：关键帧及检查记录，本地生成、不纳入 Git。

## 内容约定

初始 Goal：`I want to make a new friend.`

改写同一个 Goal：`Find a friend I can talk about books with.`

两本书各一条摘录、一条原创虚构用户笔记。添加镜头同时列出两本书及封面，分别添加后并排展示两张卡片，再打开第一本；第二本之后从书库切换。Goal 只关联两条笔记；高亮留在原书，不演示自动建立关联。三个结局平等呈现，不执行某个结局，也不承诺交友结果。

完整 EPUB、来源页面、四条批注、导入快照和 SQLite 验证位于 [交友素材包](../../docs/remotion/friendship/README.md)。

## 检查

```powershell
npm run lint
npm run review
```

正文页面可在仓库依赖已安装时运行 `npm run prepare:pages` 重建。脚本读取已验证的完整书籍，使用本地 Lora 字体的真实字宽估算自然换行，并保留连续原文；末段可像普通分页一样在页底结束。不会改写原书或插入凑行文本。

2026-10-27 窗口比例修订：调整前版本已提交为 `ca7e66e`。新版将应用窗口恢复为 3∶2，阶段文案放到侧边，阅读中逐渐隐去；高亮和周围正文统一为 25px，页面约 15 行。镜头只作 2.5–3.5% 的等比推进，保留 Goal、正文和页边笔记。主片仍为 39 秒。新版审阅帧保存在 `out/review-tall/`，原审阅帧留在 `out/review/`。

关键帧脚本使用当前 Windows 安装的 Chrome；其他机器修改 `scripts/check-frames.cjs` 中的 `browserExecutable`。它只渲染静帧，不导出视频。主片长度在脚本中验证为 1170 帧。

所有素材、工程依赖和构建产物位于独立目录；未修改 AuraReader 的产品业务代码或日常数据库。
