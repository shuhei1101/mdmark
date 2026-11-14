import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { expect, test } from "vitest";
import {
  copyMermaidVendor,
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

const createTempDir = useTempDirs();
const browser = useBrowser(createTempDir);

// build の設定の記載方法: 行を追加して使用する
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

/** 見本の文書群を作る: 入口 `README.md`・用語集の表を持つ `用語集.md`・外部ライブラリのマーカーと画像を持つ `使い方/guide.md` と、3 つを記載した索引 */
async function createSampleDir(options?: {
  buildLines?: string[];
  readme?: string;
}): Promise<string> {
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig(options?.buildLines ?? BUILD_BASE),
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: top",
      "    path: README.md",
      "    title: 入口",
      "  - id: terms",
      "    path: 用語集.md",
      "    title: 用語集",
      "  - id: guide",
      "    path: 使い方/guide.md",
      "    title: 使用方法",
      "",
    ].join("\n"),
    "README.md":
      options?.readme ??
      "# 入口\n\n[使用方法](使い方/guide.md) を読み込む。\n\nマーカーを記載する。\n",
    "用語集.md": [
      "# 用語集",
      "",
      '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
      "",
      "| 用語 | 意味 |",
      "| --- | --- |",
      "| マーカー | HTML コメントで記載する指定 |",
      "",
      "<!-- /glossary -->",
      "",
    ].join("\n"),
    "使い方/guide.md":
      '# 使用方法\n\n<!-- test-lib: {"items": ["a"]} -->\n\n![図](../img/a.png)\n\n[入口へ](../README.md)\n',
    "lib/test-lib.js": TEST_LIB_SOURCE,
    "img/a.png": PNG_BYTES,
  });
  return dir;
}

// 3 つの文書を、文書をまたぐ用語と被参照が有効になる 1 枚にまとめる（正常系）
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
  await page.waitForSelector("article.zq h1");
  await expect(page.locator("article.zq h1").textContent()).resolves.toContain(
    "入口",
  );
  await expect(
    page.locator(".zq-bundle-side .zq-doc-list a").count(),
  ).resolves.toBe(3);
  await expect(
    page.locator("article .zq-term").first().textContent(),
  ).resolves.toBe("マーカー");
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article.zq h1")?.textContent?.includes("使用方法"),
  );
  await page.waitForFunction(
    () =>
      document.querySelector("article [data-zq-slot]")?.textContent ===
      "drawn:a",
  );
  await expect(
    page.locator(".zq-backlinks a").allTextContents(),
  ).resolves.toContain("入口");
  await expect(
    page
      .locator("article img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).resolves.toBeGreaterThan(0);
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 除外した文書へのリンクを記載したまま残し、警告に出す（正常系（1 枚に含まれない文書へのリンクがある））
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
  await page.waitForSelector("article.zq h1");
  const href = await page.locator("article p a").first().getAttribute("href");
  expect(decodeURI(href ?? "")).toBe("下書き/メモ.md");
  const titles = await page
    .locator(".zq-bundle-side .zq-doc-list a")
    .allTextContents();
  expect(titles).not.toContain("メモ");
  await page.close();
});

// 設定に build が無いと、記載方法を示して終わる（異常系（build が無い））
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

// build.include がどの文書にも該当しないと、HTML を書き込まずに終わる（異常系（対象の文書が 0 件））
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

// build.out へ記載できないと、パスと修正方法を示して終わる（異常系（出力先へ書き込めない））
test("test_error_when_output_unwritable", async () => {
  // 準備
  const dir = await createSampleDir();
  await writeFiles(dir, { dist: "ファイル\n" });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("dist/docs.html");
  expect(result.stderr).toContain("確認して");
  expect(await readFile(join(dir, "dist"), "utf8")).toBe("ファイル\n");
});

