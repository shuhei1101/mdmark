import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { STRENGTH_TEXT, wrapDirective } from "../../unit/helpers/diagrams.ts";
import {
  copyMermaidVendor,
  countDynamicImportsInScripts,
  GREET_SOURCE,
  GREET_WITH_IMPORT_SOURCE,
  linesOf,
  MAP_STORE_CONFIG,
  mapStoreDoc,
  PNG_BYTES,
  readHighlightVendor,
  readMapStore,
  readMediaSamples,
  runCli,
  TEST_LIB_SOURCE,
  THEME_SOURCE,
  useBrowser,
  useTempDirs,
  VIEW_SOURCE,
  writeFiles,
} from "../cli.ts";
import {
  countCommentNodes,
  reportTraces,
  snapshotDom,
  TRACES_FILES,
} from "../traces.ts";

/** 色分けのライブラリ（`@highlightjs/cdn-assets@11.12.0` の `es/`）の場所 */
const HIGHLIGHT_ES_ROOT = fileURLToPath(
  new URL("../../../node_modules/@highlightjs/cdn-assets/es/", import.meta.url),
);

/** 色分けのライブラリの本体と、書き出しの試験で使用する言語のモジュール（`typescript`・`python` を文書が使用し、`yaml` は使用しない） */
const HIGHLIGHT_FILES = [
  "core.min.js",
  "languages/typescript.min.js",
  "languages/python.min.js",
  "languages/yaml.min.js",
];

const createTempDir = useTempDirs();
const browser = useBrowser(createTempDir);

// 表・用語集の表・外部ライブラリのマーカー・拡張のマーカー・相対パスの画像・api.md へのリンク・script 要素を持つ文書
const GUIDE = [
  "# ガイド",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 名前 | 数 |",
  "| --- | --- |",
  "| a | 2 |",
  "| b | 1 |",
  "",
  "<!-- /table -->",
  "",
  '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
  "",
  "| 用語 | 意味 |",
  "| --- | --- |",
  "| マーカー | HTML コメントで記載する指定 |",
  "",
  "<!-- /glossary -->",
  "",
  "本文にマーカーを記載する。",
  "",
  '<!-- test-lib: {"items": ["a", "b"]} -->',
  "",
  '<!-- greet: {"target": "世界"} -->',
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
      "schema: 2",
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
  await page.waitForSelector("article.zq h1");
  await page.waitForSelector("[data-zq-slot]:not(:empty)");
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-zq-slot]")].every(
      (slot) => slot.textContent !== "",
    ),
  );
  expect(externalRequests()).toEqual([]);
  expect(await page.locator("button.zq-sort").count()).toBeGreaterThan(0);
  await expect(page.locator(".zq-term").first().textContent()).resolves.toBe(
    "マーカー",
  );
  await expect(
    page.locator("article [data-zq-slot]").allTextContents(),
  ).resolves.toEqual(["drawn:a,b", "greet:世界"]);
  await expect(page.locator(".zq-notice").count()).resolves.toBe(0);
  await expect(
    page
      .locator("article img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).resolves.toBeGreaterThan(0);
  await expect(
    page.evaluate(() =>
      getComputedStyle(document.querySelector("article.zq") as Element)
        .getPropertyValue("--zq-radius")
        .trim(),
    ),
  ).resolves.toBe("0px");
  await expect(
    page.locator('.zq-backlinks a[href="api.md"]').count(),
  ).resolves.toBe(1);
  await expect(
    page.locator('article p a[href="api.md"]').count(),
  ).resolves.toBe(1);
  await expect(page.evaluate(() => "__ran" in window)).resolves.toBe(false);
  await page.close();
});

// 読み込めないものを警告に出し、読み込めたものだけを埋めて書き出す（正常系（読み込めない画像とモジュールがある））
test("test_normal_when_unreadable_assets", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "libraries:\n  test-lib: lib/missing.js\n",
    "guide.md":
      '# ガイド\n\n<!-- test-lib: {"items": ["a"]} -->\n\n![図](img/missing.png)\n\n本文のほかの部分\n',
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
  await page.waitForSelector(".zq-notice");
  await expect(page.locator(".zq-notice").count()).resolves.toBe(1);
  await expect(page.locator("article p").allTextContents()).resolves.toContain(
    "本文のほかの部分",
  );
  // 読み込めない画像のパスへの要求のほかは、外への要求が無い
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

// 無い文書を指定すると、パスを示して終わる（異常系（文書が無い））
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

// 出力のパスへ記載できないと、パスと修正方法を示して終わる（異常系（出力先へ書き込めない））
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
  expect(result.stderr).toContain("確認して");
  expect(await readFile(join(dir, "blocked"), "utf8")).toBe("ファイル\n");
  expect(existsSync(join(dir, "guide.html"))).toBe(false);
});

