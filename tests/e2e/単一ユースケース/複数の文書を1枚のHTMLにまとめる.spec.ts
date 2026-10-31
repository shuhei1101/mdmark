import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  expect,
  linesOf,
  openStandalone,
  runCli,
  test,
  writeFiles,
  writeSampleDocs,
} from "../cli.ts";

// 3 つの文書を、文書をまたぐ用語と被参照が効く 1 枚にまとめる（正常シナリオ）
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
  // 入口からリンクされた文書の末尾に、入口が関連文書として出る
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("使い方");
  await expect(page.locator(".mdmark-backlinks a")).toContainText(["入口"]);
  expect(opened.externalRequests()).toEqual([]);
});

// 外した文書へのリンクを書いたまま残し、警告に出す（正常シナリオ（1 枚に含まれない文書へのリンクがある））
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

// build.include がどの文書にも当たらないと、HTML を書かずに終わる（異常シナリオ（対象の文書が 0 件））
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

// 設定の aliases の YAML から読んだエイリアスを、どの文書にも効かせて 1 枚にまとめ、env は HTML に入れない（正常シナリオ（エイリアスを読む））
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
      "  - id: records",
      "    paths: [aliases/records.yaml]",
      "    records: records",
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
      "",
    ].join("\n")}`,
    "aliases/records.yaml": [
      "records:",
      "  - alias_type: command",
      "    id: unit-test",
      "    name: 単体テスト",
      "    command: npm run test:unit",
      "  - alias_type: env",
      "    id: dev-server",
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
  // 一覧から開いたほかの文書: 同じエイリアスで下線が付く
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("使い方");
  await expect(page.locator("article .mdmark-term")).toHaveText(["単体テスト"]);
  expect(opened.externalRequests()).toEqual([]);
});

// 設定のテーマを描く先に当てた 1 枚を書き出し、ダークのブラウザで入口の文書と一覧から開いた文書を選んだテーマの暗い配色で読む（正常シナリオ（テーマを選ぶ））
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
