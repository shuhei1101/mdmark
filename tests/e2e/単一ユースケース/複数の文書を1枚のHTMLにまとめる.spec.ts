import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  cascadeSettings,
  cascadeTheme,
  themeValue,
  writeSettings,
} from "../cascade.ts";
import {
  CHART_SOURCE,
  expect,
  GREET_TEXT_SOURCE,
  GREET_WITH_IMPORT_SOURCE,
  linesOf,
  openStandalone,
  openWithCsp,
  PNG_BYTES,
  runCli,
  test,
  VIEW_SOURCE,
  writeFiles,
  writeSampleDocs,
} from "../cli.ts";
import {
  RANGE_COLOR,
  RANGE_CSS,
  RANGE_TS,
  rangeMarkdown,
  SYNTAX_ES_ROOT,
} from "../dist-page.ts";
import { openStandaloneWithFiles, readMediaSamples } from "../media.ts";
import {
  copyMermaidDist,
  MERMAID_EMBED_MIN_BYTES,
  MERMAID_FLOWCHART,
  MERMAID_SVG,
  MERMAID_WAIT_MS,
} from "../mermaid.ts";

// 操作が要素に届かないときに、ケースの上限まで待たずに落とす（expect の待ちと同じ 30 秒）
test.use({ actionTimeout: 30_000 });

// 3 つの文書を、文書をまたぐ用語と被参照が有効になる 1 枚にまとめる（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeSampleDocs(dir);
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(true);
  expect(linesOf(result.stdout)).toEqual([
    "書き出した: dist/docs.html（文書 3 件）",
  ]);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  await expect(page.locator("article.mdmark h1")).toContainText("入口");
  await expect(
    page.locator(".mdmark-bundle-side .mdmark-doc-list a"),
  ).toHaveCount(3);
  // 用語集の文書の表の用語が、入口の文書の本文でもツールチップを出す
  const term = page.locator("article .mdmark-term").first();
  await expect(term).toHaveText("印");
  await term.hover();
  await expect(page.locator("article .mdmark-term-tip").first()).toBeVisible();
  // ポインターを本文の外へ動かして、リンクを覆うことがあるツールチップを閉じる
  await page.mouse.move(0, 0);
  await expect(page.locator("article .mdmark-term-tip").first()).toBeHidden();
  // 入口からリンクされた文書の末尾に、入口が関連文書として出る
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("使い方");
  await expect(page.locator(".mdmark-backlinks a")).toContainText(["入口"]);
  expect(opened.externalRequests()).toEqual([]);
});

// 除外した文書へのリンクを記載したまま残し、警告に出す（正常シナリオ（1 枚に含まれない文書へのリンクがある））
test("test_normal_when_link_outside_bundle", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  await writeSampleDocs(dir, {
    buildLines: [
      '  include: ["**/*.md"]',
      '  exclude: ["node_modules/**", "dist/**", "下書き/**"]',
      '  glossary: ["用語集.md"]',
      "  entry: README.md",
      "  out: dist/docs.html",
    ],
    readme: "# 入口\n\n[メモ](下書き/メモ.md)\n",
  });
  await writeFiles(dir, { "下書き/メモ.md": "# メモ\n" });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
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
  await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  const href = await page.locator("article p a").first().getAttribute("href");
  expect(decodeURI(href ?? "")).toBe("下書き/メモ.md");
  await expect(
    page.locator(".mdmark-bundle-side .mdmark-doc-list a", { hasText: "メモ" }),
  ).toHaveCount(0);
});