// 設定の aliases の YAML から作ったエイリアスを埋め、まとめた全ての文書で有効にしる（正常系（エイリアスを読み込む））
test("test_normal_when_aliases", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "aliases:",
      "  - id: commands",
      "    paths: [aliases/commands.yaml]",
      "    alias_type: command",
      "  - id: servers",
      "    paths: [aliases/servers.yaml]",
      "    alias_type: env",
      "build:",
      '  include: ["*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md":
      "# A\n\nテストを実行する、開発サーバーを使用する。\n\n[B へ](b.md)\n",
    "b.md": "# B\n\nここでもテストを実行する、開発サーバーを使用する。\n",
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
  await page.waitForSelector("article .zq-term");
  await expect(
    page.locator("article .zq-term").allTextContents(),
  ).resolves.toEqual(["テストを実行する"]);
  await expect(
    page.locator("article .zq-term-tip code").textContent(),
  ).resolves.toBe("npm test");
  // 2 つ目の文書へ移っても同じ
  await page.locator('article p a[href="#/b.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article.zq h1")?.textContent?.includes("B"),
  );
  await page.waitForFunction(
    () =>
      document.querySelector("article .zq-term")?.textContent ===
      "テストを実行する",
  );
  await expect(
    page.locator("article .zq-term").allTextContents(),
  ).resolves.toEqual(["テストを実行する"]);
  await expect(
    page.locator("article .zq-term-tip code").textContent(),
  ).resolves.toBe("npm test");
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 設定の colorTheme を埋める設定にコピーし、まとめた全ての文書を選んだテーマで描く（正常系（テーマを選ぶ設定））
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
      const root = document.querySelector("article.zq");
      return root ? getComputedStyle(root).backgroundColor : "";
    });
  // 最初に開いた文書
  await page.waitForFunction(() =>
    document.querySelector("article.zq h1")?.textContent?.includes("A"),
  );
  await expect(readBackground()).resolves.toBe("rgb(248, 250, 252)");
  // 文書の一覧から移った 2 つ目の文書
  await page.locator('article p a[href="#/b.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article.zq h1")?.textContent?.includes("B"),
  );
  await expect(readBackground()).resolves.toBe("rgb(248, 250, 252)");
  await page.close();
});

// page のマーカーを持つ文書と持たない文書を行き来すると、開いた文書の明暗とテーマで再描画する（正常系（文書ごとのページの設定））
test("test_normal_when_page_settings_per_document", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["*.md"]',
      "  entry: a.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md":
      '<!-- page: {"scheme": "dark", "theme": "theme-slate"} -->\n\n# A\n\n[B へ](b.md)\n',
    "b.md": "# B\n\nもう 1 つの文書。\n",
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "dist", "docs.html"),
  );
  await page.emulateMedia({ colorScheme: "light" });
  const readRoot = () =>
    page.evaluate(() => {
      const root = document.querySelector("article.zq");
      return {
        dark: root?.classList.contains("zq-theme-dark") ?? false,
        light: root?.classList.contains("zq-theme-light") ?? false,
        theme: root?.getAttribute("data-zq-color-theme") ?? null,
      };
    });
  // 最初に開いた文書
  await page.waitForFunction(() =>
    document.querySelector("article.zq h1")?.textContent?.includes("A"),
  );
  await expect(readRoot()).resolves.toEqual({
    dark: true,
    light: false,
    theme: "theme-slate",
  });
  // マーカーを持たない文書
  await page.locator('article p a[href="#/b.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article.zq h1")?.textContent?.includes("B"),
  );
  await expect(readRoot()).resolves.toEqual({
    dark: false,
    light: false,
    theme: "dev-swiss",
  });
  expect(externalRequests()).toEqual([]);
  await page.close();
});

/** 2 つの文書が同じ画像と別々の動画・音声を指すフォルダを作る */
async function createMediaDir(): Promise<string> {
  const dir = await createTempDir();
  const media = await readMediaSamples();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
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
      "続きは [B](sub/b.md) を読み込む。",
      "",
    ].join("\n"),
    "sub/b.md": [
      "# B",
      "",
      "![グラフ](../images/chart.png)",
      "",
      "![スクリーンリーダー](media/voice.mp3)",
      "",
    ].join("\n"),
    "images/chart.png": PNG_BYTES,
    "media/demo.mp4": media.mp4,
    "sub/media/voice.mp3": media.mp3,
  });
  return dir;
}