// 設定の tooltips を埋める設定にコピーし、開いた HTML で用語のツールチップを下に出す（正常系（ツールチップを下に出す設定））
test("test_normal_when_tooltip_placement", async () => {
  // 準備
  const dir = await createTempDir();
  const filler = Array.from({ length: 40 }, (_, i) => `詰め物の段落 ${i}\n`);
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: index.yaml",
      "tooltips:",
      "  placement: bottom",
      "  diagramPlacement: top",
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 2",
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
      "## 2 つ目のセクション",
      "",
      "索引を読み込む。",
      "",
      ...filler,
      "<!-- er -->",
      "",
      "```json",
      JSON.stringify(TOOLTIP_ER),
      "```",
      "",
      "<!-- /er -->",
      "",
      ...filler,
    ].join("\n"),
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "guide.html"));
  await page.waitForSelector(".zq-term");
  // 持ち主を画面の中ほどへスクロールし、ポインターを乗せる
  const term = page.locator(".zq-term");
  await term.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await term.hover();
  const rects = await page.evaluate(() => {
    const word = document.querySelector(".zq-term");
    const tip = document.querySelector(".zq-term-tip");
    return {
      termBottom: word?.getBoundingClientRect().bottom ?? Number.NaN,
      tipTop: tip?.getBoundingClientRect().top ?? Number.NaN,
    };
  });
  expect(rects.tipTop).toBeGreaterThanOrEqual(rects.termBottom);
  // ER 図のテーブルの説明のボタンにポインターを乗せると、ツールチップをテーブルの上に出す
  const info = page.locator(".zq-diagram .zq-diagram-info");
  await info.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await info.hover();
  const tableRects = await info.evaluate((element) => {
    const tip = document.getElementById(
      element.getAttribute("aria-describedby") ?? "",
    );
    const table = element.closest(".zq-diagram-er-table") ?? element;
    return {
      tableTop: table.getBoundingClientRect().top,
      tipBottom: tip?.getBoundingClientRect().bottom ?? Number.NaN,
    };
  });
  expect(tableRects.tipBottom).toBeLessThanOrEqual(tableRects.tableTop);
  await page.close();
});

/** 概要を持つテーブル 1 つの ER 図の定義 */
const TOOLTIP_ER = {
  title: "問い合わせのデータ",
  scope: "問い合わせの DB",
  updated: "2026-11-14",
  width: 320,
  tables: [
    {
      id: "inquiries",
      name: "inquiries",
      label: "問い合わせ",
      desc: "受け取った問い合わせ",
      x: 24,
      y: 24,
      w: 240,
      columns: [{ name: "id", type: "bigint", pk: true }],
    },
  ],
  relations: [],
};

// 文書が使用する言語の分だけ色分けのモジュールを埋め、開いたときに外へ要求せずに色分けする（正常系（色分けするコードブロック））
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
  // 使用しない言語のモジュールを見分けられる文字が、手元のモジュールにあること
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
  await page.waitForSelector("article.zq h1");
  await page.waitForSelector('article code.language-ts span[class^="hljs-"]');
  await page.waitForSelector(
    'article code.language-python span[class^="hljs-"]',
  );
  expect(externalRequests()).toEqual([]);
  await page.close();
});

/** エイリアスを読み込む試験の設定の行: 種類ごとの行で `aliases/` の YAML を読み込む */
const ALIAS_CONFIG_LINES = [
  "aliases:",
  "  - id: commands",
  "    paths: [aliases/commands.yaml]",
  "    alias_type: command",
  "  - id: servers",
  "    paths: [aliases/servers.yaml]",
  "    alias_type: env",
  "  - id: terms",
  "    paths: [aliases/terms.yaml]",
  "    alias_type: term",
];

