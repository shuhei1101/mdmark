import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** ボタンの属性と、線・地の色 */
async function readToggle(id: string) {
  const page = await holder.openStory(id);
  const button = page.locator(".mdmark-diff-toggle");
  const info = await button.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      expanded: element.getAttribute("aria-expanded"),
      controls: element.getAttribute("aria-controls"),
      border: computed.borderTopColor,
      background: computed.backgroundColor,
      iconHidden: element.querySelector("svg")?.getAttribute("aria-hidden"),
      height: element.getBoundingClientRect().height,
    };
  });
  return { page, button, info };
}

// 差分を閉じている間は、アイコンと「変更を見る」を出す（Closed）
test("test_closed", async () => {
  // 準備・実行
  const { page, button, info } = await readToggle("parts-difftoggle--closed");
  // 検証
  await expect(button.innerText()).resolves.toBe("変更を見る");
  expect(info.expanded).toBe("false");
  expect(info.controls).toBe("mdmark-diff-panel-1");
  expect(info.iconHidden).toBe("true");
  expect(info.height).toBeGreaterThanOrEqual(32);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 差分を開いている間は、押された見た目にする（Open）
test("test_open", async () => {
  // 準備・実行
  const closed = await readToggle("parts-difftoggle--closed");
  const open = await readToggle("parts-difftoggle--open");
  // 検証
  expect(open.info.expanded).toBe("true");
  expect(open.info.border).not.toBe(closed.info.border);
  expect(open.info.background).not.toBe(closed.info.background);
});