// 2 つの文書が指す同じ画像を 1 回だけ埋め、動画・音声を出力の隣のフォルダへコピーする（正常系（画像・動画・音声を埋める））
test("test_normal_when_media_embedded", async () => {
  // 準備
  const dir = await createMediaDir();
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual([
    "書き出した: dist/docs.html（文書 2 件）",
  ]);
  const html = await readFile(join(dir, "dist", "docs.html"), "utf8");
  const pngData = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;
  expect(html.split(pngData)).toHaveLength(2);
  expect(existsSync(join(dir, "dist", "docs_files", "media", "demo.mp4"))).toBe(
    true,
  );
  expect(
    existsSync(join(dir, "dist", "docs_files", "sub", "media", "voice.mp3")),
  ).toBe(true);
  const { page, externalRequests } = await browser.openWithFiles(
    join(dir, "dist", "docs.html"),
    join(dir, "dist", "docs_files"),
  );
  const ready = async (selector: string) => {
    await page.waitForSelector(`article ${selector}`);
    await page.waitForFunction(
      (target) =>
        ((document.querySelector(`article ${target}`) as HTMLMediaElement)
          ?.readyState ?? 0) >= 1,
      selector,
    );
    return page.locator(`article ${selector}`).getAttribute("src");
  };
  await expect(ready("video")).resolves.toBe("docs_files/media/demo.mp4");
  await page.locator('article p a[href="#/sub/b.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article.zq h1")?.textContent?.includes("B"),
  );
  await expect(ready("audio")).resolves.toBe("docs_files/sub/media/voice.mp3");
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 動画・音声のコピー先の _files/ へ書き込めないと、HTML を書き込まずにパスと修正方法を示して終わる（異常系（動画・音声のコピー先へ書き込めない））
test("test_error_when_media_copy_unwritable", async () => {
  // 準備
  const dir = await createMediaDir();
  await writeFiles(dir, { "dist/docs_files": "ファイル\n" });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("dist/docs_files");
  expect(result.stderr).toContain("確認して");
  expect(await readFile(join(dir, "dist", "docs_files"), "utf8")).toBe(
    "ファイル\n",
  );
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(false);
});

// 全ての文書が使用するモジュールを 1 つのスクリプトにまとめ、blob: と動的 import を許さない環境でも文書を移って描く（正常系（blob: と動的 import を許さない環境で開く））
test("test_normal_when_blob_and_dynamic_import_blocked", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "extensions: [extensions/greet.js]",
      "libraries:",
      "  test-lib: lib/test-lib.js",
      "syntax:",
      "  url: vendor/highlightjs/es/",
      "build:",
      '  include: ["*.md"]',
      "  entry: README.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "extensions/greet.js": GREET_WITH_IMPORT_SOURCE,
    "extensions/greet-text.js": 'export const TEXT = "読み込んだ";\n',
    "lib/test-lib.js": TEST_LIB_SOURCE,
    "README.md": [
      "# 入口",
      "",
      "[ガイド](guide.md) を読み込む。",
      "",
      '<!-- greet: {"target": "世界"} -->',
      "",
      "```ts",
      "const count: number = 1;",
      "```",
      "",
    ].join("\n"),
    "guide.md": [
      "# ガイド",
      "",
      VIEW_SOURCE,
      "",
      '<!-- test-lib: {"items": ["a"]} -->',
      "",
    ].join("\n"),
    ...(await readHighlightVendor()),
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  const opened = await browser.openWithCsp(join(dir, "dist", "docs.html"));
  const { page } = opened;
  await page.waitForFunction(
    () =>
      document.querySelector("article [data-zq-slot]")?.textContent ===
      "greet:読み込んだ:世界",
  );
  await page.waitForSelector('article code.language-ts span[class^="hljs-"]');
  await page.locator('article p a[href="#/guide.md"]').click();
  await page.waitForSelector("article .zq-view");
  await page.waitForFunction(() =>
    [...document.querySelectorAll("article [data-zq-slot]")].some(
      (slot) => slot.textContent === "drawn:a",
    ),
  );
  await expect(page.locator("article .zq-notice").count()).resolves.toBe(0);
  await expect(opened.violations()).resolves.toEqual([]);
  expect(opened.inlineUrlScripts()).toEqual([]);
  await opened.close();
});

// まとめる文書の取り込み先とまとめていない名前のアイコンの形状を埋め、外へ要求せずに描く（正常系（取り込みとアイコンを埋める））
test("test_normal_when_includes_and_icons", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["docs/*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "docs/a.md": [
      "# A",
      "",
      '<!-- include: {"path": "b.md", "heading": "使用方法"} -->',
      "",
      '<!-- include: {"path": "../共通/手順.md"} -->',
      "",
      "`icon:sailboat` の段落",
      "",
    ].join("\n"),
    "docs/b.md": "# B\n\n## 使用方法\n\n使用方法の段落\n",
    "共通/手順.md": "手順の段落\n",
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "dist", "docs.html"),
  );
  await page.waitForSelector("article.zq h1");
  await page.waitForSelector('.zq-inline-icon[data-icon="sailboat"] svg');
  const includes = await page.locator("article .zq-include").allTextContents();
  expect(includes.some((text) => text.includes("使用方法の段落"))).toBe(true);
  expect(includes.some((text) => text.includes("手順の段落"))).toBe(true);
  const listed = await page
    .locator(".zq-bundle-side .zq-doc-list a")
    .allTextContents();
  expect(listed.some((text) => text.includes("手順"))).toBe(false);
  expect(externalRequests()).toEqual([]);
});