// build.include がどの文書にも該当しないと、HTML を書き込まずに終わる（異常シナリオ（対象の文書が 0 件））
test("test_error_when_no_documents", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeSampleDocs(dir, {
    buildLines: ['  include: ["nothing/**/*.md"]', "  out: dist/docs.html"],
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("0 件");
  expect(result.stderr).toContain("build.include");
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(false);
});

// 設定の aliases の YAML から読み込んだエイリアスを、どの文書にも有効にして 1 枚にまとめ、env は HTML に入れない（正常シナリオ（エイリアスを読み込む））
test("test_normal_when_aliases", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeSampleDocs(dir, {
    readme:
      "# 入口\n\n[使い方](使い方/guide.md) を読む。\n\n単体テストを流す。\n",
  });
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}${[
      "aliases:",
      "  - id: commands",
      "    paths: [aliases/commands.yaml]",
      "    alias_type: command",
      "    records: records",
      "  - id: servers",
      "    paths: [aliases/servers.yaml]",
      "    alias_type: env",
      "    records: records",
      "",
    ].join("\n")}`,
    "aliases/commands.yaml": [
      "records:",
      "  - id: unit-test",
      "    name: 単体テスト",
      "    command: npm run test:unit",
      "",
    ].join("\n"),
    "aliases/servers.yaml": [
      "records:",
      "  - id: dev-server",
      "    name: 開発サーバー",
      "    url: http://127.0.0.1:8767/",
      "",
    ].join("\n"),
    "使い方/guide.md": "# 使い方\n\n単体テストを流す。\n",
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual([
    "書き出した: dist/docs.html（文書 3 件）",
  ]);
  // env の名前・URL・id がまとめた HTML のソースに入っていない
  const html = await readFile(join(dir, "dist", "docs.html"), "utf8");
  expect(html).not.toContain("開発サーバー");
  expect(html).not.toContain("http://127.0.0.1:8767/");
  expect(html).not.toContain("dev-server");
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  // 入口の文書: 下線が付き、ツールチップにコードとコピーのボタンが出る
  await expect(page.locator("article.mdmark h1")).toContainText("入口");
  const term = page.locator("article .mdmark-term");
  await expect(term).toHaveText(["単体テスト"]);
  await term.hover();
  const tip = page.locator("article .mdmark-term-tip");
  await expect(tip.locator("code")).toHaveText("npm run test:unit");
  await expect(tip.locator("button.mdmark-term-tip-copy")).toBeVisible();
  // ポインターを本文の外へ動かして、リンクを覆うことがあるツールチップを閉じる
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
  // 一覧から開いたほかの文書: 同じエイリアスで下線が付く
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("使い方");
  await expect(page.locator("article .mdmark-term")).toHaveText(["単体テスト"]);
  expect(opened.externalRequests()).toEqual([]);
});

// 設定のテーマを描く先に適用した 1 枚を書き出し、ダークのブラウザで入口の文書と一覧から開いた文書を選んだテーマの暗い配色で読み込む（正常シナリオ（テーマを選ぶ））
test("test_normal_when_theme_selected", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  await writeSampleDocs(dir);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}colorTheme: theme-paper\n`,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(true);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  const article = page.locator("article.mdmark");
  // theme-paper の暗い配色（入口の文書）
  await expect(article.locator("h1")).toContainText("入口");
  await expect(article).toHaveCSS("background-color", "rgb(28, 25, 21)");
  // 一覧から開いたほかの文書も同じ
  await page
    .locator('.mdmark-bundle-side .mdmark-doc-list a[href="#/使い方/guide.md"]')
    .click();
  await expect(article.locator("h1")).toContainText("使い方");
  await expect(article).toHaveCSS("background-color", "rgb(28, 25, 21)");
  expect(opened.externalRequests()).toEqual([]);
});

