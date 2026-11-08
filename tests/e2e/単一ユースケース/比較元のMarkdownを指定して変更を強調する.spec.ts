import { expect, type Page, test } from "@playwright/test";
import { diffBlocks } from "../diff-ui.ts";
import {
  buildDistRoot,
  destroyDocument,
  mountDocument,
  openPage,
  removeDistRoot,
  updateDocument,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 比較元: 段落 A・B・C。段落 C は空行どうしで合わないよう 2 行にする
const BASE_MARKDOWN = [
  "比較元の段落 A です。",
  "",
  "消す段落 B です。",
  "",
  "残す段落 C の 1 行目です。",
  "残す段落 C の 2 行目です。",
  "",
].join("\n");

// 描く Markdown: 段落 A の語を 1 つ書き換え、段落 B を削除し、段落 C の後に段落 D を追加する
const TARGET_MARKDOWN = [
  "書き換えた段落 A です。",
  "",
  "残す段落 C の 1 行目です。",
  "残す段落 C の 2 行目です。",
  "",
  "足した段落 D です。",
  "",
].join("\n");

// 次の比較元: 描く Markdown から段落 D だけを除いた文書
const NEXT_BASE_MARKDOWN = TARGET_MARKDOWN.replace(
  "\n足した段落 D です。\n",
  "",
);

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 本文の段落の文字を文書の順に並べる */
function paragraphTexts(page: Page): Promise<string[]> {
  return page.locator("#doc p").allTextContents();
}

/** 段落 A・B・D を強調し、段落 C を強調していないことを確かめる */
async function expectBaseDiff(page: Page): Promise<void> {
  const added = diffBlocks(page, "add");
  await expect(added).toHaveCount(2);
  await expect(added.nth(0)).toContainText("書き換えた段落 A です。");
  await expect(added.nth(1)).toContainText("足した段落 D です。");
  const deleted = diffBlocks(page, "del");
  await expect(deleted).toHaveCount(1);
  await expect(deleted).toContainText("消す段落 B です。");
  expect(
    await page
      .locator("#doc p", { hasText: "残す段落 C" })
      .evaluate((element) => element.closest(".mdmark-diff-block")),
  ).toBeNull();
}

// 比較元を渡すと、変えたブロックを本文の中で強調し、差分を開くボタンを出さない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: TARGET_MARKDOWN,
    baseMarkdown: BASE_MARKDOWN,
  });
  // 検証
  await expectBaseDiff(page);
  const texts = await paragraphTexts(page);
  const at = (word: string) => texts.findIndex((text) => text.includes(word));
  expect(at("消す段落 B")).toBeLessThan(at("書き換えた段落 A"));
  for (const index of [0, 1]) {
    await expect(
      diffBlocks(page, "add").nth(index).locator(".mdmark-visually-hidden"),
    ).toHaveText("追加:");
    await expect(
      diffBlocks(page, "add")
        .nth(index)
        .locator('.mdmark-diff-block-sign[aria-hidden="true"]'),
    ).toHaveText("+");
  }
  await expect(
    diffBlocks(page, "del").locator(".mdmark-visually-hidden"),
  ).toHaveText("削除:");
  await expect(
    diffBlocks(page, "del").locator(
      '.mdmark-diff-block-sign[aria-hidden="true"]',
    ),
  ).toHaveText("−");
  await expect(page.locator("#doc .mdmark-diff-toggle")).toHaveCount(0);
});

// update の第 2 引数で比較元を差し替え、省くと前の比較元を保ち、null で強調を外す（正常シナリオ（比較元を差し替える））
test("test_normal_when_base_replaced", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: TARGET_MARKDOWN,
    baseMarkdown: BASE_MARKDOWN,
  });
  await expectBaseDiff(page);
  // 実行・検証: 次の比較元へ差し替える
  await updateDocument(page, TARGET_MARKDOWN, {
    baseMarkdown: NEXT_BASE_MARKDOWN,
  });
  await expect(diffBlocks(page, "add")).toHaveCount(1);
  await expect(diffBlocks(page, "add")).toContainText("足した段落 D です。");
  await expect(diffBlocks(page, "del")).toHaveCount(0);
  // 実行・検証: 第 2 引数を省くと前の比較元のまま
  await updateDocument(page, TARGET_MARKDOWN);
  await expect(diffBlocks(page, "add")).toHaveCount(1);
  await expect(diffBlocks(page, "add")).toContainText("足した段落 D です。");
  await expect(diffBlocks(page, "del")).toHaveCount(0);
  // 実行・検証: null で強調を外す
  await updateDocument(page, TARGET_MARKDOWN, { baseMarkdown: null });
  await expect(page.locator("#doc .mdmark-diff-block")).toHaveCount(0);
});

// 比較元を null で描くと強調せず、update で比較元を渡すと強調する（正常シナリオ（比較元を渡さない））
test("test_normal_when_base_null", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TARGET_MARKDOWN });
  const plain = await page.locator("#doc").innerHTML();
  await destroyDocument(page);
  // 実行
  await mountDocument(page, {
    markdown: TARGET_MARKDOWN,
    baseMarkdown: null,
  });
  // 検証
  await expect(page.locator("#doc .mdmark-diff-block")).toHaveCount(0);
  expect(await page.locator("#doc").innerHTML()).toBe(plain);
  // 実行
  await updateDocument(page, TARGET_MARKDOWN, { baseMarkdown: BASE_MARKDOWN });
  // 検証
  await expectBaseDiff(page);
});

// 比較元と同じ本文では強調しない（正常シナリオ（比較元と同じ本文））
test("test_normal_when_unchanged", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: BASE_MARKDOWN,
    baseMarkdown: BASE_MARKDOWN,
  });
  // 検証
  await expect(page.locator("#doc p").first()).toHaveText(
    "比較元の段落 A です。",
  );
  await expect(page.locator("#doc .mdmark-diff-block")).toHaveCount(0);
});

// 文字列でも null でもない比較元では、描かずに TypeError を投げる（異常シナリオ（文字列でない比較元））
test("test_error_when_base_not_string", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  const thrown = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("#doc");
    const mdmark = (
      window as Window & {
        mdmark?: {
          mount: (el: HTMLElement, opts: Record<string, unknown>) => unknown;
        };
      }
    ).mdmark;
    if (!el || !mdmark) {
      throw new Error("mdmark か描く先の要素が無い");
    }
    try {
      mdmark.mount(el, { markdown: "# 題\n", baseMarkdown: 1 });
      return null;
    } catch (error) {
      return {
        name: error instanceof Error ? error.name : "",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
  // 検証
  expect(thrown?.name).toBe("TypeError");
  expect(thrown?.message).toContain("baseMarkdown");
  expect(await page.locator("#doc").innerHTML()).toBe("");
});
