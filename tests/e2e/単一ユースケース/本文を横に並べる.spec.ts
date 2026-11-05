import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 2 列と 3 列の columns の範囲を持つ文書 */
const COLUMNS_MARKDOWN = [
  "<!-- columns -->",
  "",
  "左の列の段落",
  "",
  "<!-- column -->",
  "",
  "右の列の段落",
  "",
  "<!-- /columns -->",
  "",
  "<!-- columns -->",
  "",
  "1 列目",
  "",
  "<!-- column -->",
  "",
  "2 列目",
  "",
  "<!-- column -->",
  "",
  "3 列目",
  "",
  "<!-- /columns -->",
  "",
].join("\n");

/** 範囲ごとの列の左端・上端・幅 */
async function readColumns(page: import("@playwright/test").Page) {
  return page.locator("#doc .mdmark-layout-columns").evaluateAll((ranges) =>
    ranges.map((range) =>
      [...range.querySelectorAll(".mdmark-layout-column")].map((column) => {
        const rect = column.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        };
      }),
    ),
  );
}

// 区切りで分けた列を、等しい幅で横に並べる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: COLUMNS_MARKDOWN });
  // 検証
  const [two = [], three = []] = await readColumns(page);
  expect(two).toHaveLength(2);
  expect(two[0]?.top).toBe(two[1]?.top);
  expect(
    Math.abs((two[0]?.width ?? 0) - (two[1]?.width ?? 0)),
  ).toBeLessThanOrEqual(1);
  expect(three).toHaveLength(3);
  expect(new Set(three.map((column) => column.top)).size).toBe(1);
  await expect(page.locator("#doc [class*='mdmark-columns-']")).toHaveCount(0);
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// 狭い画面では、列を書いた順に縦に積む（正常シナリオ（狭い画面））
test("test_normal_when_narrow", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: COLUMNS_MARKDOWN });
  // 検証
  const body = await page
    .locator("#doc p")
    .first()
    .evaluate((p) => Math.round(p.getBoundingClientRect().width));
  for (const columns of await readColumns(page)) {
    for (let index = 1; index < columns.length; index++) {
      expect(columns[index]?.top).toBeGreaterThan(columns[index - 1]?.top ?? 0);
    }
    for (const column of columns) {
      expect(Math.abs(column.width - body)).toBeLessThanOrEqual(1);
    }
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

// 列の数が 2〜3 でない範囲は、警告を置いて横に並べない（異常シナリオ（列の数が 2〜3 でない））
test("test_error_when_column_count_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- columns -->",
      "",
      "1 列だけ",
      "",
      "<!-- /columns -->",
      "",
      "<!-- columns -->",
      "",
      "c1",
      "",
      "<!-- column -->",
      "",
      "c2",
      "",
      "<!-- column -->",
      "",
      "c3",
      "",
      "<!-- column -->",
      "",
      "c4",
      "",
      "<!-- /columns -->",
      "",
    ].join("\n"),
  });
  // 検証
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(2);
  await expect(warnings.nth(0)).toContainText("1 列");
  await expect(warnings.nth(1)).toContainText("4 列");
  for (const n of [0, 1]) {
    await expect(warnings.nth(n)).toContainText("2〜3");
  }
  await expect(page.locator("#doc .mdmark-layout-columns")).toHaveCount(0);
  for (const text of ["1 列だけ", "c1", "c4"]) {
    await expect(page.locator("#doc")).toContainText(text);
  }
});

// 入れ子の内側は警告を置いて並べず、外側の 2 列は横に並べる（異常シナリオ（columns の入れ子））
test("test_error_when_nested", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- columns -->",
      "",
      "<!-- columns -->",
      "",
      "内1",
      "",
      "<!-- column -->",
      "",
      "内2",
      "",
      "<!-- /columns -->",
      "",
      "<!-- column -->",
      "",
      "外2",
      "",
      "<!-- /columns -->",
      "",
    ].join("\n"),
  });
  // 検証
  const [outer = []] = await readColumns(page);
  expect(outer).toHaveLength(2);
  expect(outer[0]?.top).toBe(outer[1]?.top);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "入れ子",
  );
  const inner = await page
    .locator("#doc .mdmark-layout-column")
    .first()
    .evaluate((column) =>
      [...column.querySelectorAll("p")]
        .filter((p) => /^内/.test(p.textContent ?? ""))
        .map((p) => Math.round(p.getBoundingClientRect().top)),
    );
  expect(inner[1]).toBeGreaterThan(inner[0] ?? 0);
});
