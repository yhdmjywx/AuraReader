# 阅读字体资源与许可

这些字库随应用打包，由本地服务提供，不依赖在线字体 CDN。五款精选字体之外，Noto Serif SC 仅用于英文及自定义字体缺失中文字形时的回退，不增加菜单选项。

| 菜单名称 | 字体家族 | 来源 | 本地资源 |
| --- | --- | --- | --- |
| 更纱黑体 | Sarasa Gothic SC | [Sarasa Gothic v1.0.42](https://github.com/be5invis/Sarasa-Gothic/releases/tag/v1.0.42)，SC Unhinted 原始发行包 | `sarasa-regular`、`sarasa-bold`、`sarasa-italic`、`sarasa-bold-italic` |
| 思源宋体 | Source Han Serif SC | [Adobe Source Han Serif 2.003R](https://github.com/adobe-fonts/source-han-serif/tree/release/Variable/TTF) | `source-han-serif-sc` |
| 霞鹜文楷 | LXGW WenKai | [LXGW WenKai v1.522](https://github.com/lxgw/LxgwWenKai/releases/tag/v1.522) | `lxgw-wenkai` |
| Literata | Literata | [Google Fonts Literata](https://github.com/google/fonts/tree/main/ofl/literata) | `literata`、`literata-italic` |
| Source Serif 4 | Source Serif 4 | [Adobe Source Serif 4.005R](https://github.com/adobe-fonts/source-serif/tree/release/WOFF2/VAR) | `source-serif-4`、`source-serif-4-italic` |
| 中文字形回退 | Noto Serif SC | [Google Fonts Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc) | `noto-serif-sc` |

资源采用 WOFF2。Source Serif 4 直接采用发布方的 WOFF2 文件；其他字体由原始 TTF 压缩打包，保留完整字符集、字体名称、排版表与作者及许可证元数据，不做字形裁剪。静态字库缺少某一字重或斜体文件时，允许浏览器正常合成粗体或斜体。更纱黑体和两款英文字体另附独立斜体字库。

六套字库均附带原始 SIL Open Font License 1.1 文本，见 `licenses/`。霞鹜文楷许可证中的额外授权说明一并保留。字库作为 AuraReader 的组成资源分发，不作为字体商品单独销售。

`inventory.json` 记录各本地文件的 SHA-256、字节数、字形数量与字体家族，可用于核对资源完整性。
