import { expect, test } from "@playwright/test";
import {
  DIFF_DOC_ID,
  DIFF_PAGE_MARKDOWN,
  DIFF_REVISIONS,
  htmlRange,
  tableHtml,
} from "../diff-samples.ts";
import { backgroundOf, toggleOf, waitForDiff } from "../diff-ui.ts";
import {
  buildDistRoot,
  mountDiffDocument,
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

/** 範囲の外の段落と、範囲を持つ本文 */
function documentOf(options: { paragraph: string; range?: string }): string {
  return ["# 表", options.paragraph, options.range ?? "", "末尾", ""].join(
    "\n",
  );
}

/** 2 つのリビジョン（`r1`・`r2`）で文書を描き、差分を開く */
async function openRevisions(
  page: import("@playwright/test").Page,
  contents: { r1: string; r2: string },
): Promise<void> {
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: { revisions: DIFF_REVISIONS.slice(1), contents },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
}

/** 表のセルの値を変えた 2 つのリビジョン */
const TABLE_CONTENTS = {
  r1: documentOf({ paragraph: "表の説明", range: htmlRange(tableHtml(120)) }),
  r2: documentOf({ paragraph: "表の説明", range: htmlRange(tableHtml(150)) }),
};

// 範囲を描いた結果に切り替えると前と後の表が並び、ソースに戻せる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備・実行
  await openRevisions(page, TABLE_CONTENTS);
  // 検証: 開いた時点では、ソースの行が色分けで出て、変えたセルの語が濃い色
  const range = page.locator("#doc .mdmark-diff-html");
  await expect(range).toHaveCount(1);
  await expect(range.locator(".mdmark-diff-html-label")).toHaveText("HTML");
  const sourceButton = range.getByRole("button", { name: "ソース" });
  const previewButton = range.getByRole("button", { name: "プレビュー" });
  await expect(sourceButton).toHaveAttribute("aria-pressed", "true");
  await expect(previewButton).toHaveAttribute("aria-pressed", "false");
  const delWord = range.locator("del.mdmark-diff-word");
  const addWord = range.locator("ins.mdmark-diff-word");
  await expect(delWord).toHaveText("120");
  await expect(addWord).toHaveText("150");
  expect(await backgroundOf(delWord)).not.toBe(await backgroundOf(addWord));
  // 実行: 描いた結果に切り替える（キーで操作する）
  await previewButton.focus();
  await previewButton.press("Enter");
  // 検証: 前と後の表が並び、前・後のどちらかを題で示す
  await expect(previewButton).toHaveAttribute("aria-pressed", "true");
  const sides = range.locator(".mdmark-diff-side");
  await expect(sides).toHaveCount(2);
  await expect(sides.nth(0).locator("figcaption")).toContainText("前");
  await expect(sides.nth(1).locator("figcaption")).toContainText("後");
  await expect(sides.nth(0).locator("td").nth(1)).toHaveText("120");
  await expect(sides.nth(1).locator("td").nth(1)).toHaveText("150");
  await expect(range.locator(".mdmark-diff-line").first()).toBeHidden();
  // 実行: ソースに戻す
  await sourceButton.press("Enter");
  // 検証
  await expect(sourceButton).toHaveAttribute("aria-pressed", "true");
  await expect(range.locator(".mdmark-diff-line").first()).toBeVisible();
  await expect(delWord).toHaveText("120");
  await expect(sides.first()).toBeHidden();
});

// 後にだけある範囲は、足した行が全て緑と `+` で出て、プレビューでは前の側に範囲が無いことを示す（正常シナリオ（片側にだけある範囲））
test("test_normal_when_range_only_on_one_side", async ({ page }) => {
  // 準備・実行
  await openRevisions(page, {
    r1: documentOf({ paragraph: "表の説明" }),
    r2: documentOf({
      paragraph: "表の説明",
      range: htmlRange(tableHtml(150)),
    }),
  });
  // 検証: 足した範囲の行が全て緑と行頭の +
  const range = page.locator("#doc .mdmark-diff-html");
  const lines = range.locator(".mdmark-diff-line");
  const count = await lines.count();
  expect(count).toBeGreaterThan(5);
  for (let index = 0; index < count; index += 1) {
    await expect(lines.nth(index)).toHaveAttribute("data-kind", "add");
    await expect(lines.nth(index).locator(".mdmark-diff-sign")).toHaveText("+");
  }
  // 実行
  await range.getByRole("button", { name: "プレビュー" }).click();
  // 検証: 後の描いた結果だけが出て、前の側に範囲が無いことを示す
  await expect(range.locator(".mdmark-diff-absent")).toHaveText(
    "前のリビジョンには、この範囲がありません",
  );
  await expect(range.locator(".mdmark-diff-side table")).toHaveCount(1);
});

// 変えていない範囲は、色と印を持たずに出て、切り替えを持たない（正常シナリオ（変えていない範囲））
test("test_normal_when_range_unchanged", async ({ page }) => {
  // 準備・実行
  await openRevisions(page, {
    r1: documentOf({
      paragraph: "よくある質問の差分は確かめます。",
      range: htmlRange(tableHtml(120)),
    }),
    r2: documentOf({
      paragraph: "よくある質問の変更は確かめます。",
      range: htmlRange(tableHtml(120)),
    }),
  });
  // 検証
  const range = page.locator("#doc .mdmark-diff-html");
  await expect(range).toHaveCount(1);
  const lines = range.locator(".mdmark-diff-line");
  const count = await lines.count();
  expect(count).toBeGreaterThan(5);
  for (let index = 0; index < count; index += 1) {
    await expect(lines.nth(index)).toHaveAttribute("data-kind", "same");
    await expect(lines.nth(index).locator(".mdmark-diff-sign")).toHaveText("");
  }
  await expect(range.getByRole("button", { name: "プレビュー" })).toHaveCount(
    0,
  );
  await expect(range.locator(".mdmark-diff-view")).toHaveCount(0);
});

// スクリプトとイベントの属性を書いた範囲は、描いた結果で落とし、ページの値を書き換えない（正常シナリオ（スクリプトを書いた範囲））
test("test_normal_when_script_in_range", async ({ page }) => {
  // 準備
  const withScript = (mail: number) =>
    htmlRange(
      `${tableHtml(mail)}\n<button type="button" onclick="window.__ran = true">数え直す</button>\n<script>window.__ran = true</script>`,
    );
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    (window as unknown as { __ran: boolean }).__ran = false;
  });
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: {
      revisions: DIFF_REVISIONS.slice(1),
      contents: {
        r1: documentOf({ paragraph: "表の説明", range: withScript(120) }),
        r2: documentOf({ paragraph: "表の説明", range: withScript(150) }),
      },
    },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
  const range = page.locator("#doc .mdmark-diff-html");
  // 検証: ソースの色分けでは、script 要素の行も文字として出る
  await expect(range.locator('[data-pane="source"]')).toContainText(
    "<script>window.__ran = true</script>",
  );
  // 実行
  await range.getByRole("button", { name: "プレビュー" }).click();
  await range.locator(".mdmark-diff-side button").first().click();
  // 検証
  const preview = range.locator('[data-pane="rendered"]');
  await expect(preview.locator("script")).toHaveCount(0);
  expect(await preview.innerHTML()).not.toContain("onclick");
  await expect(preview.locator("button")).toHaveCount(2);
  expect(
    await page.evaluate(() => (window as unknown as { __ran: boolean }).__ran),
  ).toBe(false);
});
