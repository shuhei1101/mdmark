// GIF の停止・再生を 3 つのブラウザで確かめ、PoC のコードを対応ブラウザの下限と照らす

import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium, firefox, type Page, webkit } from "playwright";
import { lintBundle } from "../../scripts/baseline.ts";
import { BROWSER_TARGETS } from "../../scripts/bundle.ts";

const POC_DIR = resolve(import.meta.dirname, "..");
const INTERVAL_MS = 500;
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".gif": "image/gif",
};

const bundled = await build({
  entryPoints: [join(import.meta.dirname, "gif-pause.ts")],
  bundle: true,
  format: "esm",
  minify: false,
  write: false,
  target: BROWSER_TARGETS,
});
const code = bundled.outputFiles[0].text;
await writeFile(join(import.meta.dirname, "gif-pause.js"), code);
const violations = lintBundle({ code, file: "gif-pause.js" });
console.log(`下限の照合: 報告 ${violations.length} 件`, violations);

const server = createServer(async (request, response) => {
  const path = join(
    POC_DIR,
    decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname),
  );
  try {
    const body = await readFile(path);
    response.writeHead(200, {
      "content-type": TYPES[extname(path)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

async function changes(page: Page): Promise<boolean> {
  // GIF の範囲（img と canvas が重なる 160x120）だけを撮る
  const clip = await page.locator("#box img").boundingBox();
  if (!clip) {
    throw new Error("GIF の範囲を取れない");
  }
  const first = await page.screenshot({ clip, animations: "allow" });
  await page.waitForTimeout(INTERVAL_MS);
  const second = await page.screenshot({ clip, animations: "allow" });
  return !first.equals(second);
}

const results = [];
// 流すブラウザは PW_BROWSERS で選ぶ。WebKit は依存のライブラリがある Playwright の Docker イメージの中で流す
for (const type of [chromium, firefox, webkit].filter((t) =>
  (process.env.PW_BROWSERS ?? "chromium,firefox,webkit")
    .split(",")
    .includes(t.name()),
)) {
  const browser = await type.launch();
  const page = await browser.newPage();
  await page.goto(`${origin}/gif/index.html`);
  const button = page.locator("#box button");
  await button.waitFor();
  const movingBefore = await changes(page);
  const requestsBefore: string[] = [];
  page.on("request", (request) => requestsBefore.push(request.url()));
  await button.click();
  const movingPaused = await changes(page);
  await button.click();
  const movingResumed = await changes(page);
  results.push({
    browser: `${type.name()} ${browser.version()}`,
    動いている: movingBefore,
    停止後に変わる: movingPaused,
    再生後に変わる: movingResumed,
    切り替えでの要求: requestsBefore.length,
  });
  await browser.close();
}
console.table(results);
server.close();
