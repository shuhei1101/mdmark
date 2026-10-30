import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  linesOf,
  PNG_BYTES,
  runCli,
  TEST_LIB_SOURCE,
  useBrowser,
  useTempDirs,
  writeFiles,
} from "../cli.ts";

const createTempDir = useTempDirs();
const browser = useBrowser(createTempDir);

// build の設定の書き方: 行を足して使う
const BUILD_BASE = [
  '  include: ["**/*.md"]',
  '  exclude: ["dist/**"]',
  '  glossary: ["用語集.md"]',
  "  entry: README.md",
  "  out: dist/docs.html",
];

/** 設定ファイルの中身を作る */
function createConfig(buildLines: string[]): string {
  return [
    "index: index.yaml",
    "libraries:",
    "  test-lib: lib/test-lib.js",
    "build:",
    ...buildLines,
    "",
  ].join("\n");
}

/** 見本の文書群を作る: 入口 `README.md`・用語集の表を持つ `用語集.md`・外部ライブラリの印と画像を持つ `使い方/guide.md` と、3 つを載せた索引 */
async function createSampleDir(options?: {
  buildLines?: string[];
  readme?: string;
}): Promise<string> {
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig(options?.buildLines ?? BUILD_BASE),
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: top",
      "    path: README.md",
      "    title: 入口",
      "  - id: terms",
      "    path: 用語集.md",
      "    title: 用語集",
      "  - id: guide",
      "    path: 使い方/guide.md",
      "    title: 使い方",
      "",
    ].join("\n"),
    "README.md":
      options?.readme ??
      "# 入口\n\n[使い方](使い方/guide.md) を読む。\n\n印を書く。\n",
    "用語集.md": [
      "# 用語集",
      "",
      "<!-- glossary: term=用語 meaning=意味 -->",
      "",
      "| 用語 | 意味 |",
      "| --- | --- |",
      "| 印 | HTML コメントで書く指定 |",
      "",
      "<!-- /glossary -->",
      "",
    ].join("\n"),
    "使い方/guide.md":
      "# 使い方\n\n<!-- test-lib: a -->\n\n![図](../img/a.png)\n\n[入口へ](../README.md)\n",
    "lib/test-lib.js": TEST_LIB_SOURCE,
    "img/a.png": PNG_BYTES,
  });
  return dir;
}

