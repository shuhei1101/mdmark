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

// 線の入力の詳細を開いた状態は、タイトルと詳細を出し、横にはみ出さない（Wire）
test("test_wire", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--wire");
  // 検証
  const tip = page.locator('[role="tooltip"]');
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(tip.innerText()).resolves.toContain("件名を除いた本文");
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

// ノードの hint を開いた状態は、見出しを持たず文だけを出し、横にはみ出さない（Hint）
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
  // ノードのマーカーの上に出る
  const rects = await page.evaluate(() => {
    const owner = document.querySelector(".mdmark-diagram-info");
    const tooltip = document.querySelector('[role="tooltip"]');
    if (!owner || !tooltip) {
      throw new Error("マーカーかツールチップが無い");
    }
    return {
      ownerTop: owner.getBoundingClientRect().top,
      tipBottom: tooltip.getBoundingClientRect().bottom,
    };
  });
  expect(rects.tipBottom).toBeLessThanOrEqual(rects.ownerTop);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ER 図のテーブルを開いた状態は、論理名と物理名のタイトル・概要・列の説明を出し、横にはみ出さない（Table）
test("test_table", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--table");
  // 検証
  const tip = page.locator('[role="tooltip"]');
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(
    tip.locator(".mdmark-term-tip-heading").innerText(),
  ).resolves.toBe("注文（orders）");
  await expect(tip.innerText()).resolves.toContain("1 回の注文");
  await expect(tip.locator("dt").allInnerTexts()).resolves.toEqual([
    "customer_id",
    "status",
    "total",
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 折れ線の点のツールチップを開いた状態は、点の下に系列の名前と `{横の目盛り}: {値}` を出す（Item）
test("test_item", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--item");
  // 検証
  const tip = page.locator('[role="tooltip"]:not([hidden])');
  await expect(tip.count()).resolves.toBe(1);
  const text = await tip.innerText();
  expect(text).toMatch(/.+\n?.*: \d/);
  const id = await tip.getAttribute("id");
  const owner = page.locator(`[aria-describedby="${id}"]`);
  const [tipBox, ownerBox] = await Promise.all([
    tip.boundingBox(),
    owner.boundingBox(),
  ]);
  expect(tipBox?.y ?? 0).toBeGreaterThanOrEqual(
    (ownerBox?.y ?? 0) + (ownerBox?.height ?? 0) - 1,
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// システムの枠のタイトルのマーカーで hint を開いた状態は、マーカーの下に文だけを出す（GroupHint）
test("test_group_hint", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--group-hint");
  // 検証
  const tip = page.locator('[role="tooltip"]:not([hidden])');
  await expect(tip.count()).resolves.toBe(1);
  await expect(tip.locator(".mdmark-term-tip-heading").count()).resolves.toBe(
    0,
  );
  await expect(tip.innerText()).resolves.not.toBe("");
  const id = await tip.getAttribute("id");
  const owner = page.locator(
    `button.mdmark-diagram-group-info[aria-describedby="${id}"]`,
  );
  await expect(owner.count()).resolves.toBe(1);
  const [tipBox, ownerBox] = await Promise.all([
    tip.boundingBox(),
    owner.boundingBox(),
  ]);
  expect(tipBox?.y ?? 0).toBeGreaterThanOrEqual(
    (ownerBox?.y ?? 0) + (ownerBox?.height ?? 0) - 1,
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ノードの説明の下に、線で分けた注記の区分（見出し `注記 1` と本文）を出す（Annotation）
test("test_annotation", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-diagramtooltip--annotation");
  // 検証
  const sections = page.locator('[role="tooltip"] .mdmark-term-tip-section');
  await expect(sections.count()).resolves.toBe(2);
  await expect(sections.nth(0).innerText()).resolves.toContain(
    "入力の値を判定の条件と比べる",
  );
  await expect(
    sections.nth(1).locator(".mdmark-note-tip-heading").innerText(),
  ).resolves.toBe("注記 1");
  await expect(
    sections
      .nth(1)
      .evaluate((element) => getComputedStyle(element).borderTopStyle),
  ).resolves.toBe("solid");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 説明を持たず注記だけを持つ線は、注記の区分だけを出す（AnnotationOnlyWire）
test("test_annotation_only_wire", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-diagramtooltip--annotation-only-wire",
  );
  // 検証
  const sections = page.locator('[role="tooltip"] .mdmark-term-tip-section');
  await expect(sections.count()).resolves.toBe(1);
  await expect(sections.first().innerText()).resolves.toContain("注記 1");
  await expect(sections.first().innerText()).resolves.toContain(
    "条件を満たさないときは次の工程へ進む。",
  );
});
