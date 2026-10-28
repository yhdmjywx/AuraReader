# Deepread 竞品分类纠错

日期：2026-10-27。对应[市场报告](market-research-2026-10-27.html)。

初版错误：依据 README 的叙述和 `Book.intention` 数据字段，将 Deepread 列作“直接意图近似”竞品，并在完整工作流与能力矩阵中给予已支持标记。这把概念相似、存在代码、用户能够实际完成流程三个不同层次混在了一起。该证据不足以支持原分类，现撤回。

用户反馈：Purpose 没有展开交互；从 GitHub 拉取、npm install 后仍运行失败。这是本项目用户的实测反馈。本次没有取得其运行日志或复现其具体版本、环境，不推测失败原因，也不宣称所有环境均无法运行。

本次补查固定提交 `5c1e46c9a5cb8eaa2b88a561febf693267378e19`：

- [ReadingView.tsx](https://github.com/AyingAI/deepread/blob/5c1e46c9a5cb8eaa2b88a561febf693267378e19/components/ReadingView.tsx#L930)：Purpose 是单书文字；代码存在点击文字后编辑的事件，621–631 行保存到书籍元数据。这只能证明存在编辑代码，不能反驳用户遇到的运行/交互问题。
- [RitualView.tsx](https://github.com/AyingAI/deepread/blob/5c1e46c9a5cb8eaa2b88a561febf693267378e19/components/RitualView.tsx)：有读前填写一句意图的表单代码。
- [App.tsx](https://github.com/AyingAI/deepread/blob/5c1e46c9a5cb8eaa2b88a561febf693267378e19/App.tsx)：根据该书是否已有意图切换填写页或阅读页。
- 阅读组件将意图文字用于导出、回顾展示和 AI 请求参数；这些代码引用没有证明它具备独立 Goal、子 Goal、意图书库或跨书材料归属系统，也没有经过本次运行验收。

因此，准确的静态描述是“有单书阅读目的文本及相关代码引用”。不能上升为“已经交付与 AuraReader 相近的意图驱动工作台”，也不能用它来削弱 AuraReader 完整 Goal 系统的差异。

本次修正：

1. 从“直接竞品”、完整工作流比较、产品规模比较和能力矩阵中移除 Deepread。
2. 撤回用它证明“为什么读已有直接近似”的摘要结论，以及将字段差异当作市场差异的论证。
3. 在开源附录保留其仓库与许可证事实，明确仅为可用性未验证的概念参照，加入用户运行失败反馈。
4. Canto 仅有商店功能声明，同样改为待实测候选，不能据此断言已有等价 Goal 流程。
5. 更正证据标准：仓库存在、许可证明确、推送活跃都不是功能验收；真实竞品价值还需看可获得性、可用性、完整替代流程及用户采用证据。

这一纠错不意味着 AuraReader 没有竞争。Readwise、Zotero、MarginNote、LiquidText 等提供不同程度的阅读与材料组织替代；但其实际替代成本、体验强弱仍需实测，初版的公开资料研究不能替代这些验证。
