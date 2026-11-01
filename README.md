# AuraReader

[中文](README.zh-CN.md)

**A reading workspace centered on the reader**

Reading begins with your own intentions. As you gather material across books and leave thoughts beside the text, those intentions can grow or fade away.

## Product Demo

![The full lifecycle of a Goal: creating it, linking notes from two books, and revising its purpose](docs/assets/goal-lifecycle.gif)

In 39 seconds, see how a Goal takes shape, brings together material across books, and changes through reading. The animation recreates the interface based on actual features; see the [demo notes and sources](docs/product-demo.md).

## Why AuraReader?

**Let your own intentions guide your reading, with the freedom to move beyond any book or fixed goal.**

AuraReader aims to keep you in charge of your reading: start from your own intentions, form your own connections as you read, and freely decide where to go next.

- **Reading starts with you.** Read for research, exploration, relaxation, or without a clear purpose. You do not need to define a use for your reading in advance or prove that it will produce results.
- **Connect ideas across books and pages.** Passages from different parts of a book, or from different books, can come together around your purpose. Follow your interests and weave material into your own thinking.
- **Purposes can grow or come to an end.** A Goal can be rewritten as you read, branch into sub-Goals, be set aside or deleted, or never be created at all. New discoveries can change your initial ideas; you decide whether to keep following the same direction.
- **Keep your own voice in your reading.** In-text highlights and margin notes let you express and edit your interests and thoughts beside the original text. Link them to Goals as you choose, keeping reading, thinking, and the development of your purposes connected.

## Core Features

- **Evolving Goals and organization across books**: Describe your reading purposes in your own words, associate books with them, and bring highlights and notes from different books and passages into the same Goal. Goals exist independently of books. You can revise them as you read, branch them into sub-Goals, and complete, archive, delete, or restore them. Start with a purpose, discover one through reading, or read without a Goal.
- **In-text highlights and margin notes**: Highlight passages that matter to you and record or edit your thoughts beside them. Notes follow the currently visible text to keep reading and writing connected. Link highlights and notes to Goals as you choose, review material around a shared purpose, and return to the original passage whenever you want to continue reading.
- **Read your way**: Read EPUB and TXT files in single-page or continuous scrolling mode. Adjust fonts, text size, indentation, and reading backgrounds. Use bundled fonts, system fonts, or fonts you import yourself to suit your reading habits.
- **Local storage and combined exports**: Books, Goals, highlights, and notes are stored on your device. Export book text, highlights, and notes together as Markdown organized by chapter, preserving quotations and context for use in other editors and platforms. You can also export per-book backups to restore books and their associated reading content in AuraReader.

For instructions, see [Reading, Goals, and Export](docs/reading-guide.md). For backup coverage, see [Data and Backups](docs/data-and-backup.md).

## Get Started

AuraReader currently targets PCs and supports EPUB and TXT. The Windows x64 Electron desktop app is at the release candidate stage; its installer is unsigned and has not been publicly released. You can also run it from source. Source development requires **Node.js ≥ 24.15.0** and has been verified on Windows with Node.js 24.16.0.

Run these commands in the project root:

```powershell
npm ci
npm run desktop
```

On first launch, click “Create local library” to reach the Goal and book selection home page. You can create a Goal first or import a book and start reading. Later launches also open the home page so you can choose a book. While reading, click the AuraReader logo in the upper-left corner to return home; “Continue reading” returns to the book and position from the current session.

For browser mode, run `npm start` after installing dependencies and open [localhost:8095](http://localhost:8095/). Keep the service running while you use the app. A recent version of Chrome or Edge is recommended. See the [development guide](docs/development.md) for more on installation, ports, and packaging.

## Documentation

The linked documents are currently in Chinese.

- [Reading, Goals, and Export](docs/reading-guide.md)
- [Installation, Development, and Desktop Acceptance Checks](docs/development.md)
- [Data, Migration, and Backups](docs/data-and-backup.md)
- [Product Requirements and Principles (PRD)](docs/prd_v0_5.md)
- [Known Limitations](docs/known-limitations.md)
- [Technical Implementation and Documentation Index](docs/README.md)

## License

The project code is licensed under the [Apache License 2.0](LICENSE). Bundled fonts, third-party dependencies, and demo books follow their respective licenses; see the [resource notes](docs/known-limitations.md#阅读资源与许可边界) and [demo sources](docs/product-demo.md#素材与更新).
