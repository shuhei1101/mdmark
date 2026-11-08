import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 文字を選んだときに出す「コメント」のボタンを、名前とアイコン付きで出す（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-commentbutton--default");
  // 検証
  const button = page.locator("button.mdmark-comment-add");
  await expect(button.count()).resolves.toBe(1);
  await expect(button.getAttribute("type")).resolves.toBe("button");
  await expect(button.innerText()).resolves.toBe("コメント");
  await expect(button.locator("svg").getAttribute("aria-hidden")).resolves.toBe(
    "true",
  );
  await expect(button.isVisible()).resolves.toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 390px の画面でも、ボタンが描く先の要素の内側に収まり、横スクロールを出さない
test("test_narrow_viewport", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-commentbutton--default", {
    width: 390,
    height: 844,
  });
  // 検証
  await expect(pageOverflows(page)).resolves.toBe(false);
});
