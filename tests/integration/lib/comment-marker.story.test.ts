import type { Locator, Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 余白のマーカーのストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-commentmarginmarker--${id}`);
}

/** ストーリーの余白のマーカー */
function marker(page: Page): Locator {
  return page.locator("button.mdmark-comment-marker");
}

/** マーカーの線の種類を返却する */
function borderStyle(page: Page): Promise<string> {
  return marker(page).evaluate((el) => getComputedStyle(el).borderTopStyle);
}

// 箇所が 1 つの行は、数を出さず、選んだ文字をスクリーンリーダー向けの名前に入れたボタンにする（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await open("default");
  // 検証
  const button = marker(page);
  await expect(button.getAttribute("type")).resolves.toBe("button");
  await expect(button.getAttribute("aria-label")).resolves.toBe(
    "コメント 「テーマの変数」",
  );
  await expect(button.getAttribute("title")).resolves.toBe(
    "コメント 「テーマの変数」",
  );
  await expect(button.locator("span").count()).resolves.toBe(0);
  await expect(button.locator("svg").getAttribute("aria-hidden")).resolves.toBe(
    "true",
  );
  await expect(button.getAttribute("data-current")).resolves.toBeNull();
  await expect(button.getAttribute("data-closed")).resolves.toBeNull();
  await expect(borderStyle(page)).resolves.toBe("solid");
});

// 同じ行の 2 か所は、アイコンの後ろに数を出し、スクリーンリーダー向けの名前に件数を入れる（Merged）
test("test_merged", async () => {
  // 準備・実行
  const page = await open("merged");
  // 検証
  const button = marker(page);
  await expect(button.innerText()).resolves.toBe("2");
  await expect(button.getAttribute("aria-label")).resolves.toBe(
    "コメント 2 件、「担当者」",
  );
});

// 吹き出しを開いている箇所は data-current を持ち、地と文字の色を反転する（Current）
test("test_current", async () => {
  // 準備
  const defaultColors = await marker(await open("default")).evaluate((el) => {
    const style = getComputedStyle(el);
    return { bg: style.backgroundColor, color: style.color };
  });
  // 実行
  const page = await open("current");
  // 検証
  const button = marker(page);
  await expect(button.getAttribute("data-current")).resolves.not.toBeNull();
  const colors = await button.evaluate((el) => {
    const style = getComputedStyle(el);
    return { bg: style.backgroundColor, color: style.color };
  });
  expect(colors.bg).not.toBe(defaultColors.bg);
  expect(colors.color).not.toBe(defaultColors.color);
});

// 閉じた中の箇所は、data-closed に種類を入れ、線を破線にし、スクリーンリーダー向けの名前に閉じた中であることを入れる
test.each([
  [
    "test_closed_section",
    "closed-section",
    "section",
    "閉じた箇所",
    "閉じたセクションの中",
  ],
  [
    "test_closed_tab",
    "closed-tab",
    "tab",
    "タブの箇所",
    "選ばれていないタブの中",
  ],
  ["test_closed_row", "closed-row", "row", "行の箇所", "閉じた行の詳細の中"],
])("%s", async (_name, id, kind, quote, label) => {
  // 準備・実行
  const page = await open(id);
  // 検証
  const button = marker(page);
  await expect(button.getAttribute("data-closed")).resolves.toBe(kind);
  await expect(button.getAttribute("aria-label")).resolves.toBe(
    `コメント 「${quote}」（${label}）`,
  );
  await expect(borderStyle(page)).resolves.toBe("dashed");
});
