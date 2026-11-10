# Wiki API 与资源调查

调查及收敛日期：2026-11-05。当前实施范围以 [MVP 规格](feature-spec.md)为准。此前调查过的搜索、实体与其他扩展能力不再构成本期要求；本次没有重新进行网络探测。

## 1. 本期采用

使用各语言 Wikipedia 的 MediaWiki Action API：`https://{wikiHost}/w/api.php`。无需为本期接入 Wikidata、翻译服务或账号体系。主机由受支持站点映射及已验证语言关联确定，不能接受任意 URL 代理。

| 能力 | 参数 | 用途与边界 | 官方来源 |
| --- | --- | --- | --- |
| 原词与已有重定向 | `action=query&titles=…&redirects=1&converttitles=1` | 查原词，接受服务器规范化，不提取短语概念 | [Query](https://www.mediawiki.org/wiki/API:Query) |
| 正文导言 | `prop=extracts&exintro=1&explaintext=1` | 真实纯文本导言，可能为空；不等于全文，不用 `exsentences` 强制截句 | [TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts#API) |
| 文章身份与原文地址 | `prop=info&inprop=url` | pageid、实际标题及地址，为右上角箭头提供目标 | [Info](https://www.mediawiki.org/wiki/API:Info) |
| 官方语言版本 | `prop=langlinks&llprop=url%7Clangname%7Cautonym` | 列当前文章已有版本，用户选择后再请求对应正文；处理 continuation | [Langlinks](https://www.mediawiki.org/wiki/API:Langlinks) |
| 消歧义识别 | `prop=pageprops&ppprop=disambiguation` | 只作提示与原站入口，不生成候选；检查键存在，值可为空字符串 | [Disambiguator](https://www.mediawiki.org/wiki/Extension:Disambiguator#With_API) |
| 站点与许可 | `action=query&meta=siteinfo&siprop=general%7Crightsinfo` | 获取归属／许可元数据，可缓存，不增加用户配置项 | [Siteinfo](https://www.mediawiki.org/wiki/API:Siteinfo) |

标题解析、语言链接与内容读取足以支撑本期。没有同名或重定向结果时返回未找到，由用户修改词语。简繁标题规范化不是翻译；语言关联也不是自动把正文转换成另一语言。

## 2. 当前调用示例

```js
const endpoint = 'https://zh.wikipedia.org/w/api.php';
const params = {
  action: 'query', format: 'json', formatversion: '2',
  titles: '蛋壳', redirects: '1', converttitles: '1',
  prop: 'info|pageprops|extracts|langlinks', inprop: 'url',
  ppprop: 'disambiguation', exintro: '1', explaintext: '1',
  llprop: 'url|langname|autonym', lllimit: 'max'
};
const url = endpoint + '?' + new URLSearchParams(params);
```

先显示这次返回的中文导言。处理后续语言关联分页，不能将首批视为完整列表。只有用户选择 English 时，才用关联返回的 `Eggshell` 标题向英文站请求正文；不对中文查询词进行翻译或英文搜索。

API 返回的实际语言、正文和原文链接一起更新。章节重定向须保留 fragment；标题中的多值参数分隔字符需按官方编码规则处理，不能意外形成多标题查询。

## 3. 已调查但不采用的能力

此表是范围排除记录，不是待实现清单或默认下一阶段计划。

| 资源 | 本期处置 |
| --- | --- |
| [Search API](https://www.mediawiki.org/wiki/API:Search) | 不调用，不做相关搜索、候选排序与分页 |
| [Links API](https://www.mediawiki.org/wiki/API:Links) | 不用页面链接构建消歧义候选 |
| [Wikibase API](https://www.mediawiki.org/wiki/Wikibase/API) | 不接入 `wbsearchentities`、`wbgetentities` 或实体 sitelinks 补救；无需 QID 模型 |
| [Wikidata 数据访问](https://www.wikidata.org/wiki/Wikidata:Data_access) | 不接入图查询、批量下载或自建索引 |
| [PageImages](https://www.mediawiki.org/wiki/Extension:PageImages) | 不加入图片 |
| [Parsing wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext) | 不加入全文 HTML、章节目录或内嵌章节浏览 |
| [Wikimedia REST API](https://www.mediawiki.org/wiki/Wikimedia_REST_API) | 本期不叠加第二条摘要读取链路；此前观察到的 RESTBase 迁移说明不等于全部 REST 端点关闭 |
| MediaWiki Core REST API | 此前未能读取文档，未验证契约；不作为采用或不可用的证据 |

## 4. 历史只读探测证据

2026-11-05 早先使用 PowerShell Invoke-RestMethod、15 秒超时及研究用途 User-Agent，未带账号令牌，完成以下五次 JSON 请求。本次保留观察事实，不沿用旧方案的实施结论。

| 请求 | 当时观察 | 当前意义 |
| --- | --- | --- |
| 中文“蛋壳”，info/pageprops/langlinks/extracts | pageid `7577522`，非空导言，英文关联 `Eggshell`，另带 QID `Q2731253` | 标题、导言与语言关联有实测依据；本期不使用 QID |
| 英文 Mercury，pageprops | `disambiguation: ""` | 识别消歧义要检查键存在 |
| 中文搜索“坚硬的蛋壳” | 29 项结果，首项“蛋壳” | 这是原样全文搜索，不是提取概念；本期不采用 |
| Wikidata 搜索“蛋壳” | Q2731253 以及其他实体候选 | 仅历史能力验证，本期不采用 |
| wbgetentities Q2731253 | enwiki/zhwiki 关联 | 仅历史能力验证，本期改用文章 langlinks |

页面内容与结果会变化，不写成固定在线测试断言。仍未验证打包应用网络、所有语言、限流降级和英文正文渲染；上述请求成功不代表产品已经实现。

## 5. 必要接入约束

- 本地 Node 服务／Electron 主进程执行外网请求，保留当前桌面 `connect-src 'self'`、`frame-src 'none'`。不通过放开 CSP 或 iframe 实现弹窗。
- CORS `origin=*` 不能覆盖应用 CSP 或解决网络不可达。[跨站请求](https://www.mediawiki.org/wiki/API:Cross-site_requests)
- 声明应用版本及实际项目联系信息，设置超时、取消，尊重 Retry-After；失败与未找到分开处理。可轻量缓存和去重，不引入配置系统。[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)
- 只发送用户主动提交的查询词及必要站点／文章参数，不上传书籍、Goal、笔记或周边段落。
- 纯文本显示导言；保留来源文章链接、贡献者归属和适用许可，不冒称原创或 AI 总结。许可呈现不构成额外常驻功能面板。[内容使用条款](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)

## 6. 第三方参考的使用边界

[KOReader](https://koreader.rocks/user_guide/)与 [WikiLens](https://github.com/Ville-Mattila/wikilens)仅作为阅读查询实现参考。WikiLens 的标题查询与已有重定向符合本期选词方向，不能因它缺少短语搜索就否定匹配度；语言版本切换、应用架构及许可仍需单独处理。

当前未决定移植 WikiLens 代码，也不把其图片、音频、事实卡片、固定／拖动、历史记录加入本期。外观以用户指定 Figma 为准。

### WikiLens 可借鉴的实现

依据此前已检查的 **v1.9.0，提交 `15ef9a7e923664d320ed6534fc70ae1774d515a3`**。以下是固定版本的静态源码观察，未安装运行该扩展；本次整理不宣称重新验证了最新版本。借鉴实现思路不等于直接复制源码，也不扩大 MVP。

源码入口：[background.js](https://github.com/Ville-Mattila/wikilens/blob/15ef9a7e923664d320ed6534fc70ae1774d515a3/background.js)、[content.js](https://github.com/Ville-Mattila/wikilens/blob/15ef9a7e923664d320ed6534fc70ae1774d515a3/content.js)、[action.js](https://github.com/Ville-Mattila/wikilens/blob/15ef9a7e923664d320ed6534fc70ae1774d515a3/action.js)。

| 可借鉴点 | WikiLens 的实现 | AuraReader 的采用方式 |
| --- | --- | --- |
| 原词查询与重定向 | `lookupCoreInLanguage` 查询标题；精确模式额外比较返回标题，关闭该模式可接受服务端重定向 | 保留原词查询与维基已有重定向；使用已选 Action API，不照搬其严格标题相等检查或 REST 接口 |
| 网络与页面分离 | background service worker 处理远端请求，content script 只负责交互 | 沿用本地 Node 服务／Electron 主进程请求，React 展示；复用项目 IPC／HTTP 模式，不搬 `chrome.runtime` |
| 防止旧结果覆盖新查询 | content 中以 `requestSeq` 检查回调，background 用 AbortController 取消被替代请求 | 使用请求序号和取消机制，覆盖改词、切语言、关闭与切书；不依赖旧 DOM 选区持续存在 |
| 正文先返回 | `lookupArticle` 先返回核心内容，随后才做附加信息获取 | 正文不等待非必要数据；语言关联可独立加载，其失败不清空已取得正文。不引入图片等 enrichment 链路 |
| 轻量结果缓存 | 有界 Map 保存查询结果，减少重复请求 | 可参考成功结果缓存，缓存键含站点与文章／查询身份；不迁移扩展存储或永久查询历史 |
| 原文地址随结果返回 | 核心结果包含 `pageUrl`，供外链使用 | 供 Figma 右上角 `↗` 使用，切语言后同步更新；桌面通过经验证的系统浏览器打开能力执行 |
| Enter 提交 | `action.js` 监听输入框 Enter 并发起查询 | 对应 Figma 可编辑查询词；成功后更新应用内正文，而非照搬其工具栏成功后直接打开原站的行为 |
| 超长正文滚动 | content 的文章内容区支持滚动 | 按 Figma 正文 Frame 实现独立滚动，顶部查询词和语言控件固定；不继承原卡片样式 |
| 远端内容处理边界 | `renderFormattedText` 用 DOMParser 和标签白名单重建内容，不直接注入远端 HTML | 本期以纯文本呈现即可，无需搬 HTML 清理器；保留远端内容不能直接执行或注入的原则 |

### 必须修改或不沿用的处理

- **语言回退**：WikiLens 在所选站点查询失败后，用同一文字重查英文站；这不是当前词条的语言版本切换。本期仅使用 `langlinks`，用户选择后再加载对应版本。
- **错误缓存**：其查询外层会把非取消异常缓存为 miss。不能照搬；网络故障、限流和无词条必须区分，失败不缓存成未找到。
- **消歧义列表**：其 `lookupDisambiguation` 截取页面链接作为选项。本期只提示并提供原站入口，不引入候选系统。
- **选区和触发**：不搬全局选区监听、自动查询、80 字限制或多行选词拒绝规则；使用 AuraReader 现有 reader 快照与用户点击入口。
- **界面和扩展设施**：不搬 Shadow DOM、扩展设置页、`chrome.storage`、自动消失、固定／拖动、历史计数、图片、音频、事实卡片和章节目录；界面与退出行为由 Figma 和当前规格决定。
- **正文接口**：其导言 HTML 与章节读取可以说明该项目如何取得内容，但本期已选纯文本导言，不因此改成完整文章浏览器。

### 代码复用许可边界

该固定版本采用 [GPL-3.0](https://github.com/Ville-Mattila/wikilens/blob/15ef9a7e923664d320ed6534fc70ae1774d515a3/LICENSE)，AuraReader 当前 [LICENSE](../../../LICENSE) 为 Apache-2.0。若未来复制并整合其源码后分发，需处理 GPL 对组合程序及源码提供的要求，不能仅保留署名就按原有 Apache-only 方式发布；参见此前评估使用的 [GNU 官方说明](https://www.gnu.org/licenses/gpl-faq.en.html#GPLInProprietarySystem)。

本期实施方向是依据官方 API 与现有项目架构实现所需功能，借鉴上表中的通用处理方式；没有批准直接复制 WikiLens 代码或改变项目许可。