// 2 つの文書が指す同じ画像を 1 回だけ埋め、動画・音声を出力先のフォルダへコピーし、どちらの文書でも再生バーを出す（正常シナリオ（画像・動画・音声を埋める））
test("test_normal_when_media_embedded", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  const media = await readMediaSamples();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "assets:",
      "  root: assets",
      "build:",
      '  include: ["**/*.md"]',
      '  exclude: ["dist/**"]',
      "  entry: a.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": [
      "# A",
      "",
      "![グラフ](images/chart.png)",
      "",
      "![操作](media/demo.mp4)",
      "",
      "続きは [B](sub/b.md) を読む。",
      "",
    ].join("\n"),
    "sub/b.md": [
      "# B",
      "",
      "![グラフ](../images/chart.png)",
      "",
      "![読み上げ](media/voice.mp3)",
      "",
    ].join("\n"),
    "images/chart.png": PNG_BYTES,
    "media/demo.mp4": media.mp4,
    "sub/media/voice.mp3": media.mp3,
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証: 終了コードと、同じ画像を 1 回だけ埋めたこと
  expect(result.code).toBe(0);
  const htmlFile = join(dir, "dist", "docs.html");
  const html = await readFile(htmlFile, "utf8");
  const pngData = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;
  expect(html.split(pngData)).toHaveLength(2);
  // 検証: 動画・音声を出力先のフォルダへコピーする
  const filesDir = join(dir, "dist", "docs_files");
  expect(await readFile(join(filesDir, "media", "demo.mp4"))).toEqual(
    media.mp4,
  );
  expect(await readFile(join(filesDir, "sub", "media", "voice.mp3"))).toEqual(
    media.mp3,
  );
  // 検証: どちらの文書を開いても再生バーを出す
  const opened = await openStandaloneWithFiles(page, {
    tempDir,
    htmlFile,
    filesDir,
  });
  const video = page.locator("article.mdmark video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("src", "docs_files/media/demo.mp4");
  await page.locator('article p a[href="#/sub/b.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("B");
  const audio = page.locator("article.mdmark audio");
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute("controls", "");
  await expect(audio).toHaveAttribute("src", "docs_files/sub/media/voice.mp3");
  // 検証: 外へのネットワークの要求が 0 件
  await page.waitForLoadState("networkidle");
  expect(opened.externalRequests()).toEqual([]);
});

// 全ての文書が使用するモジュールを 1 つのスクリプトにまとめ、blob: と動的 import を許さない環境で開いて文書を移る（正常シナリオ（blob: と動的 import を許さない環境で開く））
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
      "syntax:",
      "  url: vendor/highlightjs/es/",
      "build:",
      '  include: ["*.md"]',
      "  entry: README.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "extensions/greet.js": GREET_WITH_IMPORT_SOURCE,
    "extensions/greet-text.js": GREET_TEXT_SOURCE,
    "lib/chart.js": CHART_SOURCE,
    "README.md": [
      "# 入口",
      "",
      "[ガイド](guide.md) を読む。",
      "",
      '<!-- greet: {"target": "世界"} -->',
      "",
      "```ts",
      "const count: number = 1;",
      "```",
      "",
    ].join("\n"),
    "guide.md": ["# ガイド", "", VIEW_SOURCE, "", "<!-- chart -->", ""].join(
      "\n",
    ),
    ...vendor,
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(true);
  const opened = await openWithCsp(page, join(dir, "dist", "docs.html"));
  const article = page.locator("article.mdmark");
  await expect(article.locator("h1")).toContainText("入口");
  await expect(
    article.locator("[data-mdmark-slot]", { hasText: "greet:読んだ:世界" }),
  ).toHaveCount(1);
  await expect(
    article.locator('code.language-ts span[class*="hljs-"]').first(),
  ).toBeVisible();
  await article.locator('p a[href="#/guide.md"]').click();
  await expect(article.locator("h1")).toContainText("ガイド");
  await expect(article.locator(".mdmark-view")).toHaveCount(1);
  await expect(article.locator("canvas")).toHaveCount(1);
  await expect(article.locator(".mdmark-notice")).toHaveCount(0);
  expect(await opened.violations()).toEqual([]);
  expect(opened.blobRequests()).toEqual([]);
  await opened.close();
});