/** エイリアスを読み込む試験のレコード: 使用できる `command`・値に URL を持つ `env`・説明が空の `term` */
const ALIAS_RECORD_FILES: Record<string, string> = {
  "aliases/commands.yaml": [
    "id: run-test",
    "name: テストを実行する",
    "command: npm test",
    "",
  ].join("\n"),
  "aliases/servers.yaml": [
    "id: dev-server",
    "name: 開発サーバー",
    "url: http://127.0.0.1:8767/",
    "",
  ].join("\n"),
  "aliases/terms.yaml": [
    "id: empty-term",
    "name: 空の用語",
    "description: ''",
    "",
  ].join("\n"),
};

/** 書き出した HTML に埋めたエイリアスの `id` を並べて返却する */
function embeddedAliasIds(html: string): string[] {
  const payload = /<script[^>]*id="zq-payload"[^>]*>([\s\S]*?)<\/script>/.exec(
    html,
  )?.[1];
  const parsed = JSON.parse(payload ?? "{}") as {
    aliases?: Array<{ id: string }>;
  };
  return (parsed.aliases ?? []).map((alias) => alias.id);
}

// 設定の aliases の YAML から作ったエイリアスを埋め、env を埋めずに書き出す（正常系（エイリアスを読み込む））
test("test_normal_when_aliases", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": `${ALIAS_CONFIG_LINES.join("\n")}\n`,
    "guide.md": "# ガイド\n\nテストを実行する、開発サーバーを使用する。\n",
    ...ALIAS_RECORD_FILES,
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const warnings = linesOf(result.stderr);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("aliases/terms.yaml");
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
  await page.waitForSelector(".zq-term");
  await expect(page.locator(".zq-term").allTextContents()).resolves.toEqual([
    "テストを実行する",
  ]);
  const tip = page.locator(".zq-term-tip");
  await expect(tip.locator("code").textContent()).resolves.toBe("npm test");
  await expect(
    tip.locator("button.zq-term-tip-copy").textContent(),
  ).resolves.toContain("コピー");
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 設定の colorTheme を埋める設定にコピーし、開いた HTML を選んだテーマで描く（正常系（テーマを選ぶ設定））
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
  await page.waitForSelector(".zq");
  const background = await page.evaluate(() => {
    const root = document.querySelector(".zq");
    return root ? getComputedStyle(root).backgroundColor : "";
  });
  expect(background).toBe("rgb(248, 250, 252)");
  await page.close();
});

// 設定の labels を埋める設定にコピーし、開いた HTML で操作できる部品のボタンを設定の文言で描く（正常系（部品の文言を替える設定））
test("test_normal_when_param_copy_label", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "labels:\n  paramCopy: コピー\n",
    "guide.md": `# ガイド\n\n${wrapDirective("param", STRENGTH_TEXT)}`,
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "guide.html"));
  const button = page.locator("button.zq-param-copy");
  await button.waitFor();
  expect(await button.textContent()).toBe("コピー");
  await page.close();
});