// 範囲の ts を変換してまとめ、文書を移るときに範囲の destroy を呼ぶ（正常系（範囲のスクリプトと CSS））
test("test_normal_when_range_scripts", async () => {
  // 準備
  const dir = await createTempDir();
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
      "[ガイド](guide.md) を読み込む。",
      "",
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
    ].join("\n"),
    "guide.md": ["# ガイド", "", "範囲を持たない文書。", ""].join("\n"),
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const opened = await browser.openWithCsp(join(dir, "dist", "docs.html"));
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
  await page.locator('article p a[href="#/guide.md"]').click();
  await page.waitForFunction(() =>
    document.querySelector("article h1")?.textContent?.includes("ガイド"),
  );
  await expect(
    page.evaluate(() => Reflect.get(window, "__zqDestroyed")),
  ).resolves.toBe(1);
  await expect(
    page.locator("article style.zq-html-style").count(),
  ).resolves.toBe(0);
  await expect(opened.violations()).resolves.toEqual([]);
  expect(opened.inlineUrlScripts()).toEqual([]);
  await opened.close();
});

// まとめる文書のどれかに mermaid のコードブロックがあるときだけ mermaid を 1 回まとめて埋める（正常系（mermaid のコードブロック））
test("test_normal_when_mermaid_embedded", async () => {
  // 準備
  const dir = await createTempDir();
  await copyMermaidVendor(dir);
  const config = (include: string) =>
    [
      "mermaid:",
      "  url: vendor/mermaid/mermaid.esm.min.mjs",
      "build:",
      `  include: [${include}]`,
      "  out: dist/docs.html",
      "  entry: a.md",
      "",
    ].join("\n");
  await writeFiles(dir, {
    "mdmark.config.yaml": config('"*.md"'),
    "a.md": "# A\n\n[B へ](b.md)\n",
    "b.md": [
      "# B",
      "",
      "```mermaid",
      "flowchart LR",
      "  A[受付] --> B[回答]",
      "```",
      "",
    ].join("\n"),
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const html = await readFile(join(dir, "dist", "docs.html"), "utf8");
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "dist", "docs.html"),
  );
  await page.waitForSelector("article.zq h1");
  await page.locator('article p a[href="#/b.md"]').click();
  await page.waitForSelector(
    'article figure.zq-diagram[data-diagram="mermaid"] .zq-mermaid > svg',
    {
      timeout: 60_000,
    },
  );
  expect(externalRequests()).toEqual([]);
  await page.close();
  // mermaid のコードブロックを持たない文書だけをまとめたときは埋めない
  await writeFiles(dir, { "mdmark.config.yaml": config('"a.md"') });
  const onlyPlain = await runCli(["build"], dir);
  expect(onlyPlain.code).toBe(0);
  const plainHtml = await readFile(join(dir, "dist", "docs.html"), "utf8");
  expect(plainHtml).not.toContain("mermaidModule");
  expect(plainHtml.length).toBeLessThan(html.length - 1_000_000);
}, 240_000);