// 同じラベルの脚注を持つ 2 つの文書をまとめ、移った文書の脚注のツールチップと戻るリンクがその文書の中で有効になる（正常シナリオ（脚注を持つ文書））
test("test_normal_when_footnotes", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeSampleDocs(dir, {
    readme:
      "# 入口\n\n[使い方](使い方/guide.md) を読む[^1]。\n\n[^1]: 入口の補足\n",
  });
  await writeFiles(dir, {
    "使い方/guide.md":
      "# 使い方\n\n別の文書にも脚注がある[^1]。\n\n[^1]: 別の文書の補足\n",
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(true);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  const article = page.locator("article.mdmark");
  await expect(article.locator("h1")).toContainText("使い方");
  const link = article.locator(".mdmark-fn-link");
  await link.hover();
  const tip = article.locator(".mdmark-fn-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("別の文書の補足");
  await page.mouse.move(0, 0);
  const list = article.locator("details.mdmark-footnotes");
  await list.locator("summary").click();
  await list.locator(".mdmark-fn-back").click();
  // 開いている文書は入れ替わらず、その文書の番号へ戻る
  await expect(article.locator("h1")).toContainText("使い方");
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
  expect(opened.externalRequests()).toEqual([]);
});

// まとめる文書の取り込み先とまとめていない名前のアイコンを埋め、外へ要求せずに描く（正常シナリオ（取り込みとアイコンを埋める））
test("test_normal_when_includes_and_icons_embedded", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["docs/*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "docs/a.md":
      '# A\n\n<!-- include: {"path": "b.md", "heading": "使い方"} -->\n\n<!-- include: {"path": "../共通/手順.md"} -->\n\n`icon:sailboat` の段落\n',
    "docs/b.md": "# B\n\n## 使い方\n\n使い方の段落\n",
    "共通/手順.md": "手順の段落\n",
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  await expect(
    page.locator('article .mdmark-inline-icon[data-icon="sailboat"] svg'),
  ).toHaveCount(1);
  const includes = page.locator("article .mdmark-include");
  await expect(includes.nth(0)).toContainText("使い方の段落");
  await expect(includes.nth(1)).toContainText("手順の段落");
  await expect(
    page.locator(".mdmark-bundle-side .mdmark-doc-list a", { hasText: "手順" }),
  ).toHaveCount(0);
  expect(opened.externalRequests()).toEqual([]);
});

// 範囲の ts の型を削除してまとめ、範囲を持たない文書へ移ると範囲の destroy を呼び、移った先に範囲の css を適用しない（正常シナリオ（範囲のスクリプトと CSS））
test("test_normal_when_range_scripts", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "features:",
      "  html-scripts: true",
      "build:",
      '  include: ["*.md"]',
      "  entry: README.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "README.md": [
      "# 入口",
      "",
      rangeMarkdown({ css: RANGE_CSS, ts: RANGE_TS }),
    ].join("\n"),
    "guide.md": [
      "# ガイド",
      "",
      rangeMarkdown({}, '<div class="box">範囲を持たない文書の箱</div>'),
    ].join("\n"),
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(true);
  const opened = await openWithCsp(page, join(dir, "dist", "docs.html"));
  const article = page.locator("article.mdmark");
  const scope = article.locator('.mdmark-html[data-html-scope="0"]');
  const box = scope.locator(".box");
  await expect(box).toHaveCSS("background-color", RANGE_COLOR);
  await expect(async () => {
    await box.click();
    await expect(scope).toHaveClass(/\bis-open\b/, { timeout: 500 });
  }).toPass();
  // 実行・検証: 文書の一覧で範囲を持たない文書へ移る
  await page
    .locator('.mdmark-bundle-side .mdmark-doc-list a[href="#/guide.md"]')
    .click();
  await expect(article.locator("h1")).toContainText("ガイド");
  expect(
    await page.evaluate(() => Reflect.get(window, "__mdmarkDestroyed")),
  ).toBe(1);
  await expect(article.locator("style.mdmark-html-style")).toHaveCount(0);
  await expect(article.locator(".mdmark-html div")).not.toHaveCSS(
    "background-color",
    RANGE_COLOR,
  );
  expect(await opened.violations()).toEqual([]);
  expect(opened.blobRequests()).toEqual([]);
  await opened.close();
});

