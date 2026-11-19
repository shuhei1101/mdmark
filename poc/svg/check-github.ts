// PoC の確認: GitHub の Markdown の表示で、テーマの設定と OS の配色の設定を別々に切り替えて SVG の画像を撮る
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "shots");
const commit = process.argv[2];
const url = `https://github.com/shuhei1101/mdmark/blob/${commit}/poc/svg/out/README.md`;
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const result: Record<string, unknown> = {};
for (const theme of ["light", "dark"] as const) {
  for (const os of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: os, viewport: { width: 1400, height: 1000 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    // 未ログインでは OS の配色に従うため、ログインしたときのテーマの設定と同じ属性を html 要素に当てる
    await page.evaluate((mode) => {
      document.documentElement.setAttribute("data-color-mode", mode);
      document.documentElement.setAttribute("data-light-theme", "light");
      document.documentElement.setAttribute("data-dark-theme", "dark");
    }, theme);
    const images = page.locator("article img[alt]");
    const count = await images.count();
    const states = [];
    for (let index = 0; index < count; index += 1) {
      const image = images.nth(index);
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((e: HTMLImageElement) => e.decode().catch(() => undefined));
      states.push(await image.evaluate((e: HTMLImageElement) => ({ alt: e.alt, w: e.naturalWidth, h: e.naturalHeight })));
      await image.screenshot({ path: join(shots, `github-${theme}-${os}-${index + 1}.png`) });
    }
    const pageTheme = await page.evaluate(() => document.documentElement.getAttribute("data-color-mode"));
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.locator("article").screenshot({ path: join(shots, `github-${theme}-${os}-page.png`) });
    result[`theme=${theme} os=${os}`] = { pageTheme, background, images: states };
    await context.close();
  }
}
await browser.close();
console.log(JSON.stringify(result, null, 1));
