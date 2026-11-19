// PoC の確認: Chromium で、mount で描いた見本と <img> で開いた SVG を撮り、foreignObject の切れと余白を測る
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const shots = join(here, "shots");
const TYPES: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".html": "text/html", ".md": "text/plain", ".png": "image/png" };

const server = createServer(async (request, response) => {
  const path = normalize(join(root, decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname)));
  if (!path.startsWith(root)) return void response.writeHead(403).end();
  const body = await readFile(path).catch(() => undefined);
  if (body === undefined) return void response.writeHead(404).end();
  response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body);
});
await new Promise<void>((done) => server.listen(0, done));
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}`;
await mkdir(shots, { recursive: true });

const markdown = await readFile(join(here, "samples/samples.md"), "utf8");
const mountPage = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/dist/index.css"><body style="margin:0;background:#fff"><div id="doc" class="mdmark-theme-light" style="width:800px"></div><script type="module">import { mount } from "/dist/index.js"; mount(document.querySelector("#doc"), { markdown: ${JSON.stringify(markdown)} }); window.__done = true;</script>`;
const imgPage = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${[1, 2, 3, 4, 5, 6].map((n) => `<p><img id="s${n}" src="/poc/svg/out/sample-${n}.svg"></p>`).join("")}`;
await writeFile(join(here, "out/mount.html"), mountPage);
await writeFile(join(here, "out/img.html"), imgPage);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: "light" });
const result: Record<string, unknown> = {};

await page.goto(`${base}/poc/svg/out/mount.html`);
await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done === true);
await page.waitForTimeout(500);
for (let n = 1; n <= 6; n += 1) {
  const block = page.locator(`#section-見本-${n} > *`).first();
  await block.screenshot({ path: join(shots, `mount-${n}.png`) });
}

await page.goto(`${base}/poc/svg/out/img.html`);
await page.waitForLoadState("networkidle");
for (let n = 1; n <= 6; n += 1) {
  const img = page.locator(`#s${n}`);
  const natural = await img.evaluate((e: HTMLImageElement) => ({ w: e.naturalWidth, h: e.naturalHeight, complete: e.complete }));
  await img.screenshot({ path: join(shots, `img-${n}.png`) });
  result[`img-${n}`] = natural;
}

// SVG を文書として開き、foreignObject の中身の大きさと、外へのリクエストを測る
for (const n of [3, 4, 5, 6]) {
  const requests: string[] = [];
  page.removeAllListeners("request");
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${base}/poc/svg/out/sample-${n}.svg`);
  const measured = await page.evaluate(() => {
    const fo = document.querySelector("foreignObject") as SVGForeignObjectElement;
    const div = fo.firstElementChild as HTMLElement;
    const box = { w: Number(fo.getAttribute("width")), h: Number(fo.getAttribute("height")) };
    const origin = div.getBoundingClientRect();
    let right = 0;
    let bottom = 0;
    for (const element of div.querySelectorAll("*")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      right = Math.max(right, rect.right - origin.left);
      bottom = Math.max(bottom, rect.bottom - origin.top);
    }
    return { box, content: { w: Math.round(right), h: Math.round(bottom) }, scroll: { w: div.scrollWidth, h: div.scrollHeight } };
  });
  result[`fo-${n}`] = {
    ...measured,
    clipped: measured.content.w > measured.box.w || measured.content.h > measured.box.h,
    slack: { right: measured.box.w - measured.content.w, bottom: measured.box.h - measured.content.h },
    requests: requests.filter((url) => !url.endsWith(`sample-${n}.svg`)),
  };
}
await browser.close();
server.close();
console.log(JSON.stringify(result, null, 2));
