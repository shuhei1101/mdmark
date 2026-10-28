import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 右側の目次が出る広い幅の画面
const WIDE = { width: 1280, height: 800 };

/** 右側の目次の中の要素の computed style の値を返す */
function styleOf(
  page: Page,
  selector: string,
  property: string,
): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate(
      (element, name) => getComputedStyle(element).getPropertyValue(name),
      property,
    );
}

/** `aria-current` を持つ項目の `data-heading-id` を返す */
function currentIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator('.mdmark-side-toc a[aria-current="location"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("data-heading-id")),
    );
}

/** パネルの左端が画面の中にあるか */
function panelInViewport(page: Page): Promise<boolean> {
  return page.locator(".mdmark-side-toc-panel").evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  });
}

// 右端に見出しの数の線だけを出し、目次は隠す（HoverRail）
test("test_hover_rail", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--hover-rail", WIDE);
  // 検証
  await expect(page.locator(".mdmark-side-toc-bar").count()).resolves.toBe(4);
  await expect(
    page.locator(".mdmark-side-toc-rail").getAttribute("aria-hidden"),
  ).resolves.toBe("true");
  await expect(styleOf(page, ".mdmark-side-toc-rail", "display")).resolves.toBe(
    "flex",
  );
  await expect(
    styleOf(page, ".mdmark-side-toc-panel", "opacity"),
  ).resolves.toBe("0");
  await expect(
    styleOf(page, ".mdmark-side-toc-toggle", "display"),
  ).resolves.toBe("none");
  // 階層が深い線ほど短い
  const widths = await page
    .locator(".mdmark-side-toc-bar")
    .evaluateAll((bars) =>
      bars.map((bar) => bar.getBoundingClientRect().width),
    );
  expect(widths[0]).toBeGreaterThan(widths[1] as number);
  expect(widths[1]).toBeGreaterThan(widths[3] as number);
});

// ポインターを乗せると目次が画面の中に出て、今いる節の項目と線がハイライトされる（HoverShown）
test("test_hover_shown", async () => {
  // 準備
  const page = await holder.openStory("parts-sidetoc--hover-shown", WIDE);
  // 実行
  await page.locator(".mdmark-side-toc-rail").hover();
  // 検証
  await expect(
    styleOf(page, ".mdmark-side-toc-panel", "opacity"),
  ).resolves.toBe("1");
  await expect(panelInViewport(page)).resolves.toBe(true);
  await expect(currentIds(page)).resolves.toEqual(["使い方"]);
  await expect(
    page.locator(".mdmark-side-toc-bar[data-current]").count(),
  ).resolves.toBe(1);
  await expect(
    page
      .locator('.mdmark-side-toc a[aria-current="location"]')
      .evaluate((link) => getComputedStyle(link).backgroundColor),
  ).resolves.toBe("rgb(230, 243, 241)");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ピン止めすると、線を隠し、目次を本文に重ねず右の列に出し続ける（HoverPinned）
test("test_hover_pinned", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--hover-pinned", WIDE);
  // 検証
  await expect(
    page.locator(".mdmark-side-toc-pin").getAttribute("aria-pressed"),
  ).resolves.toBe("true");
  await expect(
    styleOf(page, ".mdmark-side-toc-panel", "opacity"),
  ).resolves.toBe("1");
  await expect(
    styleOf(page, ".mdmark-side-toc-panel", "position"),
  ).resolves.toBe("static");
  await expect(styleOf(page, ".mdmark-side-toc-rail", "display")).resolves.toBe(
    "none",
  );
  await expect(currentIds(page)).resolves.toEqual(["使い方"]);
  await expect(panelInViewport(page)).resolves.toBe(true);
});

// fixed でサイドバーを閉じると、目次を出すボタンだけを出す（FixedClosed）
test("test_fixed_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--fixed-closed", WIDE);
  // 検証
  const toggle = page.locator(".mdmark-side-toc-toggle");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(toggle.getAttribute("aria-label")).resolves.toBe("目次を表示");
  await expect(
    styleOf(page, ".mdmark-side-toc-toggle", "display"),
  ).resolves.not.toBe("none");
  await expect(
    styleOf(page, ".mdmark-side-toc-panel", "display"),
  ).resolves.toBe("none");
  await expect(styleOf(page, ".mdmark-side-toc-rail", "display")).resolves.toBe(
    "none",
  );
});

// fixed でサイドバーを開くと、今いる節の項目をハイライトする（FixedOpen）
test("test_fixed_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--fixed-open", WIDE);
  // 検証
  await expect(
    page.locator(".mdmark-side-toc-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  await expect(
    styleOf(page, ".mdmark-side-toc-panel", "display"),
  ).resolves.toBe("flex");
  await expect(currentIds(page)).resolves.toEqual(["前提"]);
  await expect(styleOf(page, ".mdmark-side-toc-pin", "display")).resolves.toBe(
    "none",
  );
  await expect(
    page.locator('.mdmark-side-toc nav[aria-label="右側の目次"]').count(),
  ).resolves.toBe(1);
  await expect(panelInViewport(page)).resolves.toBe(true);
});

// sections がオフなら、すべて展開・すべて折りたたむのボタンが無い（WithoutSections）
test("test_without_sections", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--without-sections", WIDE);
  // 検証
  await expect(page.locator("[data-fold-all]").count()).resolves.toBe(0);
  await expect(page.locator(".mdmark-side-toc-list a").count()).resolves.toBe(
    4,
  );
});

// 見出しが長いと、項目が折り返し、画面から溢れない（LongHeading）
test("test_long_heading", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--long-heading", WIDE);
  // 検証
  const heights = await page
    .locator(".mdmark-side-toc-list a")
    .evaluateAll((links) =>
      links.map((link) => link.getBoundingClientRect().height),
    );
  const lineHeight = await page
    .locator(".mdmark-side-toc-list a")
    .first()
    .evaluate((link) => Number.parseFloat(getComputedStyle(link).lineHeight));
  for (const height of heights) {
    expect(height).toBeGreaterThan(lineHeight * 2);
  }
  await expect(pageOverflows(page)).resolves.toBe(false);
  await expect(panelInViewport(page)).resolves.toBe(true);
});
