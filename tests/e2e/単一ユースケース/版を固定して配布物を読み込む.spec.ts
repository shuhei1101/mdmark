import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { main } from "../../../scripts/build.ts";

// jsDelivr の GitHub エンドポイントの、版のタグまでの URL
const CDN_BASE = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark";
// ページを返す架空のオリジン
const PAGE_URL = "https://app.example.test/";
// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

/** 配布物を読むページの HTML を返す。ページが読む版は引数で決める */
function pageHtml(tag: string): string {
  return `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="${CDN_BASE}@${tag}/dist/index.css">
    <script type="module">
      import { version } from "${CDN_BASE}@${tag}/dist/index.js";
      window.mdmarkVersion = version();
    </script>
  </head>
  <body><p id="body">本文の段落</p></body>
</html>`;
}

/** ページの HTML と、jsDelivr への要求を、手元の応答に差し替える。配信のサーバーは立てない */
async function routeAll(
  page: Page,
  tag: string,
  cdn: (file: string) => Promise<{ status: number; body?: Buffer }>,
): Promise<void> {
  await page.route(PAGE_URL, (route) =>
    route.fulfill({ contentType: "text/html", body: pageHtml(tag) }),
  );
  await page.route(`${CDN_BASE}@*/dist/*`, async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    const { status, body } = await cdn(file ?? "");
    await route.fulfill({
      status,
      body,
      contentType: file?.endsWith(".css") ? "text/css" : "text/javascript",
      // 別のオリジンのページが module を読むため
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

test.beforeAll(async () => {
  // `v0.0.1` を埋めてビルドした作業ツリーを用意する
  builtRoot = await mkdtemp(join(tmpdir(), "mdmark-e2e-dist-"));
  await cp(
    resolve(import.meta.dirname, "../../../src"),
    join(builtRoot, "src"),
    {
      recursive: true,
    },
  );
  await symlink(
    resolve(import.meta.dirname, "../../../node_modules"),
    join(builtRoot, "node_modules"),
    "dir",
  );
  await writeFile(join(builtRoot, "version.ini"), "v0.0.1\n");
  const code = await main([], { root: builtRoot, maxBytes: MAX_BYTES });
  expect(code).toBe(0);
});

test.afterAll(async () => {
  await rm(builtRoot, { recursive: true, force: true });
});

// 版を固定した URL で配布物を読み、公開関数と CSS 変数が同じ版になる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await routeAll(page, "v0.0.1", async (file) => ({
    status: 200,
    body: await readFile(join(builtRoot, "dist", file)),
  }));
  // 実行
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => "mdmarkVersion" in window);
  // 検証
  expect(
    await page.evaluate(
      () => (window as unknown as { mdmarkVersion: string }).mdmarkVersion,
    ),
  ).toBe("v0.0.1");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--mdmark-version",
      ),
    ),
  ).toBe('"v0.0.1"');
});

// 配布物を読めなくても本文は表示され、読めなかったことがコンソールに出る（異常シナリオ）
test("test_error_when_dist_not_found", async ({ page }) => {
  // 準備
  // 読めなかった module を、Chromium は error、Firefox は warning でコンソールに出す
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${message.text()} ${message.location().url}`);
    }
  });
  await routeAll(page, "v9.9.9", async () => ({ status: 404 }));
  // 実行
  await page.goto(PAGE_URL);
  // 検証
  await expect(page.locator("#body")).toBeVisible();
  await expect
    .poll(() => errors.some((e) => e.includes("index.js")))
    .toBe(true);
});
