const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { bundle } = require("@remotion/bundler");
const {
  openBrowser,
  selectComposition,
  renderStill,
} = require("@remotion/renderer");
const root = path.resolve(__dirname, "..");
(async () => {
  const serveUrl = await bundle({
    entryPoint: path.join(root, "src/index.ts"),
    outDir: path.join(root, "out/bundle"),
    publicDir: path.join(root, "public"),
    rootDir: root,
    enableCaching: false,
  });
  const browser = await openBrowser("chrome", {
    browserExecutable:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    logLevel: "error",
  });
  try {
    const composition = await selectComposition({
      serveUrl,
      id: "AuraReaderFriendship",
      puppeteerInstance: browser,
      logLevel: "error",
    });
    assert.equal(composition.durationInFrames, 1170);
    assert.equal(composition.fps, 30);
    assert.equal(composition.width, 1920);
    assert.equal(composition.height, 1080);
    const output = path.join(root, process.env.AURA_REVIEW_DIR || "out/review");
    fs.mkdirSync(output, { recursive: true });
    const frames = process.argv.slice(2).length
      ? process.argv.slice(2).map(Number)
      : [45, 145, 195, 295, 450, 525, 650, 735, 855, 930, 1120];
    const checked = [];
    for (const frame of frames) {
      const filename = "frame-" + String(frame).padStart(4, "0") + ".png";
      await renderStill({
        composition,
        serveUrl,
        frame,
        output: path.join(output, filename),
        imageFormat: "png",
        puppeteerInstance: browser,
        logLevel: "error",
      });
      checked.push({ frame, seconds: frame / 30, file: filename });
      console.log("Verified frame " + frame);
    }
    fs.writeFileSync(
      path.join(output, "checks.json"),
      JSON.stringify(
        {
          composition: {
            id: composition.id,
            fps: composition.fps,
            width: composition.width,
            height: composition.height,
            durationInFrames: composition.durationInFrames,
          },
          frames: checked,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close({ silent: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
