import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  createBrowserHolder,
  expectCountBelowTitle,
  pageOverflows,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1920, height: 1000 };

/** ストーリーを開く */
function openStory(id: string, viewport = WIDE): Promise<Page> {
  return holder.openStory(`parts-mapc4--${id}`, viewport);
}

type Box = { left: number; top: number; right: number; bottom: number };

/** 辺が接するだけは重ならない扱いで、2 つの矩形が重なるか */
const overlaps = (a: Box, b: Box) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

/** ノードと線の、薄くしたか */
function dimsOf(page: Page) {
  return page
    .locator(
      ".mdmark-diagram-stage :is(.mdmark-diagram-node[data-node], path.mdmark-diagram-wire[data-wire])",
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id:
          element.getAttribute("data-node") ??
          element.getAttribute("data-wire") ??
          "",
        dim: element.classList.contains("map-dim"),
      })),
    );
}

/** 表示しているノードのうち、どの 2 つも重ならないことを確かめる */
async function expectNoOverlap(page: Page): Promise<void> {
  const boxes = await page
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          id: element.getAttribute("data-node") ?? "",
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
        };
      }),
    );
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
}

/** 幅 390px の置き場所では、表示する枠の中で横にスクロールし、ページははみ出さない */
async function expectNarrow(page: Page): Promise<void> {
  const viewport = await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
  expect(viewport.scroll).toBeGreaterThan(viewport.client);
  await expect(pageOverflows(page)).resolves.toBe(false);
}

// 要素の種類の行・説明・外部の要素の灰色の面・破線の境界を描き、ノードが重ならない（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  await expectNoOverlap(page);
  await expect(
    page.locator('[data-node="support"] .mdmark-diagram-node-kind').innerText(),
  ).resolves.toContain("[External Person]");
  await expect(
    page.locator('[data-node="store"] .map-c4-description').innerText(),
  ).resolves.toBe("注文と支払いを受け付ける");
  const backgrounds = await page
    .locator('[data-node="pay"], [data-node="store"]')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundColor),
    );
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
  for (const [id, title] of [
    ["company", "自社［Enterprise］"],
    ["shop", "通販［Software System］"],
  ] as const) {
    const group = page.locator(`.map-group[data-group="${id}"]`);
    await expect(group.innerText()).resolves.toContain(title);
    await expect(
      group.evaluate((element) => getComputedStyle(element).borderTopStyle),
    ).resolves.toBe("dashed");
  }
});

// 境界「通販」を閉じると、名前の行の下に「要素 3 件」の行を持つ 1 つのノードになり、タイトルが収まる（BoundaryCollapsed）
test("test_boundary_collapsed", async () => {
  // 準備・実行
  const page = await openStory("boundary-collapsed");
  // 検証
  const closed = page.locator('.map-closed-group[data-group="shop"]');
  await expectCountBelowTitle(
    page,
    '.map-closed-group[data-group="shop"]',
    "要素 3 件",
  );
  const size = await closed.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
});

// 境界「通販」の中へ入ると、外の要素が薄い（Entered）
test("test_entered", async () => {
  // 準備・実行
  const page = await openStory("entered");
  // 検証
  const shown = await page
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      elements
        .filter((element) => !element.classList.contains("map-faded"))
        .map((element) => element.getAttribute("data-node")),
    );
  expect(shown.sort()).toEqual(["store", "stock", "orders"].sort());
});

// 「注文のシステム」と「在庫のシステム」を選ぶと、Rel_R の線と両端のほかが薄い（ElementSelected）
test("test_element_selected", async () => {
  // 準備・実行
  const page = await openStory("element-selected");
  // 検証
  const marks = await dimsOf(page);
  for (const id of ["store", "stock", "r3"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["customer", "orders", "pay", "r1", "r2"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
});

// 幅 390px の置き場所（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openStory("narrow", { width: 390, height: 844 });
  // 検証
  await expectNarrow(page);
});

// 要素はフォーカスを受け、外部の要素は種類の行の External でも伝える（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  const hit = page.locator(
    '.mdmark-diagram-node[data-node="store"] > .mdmark-diagram-node-hit',
  );
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  await expect(hit.getAttribute("aria-label")).resolves.toBe("注文のシステム");
  await expect(
    page.locator('[data-node="pay"]').innerText(),
  ).resolves.toContain("External");
});
