console.log("=== 跨段落高亮 DOM 匹配算法测试 ===");

let htmlContent = `
<p>央行的超发货币政策像是一种剧毒的麻醉剂。它能在短期内掩盖结构性矛盾，却在无形中把债务的雪球越推越大。</p>
<p>当全球主要经济体的债务 GDP 占比突破历史警戒线时，边际收益开始急速递减。每一单位新发行的债务所能带来的经济增长微乎其微。</p>
<p>作为独立的研读者与投资者，你必须学会看清资产负债表的真相，而不是被官方的乐观表态所蒙蔽。</p>
`;

// 跨段落选区引文 (包含换行符 \n 或多行)
const crossParagraphQuote = `央行的超发货币政策像是一种剧毒的麻醉剂。它能在短期内掩盖结构性矛盾，却在无形中把债务的雪球越推越大。\n当全球主要经济体的债务 GDP 占比突破历史警戒线时，边际收益开始急速递减。每一单位新发行的债务所能带来的经济增长微乎其微。`;

console.log("1. 旧版检测结果 (htmlContent.includes(crossParagraphQuote)):", htmlContent.includes(crossParagraphQuote));

function applyHighlightRobust(html, note) {
    if (!note || !note.quote) return html;
    
    // 优先尝试全量精确匹配
    if (html.includes(note.quote)) {
        const mark = `<mark class="hl-${note.color || 'yellow'}" data-id="${note.id}">${note.quote}</mark>`;
        return html.replace(note.quote, mark);
    }

    // 跨段落多行 / 多片段拆分处理
    const segments = note.quote.split(/[\r\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    let updatedHtml = html;
    segments.forEach(seg => {
        if (updatedHtml.includes(seg)) {
            const mark = `<mark class="hl-${note.color || 'yellow'}" data-id="${note.id}">${seg}</mark>`;
            updatedHtml = updatedHtml.replace(seg, mark);
        }
    });

    return updatedHtml;
}

const noteObj = {
    id: 'note-test-cross',
    color: 'yellow',
    quote: crossParagraphQuote
};

const finalHtml = applyHighlightRobust(htmlContent, noteObj);

console.log("\n2. 修复算法高亮结果:");
console.log("包含 <mark> 数量:", (finalHtml.match(/<mark/g) || []).length);
console.log("\n处理后的 HTML 内容:\n", finalHtml);
