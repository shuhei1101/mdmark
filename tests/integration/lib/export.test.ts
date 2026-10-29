import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

/** 色分けのライブラリ（`@highlightjs/cdn-assets@11.12.0` の `es/`）の場所 */
const HIGHLIGHT_ES_ROOT = fileURLToPath(
  new URL("../../../node_modules/@highlightjs/cdn-assets/es/", import.meta.url),
);

/** 色分けのライブラリの本体と、書き出しの試験で使う言語のモジュール（`typescript`・`python` を文書が使い、`yaml` は使わない） */
const HIGHLIGHT_FILES = [
  "core.min.js",
  "languages/typescript.min.js",
  "languages/python.min.js",
  "languages/yaml.min.js",
];

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
  // 読めない画像のパスへの要求のほかは、外への要求が無い
  expect(
    externalRequests().filter((url) => !url.endsWith("/img/missing.png")),
  ).toEqual([]);
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

// 設定の tooltips を埋める設定に写し、開いた HTML で用語のツールチップを下に出す（正常系（ツールチップを下に出す設定））
test("test_normal_when_tooltip_placement", async () => {
  // 準備
  const dir = await createTempDir();
  const filler = Array.from({ length: 40 }, (_, i) => `詰め物の段落 ${i}\n`);
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: index.yaml",
      "tooltips:",
      "  placement: bottom",
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: guide",
      "    path: guide.md",
      "    title: ガイド",
      "terms:",
      "  - id: index",
      "    term: 索引",
      "    meaning: 文書と用語を並べた YAML のファイル",
      "",
    ].join("\n"),
    "guide.md": [
      "# ガイド",
      "",
      ...filler,
      "## 2 つ目の節",
      "",
      "索引を読む。",
      "",
      ...filler,
    ].join("\n"),
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "guide.html"));
  await page.waitForSelector(".mdmark-term");
  // 持ち主を画面の中ほどへ送り、ポインターを乗せる
  const term = page.locator(".mdmark-term");
  await term.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await term.hover();
  const rects = await page.evaluate(() => {
    const word = document.querySelector(".mdmark-term");
    const tip = document.querySelector(".mdmark-term-tip");
    return {
      termBottom: word?.getBoundingClientRect().bottom ?? Number.NaN,
      tipTop: tip?.getBoundingClientRect().top ?? Number.NaN,
    };
  });
  expect(rects.tipTop).toBeGreaterThanOrEqual(rects.termBottom);
  await page.close();
});

// 文書が使う言語の分だけ色分けのモジュールを埋め、開いたときに外へ要求せずに色分けする（正常系（色分けするコードブロック））
test("test_normal_when_syntax_highlighted", async () => {
  // 準備
  const dir = await createTempDir();
  const vendor: Record<string, string> = {};
  for (const file of HIGHLIGHT_FILES) {
    vendor[`vendor/highlightjs/es/${file}`] = await readFile(
      join(HIGHLIGHT_ES_ROOT, file),
      "utf8",
    );
  }
  // 使わない言語のモジュールを見分けられる文字が、手元のモジュールにあること
  expect(vendor["vendor/highlightjs/es/languages/yaml.min.js"]).toContain(
    'name:"YAML"',
  );
  await writeFiles(dir, {
    "mdmark.config.yaml": "syntax:\n  url: vendor/highlightjs/es/\n",
    "guide.md": [
      "# ガイド",
      "",
      "```ts",
      "const count: number = 1;",
      "```",
      "",
      "```python",
      "def greet(name):",
      "    return name",
      "```",
      "",
    ].join("\n"),
    ...vendor,
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  const html = await readFile(join(dir, "guide.html"), "utf8");
  expect(html).not.toContain('name:"YAML"');
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "guide.html"),
  );
  await page.waitForSelector("article.mdmark h1");
  await page.waitForSelector('article code.language-ts span[class^="hljs-"]');
  await page.waitForSelector(
    'article code.language-python span[class^="hljs-"]',
  );
  expect(externalRequests()).toEqual([]);
  await page.close();
});

/** エイリアスを読む試験の設定の行: `aliases/` の YAML を `alias_type` の列で種類を決めて読む */
const ALIAS_CONFIG_LINES = [
  "aliases:",
  "  - id: records",
  "    paths: [aliases/*.yaml]",
  "    metadata:",
  "      alias_type: { type: ref, field: alias_type }",
];

/** エイリアスを読む試験のレコード: 使える `command`・値に URL を持つ `env`・説明が空の `term` */
const ALIAS_RECORD_FILES: Record<string, string> = {
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
  "aliases/term.yaml": [
    "alias_type: term",
    "id: empty-term",
    "name: 空の用語",
    "description: ''",
    "",
  ].join("\n"),
};

/** 書き出した HTML に埋めたエイリアスの `id` を並べて返す */
function embeddedAliasIds(html: string): string[] {
  const payload =
    /<script[^>]*id="mdmark-payload"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  const parsed = JSON.parse(payload ?? "{}") as {
    aliases?: Array<{ id: string }>;
  };
  return (parsed.aliases ?? []).map((alias) => alias.id);
}

// 設定の aliases の YAML から作ったエイリアスを埋め、env を埋めずに書き出す（正常系（エイリアスを読む））
test("test_normal_when_aliases", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": `${ALIAS_CONFIG_LINES.join("\n")}\n`,
    "guide.md": "# ガイド\n\nテストを流す、開発サーバーを使う。\n",
    ...ALIAS_RECORD_FILES,
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const warnings = linesOf(result.stderr);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("aliases/term.yaml");
  expect(warnings[0]).toContain("alias_required_empty");
  // env は埋めない: 値の URL と id が HTML のソースに無い
  const html = await readFile(join(dir, "guide.html"), "utf8");
  expect(html).not.toContain("http://127.0.0.1:8767/");
  expect(html).not.toContain("dev-server");
  expect(embeddedAliasIds(html)).toEqual(["run-test"]);
  // 開いた文書: コマンドの名前に下線が付き、ツールチップにコマンドとコピーのボタンが出る
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "guide.html"),
  );
  await page.waitForSelector(".mdmark-term");
  await expect(page.locator(".mdmark-term").allTextContents()).resolves.toEqual(
    ["テストを流す"],
  );
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.locator("code").textContent()).resolves.toBe("npm test");
  await expect(
    tip.locator("button.mdmark-term-tip-copy").textContent(),
  ).resolves.toContain("コピー");
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 設定の colorTheme を埋める設定に写し、開いた HTML を選んだテーマで描く（正常系（テーマを選ぶ設定））
test("test_normal_when_color_theme", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "colorTheme: theme-slate\n",
    "guide.md": "# ガイド\n\n[リンク](https://example.com/) を含む段落。\n",
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "guide.html"));
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForSelector(".mdmark");
  const background = await page.evaluate(() => {
    const root = document.querySelector(".mdmark");
    return root ? getComputedStyle(root).backgroundColor : "";
  });
  expect(background).toBe("rgb(248, 250, 252)");
  await page.close();
});
