import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 3 つの手順に、丸で囲んだ番号を付ける（Basic）
test("test_basic", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-steps--basic");
  // 検証
  const steps = page.locator("ol.mdmark-steps");
  await expect(steps.locator("> li").count()).resolves.toBe(3);
  const style = await steps
    .locator("> li")
    .first()
    .evaluate((element) => ({
      listStyle: getComputedStyle(element.parentElement as Element)
        .listStyleType,
      markerDisplay: getComputedStyle(element, "::before").display,
      markerRadius: getComputedStyle(element, "::before").borderTopLeftRadius,
    }));
  expect(style.listStyle).toBe("none");
  expect(style.markerDisplay).toBe("grid");
  expect(style.markerRadius).toBe("50%");
});

// 手順の中のコードブロックと入れ子のリストを持ち、入れ子の番号付きリストは手順にしない（Rich）
test("test_rich", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-steps--rich");
  // 検証
  await expect(page.locator("ol.mdmark-steps").count()).resolves.toBe(1);
  await expect(
    page.locator("ol.mdmark-steps pre").count(),
  ).resolves.toBeGreaterThanOrEqual(1);
  const nested = page.locator("ol.mdmark-steps ol");
  await expect(nested.count()).resolves.toBe(1);
  await expect(
    nested.evaluate((el) => el.classList.contains("mdmark-steps")),
  ).resolves.toBe(false);
});

// 項目の文が長く折り返しても、線が項目の高さに合わせて伸びる（Long）
test("test_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-steps--long");
  // 検証
  const first = page.locator("ol.mdmark-steps > li").first();
  const line = await first.evaluate((element) => {
    const after = getComputedStyle(element, "::after");
    return { content: after.content, position: after.position };
  });
  expect(line.content).not.toBe("none");
  expect(line.position).toBe("absolute");
  const lines = await first.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(lines).toBeGreaterThan(60);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 閉じたステップは、見出し「手順（3 ステップ）」だけが見える（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-steps--closed");
  // 検証
  const details = page.locator("details.mdmark-collapsible");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(details.locator("summary").innerText()).resolves.toBe(
    "手順（3 ステップ）",
  );
  await expect(page.locator("ol.mdmark-steps").isVisible()).resolves.toBe(
    false,
  );
});

// 開いたステップに title= を付けると、見出し「準備」の下に番号と項目が見える（OpenTitle）
test("test_open_title", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-steps--open-title");
  // 検証
  const details = page.locator("details.mdmark-collapsible");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(true);
  await expect(details.locator("summary").innerText()).resolves.toBe("準備");
  const steps = page.locator("ol.mdmark-steps");
  await expect(steps.isVisible()).resolves.toBe(true);
  await expect(steps.locator("> li").count()).resolves.toBe(3);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
