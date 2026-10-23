import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 閉じているツールチップは見えず、持ち主だけが見える（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--closed");
  // 検証
  await expect(page.locator('[role="tooltip"]').isVisible()).resolves.toBe(
    false,
  );
  await expect(
    page.locator(".mdmark-diagram-label.has-tip").isVisible(),
  ).resolves.toBe(true);
});

// 線の入力の詳細を開いた状態は、題と詳細を出し、横にはみ出さない（Wire）
test("test_wire", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--wire");
  // 検証
  const tip = page.locator('[role="tooltip"]');
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(tip.innerText()).resolves.toContain("件名を除いた本文");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 箱の入力・処理・出力を開いた状態は、3 行を見出しつきで出し、横にはみ出さない（Io）
test("test_io", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--io");
  // 検証
  const tip = page.locator('[role="tooltip"]');
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(tip.locator("dt").allInnerTexts()).resolves.toEqual([
    "入力",
    "処理",
    "出力",
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 用語を開いた状態は、本文の用語と同じ破線の下線で意味を出し、横にはみ出さない（Term）
test("test_term", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--term");
  // 検証
  await expect(page.locator('[role="tooltip"]').innerText()).resolves.toContain(
    "選択肢から選ぶ",
  );
  const style = await page
    .locator(".mdmark-term")
    .evaluate((element) => getComputedStyle(element).textDecorationStyle);
  expect(style).toBe("dashed");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 箱の hint を開いた状態は、見出しを持たず文だけを出し、横にはみ出さない（Hint）
test("test_hint", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--hint");
  // 検証
  const tip = page.locator('[role="tooltip"]');
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(tip.innerText()).resolves.toContain(
    "保存と送信のツールだけを持つ MCP サーバー",
  );
  await expect(tip.locator(".mdmark-term-tip-heading").count()).resolves.toBe(
    0,
  );
  await expect(tip.locator("dt").count()).resolves.toBe(0);
  // 箱の印の上に出る
  const rects = await page.evaluate(() => {
    const owner = document.querySelector(".mdmark-diagram-info");
    const tooltip = document.querySelector('[role="tooltip"]');
    if (!owner || !tooltip) {
      throw new Error("印かツールチップが無い");
    }
    return {
      ownerTop: owner.getBoundingClientRect().top,
      tipBottom: tooltip.getBoundingClientRect().bottom,
    };
  });
  expect(rects.tipBottom).toBeLessThanOrEqual(rects.ownerTop);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
