import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 1〜12 行目に `const v{行} = {行};` を持つ `src/app.ts` の本文 */
const APP_TS = Array.from(
  { length: 12 },
  (_, index) => `const v${index + 1} = ${index + 1};`,
).join("\n");

/** 準備・実行・片付けの見出しを持ち、実行の下に表を持つ `共通/手順.md` */
const PROCEDURE_MD = [
  "## 準備",
  "",
  "準備の段落",
  "",
  "## 実行",
  "",
  "実行の段落",
  "",
  "<!-- table: data -->",
  "",
  "| 手順 | 担当 |",
  "| --- | --- |",
  "| ビルド | 開発者 |",
  "| 確認 | 利用者 |",
  "",
  "<!-- /table -->",
  "",
  "## 片付け",
  "",
  "片付けの段落",
  "",
].join("\n");

// 取り込む文書の表から、全体・見出しの中・行の範囲を描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "# 案内",
      "",
      "<!-- include: 共通/手順.md -->",
      "",
      "<!-- include: 共通/手順.md#実行 -->",
      "",
      "<!-- include: src/app.ts#L3-L5 -->",
      "",
    ].join("\n"),
    includes: { "共通/手順.md": PROCEDURE_MD, "src/app.ts": APP_TS },
  });
  // 検証
  const includes = page.locator("#doc .mdmark-include");
  await expect(includes).toHaveCount(3);
  const whole = includes.nth(0);
  const section = includes.nth(1);
  for (const text of ["準備の段落", "実行の段落", "片付けの段落"]) {
    await expect(whole).toContainText(text);
  }
  await expect(section).toContainText("実行の段落");
  await expect(section).not.toContainText("準備の段落");
  await expect(section).not.toContainText("片付けの段落");
  await expect(
    page.locator("#doc .mdmark-include").nth(1).locator(".mdmark-table"),
  ).toHaveAttribute("data-kind", "data");
  await expect(
    page.locator("#doc .mdmark-include").nth(1).locator(".mdmark-sort").first(),
  ).toBeVisible();
  const code = page
    .locator("#doc .mdmark-include")
    .nth(2)
    .locator("code.language-ts");
  await expect(code).toContainText("const v3 = 3;");
  await expect(code).toContainText("const v5 = 5;");
  await expect(code).not.toContainText("const v6 = 6;");
  const heading = page
    .locator("#doc .mdmark-include h2", { hasText: "実行" })
    .first();
  await expect(heading.locator(".mdmark-anchor")).toHaveCount(1);
  await expect(
    page.locator(".mdmark-side-toc-list a", { hasText: "実行" }).first(),
  ).toHaveCount(1);
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// 取り込み先が無いマーカーの場所に、無いものを記載した記載の警告を配置する（異常シナリオ（取り込み先が無い））
test("test_error_when_target_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "前の段落",
      "",
      "<!-- include: missing.md -->",
      "",
      "<!-- include: 共通/手順.md#無い見出し -->",
      "",
      "<!-- include: src/app.ts#L20-L22 -->",
      "",
      "後ろの段落",
      "",
    ].join("\n"),
    includes: { "共通/手順.md": PROCEDURE_MD, "src/app.ts": APP_TS },
  });
  // 検証
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(3);
  await expect(warnings.nth(0)).toContainText("missing.md");
  await expect(warnings.nth(1)).toContainText("無い見出し");
  await expect(warnings.nth(2)).toContainText("12 行");
  await expect(page.locator("#doc")).toContainText("前の段落");
  await expect(page.locator("#doc")).toContainText("後ろの段落");
});

// 循環する取り込みを止め、循環の順を記載した記載の警告を配置する（異常シナリオ（取り込みが循環する））
test("test_error_when_circular", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- include: a.md -->\n",
    includes: {
      "a.md": "a の段落\n\n<!-- include: b.md -->\n",
      "b.md": "b の段落\n\n<!-- include: a.md -->\n",
    },
  });
  // 検証
  await expect(page.getByText("a の段落")).toHaveCount(1);
  await expect(page.getByText("b の段落")).toHaveCount(1);
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("a.md → b.md → a.md");
  await expect(page.locator("#doc")).toBeVisible();
});

// 取り込む文書の先頭のフロントマターは、表示をオンにしても取り込まない（正常シナリオ（取り込む文書がフロントマターを持つ））
test("test_normal_when_included_has_frontmatter", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "前の段落\n\n<!-- include: 共通/手順.md -->\n\n後の段落\n",
    config: { features: { frontmatter: true } },
    includes: {
      "共通/手順.md": "---\ntitle: 手順\n---\n\n## 実行\n\n実行の段落\n",
    },
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("h2", { hasText: "実行" })).toHaveCount(1);
  await expect(doc.getByText("実行の段落")).toHaveCount(1);
  await expect(doc).not.toContainText("title: 手順");
  await expect(doc.locator(".mdmark-frontmatter")).toHaveCount(0);
});