/** 段落 200 個を持ち、100 個目の段落に b.md へのリンクを持つ a.md（entry）と、段落 200 個の末尾に a.md へのリンクを持つ b.md をまとめたフォルダを作る */
async function createLongDir(): Promise<string> {
  const dir = await createTempDir();
  const paragraphs = (link: { at: number; text: string }) =>
    Array.from({ length: 200 }, (_, index) =>
      index === link.at ? `${link.text}\n` : `段落 ${index + 1}\n`,
    ).join("\n");
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["*.md"]',
      "  entry: a.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": `# A\n\n${paragraphs({ at: 99, text: "[B へ](b.md)" })}`,
    "b.md": `# B\n\n${paragraphs({ at: 199, text: "[A へ](a.md)" })}`,
  });
  return dir;
}

/** 開いている文書の h1 がその文字を持つまで待つ */
async function waitForTitle(page: Page, title: string): Promise<void> {
  await page.waitForFunction(
    (text) =>
      document.querySelector("article.zq h1")?.textContent?.includes(text),
    title,
  );
}

/** `scrollY` がその値（±1px）になるまで待つ */
async function waitForScrollY(page: Page, y: number): Promise<void> {
  await page.waitForFunction(
    (expected) => Math.abs(window.scrollY - expected) <= 1,
    y,
  );
}

// 文書間のリンクで移ってから戻る・進むと、その履歴の項目を離れたときのスクロール位置で描く（正常系（戻る・進むで離れたときの位置に戻る））
test("test_normal_when_back_forward_restore_scroll", async () => {
  // 準備
  const dir = await createLongDir();
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page, externalRequests } = await browser.openHtml(
    join(dir, "dist", "docs.html"),
    { width: 1280, height: 800 },
  );
  await waitForTitle(page, "A");
  await expect(page.evaluate(() => history.scrollRestoration)).resolves.toBe(
    "manual",
  );
  const toB = page.locator('article p a[href="#/b.md"]');
  await toB.scrollIntoViewIfNeeded();
  const leftAt = await page.evaluate(() => window.scrollY);
  await toB.click();
  await waitForTitle(page, "B");
  await expect(page.evaluate(() => window.scrollY)).resolves.toBe(0);
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.goBack();
  await waitForTitle(page, "A");
  await waitForScrollY(page, leftAt);
  await expect(toB.isVisible()).resolves.toBe(true);
  await page.goForward();
  await waitForTitle(page, "B");
  await waitForScrollY(page, 1000);
  const toA = page.locator('article p a[href="#/a.md"]');
  await toA.scrollIntoViewIfNeeded();
  await toA.click();
  await waitForTitle(page, "A");
  await expect(page.evaluate(() => window.scrollY)).resolves.toBe(0);
  expect(new URL(page.url()).hash).toMatch(/^#\/a\.md$/);
  expect(externalRequests()).toEqual([]);
  await page.close();
});

