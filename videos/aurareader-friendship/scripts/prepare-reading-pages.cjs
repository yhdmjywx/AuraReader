const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const fontkit = require("fontkit");
const root = path.resolve(__dirname, "..");
const source = path.resolve(root, "../../docs/remotion/friendship");
const books = JSON.parse(
  fs.readFileSync(path.join(source, "books.json"), "utf8"),
);
const content = JSON.parse(
  fs.readFileSync(path.join(root, "src/content.json"), "utf8"),
);
const font = fontkit.openSync(path.join(root, "public/fonts/Lora.ttf"));
const width = 640,
  fontSize = 25,
  lineHeight = 40,
  paragraphGap = 14;
const clean = (text) => text.replace(/\s+/g, " ").trim();
const measure = (text) =>
  (font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) /
    font.unitsPerEm) *
  fontSize;
function lines(text) {
  const result = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (current && measure(current + " " + word) > width) {
      result.push(current);
      current = word;
    } else current = current ? current + " " + word : word;
  }
  if (current) result.push(current);
  return result;
}
const pages = content.materials.map((material, index) => {
  const book = books.find((b) => b.id === material.bookId);
  const dom = new JSDOM(book.pages[material.sourcePage - 1]);
  dom.window.document
    .querySelectorAll(".pagenum")
    .forEach((node) => node.remove());
  const paragraphs = [...dom.window.document.querySelectorAll("p")]
    .map((p) => clean(p.textContent))
    .filter(Boolean);
  const selected = paragraphs.findIndex((p) => p.includes(material.quote));
  assert.ok(selected >= 0);
  const first = index === 0 ? Math.max(0, selected - 1) : selected;
  const chosen = [];
  let lineCount = 0;
  for (let at = first; at < paragraphs.length && lineCount < 15; at++) {
    const wrapped = lines(paragraphs[at]);
    const remaining = 15 - lineCount;
    // A normal page may end partway through a paragraph. Keep a continuous
    // prefix of the original text; never insert manual line breaks or ellipses.
    const excerpt =
      wrapped.length > remaining
        ? wrapped.slice(0, remaining).join(" ")
        : paragraphs[at];
    assert.ok(paragraphs[at].startsWith(excerpt));
    chosen.push(excerpt);
    lineCount += lines(excerpt).length;
  }
  assert.ok(
    lineCount >= 13 && lineCount <= 17,
    "Natural body line count must stay close to 15",
  );
  const quoteParagraph = selected - first;
  const before = chosen[quoteParagraph].split(material.quote)[0];
  const wordsBefore = before.trim().split(/\s+/).filter(Boolean);
  const quoteLine =
    chosen.slice(0, quoteParagraph).reduce((n, p) => n + lines(p).length, 0) +
    Math.max(0, lines(wordsBefore.join(" ")).length - 1);
  const quoteTop = 281 + quoteLine * lineHeight + quoteParagraph * paragraphGap;
  const page = {
    bookId: book.id,
    sourceUrl: material.sourceUrl,
    sourcePage: material.sourcePage,
    paragraphs: chosen,
    quoteParagraph,
    quoteLine,
    quoteTop,
    lineCount,
    width,
    fontSize,
    lineHeight,
    paragraphGap,
  };
  dom.window.close();
  return page;
});
fs.writeFileSync(
  path.join(root, "src/reading-pages.json"),
  JSON.stringify(pages, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    pages.map((p) => ({
      book: p.bookId,
      lines: p.lineCount,
      paragraphs: p.paragraphs.length,
      quoteTop: p.quoteTop,
    })),
    null,
    2,
  ),
);
