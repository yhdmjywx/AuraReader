const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const JSZip = require("jszip");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const source = path.resolve(root, "../../docs/remotion/friendship");
const content = JSON.parse(
  fs.readFileSync(path.join(root, "src/content.json"), "utf8"),
);
(async () => {
  const output = path.join(root, "public/covers");
  fs.mkdirSync(output, { recursive: true });
  const manifest = [];
  for (const material of content.materials) {
    const zip = await JSZip.loadAsync(
      fs.readFileSync(path.join(source, "sources", material.file)),
    );
    const opf = Object.keys(zip.files).find((name) => name.endsWith(".opf"));
    assert.ok(opf);
    const dom = new JSDOM(await zip.file(opf).async("string"), {
      contentType: "application/xml",
    });
    const coverId = dom.window.document
      .querySelector('meta[name="cover"]')
      ?.getAttribute("content");
    const item = [...dom.window.document.querySelectorAll("item")].find(
      (node) =>
        (node.getAttribute("properties") || "")
          .split(" ")
          .includes("cover-image") || node.getAttribute("id") === coverId,
    );
    assert.ok(item, "Official EPUB declares a cover");
    const entry = path.posix.join(
      path.posix.dirname(opf),
      item.getAttribute("href"),
    );
    const bytes = await zip.file(entry).async("nodebuffer");
    const filename = material.key + ".jpg";
    fs.writeFileSync(path.join(output, filename), bytes);
    manifest.push({
      bookId: material.bookId,
      title: material.title,
      author: material.author,
      file: "covers/" + filename,
      sourceEpub: material.file,
      sourceEntry: entry,
      catalog: "https://www.gutenberg.org/ebooks/" + material.pg,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      note: "Unmodified cover image declared in the preserved official EPUB. No third-party edition or generated replacement.",
    });
    dom.window.close();
  }
  fs.writeFileSync(
    path.join(output, "sources.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      manifest.map((m) => ({ book: m.title, cover: m.file })),
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