// 3 つの文書を、文書をまたぐ用語と被参照が効く 1 枚にまとめる（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createSampleDir();
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual([
    "書き出した: dist/docs.html（文書 3 件）",
  ]);
  expect(result.stderr).toBe("");
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "dist", "docs.html"),
  );
  await page.waitForSelector("article.mdmark h1");
  await expect(
    page.locator("article.mdmark h1").textContent(),
  ).resolves.toContain("入口");
  await expect(
    page.locator(".mdmark-bundle-side .mdmark-doc-list a").count(),
  ).resolves.toBe(3);
  await expect(
    page.locator("article .mdmark-term").first().textContent(),
  ).resolves.toBe("印");
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector("article.mdmark h1")
      ?.textContent?.includes("使い方"),
  );
  await page.waitForFunction(
    () =>
      document.querySelector("article [data-mdmark-slot]")?.textContent ===
      "drawn:a",
  );
  await expect(
    page.locator(".mdmark-backlinks a").allTextContents(),
  ).resolves.toContain("入口");
  await expect(
    page
      .locator("article img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).resolves.toBeGreaterThan(0);
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 外した文書へのリンクを書いたまま残し、警告に出す（正常系（1 枚に含まれない文書へのリンクがある））
test("test_normal_when_link_outside_bundle", async () => {
  // 準備
  const dir = await createSampleDir({
    buildLines: [
      '  include: ["**/*.md"]',
      '  exclude: ["dist/**", "下書き/**"]',
      "  out: dist/docs.html",
    ],
    readme: "# 入口\n\n[メモ](下書き/メモ.md)\n",
  });
  await writeFiles(dir, { "下書き/メモ.md": "# メモ\n" });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual([
    "書き出した: dist/docs.html（文書 3 件）",
  ]);
  expect(
    linesOf(result.stderr).some(
      (line) => line.includes("README.md") && line.includes("下書き/メモ.md"),
    ),
  ).toBe(true);
  const { page } = await browser.openHtml(join(dir, "dist", "docs.html"));
  await page.waitForSelector("article.mdmark h1");
  const href = await page.locator("article p a").first().getAttribute("href");
  expect(decodeURI(href ?? "")).toBe("下書き/メモ.md");
  const titles = await page
    .locator(".mdmark-bundle-side .mdmark-doc-list a")
    .allTextContents();
  expect(titles).not.toContain("メモ");
  await page.close();
});

// 設定に build が無いと、書き方を示して終わる（異常系（build が無い））
test("test_error_when_build_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "README.md": "# 入口\n",
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("build.include");
  expect(result.stderr).toContain("build.out");
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(false);
});

// build.include がどの文書にも当たらないと、HTML を書かずに終わる（異常系（対象の文書が 0 件））
test("test_error_when_no_documents", async () => {
  // 準備
  const dir = await createSampleDir({
    buildLines: ['  include: ["nothing/**/*.md"]', "  out: dist/docs.html"],
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("0 件");
  expect(result.stderr).toContain("build.include");
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(false);
});

// build.out へ書けないと、パスと直し方を示して終わる（異常系（出力先へ書けない））
test("test_error_when_output_unwritable", async () => {
  // 準備
  const dir = await createSampleDir();
  await writeFiles(dir, { dist: "ファイル\n" });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("dist/docs.html");
  expect(result.stderr).toContain("確かめて");
  expect(await readFile(join(dir, "dist"), "utf8")).toBe("ファイル\n");
});

// 設定の aliases の YAML から作ったエイリアスを埋め、まとめた全ての文書で効かせる（正常系（エイリアスを読む））
test("test_normal_when_aliases", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "aliases:",
      "  - id: records",
      "    paths: [aliases/*.yaml]",
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
      "build:",
      '  include: ["*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": "# A\n\nテストを流す、開発サーバーを使う。\n\n[B へ](b.md)\n",
    "b.md": "# B\n\nここでもテストを流す、開発サーバーを使う。\n",
    "aliases/command.yaml": [
      "alias_type: command",
      "id: run-test",
      "name: テストを流す",
      "command: npm test",
      "",
    ].join("\n"),
    "aliases/env.yaml": [
      "alias_type: env",
      "id: dev-server",
      "name: 開発サーバー",
      "url: http://127.0.0.1:8767/",
      "",
    ].join("\n"),
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const html = await readFile(join(dir, "dist", "docs.html"), "utf8");
  expect(html).not.toContain("http://127.0.0.1:8767/");
  expect(html).not.toContain("dev-server");
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "dist", "docs.html"),
  );
  // 1 つ目の文書: コマンドの名前だけに下線が付き、ツールチップに npm test が出る
  await page.waitForSelector("article .mdmark-term");
  await expect(
    page.locator("article .mdmark-term").allTextContents(),
  ).resolves.toEqual(["テストを流す"]);
  await expect(
    page.locator("article .mdmark-term-tip code").textContent(),
  ).resolves.toBe("npm test");
  // 2 つ目の文書へ移っても同じ
  await page.locator('article p a[href="#/b.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article.mdmark h1")?.textContent?.includes("B"),
  );
  await page.waitForFunction(
    () =>
      document.querySelector("article .mdmark-term")?.textContent ===
      "テストを流す",
  );
  await expect(
    page.locator("article .mdmark-term").allTextContents(),
  ).resolves.toEqual(["テストを流す"]);
  await expect(
    page.locator("article .mdmark-term-tip code").textContent(),
  ).resolves.toBe("npm test");
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 設定の colorTheme を埋める設定に写し、まとめた全ての文書を選んだテーマで描く（正常系（テーマを選ぶ設定））
test("test_normal_when_color_theme", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "colorTheme: theme-slate",
      "build:",
      '  include: ["*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": "# A\n\n[B へ](b.md)\n",
    "b.md": "# B\n\nもう 1 つの文書。\n",
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "dist", "docs.html"));
  await page.emulateMedia({ colorScheme: "light" });
  const readBackground = () =>
    page.evaluate(() => {
      const root = document.querySelector("article.mdmark");
      return root ? getComputedStyle(root).backgroundColor : "";
    });
  // 最初に開いた文書
  await page.waitForFunction(() =>
    document.querySelector("article.mdmark h1")?.textContent?.includes("A"),
  );
  await expect(readBackground()).resolves.toBe("rgb(248, 250, 252)");
  // 文書の一覧から移った 2 つ目の文書
  await page.locator('article p a[href="#/b.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article.mdmark h1")?.textContent?.includes("B"),
  );
  await expect(readBackground()).resolves.toBe("rgb(248, 250, 252)");
  await page.close();
});
