import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  APP_TS,
  CHART_SOURCE,
  expect,
  GREET_TEXT_SOURCE,
  GREET_WITH_IMPORT_SOURCE,
  linesOf,
  openStandalone,
  openWithCsp,
  PNG_BYTES,
  runCli,
  THEME_SOURCE,
  test,
  VIEW_SOURCE,
  writeFiles,
} from "../cli.ts";
import {
  RANGE_COLOR,
  RANGE_CSS,
  RANGE_TS,
  rangeMarkdown,
  SYNTAX_ES_ROOT,
} from "../dist-page.ts";
import { openStandaloneWithFiles, readMediaSamples } from "../media.ts";

// 色分けのライブラリの本体と、手元に置く言語のモジュール（文書が使うのは `typescript` と `python`、`yaml` は使わない）
const SYNTAX_FILES = [
  "core.min.js",
  "languages/typescript.min.js",
  "languages/python.min.js",
  "languages/yaml.min.js",
];

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

// 文書が使う言語の分だけ色分けのモジュールを埋めた HTML を書き出し、外へ要求せずに色分けする（正常シナリオ（色分けするコードブロック））
test("test_normal_when_code_highlighted", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  const vendor: Record<string, string> = {};
  for (const file of SYNTAX_FILES) {
    vendor[`vendor/highlightjs/es/${file}`] = await readFile(
      join(SYNTAX_ES_ROOT, file),
      "utf8",
    );
  }
  // 使わない言語のモジュールを見分けられる文字が、手元のモジュールにある
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
  const result = await runCli(builtRoot, ["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  expect(existsSync(join(dir, "guide.html"))).toBe(true);
  const html = await readFile(join(dir, "guide.html"), "utf8");
  expect(html).not.toContain('name:"YAML"');
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "guide.html"),
  });
  const article = page.locator("article.mdmark");
  await expect(article.locator("h1")).toContainText("ガイド");
  for (const language of ["ts", "python"]) {
    await expect(
      article.locator(`code.language-${language} span[class*="hljs-"]`).first(),
    ).toBeVisible();
  }
  expect(opened.externalRequests()).toEqual([]);
});

// エイリアスを読む設定の行: `records` の配列を持つ YAML を指す行と、無いファイルを指す行
const ALIAS_CONFIG_LINES = [
  "aliases:",
  "  - id: records",
  "    paths: [aliases/records.yaml]",
  "    records: records",
  "    metadata:",
  "      alias_type: { type: ref, field: alias_type }",
  "  - id: missing",
  "    paths: [aliases/missing.yaml]",
  "    metadata:",
  "      alias_type: { type: ref, field: alias_type }",
  "",
].join("\n");

// `term` の `ワークスペース` と、値に URL とポートを持つ `env` の `開発サーバー`
const ALIAS_RECORDS = [
  "records:",
  "  - alias_type: term",
  "    id: workspace",
  "    name: ワークスペース",
  "    description: 話し合いの記録を置くフォルダ",
  "  - alias_type: env",
  "    id: dev-server",
  "    name: 開発サーバー",
  "    url: http://127.0.0.1:8767/",
  '    port: "8767"',
  "",
].join("\n");

// 設定の aliases の YAML から読めたエイリアスだけを埋めて書き出し、読めない行は警告にして終了コード 0 で終わり、env は HTML に入れない（正常シナリオ（エイリアスを読む））
test("test_normal_when_aliases", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": ALIAS_CONFIG_LINES,
    "aliases/records.yaml": ALIAS_RECORDS,
    "guide.md": "# ガイド\n\nワークスペースを置く。\n",
  });
  // 実行
  const result = await runCli(builtRoot, ["export", "guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "guide.html"))).toBe(true);
  // 読めなかった行のパスが警告に出る
  const warnings = linesOf(result.stderr);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("aliases/missing.yaml");
  // env の名前・URL・id が HTML のソースに入っていない
  const html = await readFile(join(dir, "guide.html"), "utf8");
  expect(html).not.toContain("開発サーバー");
  expect(html).not.toContain("http://127.0.0.1:8767/");
  expect(html).not.toContain("dev-server");
  // file:// で開くと、下線が付き、ツールチップに説明が出る
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "guide.html"),
  });
  const term = page.locator("article .mdmark-term");
  await expect(term).toHaveText(["ワークスペース"]);
  await term.hover();
  await expect(page.locator("article .mdmark-term-tip")).toContainText(
    "話し合いの記録を置くフォルダ",
  );
  expect(opened.externalRequests()).toEqual([]);
});

