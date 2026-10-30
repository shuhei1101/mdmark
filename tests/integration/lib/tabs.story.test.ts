import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** タブの `aria-selected` と `tabindex` を並んだ順に返す */
function tabStates(page: Page): Promise<Array<[string | null, string | null]>> {
  return page
    .locator("[role=tab]")
    .evaluateAll((tabs) =>
      tabs.map((tab) => [
        tab.getAttribute("aria-selected"),
        tab.getAttribute("tabindex"),
      ]),
    );
}

/** 中身の `hidden` を並んだ順に返す */
function panelHidden(page: Page): Promise<boolean[]> {
  return page
    .locator(".mdmark-tab-panel")
    .evaluateAll((panels) =>
      panels.map((panel) => panel.hasAttribute("hidden")),
    );
}

// 1 つ目のタブだけが選ばれ、その中身だけが見える（First）
test("test_first", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-tabs--first");
  // 検証
  await expect(page.locator("[role=tablist]").count()).resolves.toBe(1);
  await expect(page.locator("[role=tab]").allTextContents()).resolves.toEqual([
    "macOS",
    "Windows",
    "Linux",
  ]);
  await expect(tabStates(page)).resolves.toEqual([
    ["true", "0"],
    ["false", "-1"],
    ["false", "-1"],
  ]);
  await expect(panelHidden(page)).resolves.toEqual([false, true, true]);
  await expect(
    page.locator("[role=tabpanel]").first().getAttribute("aria-labelledby"),
  ).resolves.toBe(await page.locator("[role=tab]").first().getAttribute("id"));
  await expect(
    page
      .locator("[role=tabpanel] > .mdmark-tab-title")
      .first()
      .evaluate((title) => getComputedStyle(title).display),
  ).resolves.toBe("none");
});

// 2 つ目のタブだけが選ばれ、その中身だけが見える（Second）
test("test_second", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-tabs--second");
  // 検証
  await expect(tabStates(page)).resolves.toEqual([
    ["false", "-1"],
    ["true", "0"],
    ["false", "-1"],
  ]);
  await expect(panelHidden(page)).resolves.toEqual([true, false, true]);
  await expect(
    page.locator("[role=tab][aria-selected=true]").textContent(),
  ).resolves.toBe("Windows");
  await expect(
    page
      .locator("[role=tab][aria-selected=true]")
      .evaluate((tab) => getComputedStyle(tab).borderTopWidth),
  ).resolves.toBe("1px");
});

// タブが多く名前が長くても、並びが折り返して横スクロールが出ない（Many）
test("test_many", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-tabs--many");
  // 検証
  await expect(page.locator("[role=tab]").count()).resolves.toBe(7);
  const tops = await page
    .locator("[role=tab]")
    .evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().top));
  expect(new Set(tops).size).toBeGreaterThan(1);
  await expect(
    page
      .locator("[role=tablist]")
      .evaluate((list) => getComputedStyle(list).flexWrap),
  ).resolves.toBe("wrap");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// タブの並びを付けず、全ての中身がタブ名を題にして縦に並ぶ（Unmounted）
test("test_unmounted", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-tabs--unmounted");
  // 検証
  await expect(page.locator("[role=tablist]").count()).resolves.toBe(0);
  await expect(page.locator("[role=tabpanel]").count()).resolves.toBe(0);
  const titles = page.locator(".mdmark-tab-panel > .mdmark-tab-title");
  await expect(titles.allTextContents()).resolves.toEqual(["macOS", "Windows"]);
  for (const title of await titles.all()) {
    await expect(title.isVisible()).resolves.toBe(true);
  }
  await expect(panelHidden(page)).resolves.toEqual([false, false]);
  const boxes = await page.locator(".mdmark-tab-panel").evaluateAll((panels) =>
    panels.map((panel) => {
      const { top, bottom } = panel.getBoundingClientRect();
      return { top, bottom };
    }),
  );
  expect(boxes[1]?.top).toBeGreaterThanOrEqual(boxes[0]?.bottom ?? Infinity);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 閉じたタブは、見出し「タブ（uv・pip）」だけが見え、タブの並びと中身が見えない（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-tabs--closed");
  // 検証
  const details = page.locator("details.mdmark-collapsible");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(details.locator("summary").innerText()).resolves.toBe(
    "タブ（uv・pip）",
  );
  await expect(page.locator("[role=tablist]").isVisible()).resolves.toBe(false);
  await expect(
    page.locator("[role=tabpanel]").first().isVisible(),
  ).resolves.toBe(false);
});

// 開いたタブに title= を付けると、見出しの下にタブの並びと 1 つ目の中身が見える（OpenTitle）
test("test_open_title", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-tabs--open-title");
  // 検証
  const details = page.locator("details.mdmark-collapsible");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(true);
  await expect(details.locator("summary").innerText()).resolves.toBe("入れ方");
  await expect(page.locator("[role=tablist]").isVisible()).resolves.toBe(true);
  await expect(panelHidden(page)).resolves.toEqual([false, true]);
  await expect(tabStates(page)).resolves.toEqual([
    ["true", "0"],
    ["false", "-1"],
  ]);
});
