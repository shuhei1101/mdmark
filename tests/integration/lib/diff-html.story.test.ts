import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 変えた範囲を既定のソースの色分けで出し、右端に「HTML」のラベルを置く（Source）
test("test_source", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffhtml--source");
  // 検証
  await expect(
    page.locator(".mdmark-diff-html-label").innerText(),
  ).resolves.toBe("HTML");
  await expect(
    page.locator('[data-view="source"]').getAttribute("aria-pressed"),
  ).resolves.toBe("true");
  await expect(
    page.locator('[data-view="rendered"]').getAttribute("aria-pressed"),
  ).resolves.toBe("false");
  await expect(page.locator('[data-pane="source"]').isVisible()).resolves.toBe(
    true,
  );
  await expect(
    page.locator('[data-pane="rendered"]').isVisible(),
  ).resolves.toBe(false);
  const label = await page.evaluate(() => {
    const head = document.querySelector(
      ".mdmark-diff-html-head",
    ) as HTMLElement;
    const text = document.querySelector(
      ".mdmark-diff-html-label",
    ) as HTMLElement;
    return (
      head.getBoundingClientRect().right - text.getBoundingClientRect().right
    );
  });
  expect(label).toBeLessThan(40);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** プレビューの前と後の位置 */
async function sidesOf(page: Awaited<ReturnType<typeof holder.openStory>>) {
  return page.evaluate(() => {
    const [first, second] = [
      ...document.querySelectorAll(".mdmark-diff-side"),
    ].map((element) => element.getBoundingClientRect());
    return { first, second };
  });
}

// プレビューで前と後を横に並べる（PreviewSide）
test("test_preview_side", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffhtml--preview-side");
  await page.setViewportSize({ width: 900, height: 600 });
  // 検証
  const sides = await sidesOf(page);
  expect(sides.second?.left).toBeGreaterThan(sides.first?.left ?? 0);
  expect(
    Math.abs((sides.second?.top ?? 0) - (sides.first?.top ?? 0)),
  ).toBeLessThan(2);
  const names = await page.locator(".mdmark-diff-side-name").allInnerTexts();
  expect(names).toEqual(["前", "後"]);
  const cells = await page
    .locator(".mdmark-diff-side td:nth-child(2)")
    .allInnerTexts();
  expect(cells).toEqual(["120", "150"]);
});

// プレビューで前と後を縦に並べる（PreviewStack）
test("test_preview_stack", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffhtml--preview-stack");
  await page.setViewportSize({ width: 900, height: 600 });
  // 検証
  const sides = await sidesOf(page);
  expect(sides.second?.top).toBeGreaterThanOrEqual(sides.first?.bottom ?? 0);
  expect(
    Math.abs((sides.second?.left ?? 0) - (sides.first?.left ?? 0)),
  ).toBeLessThan(2);
});

// 後にだけある範囲のプレビューは、前の側にそのことを出す（OneSide）
test("test_one_side", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffhtml--one-side");
  // 検証
  await expect(page.locator(".mdmark-diff-absent").innerText()).resolves.toBe(
    "前のリビジョンには、この範囲がありません",
  );
  await expect(
    page.locator(".mdmark-diff-side td:nth-child(2)").count(),
  ).resolves.toBe(1);
});

// 変えていない範囲は、「HTML」のラベルだけの見出しで、切り替えを持たない（Unchanged）
test("test_unchanged", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffhtml--unchanged");
  // 検証
  await expect(
    page.locator(".mdmark-diff-html-label").innerText(),
  ).resolves.toBe("HTML");
  await expect(page.locator(".mdmark-diff-view").count()).resolves.toBe(0);
  const head = await page
    .locator(".mdmark-diff-html-head")
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(head).toBeLessThan(32);
});

// スクリプトとイベントの属性を落としたプレビューを出す（ScriptDropped）
test("test_script_dropped", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diffhtml--script-dropped");
  // 検証
  await expect(page.locator(".mdmark-diff-side script").count()).resolves.toBe(
    0,
  );
  const button = page.locator(".mdmark-diff-side button").first();
  await expect(button.innerText()).resolves.toBe("数える");
  await expect(button.getAttribute("onclick")).resolves.toBeNull();
});