// 開いている文書をスクロールして再読み込みすると、再読み込みの前の位置で描く（正常系（再読み込みで離れたときの位置に戻る））
test("test_normal_when_reload_restore_scroll", async () => {
  // 準備
  const dir = await createLongDir();
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "dist", "docs.html"), {
    width: 1280,
    height: 800,
  });
  await waitForTitle(page, "A");
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.reload();
  await waitForTitle(page, "A");
  await waitForScrollY(page, 3000);
  await page.close();
});

// 開閉と group= の無いタブを変えてから移り、戻ると開閉とタブを戻してから位置を戻す（正常系（戻るで開閉と選んだタブを戻す））
test("test_normal_when_back_restore_folds_and_tabs", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["*.md"]',
      "  entry: a.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": [
      "# A",
      "",
      '<!-- table: {"kind": "data", "collapse": {"open": false}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 10 |",
      "",
      "<!-- /table -->",
      "",
      "```tree",
      "docs/",
      "└── a.md",
      "```",
      "",
      "## 導入",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "<!-- tabs -->",
      "",
      "### 一つ目",
      "",
      "一つ目の中身",
      "",
      "### 二つ目",
      "",
      ...Array.from({ length: 100 }, (_, index) => `段落 ${index + 1}\n`),
      "[B へ](b.md)",
      "",
      "<!-- /tabs -->",
      "",
    ].join("\n"),
    "b.md": "# B\n\nもう 1 つの文書。\n",
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "dist", "docs.html"), {
    width: 1280,
    height: 800,
  });
  await waitForTitle(page, "A");
  await page.locator("article .zq-section-toggle", { hasText: "導入" }).click();
  await page.locator("article details.zq-table-details > summary").click();
  await page.locator("article .zq-tree-toggle").first().click();
  await page.locator("article .zq-tab", { hasText: "二つ目" }).click();
  const toB = page.locator('article a[href="#/b.md"]');
  await toB.scrollIntoViewIfNeeded();
  const leftAt = await page.evaluate(() => window.scrollY);
  await toB.click();
  await waitForTitle(page, "B");
  await page.goBack();
  await waitForTitle(page, "A");
  await waitForScrollY(page, leftAt);
  await expect(
    page.evaluate(() => {
      const section = document.querySelector(
        "article .zq-section-toggle[aria-controls='section-導入']",
      );
      const body = document.querySelector('[id="section-導入"]');
      return {
        section: section?.getAttribute("aria-expanded") ?? null,
        hidden: body?.hasAttribute("hidden") ?? null,
        table:
          document
            .querySelector("article details.zq-table-details")
            ?.hasAttribute("open") ?? null,
        tree:
          document
            .querySelector("article .zq-tree-toggle")
            ?.getAttribute("aria-expanded") ?? null,
        tab:
          [...document.querySelectorAll("article .zq-tab")]
            .find((tab) => tab.textContent?.includes("二つ目"))
            ?.getAttribute("aria-selected") ?? null,
        stored: Object.keys(localStorage).filter((key) =>
          key.startsWith("zq-tabs:"),
        ),
      };
    }),
  ).resolves.toEqual({
    section: "true",
    hidden: false,
    table: true,
    tree: "false",
    tab: "true",
    stored: [],
  });
  await expect(toB.isVisible()).resolves.toBe(true);
  await page.close();
});

// sessionStorage を取り出せないページでは、戻るで文書の頭から描き、例外を出さない（正常系（sessionStorage が使えない））
test("test_normal_when_session_storage_unavailable", async () => {
  // 準備
  const dir = await createLongDir();
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "dist", "docs.html"), {
    width: 1280,
    height: 800,
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("使えない", "SecurityError");
      },
    });
  });
  const errors: Error[] = [];
  const warnings: string[] = [];
  page.on("pageerror", (error) => errors.push(error));
  page.on("console", (message) => {
    if (message.type() === "warning") {
      warnings.push(message.text());
    }
  });
  await page.reload();
  await waitForTitle(page, "A");
  const toB = page.locator('article p a[href="#/b.md"]');
  await toB.scrollIntoViewIfNeeded();
  await toB.click();
  await waitForTitle(page, "B");
  await page.goBack();
  await waitForTitle(page, "A");
  await expect(page.evaluate(() => window.scrollY)).resolves.toBe(0);
  expect(errors).toEqual([]);
  expect(warnings.some((text) => text.includes("表示の状態"))).toBe(true);
  await page.close();
});

