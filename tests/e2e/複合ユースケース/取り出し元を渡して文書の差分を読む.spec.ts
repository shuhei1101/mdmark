import { expect, test } from "@playwright/test";
import {
  DIFF_CONTENTS,
  DIFF_DOC_ID,
  DIFF_PAGE_MARKDOWN,
  DIFF_REVISIONS,
} from "../diff-samples.ts";
import {
  afterSelect,
  backgroundOf,
  beforeSelect,
  diffLines,
  toggleOf,
  waitForDiff,
} from "../diff-ui.ts";
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

// 取り出し元を渡して描き、本文の変更を行と文字で読み、埋め込んだ HTML の変更を描いた結果に切り替えて確かめる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: { revisions: DIFF_REVISIONS, contents: DIFF_CONTENTS },
  });
  // 実行: 差分を開く（既定は r2 と r3）
  await toggleOf(page).click();
  await waitForDiff(page);
  // 検証: r2 と r3 を比べると、埋め込んだ HTML の範囲がソースの行と文字の色分けで出る
  const range = page.locator("#doc .mdmark-diff-html");
  await expect(range).toHaveCount(1);
  await expect(range.locator("del.mdmark-diff-word")).toHaveText("120");
  await expect(range.locator("ins.mdmark-diff-word")).toHaveText("150");
  // 実行: 前に r1、後に r2 を選ぶ
  await beforeSelect(page).selectOption("r1");
  await afterSelect(page).selectOption("r2");
  // 検証: 消した行が赤と -、足した行が緑と +、同じ行は色なし。変わった語だけが濃い色
  await expect(diffLines(page, "del")).toHaveCount(2);
  await expect(diffLines(page, "add")).toHaveCount(2);
  const sameColor = await backgroundOf(diffLines(page, "same").first());
  expect(await backgroundOf(diffLines(page, "del").first())).not.toBe(
    sameColor,
  );
  expect(await backgroundOf(diffLines(page, "add").first())).not.toBe(
    sameColor,
  );
  await expect(
    diffLines(page, "del").first().locator(".mdmark-diff-sign"),
  ).toHaveText("-");
  await expect(
    diffLines(page, "add").first().locator(".mdmark-diff-sign"),
  ).toHaveText("+");
  await expect(page.locator("#doc del.mdmark-diff-word")).toHaveText("差分");
  await expect(page.locator("#doc ins.mdmark-diff-word")).toHaveText("変更");
  // 実行: 前に r2、後に r3 を選び直し、範囲を描いた結果に切り替える
  await afterSelect(page).selectOption("r3");
  await beforeSelect(page).selectOption("r2");
  await expect(range.locator("del.mdmark-diff-word")).toHaveText("120");
  await range.getByRole("button", { name: "プレビュー" }).click();
  // 検証: r2 と r3 の表が前と後で並ぶ
  const sides = range.locator(".mdmark-diff-side");
  await expect(sides).toHaveCount(2);
  await expect(sides.nth(0).locator("td").nth(1)).toHaveText("120");
  await expect(sides.nth(1).locator("td").nth(1)).toHaveText("150");
  // 実行: ソースに戻す
  await range.getByRole("button", { name: "ソース" }).click();
  // 検証
  await expect(range.locator("del.mdmark-diff-word")).toBeVisible();
  await expect(sides.first()).toBeHidden();
});

// 本文を取り出せないリビジョンを選ぶと知らせの枠が出て、文書は残り、選び直すと差分が出る（異常シナリオ（本文を取り出せない））
test("test_error_when_content_unavailable", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: {
      revisions: DIFF_REVISIONS,
      contents: DIFF_CONTENTS,
      failContent: ["r1"],
    },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
  // 実行: r1 を比べる側に選ぶ
  await beforeSelect(page).selectOption("r1");
  // 検証
  const notice = page.locator("#doc .mdmark-notice");
  await expect(notice).toBeVisible();
  await expect(page.locator("#doc h1")).toBeVisible();
  // 実行: r2 を選び直す
  await beforeSelect(page).selectOption("r2");
  // 検証
  await expect(notice).toHaveCount(0);
  await waitForDiff(page);
  await expect(page.locator("#doc .mdmark-diff-html")).toHaveCount(1);
});
