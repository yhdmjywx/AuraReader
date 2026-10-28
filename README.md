# AuraReader

**以阅读者为主体的阅读工作台**

按照自己的意图阅读，让跨越书籍的材料、原文旁的想法与持续发展的阅读目的联系起来。

## 产品演示

![Goal 从建立、关联两本书的笔记到改写目的的完整过程](docs/assets/goal-lifecycle.gif)

39 秒看一个 Goal 如何建立、关联跨书材料，并随着阅读而改变。动画按实际功能重建界面；[演示说明与素材来源](docs/product-demo.md)。

## Why AuraReader?

阅读可以为了研究、探索或放松，也可以没有明确目的。读什么、关注什么、哪些内容彼此相关，都由读者决定。AuraReader 将阅读、表达和组织材料放在同一个工作台里，让你的想法留在原文旁，也能随着阅读继续发展。阅读成果可以带走，在其他编辑器和平台继续使用。

## Core Features

- **Goal 系统**：让同一个阅读目的联系起不同书籍、不同位置的内容。你可以先建立 Goal，再添加书籍和材料，也可以在阅读中产生目的，改写它或展开为子 Goal。**Goal 完全可选；不设置 Goal，仍可自由阅读、高亮和记笔记。**
- **页边笔记与高亮**：在原文中选择关注的文字，直接在旁边记录、编辑想法。笔记跟随当前可见正文，保持阅读与思考连贯，并可回到对应原文。
- **本地导出**：将书籍正文、高亮与笔记整合为 Markdown，保留引用与上下文；也可逐书备份，在 AuraReader 中恢复阅读。

## Get Started

当前面向 PC，支持 EPUB、TXT。Windows x64 Electron 桌面版处于候选阶段，安装包未签名、尚未公开发布；也可从源码运行。需 **Node.js ≥ 24.15.0**，已在 Windows / Node.js 24.16.0 验证。

在项目根目录运行：

```powershell
npm ci
npm run desktop
```

首次启动点击“创建独立桌面书库”，随后导入书籍即可阅读。

浏览器模式：依赖安装后运行 `npm start`，打开 [localhost:8095](http://localhost:8095/)，使用期间保持服务运行，建议使用近期 Chrome / Edge。更多安装、端口与打包说明见 [开发文档](docs/development.md)。

## Documentation

- [阅读、Goal 与导出](docs/reading-guide.md)
- [安装、开发与桌面验收](docs/development.md)
- [数据、迁移与备份](docs/data-and-backup.md)
- [产品需求与原则（PRD）](docs/prd_v0_5.md)
- [已知限制](docs/known-limitations.md)
- [技术实现与文档索引](docs/README.md)

## License

项目代码采用 [Apache License 2.0](LICENSE)。内置字体、第三方依赖与演示书籍遵循各自许可，见 [资源说明](docs/known-limitations.md#阅读资源与许可边界) 和 [演示来源](docs/product-demo.md#素材与更新)。