// 設定のテーマを描く先に当てた HTML を書き出し、file:// で開いて選んだテーマの配色で読む（正常シナリオ（テーマを選ぶ））
test("test_normal_when_theme_selected", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "colorTheme: theme-contrast",
      "libraries:",
      "  chart: lib/chart.js",
      "",
    ].join("\n"),
    "lib/chart.js": CHART_SOURCE,
    "guide.md": GUIDE,
    "api.md": "# API\n",
    "img/a.png": PNG_BYTES,
  });
  await page.emulateMedia({ colorScheme: "light" });
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
  // theme-contrast の明るい配色（地は白、リンクは濃い青）
  await expect(article).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(article.locator('a[href="api.md"]')).toHaveCSS(
    "color",
    "rgb(0, 55, 168)",
  );
  expect(opened.externalRequests()).toEqual([]);
});

// 画像を data URL で埋め、動画・音声を出力先のフォルダへコピーし、文書からの相対パスに無いファイルをアセットのルートで探す（正常シナリオ（画像・動画・音声を埋める））
test("test_normal_when_media_embedded", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
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
      "![操作](media/demo.mp4)",
      "",
      "![読み上げ](media/voice.mp3)",
      "",
      "![ロゴ](images/logo.png)",
      "",
      "[仕様書](files/spec.pdf)",
      "",
    ].join("\n"),
    "docs/images/chart.png": PNG_BYTES,
    "docs/images/dark.png": PNG_BYTES,
    "docs/images/build.gif": media.gif,
    "docs/media/demo.mp4": media.mp4,
    "docs/media/voice.mp3": media.mp3,
    "docs/files/spec.pdf": "%PDF-1.4\n",
    "assets/images/logo.png": PNG_BYTES,
  });
  // 実行
  const result = await runCli(builtRoot, ["export", "docs/guide.md"], dir);
  // 検証: 終了コード
  expect(result.code).toBe(0);
  // 検証: 動画・音声を出力先のフォルダへコピーし、添付はコピーしない
  const filesDir = join(dir, "docs", "guide_files");
  expect(await readFile(join(filesDir, "docs", "media", "demo.mp4"))).toEqual(
    media.mp4,
  );
  expect(await readFile(join(filesDir, "docs", "media", "voice.mp3"))).toEqual(
    media.mp3,
  );
  expect(existsSync(join(filesDir, "docs", "files"))).toBe(false);
  // 検証: 開いた HTML の画像は data URL、動画・音声はコピーを相対パスで指し、添付は書いたパスのまま
  const opened = await openStandaloneWithFiles(page, {
    tempDir,
    htmlFile: join(dir, "docs", "guide.html"),
    filesDir,
  });
  const article = page.locator("article.mdmark");
  await expect(article.locator("video")).toHaveCount(1);
  for (const alt of ["グラフ", "暗い構成", "ビルド", "ロゴ"]) {
    await expect(article.locator(`img[alt="${alt}"]`), alt).toHaveAttribute(
      "src",
      /^data:/,
    );
  }
  await expect(article.locator("video")).toHaveAttribute(
    "src",
    "guide_files/docs/media/demo.mp4",
  );
  await expect(article.locator("audio")).toHaveAttribute(
    "src",
    "guide_files/docs/media/voice.mp3",
  );
  await expect(
    article.locator('a.mdmark-card[data-card="file"]'),
  ).toHaveAttribute("href", "files/spec.pdf");
  // 検証: 外へのネットワークの要求が 0 件
  await page.waitForLoadState("networkidle");
  expect(opened.externalRequests()).toEqual([]);
});

// 起動の処理・拡張・部品・色分け・外部ライブラリを 1 つのスクリプトに束ね、blob: と動的 import を許さない環境で開いて読む（正常シナリオ（blob: と動的 import を許さない環境で開く））
test("test_normal_when_blob_and_dynamic_import_blocked", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  const vendor: Record<string, string> = {};
  for (const file of ["core.min.js", "languages/typescript.min.js"]) {
    vendor[`vendor/highlightjs/es/${file}`] = await readFile(
      join(SYNTAX_ES_ROOT, file),
      "utf8",
    );
  }
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "extensions: [extensions/greet.js]",
      "libraries:",
      "  chart: lib/chart.js",
      "  missing-lib: lib/missing.js",
      "syntax:",
      "  url: vendor/highlightjs/es/",
      "",
    ].join("\n"),
    "extensions/greet.js": GREET_WITH_IMPORT_SOURCE,
    "extensions/greet-text.js": GREET_TEXT_SOURCE,
    "lib/chart.js": CHART_SOURCE,
    "guide.md": [
      "# ガイド",
      "",
      "<!-- greet: 世界 -->",
      "",
      VIEW_SOURCE,
      "",
      "<!-- chart: a b -->",
      "",
      "<!-- missing-lib: c -->",
      "",
      "```ts",
      "const count: number = 1;",
      "```",
      "",
    ].join("\n"),
    ...vendor,
  });
  // 実行
  const result = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "out/guide.html"],
    dir,
  );
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "out", "guide.html"))).toBe(true);
  const opened = await openWithCsp(page, join(dir, "out", "guide.html"));
  const article = page.locator("article.mdmark");
  await expect(article.locator("h1")).toContainText("ガイド");
  await expect(
    article.locator("[data-mdmark-slot]", { hasText: "greet:読んだ:世界" }),
  ).toHaveCount(1);
  await expect(article.locator(".mdmark-view")).toHaveCount(1);
  await expect(article.locator("canvas")).toHaveCount(1);
  await expect(
    article.locator('code.language-ts span[class*="hljs-"]').first(),
  ).toBeVisible();
  await expect(article.locator(".mdmark-notice")).toHaveCount(1);
  await expect(article.locator(".mdmark-notice")).toContainText("missing-lib");
  expect(await opened.violations()).toEqual([]);
  expect(opened.blobRequests()).toEqual([]);
  await opened.close();
});

