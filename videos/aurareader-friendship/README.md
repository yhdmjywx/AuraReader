# AuraReader · Friendship

39 秒产品动画预览工程。1920 × 1080，30 fps，1170 帧。按 [最终分镜](../../docs/remotion/friendship-final-plan.md) 制作。

## 预览

在本目录运行：

```powershell
npm run dev
```

Studio 默认预览地址：<http://localhost:3000/AuraReaderFriendship>。已有 Studio 时以终端打印地址为准。主片是 `AuraReaderFriendship`；`Scenes` 下七个分镜各有独立时间线。

本轮交付无配乐的可播放动画预览，没有导出 MP4。所有动画由帧驱动；播放、暂停、拖动时间线都得到确定的状态。界面为按产品配色、导航及实际功能制作的动画重建，经过镜头取舍和字号放大，不是桌面录屏。

## 文件

- `src/Film.tsx`：七段时间线。
- `src/scenes/`：七个分镜，分别注册为独立 composition。
- `src/design.tsx`：共用 Goal 组件、产品外壳、品牌、材料及光标。
- `src/Reader.tsx`：真实摘录、高亮、页边笔记和主动归入动作。
- `src/content.json`：已核对来源的摘录与演示笔记。
- `public/fonts/`：Inter、Lora 及各自的 OFL 许可证，预览不依赖在线字体。
- `out/review/`：关键帧及检查记录，本地生成、不纳入 Git。

## 内容约定

初始 Goal：`I want to make a new friend.`

改写同一个 Goal：`Find a friend I can talk about books with.`

两本书各一条摘录、一条原创虚构用户笔记。Goal 只关联两条笔记；高亮留在原书。第二本书通过书库打开，不演示自动建立书籍关联。三个结局平等呈现，不执行某个结局，也不承诺交友结果。

完整 EPUB、来源页面、四条批注、导入快照和 SQLite 验证位于 [交友素材包](../../docs/remotion/friendship/README.md)。

## 检查

```powershell
npm run lint
npm run review
```

关键帧脚本使用当前 Windows 安装的 Chrome；其他机器修改 `scripts/check-frames.cjs` 中的 `browserExecutable`。它只渲染静帧，不导出视频。主片长度在脚本中验证为 1170 帧。

所有素材、工程依赖和构建产物位于独立目录；未修改 AuraReader 的产品业务代码或日常数据库。
