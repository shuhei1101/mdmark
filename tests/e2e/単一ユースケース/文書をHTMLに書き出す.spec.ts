import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CHART_SOURCE,
  expect,
  linesOf,
  openStandalone,
  PNG_BYTES,
  runCli,
  THEME_SOURCE,
  test,
  writeFiles,
} from "../cli.ts";

// 表の印・用語集の表・Chart.js の印・相対パスで指す画像・他の文書へのリンク・script 要素を持つ文書
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
  "<!-- chart: a b -->",
  "",
  "![図](img/a.png)",
  "",
  "[API](api.md)",
  "",
  "<script>window.__ran = true</script>",
  "",
].join("\n");

// 設定・見本の文書と、手元のモジュール・画像・CSS を書く
async function writeSample(dir: string): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "theme: theme.css",
      "libraries:",
      "  chart: lib/chart.js",
      "",
    ].join("\n"),
    "theme.css": THEME_SOURCE,
    "lib/chart.js": CHART_SOURCE,
    "guide.md": GUIDE,
    "api.md": "# API\n",
    "img/a.png": PNG_BYTES,
  });
}

// 設定・外部ライブラリ・画像を埋めた HTML を書き出し、空のフォルダへ写して file:// で開いて読む（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeSample(dir);
  // 実行
  const result = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "out/guide.html"],
    dir,
  );
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "out", "guide.html"))).toBe(true);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "out", "guide.html"),
  });
  const article = page.locator("article.mdmark");
  await expect(article.locator("h1")).toContainText("ガイド");
  await expect(article.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".mdmark-notice")).toHaveCount(0);
  expect(opened.externalRequests()).toEqual([]);
  expect(await article.locator("button.mdmark-sort").count()).toBeGreaterThan(
    0,
  );
  expect(await article.locator("button.mdmark-pin").count()).toBeGreaterThan(0);
  const term = article.locator(".mdmark-term").first();
  await expect(term).toHaveText("印");
  await term.hover();
  await expect(article.locator(".mdmark-term-tip").first()).toBeVisible();
  await expect(article.locator("img")).toHaveJSProperty("complete", true);
  expect(
    await article
      .locator("img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  expect(
    await article.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--mdmark-radius").trim(),
    ),
  ).toBe("0px");
  await expect(article.locator('p a[href="api.md"]')).toHaveCount(1);
  expect(await page.evaluate(() => "__ran" in window)).toBe(false);
});

// 読めない画像とモジュールを警告に出し、読めたものだけを埋めて書き出す（正常シナリオ（読めない画像とモジュールがある））
test("test_normal_when_unreadable_assets", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "libraries:\n  chart: lib/missing.js\n",
    "guide.md":
      "# ガイド\n\n<!-- chart: a -->\n\n![図](img/missing.png)\n\n本文のほかの部分\n",
  });
  // 実行
  const result = await runCli(builtRoot, ["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "guide.html"))).toBe(true);
  const warnings = linesOf(result.stderr);
  expect(warnings.some((line) => line.includes("img/missing.png"))).toBe(true);
  expect(warnings.some((line) => line.includes("chart"))).toBe(true);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "guide.html"),
  });
  await expect(page.locator(".mdmark-notice")).toHaveCount(1);
  await expect(
    page.locator("article p", { hasText: "本文のほかの部分" }),
  ).toHaveCount(1);
  // 読めない画像のパスへの要求のほかは、外への要求が無い
  expect(
    opened
      .externalRequests()
      .filter((url) => !url.endsWith("/img/missing.png")),
  ).toEqual([]);
});

// 出力のパスの親がファイルのとき、書けないパスと直し方を示して終わる（異常シナリオ（出力先へ書けない））
test("test_error_when_output_unwritable", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeSample(dir);
  await writeFiles(dir, { blocked: "ファイル\n" });
  // 実行
  const result = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "blocked/guide.html"],
    dir,
  );
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("blocked/guide.html");
  expect(result.stderr).toContain("確かめて");
  expect(await readFile(join(dir, "blocked"), "utf8")).toBe("ファイル\n");
  expect(existsSync(join(dir, "guide.html"))).toBe(false);
});
