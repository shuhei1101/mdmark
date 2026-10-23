import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** コメントの吹き出しのストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-commentbubble--${id}`);
}

/** 吹き出しの枠が `role="dialog"` で、閉じるボタンを持つことを確かめる */
async function expectFrame(page: Page): Promise<void> {
  const bubble = page.locator(".mdmark-comment-bubble");
  await expect(bubble.getAttribute("role")).resolves.toBe("dialog");
  await expect(bubble.getAttribute("aria-label")).resolves.toBe("コメント");
  await expect(bubble.getAttribute("tabindex")).resolves.toBe("-1");
  await expect(page.locator(".mdmark-comment-quote").innerText()).resolves.toBe(
    "「テーマの変数」へのコメント",
  );
  const close = page.locator("button.mdmark-comment-close");
  await expect(close.getAttribute("aria-label")).resolves.toBe("閉じる");
  await expect(close.locator("svg").count()).resolves.toBe(1);
}

/** 本文の並びを返す */
function bodies(page: Page): Promise<string[]> {
  return page.locator(".mdmark-comment-list li").allInnerTexts();
}

// コメントが 1 つのときは、本文を 1 件だけ並べる（Single）
test("test_single", async () => {
  // 準備・実行
  const page = await open("single");
  // 検証
  await expectFrame(page);
  await expect(bodies(page)).resolves.toEqual(["変数の名前を一覧にしてほしい"]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 同じ箇所に複数のコメントがあるときは、保存した順に並べ、改行はそのまま折り返す（Multiple）
test("test_multiple", async () => {
  // 準備・実行
  const page = await open("multiple");
  // 検証
  await expectFrame(page);
  const texts = await bodies(page);
  expect(texts).toHaveLength(2);
  expect(texts[0]).toBe("変数の名前を一覧にしてほしい");
  expect(texts[1]).toContain("2 行目の続き");
  await expect(
    page
      .locator(".mdmark-comment-body")
      .nth(1)
      .evaluate((body) => getComputedStyle(body).whiteSpace),
  ).resolves.toMatch(/pre-wrap|pre-line/);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// HTML に見える本文は、文字のまま出す（EscapedBody）
test("test_escaped_body", async () => {
  // 準備・実行
  const page = await open("escaped-body");
  // 検証
  await expectFrame(page);
  await expect(bodies(page)).resolves.toEqual(["ここは <b>太字</b> にしたい"]);
  await expect(page.locator(".mdmark-comment-list b").count()).resolves.toBe(0);
});
