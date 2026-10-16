// PoC: 書き出した HTML だけを空のフォルダへ写し、file:// で開いて要求と描画を確かめる
import { copyFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, firefox } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));

/** 描き終えるのを待つ上限（ミリ秒） */
const DRAW_TIMEOUT_MS = 10_000;

/** 1 つのブラウザと 1 つの書き出しで、成功条件の観点ごとの結果を返す */
async function check(options: {
  browserType: typeof chromium;
  variant: "blob" | "data";
}) {
  const { browserType, variant } = options;
  // 隣のファイルを読んでしまう漏れも失敗として出すため、HTML だけを空のフォルダに置く
  const dir = await mkdtemp(join(tmpdir(), "mdmark-poc-"));
  const file = join(dir, "index.html");
  await copyFile(join(here, "out", `single-${variant}.html`), file);
  const pageUrl = pathToFileURL(file).href;

  const browser = await browserType.launch();
  const page = await browser.newPage();
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    // blob: と data: は埋めたものを読む要求で、外への要求ではない
    if (url !== pageUrl && !url.startsWith("blob:") && !url.startsWith("data:")) {
      outside.push(url);
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.goto(pageUrl);
  const drawn = await page
    .locator("[data-mdmark-drawn] canvas")
    .waitFor({ timeout: DRAW_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  const result = {
    browser: browserType.name(),
    variant,
    outsideRequests: outside,
    canvas: drawn,
    notices: await page.locator(".mdmark-notice").count(),
    sortButtons: await page.locator(".mdmark-sort").count(),
    pinButtons: await page.locator(".mdmark-pin").count(),
    errors,
  };
  await browser.close();
  return result;
}

for (const browserType of [chromium, firefox]) {
  for (const variant of ["blob", "data"] as const) {
    console.log(JSON.stringify(await check({ browserType, variant })));
  }
}