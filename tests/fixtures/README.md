# 测试 EPUB 素材

`test.epub` 是用户提供的 `pg11-images-3.epub` 的完整副本，未修改书内文件。

- 书名：Alice's Adventures in Wonderland（《爱丽丝梦游仙境》）
- 作者：Lewis Carroll
- 来源：Project Gutenberg，电子书编号 11，https://www.gutenberg.org/ebooks/11
- 语言：英文（`en`）
- 格式：EPUB 3，附带 EPUB3 nav 和 NCX 目录
- 目录：16 个平级条目，其中包括 12 章正文及 Project Gutenberg 许可条目
- 书内权利声明：`Public domain in the USA.`

书内完整的 Project Gutenberg 声明与许可原样保留。该声明限定美国公有领域状态；在其他地区使用或分发时应参照书内许可及当地规定。素材不属于项目代码的 MIT 许可范围。

测试使用本文件验证目录解析、锚点和正文顺序映射。嵌套目录使用单元测试中的自写 XML / HTML 样例验证，不依赖商业出版版本。
