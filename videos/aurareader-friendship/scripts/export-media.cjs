const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { bundle } = require("@remotion/bundler");
const {
  openBrowser,
  selectComposition,
  renderMedia,
} = require("@remotion/renderer");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "out/exports");
const mp4 = path.join(output, "AuraReader-Friendship-1080p.mp4");
const gif = path.join(output, "AuraReader-Friendship-720p.gif");
const palette = path.join(output, "gif-palette.png");
function run(file, args) {
  return execFileSync(file, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
  });
}
function probe(file) {
  return JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-count_frames",
      "-show_entries",
      "format=duration,size:stream=codec_name,width,height,r_frame_rate,nb_read_frames",
      "-of",
      "json",
      file,
    ]),
  );
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  console.log("Bundling the current film...");
  const serveUrl = await bundle({
    entryPoint: path.join(root, "src/index.ts"),
    outDir: path.join(root, "out/export-bundle"),
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
    let last = -1;
    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: mp4,
      puppeteerInstance: browser,
      crf: 18,
      pixelFormat: "yuv420p",
      x264Preset: "medium",
      concurrency: 4,
      muted: true,
      overwrite: true,
      logLevel: "error",
      onProgress: (p) => {
        const step = Math.floor(p.progress * 20);
        if (step !== last) {
          last = step;
          console.log(
            "MP4 " +
              Math.round(p.progress * 100) +
              "% · " +
              p.renderedFrames +
              "/1170 frames",
          );
        }
      },
    });
  } finally {
    await browser.close({ silent: true });
  }
  console.log("Creating the GIF palette...");
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    mp4,
    "-vf",
    "fps=15,scale=1280:720:flags=lanczos,palettegen=max_colors=256:stats_mode=diff",
    "-frames:v",
    "1",
    palette,
  ]);
  console.log("Encoding the complete looping GIF...");
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    mp4,
    "-i",
    palette,
    "-filter_complex",
    "[0:v]fps=15,scale=1280:720:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
    "-loop",
    "0",
    gif,
  ]);
  console.log("Checking duration, frame counts and full decoding...");
  const video = probe(mp4),
    animation = probe(gif);
  assert.equal(video.streams[0].codec_name, "h264");
  assert.equal(video.streams[0].width, 1920);
  assert.equal(video.streams[0].height, 1080);
  assert.equal(Number(video.streams[0].nb_read_frames), 1170);
  assert.ok(Math.abs(Number(video.format.duration) - 39) < 0.1);
  assert.equal(animation.streams[0].codec_name, "gif");
  assert.equal(animation.streams[0].width, 1280);
  assert.equal(animation.streams[0].height, 720);
  assert.equal(Number(animation.streams[0].nb_read_frames), 585);
  assert.ok(Math.abs(Number(animation.format.duration) - 39) < 0.1);
  run("ffmpeg", ["-hide_banner", "-v", "error", "-i", mp4, "-f", "null", "-"]);
  run("ffmpeg", [
    "-hide_banner",
    "-v",
    "error",
    "-ignore_loop",
    "1",
    "-i",
    gif,
    "-f",
    "null",
    "-",
  ]);
  run("ffmpeg", [
    "-hide_banner",
    "-v",
    "error",
    "-y",
    "-ss",
    "9.8",
    "-i",
    mp4,
    "-frames:v",
    "1",
    path.join(output, "video-check.png"),
  ]);
  run("ffmpeg", [
    "-hide_banner",
    "-v",
    "error",
    "-y",
    "-ss",
    "9.8",
    "-ignore_loop",
    "1",
    "-i",
    gif,
    "-frames:v",
    "1",
    path.join(output, "gif-check.png"),
  ]);
  const result = {
    status: "passed",
    composition: "AuraReaderFriendship",
    durationSeconds: 39,
    audio: "none",
    video: {
      filename: path.basename(mp4),
      bytes: fs.statSync(mp4).size,
      probe: video,
    },
    gif: {
      filename: path.basename(gif),
      bytes: fs.statSync(gif).size,
      loop: "infinite",
      probe: animation,
    },
    validation:
      "Both complete outputs decoded with FFmpeg without errors; original video and GIF frame counts and durations verified.",
  };
  fs.writeFileSync(
    path.join(output, "export-checks.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        status: result.status,
        video: { file: mp4, bytes: result.video.bytes },
        gif: { file: gif, bytes: result.gif.bytes },
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error.message);
  if (error.stderr) console.error(error.stderr.toString());
  process.exitCode = 1;
});
