import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** コメントの印のストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-commentmark--${id}`);
}

/** 印の下線の種類を返す */
function underline(page: Page): Promise<string> {
  return page
    .locator("mark.mdmark-comment-mark")
    .evaluate((mark) => getComputedStyle(mark).textDecorationLine);
}

// 段落の中の印は、本文の文字を変えず、押せる印として読み上げる（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await open("default");
  // 検証
  const mark = page.locator("mark.mdmark-comment-mark");
  await expect(mark.innerText()).resolves.toBe("テーマの変数");
  await expect(mark.getAttribute("tabindex")).resolves.toBe("0");
  await expect(mark.getAttribute("role")).resolves.toBe("button");
  await expect(mark.getAttribute("aria-haspopup")).resolves.toBe("dialog");
  await expect(mark.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(mark.getAttribute("aria-describedby")).resolves.toBe(
    "mdmark-comment-hint",
  );
  await expect(page.locator("#storybook-root p").innerText()).resolves.toBe(
    "本文のテーマの変数を読む。",
  );
  await expect(underline(page)).resolves.toContain("underline");
  await expect(
    mark.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).resolves.not.toBe("rgba(0, 0, 0, 0)");
});

// 吹き出しを開いているときは、aria-expanded を true にして印のまま出す（Expanded）
test("test_expanded", async () => {
  // 準備・実行
  const page = await open("expanded");
  // 検証
  const mark = page.locator("mark.mdmark-comment-mark");
  await expect(mark.getAttribute("aria-expanded")).resolves.toBe("true");
  await expect(underline(page)).resolves.toContain("underline");
});