/** グループ place を持つ map の範囲の文書 */
const mapPlaceDoc = (title: string, links: string): string =>
  [
    `# ${title}`,
    "",
    links,
    "",
    "<!-- map -->",
    "",
    "```mermaid",
    "flowchart LR",
    '  user["利用側"]',
    "  subgraph place [配置]",
    "    direction TB",
    '    layout["自動配置"]',
    '    route["線の経路"]',
    "  end",
    "  user --> layout",
    "  layout --> route",
    "```",
    "",
    "<!-- /map -->",
    "",
  ].join("\n");

// 文書を切り替えると map のクエリ文字列を消し、戻ると前の文書の図を中へ入った状態から描く（正常系（文書を切り替えると map のクエリ文字列を消す））
test("test_normal_when_switch_clears_map_query", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["*.md"]',
      "  entry: a.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": mapPlaceDoc("A", "[B へ](b.md)"),
    "b.md": mapPlaceDoc("B", "[A へ](a.md)"),
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "dist", "docs.html"));
  await page.evaluate(() => sessionStorage.clear());
  const url = new URL(page.url());
  url.search = "?keep=1";
  await page.goto(url.href);
  await waitForTitle(page, "A");
  const enter = page.locator(
    'article figure[data-diagram="map"] [data-group-enter="place"]',
  );
  await enter.waitFor({ timeout: 60_000 });
  await enter.click();
  const params = async () =>
    new URL(page.url()).searchParams.toString().split("&").sort();
  await expect(params()).resolves.toEqual(["keep=1", "map-1=place"]);
  // 実行: 文書の一覧で b.md へ移る
  await page.locator('.zq-bundle-side .zq-doc-list a[href="#/b.md"]').click();
  await waitForTitle(page, "B");
  // 検証: map- のキーが消え、ほかのキーは変わらず、b.md の図を全体から描く
  await page
    .locator('article figure[data-diagram="map"] [data-group-enter="place"]')
    .waitFor({ timeout: 60_000 });
  await expect(params()).resolves.toEqual(["keep=1"]);
  await expect(
    page
      .locator('article figure[data-diagram="map"] [data-tool="back"]')
      .isDisabled(),
  ).resolves.toBe(true);
  // 実行・検証: 戻ると a.md の図を「配置」の中から描く
  await page.goBack();
  await waitForTitle(page, "A");
  await page.waitForFunction(
    () =>
      document.querySelector(
        'article figure[data-diagram="map"] .map-group-title.is-current',
      )?.textContent === "配置",
    undefined,
    { timeout: 60_000 },
  );
  await page.close();
}, 180_000);

// 設定の map を埋める設定にコピーし、まとめた全ての文書の map の図を設定の種類と線で描く（正常系（map の設定））
test("test_normal_when_map_config", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      MAP_STORE_CONFIG,
      "build:",
      '  include: ["*.md"]',
      "  entry: a.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": mapStoreDoc("A", "[B へ](b.md)"),
    "b.md": mapStoreDoc("B"),
  });
  // 実行
  const result = await runCli(["build"], dir);
  // 検証
  expect(result.code).toBe(0);
  const { page } = await browser.openHtml(join(dir, "dist", "docs.html"));
  await waitForTitle(page, "A");
  const expected = {
    label: "保存先",
    shape: "rect",
    color: "purple",
    dash: expect.stringMatching(/\d/),
  };
  await expect(readMapStore(page)).resolves.toEqual(expected);
  await page.locator('article p a[href="#/b.md"]').click();
  await waitForTitle(page, "B");
  await expect(readMapStore(page)).resolves.toEqual(expected);
  await page.close();
}, 180_000);