// 画像を data URL で埋め、動画・音声を出力の隣のフォルダへコピーし、文書からの相対パスに無いファイルをアセットのルートで探す（正常系（画像・動画・音声とアセットのルート））
test("test_normal_when_media_embedded", async () => {
  // 準備
  const dir = await createTempDir();
  const media = await readMediaSamples();
  await writeFiles(dir, {
    "mdmark.config.yaml": "assets:\n  root: assets\n",
    "docs/guide.md": [
      "# ガイド",
      "",
      "![グラフ](images/chart.png)",
      "",
      "![暗い構成](images/dark.png#only-dark)",
      "",
      "![ビルド](images/build.gif)",
      "",
      "![操作](media/demo.mp4){poster=images/poster.png}",
      "",
      "![スクリーンリーダー](media/voice.mp3)",
      "",
      "![ロゴ](images/logo.png)",
      "",
      "[仕様書](files/spec.pdf)",
      "",
    ].join("\n"),
    "docs/images/chart.png": PNG_BYTES,
    "docs/images/dark.png": PNG_BYTES,
    "docs/images/build.gif": media.gif,
    "docs/images/poster.png": PNG_BYTES,
    "docs/media/demo.mp4": media.mp4,
    "docs/media/voice.mp3": media.mp3,
    "docs/files/spec.pdf": "%PDF-1.4\n",
    "assets/images/logo.png": PNG_BYTES,
  });
  // 実行
  const result = await runCli(["export", "docs/guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["書き出した: docs/guide.html"]);
  expect(result.stderr).toBe("");
  // 動画・音声をコピーし、添付はコピーしない
  expect(
    await readFile(
      join(dir, "docs", "guide_files", "docs", "media", "demo.mp4"),
    ),
  ).toEqual(media.mp4);
  expect(
    await readFile(
      join(dir, "docs", "guide_files", "docs", "media", "voice.mp3"),
    ),
  ).toEqual(media.mp3);
  expect(existsSync(join(dir, "docs", "guide_files", "files"))).toBe(false);
  const { page, externalRequests } = await browser.openWithFiles(
    join(dir, "docs", "guide.html"),
    join(dir, "docs", "guide_files"),
  );
  await page.waitForSelector("article.zq figure.zq-media video");
  const embedded = await page.evaluate(() => {
    const src = (alt: string) =>
      document
        .querySelector(`article img[alt="${alt}"]`)
        ?.getAttribute("src") ?? "";
    const video = document.querySelector("article video");
    return {
      chart: src("グラフ"),
      dark: src("暗い構成"),
      gif: src("ビルド"),
      logo: src("ロゴ"),
      poster: video?.getAttribute("poster") ?? "",
      video: video?.getAttribute("src") ?? "",
      audio: document.querySelector("article audio")?.getAttribute("src") ?? "",
      card:
        document
          .querySelector('article a.zq-card[data-card="file"]')
          ?.getAttribute("href") ?? "",
    };
  });
  for (const key of ["chart", "dark", "gif", "logo", "poster"] as const) {
    expect(embedded[key], key).toMatch(/^data:/);
  }
  expect(embedded.dark).toMatch(/#only-dark$/);
  expect(embedded.video).toBe("guide_files/docs/media/demo.mp4");
  expect(embedded.audio).toBe("guide_files/docs/media/voice.mp3");
  expect(embedded.card).toBe("files/spec.pdf");
  await page.waitForLoadState("networkidle");
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 動画・音声のコピー先の _files/ へ書き込めないと、HTML を書き込まずにパスと修正方法を示して終わる（異常系（動画・音声のコピー先へ書き込めない））
test("test_error_when_media_copy_unwritable", async () => {
  // 準備
  const dir = await createTempDir();
  const media = await readMediaSamples();
  await writeFiles(dir, {
    "mdmark.config.yaml": "assets:\n  root: .\n",
    "guide.md": "# ガイド\n\n![操作](media/demo.mp4)\n",
    "media/demo.mp4": media.mp4,
    guide_files: "ファイル\n",
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("guide_files");
  expect(result.stderr).toContain("確認して");
  expect(await readFile(join(dir, "guide_files"), "utf8")).toBe("ファイル\n");
  expect(existsSync(join(dir, "guide.html"))).toBe(false);
});

/** 最上位で例外を投げる拡張の代役 */
const BROKEN_SOURCE =
  'throw new Error("broken の評価で失敗");\nexport default {};\n';

// 起動の処理・拡張・部品・色分け・外部ライブラリを 1 つのスクリプトにまとめ、blob: と動的 import を許さない環境でも描く（正常系（blob: と動的 import を許さない環境で開く））
test("test_normal_when_blob_and_dynamic_import_blocked", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "extensions: [extensions/broken.js, extensions/greet.js]",
      "libraries:",
      "  test-lib: lib/test-lib.js",
      "  missing-lib: lib/missing-lib.js",
      "syntax:",
      "  url: vendor/highlightjs/es/",
      "",
    ].join("\n"),
    "extensions/greet.js": GREET_WITH_IMPORT_SOURCE,
    "extensions/greet-text.js": 'export const TEXT = "読み込んだ";\n',
    "extensions/broken.js": BROKEN_SOURCE,
    "lib/test-lib.js": TEST_LIB_SOURCE,
    "guide.md": [
      "# ガイド",
      "",
      '<!-- greet: {"target": "世界"} -->',
      "",
      VIEW_SOURCE,
      "",
      '<!-- test-lib: {"items": ["a"]} -->',
      "",
      '<!-- missing-lib: {"items": ["b"]} -->',
      "",
      "```ts",
      "const count: number = 1;",
      "```",
      "",
    ].join("\n"),
    ...(await readHighlightVendor()),
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).toContain("missing-lib");
  const html = await readFile(join(dir, "guide.html"), "utf8");
  expect(html).not.toMatch(/<script[^>]*\ssrc=/);
  const opened = await browser.openWithCsp(join(dir, "guide.html"));
  const { page } = opened;
  await page.waitForSelector("article.zq h1");
  await page.waitForFunction(() =>
    [...document.querySelectorAll("article [data-zq-slot]")].some((slot) =>
      slot.textContent?.startsWith("greet:"),
    ),
  );
  await page.waitForSelector("article .zq-view");
  await page.waitForSelector('article code.language-ts span[class^="hljs-"]');
  await page.waitForSelector("article .zq-notice");
  await expect(
    page.locator("article [data-zq-slot]").allTextContents(),
  ).resolves.toContain("greet:読み込んだ:世界");
  await expect(
    page.locator("article [data-zq-slot]").allTextContents(),
  ).resolves.toContain("drawn:a");
  await expect(page.locator("article .zq-notice").count()).resolves.toBe(1);
  await expect(
    page.locator("article .zq-notice").textContent(),
  ).resolves.toContain("missing-lib");
  expect(opened.consoleErrors().join("\n")).toContain("broken の評価で失敗");
  await expect(opened.violations()).resolves.toEqual([]);
  expect(opened.inlineUrlScripts()).toEqual([]);
  await opened.close();
});

/** 1〜12 行目に `const v{行} = {行};` を持つ `src/app.ts` の本文 */
const APP_TS = Array.from(
  { length: 12 },
  (_, index) => `const v${index + 1} = ${index + 1};`,
).join("\n");

// 取り込む文書とまとめていない名前のアイコンの形状を埋め、開いたときに外へ要求せずに描く（正常系（取り込みとアイコンを埋める））
test("test_normal_when_includes_and_icons", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features: {}\n",
    "docs/guide.md": [
      "# 案内",
      "",
      "## `icon:sailboat` 航海 `icon:no-such-icon`",
      "",
      '<!-- include: {"path": "共通/手順.md", "heading": "実行"} -->',
      "",
      '<!-- include: {"path": "../src/app.ts", "lines": {"from": 3, "to": 5}} -->',
      "",
      '<!-- include: {"path": "missing.md"} -->',
      "",
    ].join("\n"),
    "docs/共通/手順.md": [
      "## 準備",
      "",
      "準備の段落",
      "",
      "## 実行",
      "",
      "実行の段落",
      "",
      '<!-- include: {"path": "../../src/app.ts", "heading": "L1"} -->',
      "",
    ].join("\n"),
    "src/app.ts": APP_TS,
  });
  // 実行
  const result = await runCli(["export", "docs/guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const stderr = linesOf(result.stderr);
  expect(stderr.some((line) => line.includes("missing.md"))).toBe(true);
  expect(stderr.some((line) => line.includes("no-such-icon"))).toBe(true);
  const htmlFile = join(dir, "docs", "guide.html");
  const { page, externalRequests } = await browser.openHtml(htmlFile);
  await page.waitForSelector("article.zq h1");
  await page.waitForSelector('.zq-inline-icon[data-icon="sailboat"] svg');
  const article = page.locator("article.zq");
  await expect(article.textContent()).resolves.toContain("実行の段落");
  await expect(article.textContent()).resolves.not.toContain("準備の段落");
  const codes = await page.locator("code.language-ts").allTextContents();
  expect(codes.some((code) => code.includes("const v1 = 1;"))).toBe(true);
  expect(
    codes.some(
      (code) =>
        code.includes("const v3 = 3;") &&
        code.includes("const v5 = 5;") &&
        !code.includes("const v6 = 6;"),
    ),
  ).toBe(true);
  await expect(
    page.locator(".zq-syntax-warning", { hasText: "missing.md" }).count(),
  ).resolves.toBe(1);
  await page.waitForFunction(() =>
    document
      .querySelector("article")
      ?.innerHTML.includes("<code>icon:no-such-icon</code>"),
  );
  expect(externalRequests()).toEqual([]);
  const source = await readFile(htmlFile, "utf8");
  expect(source).toMatch(/\/\*! lucide /);
  expect(source).toContain("sailboat");
  expect(source).not.toContain('"anchor"');
});

/** 型の注釈を持ち、ノードを押すと根の要素に class `is-open` を付与・解除し、`destroy` で `window.__mdmarkDestroyed` を 1 増やす範囲の文書 */
const RANGE_SCRIPT_DOC = [
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">ノード</div>',
  "```",
  "",
  "```css",
  ".box { background-color: rgb(255, 0, 0); }",
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): (() => void) => {",
  '  const box = root.querySelector<HTMLElement>(".box");',
  "  const onClick = (): void => {",
  '    root.classList.toggle("is-open");',
  "  };",
  '  box?.addEventListener("click", onClick);',
  "  return () => {",
  "    const w = window as unknown as { __mdmarkDestroyed?: number };",
  "    w.__mdmarkDestroyed = (w.__mdmarkDestroyed ?? 0) + 1;",
  "  };",
  "};",
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

// 範囲の ts を変換してまとめたスクリプトに加え、blob: と動的 import を許さない環境でも動かす（正常系（範囲のスクリプトと CSS））
test("test_normal_when_range_scripts", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": ["features:", "  html-scripts: true", ""].join("\n"),
    "guide.md": ["# ガイド", "", RANGE_SCRIPT_DOC].join("\n"),
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const html = await readFile(join(dir, "guide.html"), "utf8");
  expect(html).not.toMatch(/<script[^>]*\ssrc=/);
  const opened = await browser.openWithCsp(join(dir, "guide.html"));
  const { page } = opened;
  const box = page.locator("article div.zq-html .box");
  await box.waitFor();
  await expect(
    box.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).resolves.toBe("rgb(255, 0, 0)");
  await page.waitForFunction(() => {
    document.querySelector<HTMLElement>("article div.zq-html .box")?.click();
    return (
      document
        .querySelector("article div.zq-html")
        ?.classList.contains("is-open") === true
    );
  });
  await expect(opened.violations()).resolves.toEqual([]);
  expect(opened.inlineUrlScripts()).toEqual([]);
  await opened.close();
});

// 端末の設定と上のフォルダの設定を重ねて書き出し、theme と extensions は記載した設定ファイルのフォルダから読み込む（正常系（設定を重ねる））
test("test_normal_when_cascaded", async () => {
  // 準備
  const dir = await createTempDir();
  const settingsFiles = {
    "settings/settings.yaml":
      "config:\n  cascade: true\nfeatures:\n  callout: false\n",
    "work/mdmark.config.yaml":
      "theme: ./theme.css\nextensions: [./ext/greet.js]\n",
    "work/theme.css": THEME_SOURCE,
    "work/ext/greet.js": GREET_SOURCE,
    "work/docs/mdmark.config.yaml": "features:\n  table: false\n",
    "work/docs/guide.md": [
      "# ガイド",
      "",
      "> [!NOTE]",
      "> 注意書き",
      "",
      '<!-- table: {"kind": "data"} -->',
      "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "<!-- /table -->",
      "",
      '<!-- greet: {"target": "世界"} -->',
      "",
    ].join("\n"),
  };
  await writeFiles(dir, settingsFiles);
  const settings = join(dir, "settings", "settings.yaml");
  const before = await Promise.all(
    [
      settings,
      join(dir, "work", "mdmark.config.yaml"),
      join(dir, "work", "docs", "mdmark.config.yaml"),
    ].map((path) => readFile(path, "utf8")),
  );
  // 実行
  const result = await runCli(
    ["export", "guide.md"],
    join(dir, "work", "docs"),
    {
      MDMARK_CONFIG: settings,
    },
  );
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["書き出した: guide.html"]);
  const { page } = await browser.openHtml(
    join(dir, "work", "docs", "guide.html"),
  );
  await page.waitForSelector("article.zq h1");
  await page.waitForFunction(
    () => document.querySelector("[data-zq-slot]")?.textContent !== "",
  );
  await expect(page.locator(".markdown-alert").count()).resolves.toBe(0);
  await expect(page.locator("article blockquote").count()).resolves.toBe(1);
  await expect(page.locator("button.zq-sort").count()).resolves.toBe(0);
  await expect(
    page.locator("article [data-zq-slot]").allTextContents(),
  ).resolves.toEqual(["greet:世界"]);
  await expect(
    page.evaluate(() =>
      getComputedStyle(document.querySelector("article.zq") as Element)
        .getPropertyValue("--zq-radius")
        .trim(),
    ),
  ).resolves.toBe("0px");
  await page.close();
  const after = await Promise.all(
    [
      settings,
      join(dir, "work", "mdmark.config.yaml"),
      join(dir, "work", "docs", "mdmark.config.yaml"),
    ].map((path) => readFile(path, "utf8")),
  );
  expect(after).toEqual(before);
});

// 端末の設定を YAML として読み込めないとき、そのパスと行を示して書き出さずに終わる（異常系（端末の設定を読み込めない・終了コード 1））
test("test_error_when_settings_unreadable", async () => {
  // 準備
  const dir = await createSampleDir();
  const settingsDir = await createTempDir();
  await writeFiles(settingsDir, {
    "settings.yaml": "features:\n  callout: false\nlibraries: [a, b}\n",
  });
  const settings = join(settingsDir, "settings.yaml");
  // 実行
  const result = await runCli(["export", "guide.md"], dir, {
    MDMARK_CONFIG: settings,
  });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("settings.yaml");
  expect(result.stderr).toContain("3 行目");
  expect(result.stderr).toContain("字下げと記載方法を修正してください");
  expect(existsSync(join(dir, "guide.html"))).toBe(false);
});

// mermaid のコードブロックがある文書のときだけ mermaid をまとめて埋め、開いたときに外へ要求せずに図にする（正常系（mermaid のコードブロック））
test("test_normal_when_mermaid_embedded", async () => {
  // 準備
  const dir = await createTempDir();
  await copyMermaidVendor(dir);
  await writeFiles(dir, {
    "mdmark.config.yaml":
      "mermaid:\n  url: vendor/mermaid/mermaid.esm.min.mjs\n",
    "guide.md": [
      "# ガイド",
      "",
      "```mermaid",
      "flowchart LR",
      "  A[受付] --> B[回答]",
      "```",
      "",
    ].join("\n"),
    "plain.md": "# 段落\n\n本文だけ。\n",
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  const plain = await runCli(["export", "plain.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(plain.code).toBe(0);
  const html = await readFile(join(dir, "guide.html"), "utf8");
  const plainHtml = await readFile(join(dir, "plain.html"), "utf8");
  expect(countDynamicImportsInScripts(html)).toBe(
    countDynamicImportsInScripts(plainHtml),
  );
  expect(plainHtml.length).toBeLessThan(html.length - 1_000_000);
  expect(plainHtml).not.toContain("mermaidModule");
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "guide.html"),
  );
  await page.waitForSelector(
    'article figure.zq-diagram[data-diagram="mermaid"] .zq-mermaid > svg',
    {
      timeout: 60_000,
    },
  );
  expect(externalRequests()).toEqual([]);
  await page.close();
}, 180_000);

// 設定の map を埋める設定にコピーし、開いた HTML の map の図を設定の種類と線で描く（正常系（map の設定））
test("test_normal_when_map_config", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": MAP_STORE_CONFIG,
    "guide.md": mapStoreDoc("ガイド"),
  });
  // 実行
  const result = await runCli(["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "guide.html"),
  );
  await expect(readMapStore(page)).resolves.toEqual({
    label: "保存先",
    shape: "rect",
    color: "purple",
    dash: expect.stringMatching(/\d/),
  });
  expect(externalRequests()).toEqual([]);
  await page.close();
}, 180_000);

/** 隠す書き出しの結合テストのフォルダを作り、隠した書き出しと `--keep-traces` の書き出しの両方を書き出す */
async function exportBothTraces(): Promise<{
  dir: string;
  hidden: Awaited<ReturnType<typeof runCli>>;
  kept: Awaited<ReturnType<typeof runCli>>;
}> {
  const dir = await createTempDir();
  await copyMermaidVendor(dir);
  await writeFiles(dir, TRACES_FILES);
  const hidden = await runCli(["export", "mdmark-intro.md"], dir);
  const kept = await runCli(
    ["export", "mdmark-intro.md", "--out", "kept.html", "--keep-traces"],
    dir,
  );
  return { dir, hidden, kept };
}

/** CSP を付けて開き、mermaid の図と範囲の部品が描かれるまで待つ */
async function openTraces(file: string) {
  const opened = await browser.openWithCsp(file);
  await opened.page.waitForSelector(
    'article figure[data-diagram="mermaid"] svg[aria-roledescription]',
    {
      timeout: 60_000,
    },
  );
  await opened.page.waitForFunction(
    () =>
      document
        .querySelector("article")
        ?.textContent?.includes("greet:利用者") === true,
  );
  return opened;
}

// 隠さない書き出しを指定しないとき、mdmark の名前を別名へ置き換え、コメント・バージョン・mdmark 自身のライセンスの表記を削除して書き出す（正常系（mdmark を使用していることを隠す））
test("test_normal_when_traces_hidden", async () => {
  // 準備
  const { dir, hidden, kept } = await exportBothTraces();
  // 実行
  const html = await readFile(join(dir, "mdmark-intro.html"), "utf8");
  const report = reportTraces(html);
  // 検証
  expect(hidden.code).toBe(0);
  expect(linesOf(hidden.stdout)).toEqual(["書き出した: mdmark-intro.html"]);
  expect(kept.code).toBe(0);
  expect(report.outside).toBe(0);
  expect(report.generated).toBe(0);
  expect(report.markdownNames).toBe(0);
  expect(report.markdown).toContain("mdmark は Markdown を描きます");
  expect(report.comments).toBe(0);
  expect(report.markdown).not.toContain("<!-- todo -->");
  for (const marker of [
    "<!-- html -->",
    "<!-- table: data -->",
    "<!-- /table -->",
  ]) {
    expect(report.markdown).toContain(marker);
  }
  expect(html).not.toMatch(/-version:"v/);
  expect(html).toMatch(/\/\*! lucide /);
  expect(html).not.toContain("<!-- lucide");
  expect(html).toContain("<title>mdmark の紹介</title>");
  const hiddenPage = await openTraces(join(dir, "mdmark-intro.html"));
  const keptPage = await openTraces(join(dir, "kept.html"));
  expect(hiddenPage.consoleErrors()).toEqual([]);
  await expect(countCommentNodes(hiddenPage.page)).resolves.toBe(0);
  await expect(snapshotDom(hiddenPage.page)).resolves.toEqual(
    await snapshotDom(keptPage.page),
  );
  await expect(
    hiddenPage.page.evaluate(
      () =>
        getComputedStyle(document.querySelector("article h1") as Element)
          .letterSpacing,
    ),
  ).resolves.toBe("3px");
  await hiddenPage.page.locator("article .box").click();
  await expect(
    hiddenPage.page.evaluate(() => ({
      open:
        document
          .querySelector("article .zq-html")
          ?.classList.contains("is-open") ?? false,
      flag: Reflect.get(window, "__zqOpened"),
    })),
  ).resolves.toEqual({ open: true, flag: true });
  await expect(
    hiddenPage.page.locator("article pre code").last().textContent(),
  ).resolves.toContain("<zq-chart>{}</zq-chart>");
  await hiddenPage.close();
  await keptPage.close();
}, 240_000);

// --keep-traces のとき、名前を置き換えず、コメントとバージョンを残して書き出す（正常系（隠さない書き出しを指定する））
test("test_normal_when_traces_kept", async () => {
  // 準備
  const { dir, kept } = await exportBothTraces();
  // 実行
  const html = await readFile(join(dir, "kept.html"), "utf8");
  // 検証
  expect(kept.code).toBe(0);
  expect(html).toContain('class="mdmark"');
  expect(html).toContain(":root{--mdmark-version:");
  expect(html).toContain('id="mdmark-payload"');
  expect(html).toContain("<!-- lucide");
  const markdown = (
    JSON.parse(
      /<script type="application\/json" id="mdmark-payload">([\s\S]*?)<\/script>/.exec(
        html,
      )?.[1] ?? "{}",
    ) as { docs: Array<{ markdown: string }> }
  ).docs[0]?.markdown;
  expect(markdown).toBe(TRACES_FILES["mdmark-intro.md"]);
}, 240_000);
