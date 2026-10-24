import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows, resolveColor } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** コメントの入力欄のストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-commentform--${id}`);
}

/** 入力欄の枠が `role="dialog"` で、題に選んだ文字を出すことを確かめる */
async function expectFrame(page: Page, quote: string): Promise<void> {
  const form = page.locator(".mdmark-comment-form");
  await expect(form.getAttribute("role")).resolves.toBe("dialog");
  await expect(form.getAttribute("aria-label")).resolves.toBe("コメントを書く");
  await expect(page.locator(".mdmark-comment-quote").innerText()).resolves.toBe(
    `「${quote}」へのコメント`,
  );
}

/** 知らせが見えているか */
function alertVisible(page: Page): Promise<boolean> {
  return page.locator(".mdmark-comment-error").isVisible();
}

// 開いた直後は、本文の欄が空で知らせを出さない（Idle）
test("test_idle", async () => {
  // 準備・実行
  const page = await open("idle");
  // 検証
  await expectFrame(page, "テーマの変数");
  await expect(page.locator("textarea").inputValue()).resolves.toBe("");
  await expect(alertVisible(page)).resolves.toBe(false);
  await expect(page.locator("button.is-primary").innerText()).resolves.toBe(
    "コメントを保存",
  );
  await expect(page.locator("button.is-primary").isDisabled()).resolves.toBe(
    false,
  );
  await expect(
    page.locator("textarea").getAttribute("aria-invalid"),
  ).resolves.toBeNull();
  // 保存のボタンは、文字の色の地と線に、地の色の文字
  const save = await page.locator("button.is-primary").evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    border: getComputedStyle(button).borderTopColor,
    color: getComputedStyle(button).color,
  }));
  const text = await resolveColor(page, "var(--mdmark-color-text)");
  expect(save).toEqual({
    background: text,
    border: text,
    color: await resolveColor(page, "var(--mdmark-color-bg)"),
  });
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 本文を書いた状態では、本文の欄に書いた文字が入っている（Typed）
test("test_typed", async () => {
  // 準備・実行
  const page = await open("typed");
  // 検証
  await expectFrame(page, "テーマの変数");
  await expect(page.locator("textarea").inputValue()).resolves.toBe(
    "変数の名前を一覧にしてほしい",
  );
  await expect(alertVisible(page)).resolves.toBe(false);
});

// 保存を待っている間は、保存のボタンを押せなくして枠を処理中にする（Saving）
test("test_saving", async () => {
  // 準備・実行
  const page = await open("saving");
  // 検証
  const save = page.locator("button.is-primary");
  await expect(save.isDisabled()).resolves.toBe(true);
  await expect(save.innerText()).resolves.toBe("保存しています…");
  await expect(
    page.locator(".mdmark-comment-form").getAttribute("aria-busy"),
  ).resolves.toBe("true");
});

// 本文が空のまま保存したときは、書くよう知らせる（Empty）
test("test_empty", async () => {
  // 準備・実行
  const page = await open("empty");
  // 検証
  await expect(alertVisible(page)).resolves.toBe(true);
  const alert = page.locator(".mdmark-comment-error");
  await expect(alert.getAttribute("role")).resolves.toBe("alert");
  await expect(alert.innerText()).resolves.toBe(
    "コメントを書いてから保存してください。",
  );
  await expect(alert.locator("svg").count()).resolves.toBe(1);
  await expect(
    page.locator("textarea").getAttribute("aria-invalid"),
  ).resolves.toBe("true");
  await expect(
    page.locator("textarea").getAttribute("aria-describedby"),
  ).resolves.toBe("story-comment-error");
});

// 保存できなかったときは、本文を残したまま、もう一度押すよう知らせる（Failed）
test("test_failed", async () => {
  // 準備・実行
  const page = await open("failed");
  // 検証
  await expect(alertVisible(page)).resolves.toBe(true);
  await expect(page.locator(".mdmark-comment-error").innerText()).resolves.toBe(
    "コメントを保存できませんでした。書いたコメントは残っています。もう一度「コメントを保存」を押してください。",
  );
  await expect(page.locator("textarea").inputValue()).resolves.toBe(
    "変数の名前を一覧にしてほしい",
  );
  await expect(
    page.locator("textarea").getAttribute("aria-invalid"),
  ).resolves.toBe("true");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 長い文字を選んだときは、題が折り返して横にはみ出さない（LongQuote）
test("test_long_quote", async () => {
  // 準備・実行
  const page = await open("long-quote");
  // 検証
  await expect(
    page.locator(".mdmark-comment-quote").innerText(),
  ).resolves.toContain("使う側のページが自分の JavaScript");
  await expect(pageOverflows(page)).resolves.toBe(false);
  await expect(
    page.locator(".mdmark-comment-quote").evaluate((quote) => {
      const style = getComputedStyle(quote);
      return style.overflowWrap !== "normal" || style.wordBreak !== "normal";
    }),
  ).resolves.toBe(true);
});
