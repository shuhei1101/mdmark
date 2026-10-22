import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 選んだ 2 つの本文に変更が無いとき、その文を出す（Same）
test("test_same", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffmessage--same");
  // 検証
  await expect(page.locator(".mdmark-diff-empty").innerText()).resolves.toBe(
    "選んだ 2 つのリビジョンの本文に、変更はありません。",
  );
});

// リビジョンが 1 つだけのとき、比較対象が無いことを出す（Single）
test("test_single", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffmessage--single");
  // 検証
  await expect(page.locator(".mdmark-diff-empty").innerText()).resolves.toBe(
    "この文書のリビジョンは 1 つだけのため、比較対象のリビジョンがありません。",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** 読み込み中の枠の線の種類と、読み上げの属性 */
async function readLoading(id: string) {
  const page = await holder.openStory(id);
  const info = await page.evaluate(() => {
    const box = document.querySelector(".mdmark-diff-loading") as HTMLElement;
    const spinner = box.querySelector(".mdmark-diff-spinner");
    return {
      text: box.textContent,
      borderStyle: getComputedStyle(box).borderTopStyle,
      height: box.getBoundingClientRect().height,
      role: box.getAttribute("role"),
      spinner: spinner
        ? {
            hidden: spinner.getAttribute("aria-hidden"),
            animation: getComputedStyle(spinner).animationName,
          }
        : null,
    };
  });
  return { page, info };
}

// 待ちが 1 秒を過ぎたとき、破線の枠に文を出し、読み上げの対象にしない（Loading）
test("test_loading", async () => {
  // 準備・実行
  const { info } = await readLoading("parts-diffmessage--loading");
  // 検証
  expect(info.text).toBe("変更を読み込んでいます");
  expect(info.borderStyle).toBe("dashed");
  expect(info.role).toBeNull();
  expect(info.height).toBeGreaterThanOrEqual(120);
  expect(info.spinner).toBeNull();
});

// 待ちが 2 秒を過ぎたとき、回る表示を足す。動きを減らす設定では回さない（LoadingSpinner）
test("test_loading_spinner", async () => {
  // 準備・実行
  const { page, info } = await readLoading(
    "parts-diffmessage--loading-spinner",
  );
  // 検証
  expect(info.spinner?.hidden).toBe("true");
  expect(info.spinner?.animation).toBe("mdmark-diff-spin");
  // 動きを減らす設定にすると、回さない
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animation = await page
    .locator(".mdmark-diff-spinner")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toBe("none");
});
