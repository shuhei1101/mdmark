// PoC: ホイールで続けてスクロールした間に、描かれたフレームの見出し行が画面の上端からずれた量を測る
// 使い方: node lag.mjs {chromium|firefox} {a|b|c} [offset]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, firefox } from "@playwright/test";

const [browserName, mode, offsetArg] = process.argv.slice(2);
const offset = Number(offsetArg ?? 0);
const WIDTH = 1280;
const HEIGHT = 800;
const URL = `http://127.0.0.1:4789/tmp/poc/sticky-table-header/page.html?mode=${mode}&offset=${offset}`;
const OUT = join(import.meta.dirname, "lag-out", `${browserName}-${mode}-${offset}`);
// 見出し行のセルを塗る目印の色
const MARK = "#ff00ff";
// 目印の色とみなす RGB の差
const TOLERANCE = 80;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await (browserName === "firefox" ? firefox : chromium).launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  ...(browserName === "firefox" ? { recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } } } : {}),
});
const page = await context.newPage();
await page.goto(URL);
await page.waitForSelector("html[data-ready]");
await page.addStyleTag({
  content: `.mdmark-table thead th, .mdmark-table thead th * { background: ${MARK} !important; color: ${MARK} !important; border-color: ${MARK} !important; box-shadow: none !important; }`,
});
// 見出し行が上端に留まる位置まで下げる
const start = await page.evaluate(() => {
  const table = document.querySelector(".mdmark-table table");
  return table.getBoundingClientRect().top + scrollY + 600;
});
await page.evaluate((y) => scrollTo(0, y), start);
await page.waitForTimeout(500);
// 上端に留まっている見出し行のセル（案 A は複製のセル）
const rest = await page.evaluate((top) => {
  const th = [...document.querySelectorAll(".mdmark-table thead th")].find((cell) => Math.abs(cell.getBoundingClientRect().top - top) <= 2);
  const r = th.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left };
}, offset);

const frames = [];
let cdp;
if (browserName === "chromium") {
  cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
    frames.push(Buffer.from(data, "base64"));
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: WIDTH, maxHeight: HEIGHT, everyNthFrame: 1 });
}

await page.mouse.move(WIDTH / 2, HEIGHT / 2);
// 下へ続けて回す → 速く回す → 上へ戻す
const pattern = [
  ...Array.from({ length: 40 }, () => [100, 16]),
  ...Array.from({ length: 20 }, () => [400, 8]),
  ...Array.from({ length: 40 }, () => [-150, 16]),
];
for (const [dy, wait] of pattern) {
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(wait);
}
await page.waitForTimeout(800);

if (cdp) {
  await cdp.send("Page.stopScreencast");
}
await context.close();
await browser.close();

// フレームを RGB の生の並びにする
let raw;
let w = WIDTH;
let h = HEIGHT;
if (browserName === "chromium") {
  frames.forEach((buf, i) => writeFileSync(join(OUT, `f${String(i).padStart(5, "0")}.png`), buf));
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(OUT, "f00000.png")]).toString().trim().split(",");
  [w, h] = probe.map(Number);
  raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(OUT, "f%05d.png"), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 2_000_000_000 });
} else {
  const video = readdirSync(OUT).find((f) => f.endsWith(".webm"));
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(OUT, video)]).toString().trim().split(",");
  [w, h] = probe.map(Number);
  raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(OUT, video), "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 2_000_000_000 });
}
// 目印の色を探す列（1 列目のセルの左の余白）
const PROBE_X = Math.round(rest.left) + 3;
const frameSize = w * h * 3;
const count = Math.floor(raw.length / frameSize);
const isMark = (f, x, y) => {
  const i = f * frameSize + (y * w + x) * 3;
  return Math.abs(raw[i] - 255) + raw[i + 1] + Math.abs(raw[i + 2] - 255) < TOLERANCE;
};
const results = [];
for (let f = 0; f < count; f++) {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    if (isMark(f, PROBE_X, y)) {
      if (top < 0) top = y;
      bottom = y + 1;
    } else if (top >= 0 && y - bottom > 4) {
      break;
    }
  }
  results.push({ f, top, bottom });
}
// 目印が最初に上端に現れたフレームから数える
const first = results.findIndex((r) => r.top >= 0);
const counted = results.slice(first);
const deviation = (r) => (r.top < 0 ? Number.POSITIVE_INFINITY : Math.max(Math.abs(r.top - Math.round(rest.top)), Math.abs(r.bottom - Math.round(rest.bottom))));
const devs = counted.map(deviation);
const over = devs.filter((d) => d > 2).length;
const summary = {
  browser: browserName,
  mode,
  offset,
  frameSize: `${w}x${h}`,
  rest,
  frames: counted.length,
  maxDeviation: Math.max(...devs.filter(Number.isFinite)),
  framesOver2px: over,
  framesHeadOffscreen: devs.filter((d) => !Number.isFinite(d)).length,
  worst: counted.filter((_, i) => devs[i] > 2).slice(0, 10),
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
