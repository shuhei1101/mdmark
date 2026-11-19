import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  type Box,
  createBrowserHolder,
  expectCountBelowTitle,
  overlaps,
  pageOverflows,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1920, height: 1000 };

/** ストーリーを開く */
function openStory(id: string, viewport = WIDE): Promise<Page> {
  return holder.openStory(`parts-maparchitecture--${id}`, viewport);
}

/** 要素の矩形（ページの座標） */
function rectOf(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
    };
  });
}

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

// service のアイコン・group のアイコンつきのタイトル・junction の点を描き、ノードが重ならない（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  await expectNoOverlap(page);
  for (const id of ["web", "api", "worker", "db", "files", "cdn"])
    await expect(
      page.locator(`[data-node="${id}"] .mdmark-diagram-node-kind svg`).count(),
      id,
    ).resolves.toBe(1);
  for (const id of ["cloud", "app"])
    await expect(
      page
        .locator(`.map-group[data-group="${id}"] .map-group-icon svg`)
        .count(),
      id,
    ).resolves.toBe(1);
  const hub = await rectOf(page, '[data-node="hub"]');
  expect(Math.round(hub.right - hub.left)).toBe(16);
  const api = await rectOf(page, '[data-node="api"]');
  const worker = await rectOf(page, '[data-node="worker"]');
  expect(worker.top).toBeGreaterThan(api.bottom);
});

// group「アプリ」の中へ入ると、外の service が薄い（Entered）
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
  expect(shown.sort()).toEqual(["api", "worker"].sort());
});

// group「アプリ」を閉じると、名前の行の下に「service 2 件」の行を持つ 1 つのノードになる（GroupCollapsed）
test("test_group_collapsed", async () => {
  // 準備・実行
  const page = await openStory("group-collapsed");
  // 検証
  await expectCountBelowTitle(
    page,
    '.map-closed-group[data-group="app"]',
    "service 2 件",
  );
});

// 「API サーバー」を選ぶと、つながる 3 本の線と相手のほかが薄い（ServiceSelected）
test("test_service_selected", async () => {
  // 準備・実行
  const page = await openStory("service-selected");
  // 検証
  const marks = await dimsOf(page);
  for (const id of ["api", "cdn", "worker", "hub", "r2", "r3", "r4"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(false);
  for (const id of ["web", "db", "files", "r1", "r5", "r6"])
    expect(marks.find((mark) => mark.id === id)?.dim, id).toBe(true);
});

// 幅 390px の置き場所（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openStory("narrow", { width: 390, height: 844 });
  // 検証
  await expectNarrow(page);
});

// service はフォーカスを受け、junction は「分岐点」の名前を持ちフォーカスを持たない（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openStory("default");
  // 検証
  const hit = page.locator(
    '.mdmark-diagram-node[data-node="api"] > .mdmark-diagram-node-hit',
  );
  await expect(hit.getAttribute("tabindex")).resolves.toBe("0");
  const hub = page.locator('.mdmark-diagram-node[data-node="hub"]');
  await expect(hub.getAttribute("aria-label")).resolves.toBe("分岐点");
  await expect(hub.getAttribute("tabindex")).resolves.toBeNull();
  await expect(
    page.locator('[data-node="hub"] .mdmark-diagram-node-hit').count(),
  ).resolves.toBe(0);
});
