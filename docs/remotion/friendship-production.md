# AuraReader 交友主题影片：首版制作记录

2026-10-27。依据 [最终分镜](friendship-final-plan.md) 完成 39 秒无配乐动画预览。

## 交付

- [独立 Remotion 工程](../../videos/aurareader-friendship/README.md)，官方脚手架，Remotion 4.0.539。
- 主片 `AuraReaderFriendship`：1920 × 1080、30 fps、1170 帧；七个分镜同时注册独立时间线。
- Studio 预览：<http://localhost:3000/AuraReaderFriendship>。本轮已启动服务并请求在 Codex 浏览器面板打开。自动化浏览器连接 localhost 超时，面板打开请求返回 queued，因此未声称通过自动浏览器完整播放验收。
- [交友素材包](friendship/README.md)：两本官方完整 EPUB、原文／书目／许可页面、两条精确摘录、两条原创虚构用户笔记、四条批注与五份逐书场景快照。

## 影片内容

同一个 Goal 从 `I want to make a new friend.` 改写为 `Find a friend I can talk about books with.`。Book A 带来情感认同，Book B 带来交流思路；两个来源的笔记保留在同一节点，结尾并列呈现 Achieve、Archive、Delete。

界面采用基于现有产品配色、导航、书籍卡片、侧栏及页边笔记的 React 动画重建，包含镜头放大与视觉取舍，不是桌面录屏。没有新增、修改 AuraReader 业务功能或使用日常数据库。未虚构独立生活日志、自动关联、自动进度或真实交友成果。

## 验证

- `npm run lint`：ESLint、严格 TypeScript 检查通过。
- Remotion 实际渲染 30 个关键帧及分镜边界，包含最后一帧 1169；验证 1170 帧、30 fps、1920 × 1080。
- 已查看创建、书籍加入、阅读归入、两条跨书材料、改写后的 Goal、结尾选择、品牌及转场关键帧。根据画面修复第一本书正文越出阅读区的问题，并调整光标移动、卡片收放和阅读区退场。
- `out/review/checks.json` 保存帧列表，PNG 位于同目录。
- 两个 EPUB 通过当前 AuraReader 导入器；摘录范围精确匹配。使用独立临时 SQLite 库验证两份最终备份可恢复为一个 Goal、两条跨书材料，并通过实际数据库完整性检查。结果见 [素材验证](friendship/validation.json)。

## 当前边界

首版制作时交付可播放的无配乐预览；之后按用户要求完成 MP4 与 GIF 导出，详见下方导出记录。声音制作和后续视觉修改另按用户反馈进行。

## 窗口比例与阅读密度修订

用户确认先提交原版，再采用“恢复真实窗口比例＋适度镜头推进”，正文自然排成约 15 行。

- 原版检查点：`ca7e66e`，`chore(video): snapshot 39-second friendship preview`。仅提交视频工程及其素材、文档；没有夹入已有市场调研等其他改动。
- 应用窗口从 1696 × 684 改为 **1440 × 960，3∶2**。影片画布保持 1920 × 1080。
- 阶段标题缩小放到左侧；阅读与跨书阶段适时淡出，让应用占据画面高度。
- 两本书都从真实章节取连续正文，用 Lora 的字宽计算自然换行，实拍关键帧各为 **15 行正文**。段落末端采用普通分页截断，不添加手工断行、重复句子或填充文字。
- 正文统一 25px、40px 行高；选中文本不额外放大。页边笔记按选区位置对齐，Goal 和两个来源的材料保留。
- 阅读期间加入 2.5–3.5% 的等比镜头推进，窗口不拉伸。
- ESLint、TypeScript 检查通过；已生成 14 张新版关键帧并查看创建、加书、两本书的阅读及归入画面。新帧位于 `videos/aurareader-friendship/out/review-tall/`。
- 原有 3002 端口 Studio 已热更新，主片仍为 1170 帧／39 秒。

## 开场愿望与第 1、2 段衔接

按用户要求将开场改为 `I want to make a new friend.`。同一份 Goal 文字从深色开场收拢为卡片，再展开进入创建编辑器。第二段不再清空、重输这句话；卡片、文字位置和尺寸使用同一组全局时间插值，跨过第 89／90 帧时连续。编辑焦点与 Create 操作在界面落位后出现。已渲染 15 个开场／交界帧检查，包括第 89、90、91 帧；审阅文件位于 `out/review-opening/`。

## 添加两本书及原始封面

按用户要求，添加时的列表同时展示两本书、作者和封面；分别主动添加后并排显示两张书籍卡片，再打开第一本书。后续书库切换列表使用同一组封面。图片从对应官方 EPUB 的 OPF `cover-image` 条目中原样提取，完整等比显示；没有套用其他作者或版本封面。来源与 SHA-256 见 `videos/aurareader-friendship/public/covers/sources.json`。

最终导入快照同步为两本书都主动关联同一个 Goal。ESLint／TypeScript 检查通过，已渲染 9 个相关关键帧，人工检查选书列表、并排封面卡片和后续切书画面；审阅帧位于 `out/review-covers/`。主片仍为 39 秒。

## MP4 与 GIF 导出

按用户要求完成当前版本的完整导出，包含新开场、3∶2 应用窗口、约 15 行正文和两本真实封面。

- MP4：`videos/aurareader-friendship/out/exports/AuraReader-Friendship-1080p.mp4`，H.264，1920 × 1080，30 fps，1170 帧，39.000 秒，6,668,825 字节，无音轨。
- GIF：`videos/aurareader-friendship/out/exports/AuraReader-Friendship-720p.gif`，1280 × 720，15 fps，585 帧，39.000 秒，17,044,828 字节，无限循环。
- 两个输出均通过 FFprobe 尺寸／帧数／时长核对，以及 FFmpeg 完整解码检查；已查看从实际导出文件解码的封面画面，内容、颜色和比例正常。
- 检查记录：`out/exports/export-checks.json`。可在视频工程目录运行 `npm run export:media` 重建。