// 端末の設定と上のフォルダの theme を重ねて、下のフォルダの build で 1 枚にまとめる（正常シナリオ（設定を重ねる））
test("test_normal_when_cascaded", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "theme: ./theme.css\n",
    "theme.css": cascadeTheme("rgb(1, 2, 3)"),
    "docs/mdmark.config.yaml":
      "build:\n  include: ['*.md']\n  out: site.html\n",
    "docs/a.md": "# A\n\n> [!NOTE]\n> 注意書き A\n",
    "docs/b.md": "# B\n\n> [!NOTE]\n> 注意書き B\n",
  });
  const settings = await writeSettings(
    await tempDir(),
    cascadeSettings({ cascade: true, applyToExport: true }),
  );
  // 実行
  const result = await runCli(builtRoot, ["build"], join(dir, "docs"), "", {
    MDMARK_CONFIG: settings,
  });
  // 検証
  expect(result.code).toBe(0);
  const html = join(dir, "docs", "site.html");
  expect(existsSync(html)).toBe(true);
  await openStandalone(page, { tempDir, htmlFile: html });
  for (const heading of ["A", "B"]) {
    await page
      .locator(".mdmark-bundle-side .mdmark-doc-list a", { hasText: heading })
      .first()
      .click();
    const article = page.locator("article.mdmark");
    await expect(article.locator("h1")).toHaveText(heading);
    await expect(article.locator(".markdown-alert")).toHaveCount(0);
    await expect(article.locator("blockquote")).toHaveCount(1);
  }
  await expect.poll(() => themeValue(page)).toBe("rgb(1, 2, 3)");
});

// mermaid のコードブロックを持つ文書があるときだけ mermaid を埋めてまとめ、開いたときに外へ要求せずに図を描く（正常シナリオ（mermaid のコードブロック））
test("test_normal_when_mermaid", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  const url = await copyMermaidDist(dir);
  const config = (include: string) =>
    [
      `mermaid:\n  url: ${url}`,
      "index: index.yaml",
      "build:",
      `  include: [${include}]`,
      "  entry: README.md",
      "  out: dist/docs.html",
      "",
    ].join("\n");
  await writeFiles(dir, {
    "mdmark.config.yaml": config('"*.md"'),
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: top",
      "    path: README.md",
      "    title: 入口",
      "  - id: flow",
      "    path: flow.md",
      "    title: 図",
      "",
    ].join("\n"),
    "README.md": "# 入口\n\n[図へ](flow.md)\n",
    "flow.md": MERMAID_FLOWCHART,
  });
  // 実行
  const result = await runCli(builtRoot, ["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(true);
  const html = await readFile(join(dir, "dist", "docs.html"), "utf8");
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  await expect(page.locator("article.mdmark h1")).toContainText("入口");
  await page.locator('article p a[href="#/flow.md"]').click();
  await expect(page.locator(`article.mdmark ${MERMAID_SVG}`)).toHaveCount(1, {
    timeout: MERMAID_WAIT_MS,
  });
  expect(opened.externalRequests()).toEqual([]);
  // 実行・検証: mermaid のコードブロックを持たない文書だけをまとめたときは埋めない
  await writeFiles(dir, { "mdmark.config.yaml": config('"README.md"') });
  const onlyPlain = await runCli(builtRoot, ["build"], dir);
  expect(onlyPlain.code).toBe(0);
  const plainHtml = await readFile(join(dir, "dist", "docs.html"), "utf8");
  expect(plainHtml.length).toBeLessThan(html.length - MERMAID_EMBED_MIN_BYTES);
});