// 脚注を持つ文書を書き出し、file:// で開いて番号のツールチップと末尾の一覧を読む（正常シナリオ（脚注を持つ文書））
test("test_normal_when_footnotes", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features: {}\n",
    "notes.md": "出典がある[^src]。\n\n[^src]: 出典の説明\n",
  });
  // 実行
  const result = await runCli(
    builtRoot,
    ["export", "notes.md", "--out", "out/notes.html"],
    dir,
  );
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "out", "notes.html"))).toBe(true);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "out", "notes.html"),
  });
  const article = page.locator("article.mdmark");
  const tip = article.locator(".mdmark-fn-tip");
  await article.locator(".mdmark-fn-link").hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("出典の説明");
  const list = article.locator("details.mdmark-footnotes");
  await expect(list).not.toHaveAttribute("open", "");
  await list.locator("summary").click();
  const item = list.locator(".mdmark-fn-item");
  await expect(item).toBeVisible();
  await expect(item).toContainText("出典の説明");
  expect(opened.externalRequests()).toEqual([]);
});

// 取り込む文書と束ねていない名前のアイコンを埋め、開いたときに外へ要求せずに描く（正常シナリオ（取り込みとアイコンを埋める））
test("test_normal_when_includes_and_icons_embedded", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features: {}\n",
    "docs/guide.md": [
      "# 案内",
      "",
      "## `icon:sailboat` 航海",
      "",
      "<!-- include: 共通/手順.md#実行 -->",
      "",
      "<!-- include: ../src/app.ts#L3-L5 -->",
      "",
    ].join("\n"),
    "docs/共通/手順.md": "## 準備\n\n準備の段落\n\n## 実行\n\n実行の段落\n",
    "src/app.ts": APP_TS,
  });
  // 実行
  const result = await runCli(builtRoot, ["export", "docs/guide.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const htmlFile = join(dir, "docs", "guide.html");
  expect(existsSync(htmlFile)).toBe(true);
  const opened = await openStandalone(page, { tempDir, htmlFile });
  await expect(
    page.locator('article .mdmark-inline-icon[data-icon="sailboat"] svg'),
  ).toHaveCount(1);
  await expect(page.locator("article .mdmark-include").first()).toContainText(
    "実行の段落",
  );
  await expect(page.locator("article")).not.toContainText("準備の段落");
  const code = page.locator("article .mdmark-include code.language-ts");
  await expect(code).toContainText("const v3 = 3;");
  await expect(code).toContainText("const v5 = 5;");
  await expect(code).not.toContainText("const v6 = 6;");
  expect(opened.externalRequests()).toEqual([]);
});

// 範囲の ts の型を外して束ねたスクリプトに加え、blob: と動的 import を許さない環境で開いても、範囲の css と ts が効く（正常シナリオ（範囲のスクリプトと CSS））
test("test_normal_when_range_scripts", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": ["features:", "  html-scripts: true", ""].join("\n"),
    "guide.md": [
      "# ガイド",
      "",
      rangeMarkdown({ css: RANGE_CSS, ts: RANGE_TS }),
    ].join("\n"),
  });
  // 実行
  const result = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "out/guide.html"],
    dir,
  );
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "out", "guide.html"))).toBe(true);
  const external: string[] = [];
  page.on("request", (request) => {
    if (!/^(?:https?:\/\/127\.0\.0\.1|blob:|data:)/.test(request.url())) {
      external.push(request.url());
    }
  });
  const opened = await openWithCsp(page, join(dir, "out", "guide.html"));
  const scope = page.locator('article .mdmark-html[data-html-scope="0"]');
  const box = scope.locator(".box");
  await expect(box).toHaveCSS("background-color", RANGE_COLOR);
  await expect(async () => {
    await box.click();
    await expect(scope).toHaveClass(/\bis-open\b/, { timeout: 500 });
  }).toPass();
  expect(await opened.violations()).toEqual([]);
  expect(opened.blobRequests()).toEqual([]);
  expect(external).toEqual([]);
  await opened.close();
});