/** 隠す書き出しの結合テストのフォルダを 2 つ作り、隠したまとめと `--keep-traces` のまとめを書き出す */
async function buildBothTraces(): Promise<{
  hiddenDir: string;
  keptDir: string;
  hidden: Awaited<ReturnType<typeof runCli>>;
  kept: Awaited<ReturnType<typeof runCli>>;
}> {
  const hiddenDir = await createTempDir();
  const keptDir = await createTempDir();
  for (const dir of [hiddenDir, keptDir]) {
    await copyMermaidVendor(dir);
    await writeFiles(dir, TRACES_FILES);
  }
  const hidden = await runCli(["build"], hiddenDir);
  const kept = await runCli(["build", "--keep-traces"], keptDir);
  return { hiddenDir, keptDir, hidden, kept };
}

/** CSP を付けて開き、入口の文書の mermaid の図と拡張が描かれるまで待つ */
async function openBundleTraces(file: string) {
  const opened = await browser.openWithCsp(file);
  await opened.page.waitForSelector(
    'article figure[data-diagram="mermaid"] svg',
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

// 隠さない書き出しを指定しないとき、文書をHTMLに書き出すと同じく隠し、ファイル名に mdmark を含む文書へも行き来できる（正常系（mdmark を使用していることを隠す））
test("test_normal_when_traces_hidden", async () => {
  // 準備
  const { hiddenDir, keptDir, hidden, kept } = await buildBothTraces();
  // 実行
  const html = await readFile(join(hiddenDir, "dist", "docs.html"), "utf8");
  const report = reportTraces(html);
  // 検証
  expect(hidden.code).toBe(0);
  expect(linesOf(hidden.stdout)).toEqual([
    "書き出した: dist/docs.html（文書 2 件）",
  ]);
  expect(kept.code).toBe(0);
  expect(report.outside).toBe(0);
  expect(report.generated).toBe(0);
  expect(report.markdownNames).toBe(0);
  expect(report.comments).toBe(0);
  expect(report.markdown).not.toContain("<!-- todo -->");
  expect(report.markdown).toContain("<!-- /table -->");
  expect(html).not.toMatch(/-version:"v/);
  expect(html).toMatch(/\/\*! lucide /);
  const hiddenPage = await openBundleTraces(
    join(hiddenDir, "dist", "docs.html"),
  );
  const keptPage = await openBundleTraces(join(keptDir, "dist", "docs.html"));
  const { page } = hiddenPage;
  expect(hiddenPage.consoleErrors()).toEqual([]);
  await expect(countCommentNodes(page)).resolves.toBe(0);
  await expect(snapshotDom(page)).resolves.toEqual(
    await snapshotDom(keptPage.page),
  );
  await expect(
    page.locator(".zq-bundle-side .zq-doc-list a").allTextContents(),
  ).resolves.toEqual(["mdmark の紹介", "使い方"]);
  await page.locator('article p a[href="#/guide.md"]').click();
  await page.waitForFunction(
    () => document.querySelector("article h1")?.textContent === "使い方",
  );
  await page.locator('article p a[href="#/mdmark-intro.md"]').click();
  await page.waitForFunction(
    () => document.querySelector("article h1")?.textContent === "mdmark の紹介",
  );
  await page.evaluate(() => history.back());
  await page.waitForFunction(
    () => document.querySelector("article h1")?.textContent === "使い方",
  );
  await hiddenPage.close();
  await keptPage.close();
}, 240_000);

// --keep-traces のとき、名前を置き換えず、コメントとバージョンを残してまとめる（正常系（隠さない書き出しを指定する））
test("test_normal_when_traces_kept", async () => {
  // 準備
  const { keptDir, kept } = await buildBothTraces();
  // 実行
  const html = await readFile(join(keptDir, "dist", "docs.html"), "utf8");
  // 検証
  expect(kept.code).toBe(0);
  expect(html).toContain('class="mdmark"');
  expect(html).toContain(":root{--mdmark-version:");
  expect(html).toContain('id="mdmark-payload"');
}, 240_000);
