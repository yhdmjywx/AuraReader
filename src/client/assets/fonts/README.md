# 阅读字体资源与许可

仅内置更纱黑体和 Literata，随应用打包，由本地服务提供，不依赖在线字体 CDN。Literata、本机及用户导入字体缺失的中文字形由更纱黑体回退补齐。

| 菜单名称 | 字体家族 | 来源 | 本地资源 |
| --- | --- | --- | --- |
| 更纱黑体 | Sarasa Gothic SC | [Sarasa Gothic v1.0.42](https://github.com/be5invis/Sarasa-Gothic/releases/tag/v1.0.42)，SC Unhinted 原始发行包 | `sarasa-regular`、`sarasa-bold`、`sarasa-italic`、`sarasa-bold-italic` |
| Literata | Literata | [Google Fonts Literata](https://github.com/google/fonts/tree/main/ofl/literata) | `literata`、`literata-italic` |

资源采用 WOFF2，由原始 TTF 压缩打包，保留完整字符集、字体名称、排版表与作者及许可证元数据，不做字形裁剪。更纱黑体包含常规、粗体、斜体和粗斜体四份字库；Literata 包含常规和斜体两份可变字重字库，共六个字体文件。

两套字库均附带原始 SIL Open Font License 1.1 文本，见 `licenses/`。字库作为 AuraReader 的组成资源分发，不作为字体商品单独销售。

`inventory.json` 记录各本地文件的 SHA-256、字节数、字形数量与字体家族，可用于核对资源完整性。
