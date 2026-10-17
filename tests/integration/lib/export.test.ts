import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  GREET_SOURCE,
  linesOf,
  PNG_BYTES,
  runCli,
  TEST_LIB_SOURCE,
  THEME_SOURCE,
  useBrowser,
  useTempDirs,
  writeFiles,
} from "../cli.ts";

const createTempDir = useTempDirs();
const browser = useBrowser(createTempDir);

// 表・用語集の表・外部ライブラリの印・拡張の印・相対パスの画像・api.md へのリンク・script 要素を持つ文書
const GUIDE = [
  "# ガイド",
  "",
  "<!-- table: data -->",
  "",
  "| 名前 | 数 |",
  "| --- | --- |",
  "| a | 2 |",
  "| b | 1 |",
  "",
  "<!-- /table -->",
  "",
  "<!-- glossary: term=用語 meaning=意味 -->",
  "",
  "| 用語 | 意味 |",
  "| --- | --- |",
  "| 印 | HTML コメントで書く指定 |",
  "",
  "<!-- /glossary -->",
  "",
  "本文に印を書く。",
  "",
  "<!-- test-lib: a b -->",
  "",
  "<!-- greet: 世界 -->",
  "",
  "![図](img/a.png)",
  "",
  "[API](api.md)",
  "",
  "<script>window.__ran = true</script>",
  "",
].join("\n");

/** 見本のフォルダを作る: 設定（`theme`・`index`・`extensions`・`libraries`）と、文書 `guide.md`・`api.md` */
async function createSampleDir(): Promise<string> {
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: index.yaml",
      "theme: theme.css",
      "extensions: [extensions/greet.js]",
      "libraries:",
      "  test-lib: lib/test-lib.js",
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: guide",
      "    path: guide.md",
      "    title: ガイド",
      "  - id: api",
      "    path: api.md",
      "    title: API",
      "",
    ].join("\n"),
    "theme.css": THEME_SOURCE,
    "extensions/greet.js": GREET_SOURCE,
    "lib/test-lib.js": TEST_LIB_SOURCE,
    "guide.md": GUIDE,
    "api.md": "# API\n\n[ガイド](guide.md)\n",
    "img/a.png": PNG_BYTES,
  });
  return dir;
}

// 設定・索引・外部ライブラリ・拡張・画像を埋めた HTML を書き出す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createSampleDir();
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["書き出した: guide.html"]);
  expect(result.stderr).toBe("");
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "guide.html"),
  );
  await page.waitForSelector("article.mdmark h1");
  await page.waitForSelector("[data-mdmark-slot]:not(:empty)");
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-mdmark-slot]")].every(
      (slot) => slot.textContent !== "",
    ),
  );
  expect(externalRequests()).toEqual([]);
  expect(await page.locator("button.mdmark-sort").count()).toBeGreaterThan(0);
  await expect(
    page.locator(".mdmark-term").first().textContent(),
  ).resolves.toBe("印");
  await expect(
    page.locator("article [data-mdmark-slot]").allTextContents(),
  ).resolves.toEqual(["drawn:a,b", "greet:世界"]);
  await expect(page.locator(".mdmark-notice").count()).resolves.toBe(0);
  await expect(
    page
      .locator("article img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).resolves.toBeGreaterThan(0);
  await expect(
    page.evaluate(() =>
      getComputedStyle(document.querySelector("article.mdmark") as Element)
        .getPropertyValue("--mdmark-radius")
        .trim(),
    ),
  ).resolves.toBe("0px");
  await expect(
    page.locator('.mdmark-backlinks a[href="api.md"]').count(),
  ).resolves.toBe(1);
  await expect(
    page.locator('article p a[href="api.md"]').count(),
  ).resolves.toBe(1);
  await expect(page.evaluate(() => "__ran" in window)).resolves.toBe(false);
  await page.close();
});

// 読めないものを警告に出し、読めたものだけを埋めて書き出す（正常系（読めない画像とモジュールがある））
test("test_normal_when_unreadable_assets", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "libraries:\n  test-lib: lib/missing.js\n",
    "guide.md":
      "# ガイド\n\n<!-- test-lib: a -->\n\n![図](img/missing.png)\n\n本文のほかの部分\n",
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "guide.html"))).toBe(true);
  const warnings = linesOf(result.stderr);
  expect(warnings.some((line) => line.includes("img/missing.png"))).toBe(true);
  expect(warnings.some((line) => line.includes("test-lib"))).toBe(true);
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "guide.html"),
  );
  await page.waitForSelector(".mdmark-notice");
  await expect(page.locator(".mdmark-notice").count()).resolves.toBe(1);
  await expect(page.locator("article p").allTextContents()).resolves.toContain(
    "本文のほかの部分",
  );
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 設定ファイルの誤りは、原因と mdmark check を示して終わる（異常系（設定ファイルが Schema に合わない））
test("test_error_when_config_invalid", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "libraries: chart.js\n",
    "guide.md": "# ガイド\n",
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("libraries");
  expect(result.stderr).toContain("mdmark check");
  expect(existsSync(join(dir, "guide.html"))).toBe(false);
});

// 無い文書を渡すと、パスを示して終わる（異常系（文書が無い））
test("test_error_when_document_missing", async () => {
  // 準備
  const dir = await createSampleDir();
  // 実行
  const result = await runCli(["export", "missing.md"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("missing.md");
  expect(existsSync(join(dir, "missing.html"))).toBe(false);
});

// 出力のパスへ書けないと、パスと直し方を示して終わる（異常系（出力先へ書けない））
test("test_error_when_output_unwritable", async () => {
  // 準備
  const dir = await createSampleDir();
  await writeFiles(dir, { blocked: "ファイル\n" });
  // 実行
  const result = await runCli(
    ["export", "guide.md", "--out", "blocked/guide.html"],
    dir,
  );
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("blocked/guide.html");
  expect(result.stderr).toContain("確かめて");
  expect(await readFile(join(dir, "blocked"), "utf8")).toBe("ファイル\n");
  expect(existsSync(join(dir, "guide.html"))).toBe(false);
});
