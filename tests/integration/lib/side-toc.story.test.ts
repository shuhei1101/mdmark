import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 右側の目次が出る広い幅の画面
const WIDE = { width: 1280, height: 800 };

/** 右側の目次の中の要素の computed style の値を返却する */
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

/** `aria-current` を持つ項目の `data-heading-id` を返却する */
function currentIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator('.mdmark-side-toc a[aria-current="location"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("data-heading-id")),
    );
}

/** 目次の頭の子の class を並びの順に返却する */
function headChildren(page: Page): Promise<string[]> {
  return page
    .locator(".mdmark-side-toc-head")
    .evaluate((head) => [...head.children].map((child) => child.className));
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

// ポインターを乗せると目次が画面の中に出て、今いるセクションの項目と線がハイライトされる（HoverShown）
test("test_hover_shown", async () => {
  // 準備
  const page = await holder.openStory("parts-sidetoc--hover-shown", WIDE);
  // 実行: ポインターを乗せると開いた目次が右端の線を覆うため、乗せた後に線が最も手前にあるかは確認しない
  await page.locator(".mdmark-side-toc-rail").hover({ force: true });
  // 検証
  await expect(
    styleOf(page, ".mdmark-side-toc-panel", "opacity"),
  ).resolves.toBe("1");
  await expect(panelInViewport(page)).resolves.toBe(true);
  await expect(currentIds(page)).resolves.toEqual(["使用方法"]);
  await expect(
    page.locator(".mdmark-side-toc-bar[data-current]").count(),
  ).resolves.toBe(1);
  // 目次の頭: タイトルを配置せず、まとめて開閉するボタンの並び → ピン止めの順。ピン止めは押す前のアイコンを出す
  await expect(headChildren(page)).resolves.toEqual([
    "mdmark-side-toc-actions",
    "mdmark-side-toc-pin",
  ]);
  await expect(page.locator(".mdmark-side-toc-title").count()).resolves.toBe(0);
  await expect(
    styleOf(page, ".mdmark-side-toc-pin-off", "display"),
  ).resolves.not.toBe("none");
  await expect(
    styleOf(page, ".mdmark-side-toc-pin-on", "display"),
  ).resolves.toBe("none");
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
  await expect(currentIds(page)).resolves.toEqual(["使用方法"]);
  await expect(panelInViewport(page)).resolves.toBe(true);
  // ピン止めした後: 押した後のアイコン（実線の右の列）と選択中の背景
  await expect(
    styleOf(page, ".mdmark-side-toc-pin-on", "display"),
  ).resolves.not.toBe("none");
  await expect(
    styleOf(page, ".mdmark-side-toc-pin-off", "display"),
  ).resolves.toBe("none");
  await expect(
    styleOf(page, ".mdmark-side-toc-pin", "background-color"),
  ).resolves.toBe("rgb(230, 243, 241)");
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

// fixed でサイドバーを開くと、今いるセクションの項目をハイライトする（FixedOpen）
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
  await expect(headChildren(page)).resolves.toEqual(["mdmark-side-toc-pin"]);
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

/** 変更のマーカーを持つ項目の `data-heading-id` を返却する */
function changedIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator(".mdmark-side-toc-list a[data-changed]")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("data-heading-id")),
    );
}

// 変わったセクションの項目に変更のマーカー、線に橙を出し、今いるセクションの線は今いるセクションの色を優先する（HoverChanged）
test("test_hover_changed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--hover-changed", WIDE);
  // 検証
  await expect(changedIds(page)).resolves.toEqual(["doc", "steps", "added"]);
  await expect(
    page
      .locator('.mdmark-side-toc-list a[data-heading-id="steps"]')
      .getAttribute("aria-label"),
  ).resolves.toBe("手順（変更）");
  const warning = await styleOf(
    page,
    ".mdmark-side-toc-changed",
    "background-color",
  );
  const bars = await page
    .locator(".mdmark-side-toc-bar")
    .evaluateAll((items) =>
      items.map((bar) => getComputedStyle(bar).backgroundColor),
    );
  const link = await styleOf(
    page,
    ".mdmark-side-toc-bar[data-current]",
    "background-color",
  );
  // 線の並び: 文書（変更）・前提・手順（変更・今いる）・準備・追加した節（変更）
  expect(bars[0]).toBe(warning);
  expect(bars[1]).not.toBe(warning);
  expect(bars[2]).toBe(link);
  expect(bars[2]).not.toBe(warning);
  expect(bars[4]).toBe(warning);
});

// fixed のサイドバーの変わったセクションの項目の右端に変更のマーカーを出す（FixedChanged）
test("test_fixed_changed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sidetoc--fixed-changed", WIDE);
  // 検証
  await expect(changedIds(page)).resolves.toEqual(["doc", "steps", "added"]);
  const rightGap = await page
    .locator('.mdmark-side-toc-list a[data-heading-id="steps"]')
    .evaluate((link) => {
      const marker = link.querySelector(".mdmark-side-toc-changed");
      const right = (marker?.getBoundingClientRect().right ?? 0) as number;
      const style = getComputedStyle(link);
      return (
        link.getBoundingClientRect().right -
        Number.parseFloat(style.paddingRight) -
        right
      );
    });
  expect(Math.abs(rightGap)).toBeLessThan(1);
  await expect(
    page
      .locator('.mdmark-side-toc-list a[data-heading-id="premise"]')
      .getAttribute("aria-label"),
  ).resolves.toBeNull();
});

// 長い見出しが折り返しても、変更のマーカーが文字と重ならず、画面から溢れない（LongHeadingChanged）
test("test_long_heading_changed", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-sidetoc--long-heading-changed",
    WIDE,
  );
  // 検証
  const overlap = await page
    .locator('.mdmark-side-toc-list a[data-heading-id="long"]')
    .evaluate((link) => {
      const marker = link.querySelector(".mdmark-side-toc-changed");
      const range = document.createRange();
      range.selectNodeContents(link.firstChild as Node);
      const text = range.getBoundingClientRect();
      const box = marker?.getBoundingClientRect();
      return box === undefined ? true : box.left < text.right;
    });
  expect(overlap).toBe(false);
  await expect(pageOverflows(page)).resolves.toBe(false);
  await expect(panelInViewport(page)).resolves.toBe(true);
});
