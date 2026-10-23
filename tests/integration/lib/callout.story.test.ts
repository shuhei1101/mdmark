import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows, resolveColor } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 注意書きのストーリーを開き、種類の class・題の文字・題と面と枠の線の色を確かめる */
async function expectKind(
  id: string,
  kind: string,
  title: string,
): Promise<void> {
  const page = await holder.openStory(`parts-callout--${id}`);
  const alert = page.locator(`.markdown-alert-${kind}`);
  await expect(alert.count()).resolves.toBe(1);
  const heading = alert.locator(".markdown-alert-title");
  await expect(heading.innerText()).resolves.toBe(title);
  const colors = await alert.evaluate((element) => {
    const heading = element.querySelector(".markdown-alert-title");
    return {
      border: getComputedStyle(element).borderTopColor,
      background: getComputedStyle(element).backgroundColor,
      title: heading ? getComputedStyle(heading).color : "",
    };
  });
  // 題は種類の色、面は種類の色を地の色に 7%、枠の線は 40% 混ぜた色
  const kindColor = `var(--mdmark-color-callout-${kind})`;
  expect(colors.title).toBe(await resolveColor(page, kindColor));
  expect(colors.border).toBe(
    await resolveColor(
      page,
      `color-mix(in oklab, ${kindColor} 40%, var(--mdmark-color-bg))`,
    ),
  );
  expect(colors.background).toBe(
    await resolveColor(
      page,
      `color-mix(in oklab, ${kindColor} 7%, var(--mdmark-color-bg))`,
    ),
  );
  expect(colors.border).not.toBe(colors.title);
  const icon = await heading.evaluate(
    (element) => getComputedStyle(element, "::before").maskImage,
  );
  expect(icon).toContain("data:image/svg+xml");
}

// 補足の注意書きは、題「補足」を種類の色で出す（Note）
test("test_note", () => expectKind("note", "note", "補足"));

// ヒントの注意書きは、題「ヒント」を種類の色で出す（Tip）
test("test_tip", () => expectKind("tip", "tip", "ヒント"));

// 重要の注意書きは、題「重要」を種類の色で出す（Important）
test("test_important", () => expectKind("important", "important", "重要"));

// 警告の注意書きは、題「警告」を種類の色で出す（Warning）
test("test_warning", () => expectKind("warning", "warning", "警告"));

// 注意の注意書きは、題「注意」を種類の色で出す（Caution）
test("test_caution", () => expectKind("caution", "caution", "注意"));

// 閉じた注意書きは、題だけが出て、題の末尾に開閉の印がある（Collapsed）
test("test_collapsed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-callout--collapsed");
  // 検証
  const alert = page.locator("details.markdown-alert");
  await expect(
    alert.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(
    page.locator("summary.markdown-alert-title").isVisible(),
  ).resolves.toBe(true);
  await expect(alert.locator("p").isVisible()).resolves.toBe(false);
  const mark = await page
    .locator("summary.markdown-alert-title")
    .evaluate((element) => getComputedStyle(element, "::after").maskImage);
  expect(mark).toContain("data:image/svg+xml");
});

// 閉じた注意書きを開くと、本文が出る（CollapsedOpened）
test("test_collapsed_opened", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-callout--collapsed-opened");
  // 検証
  const alert = page.locator("details.markdown-alert");
  await expect(
    alert.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(true);
  await expect(alert.locator("p").isVisible()).resolves.toBe(true);
});

// 本文に複数の段落とコードブロックを持っても、枠の中に収まる（Long）
test("test_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-callout--long");
  // 検証
  const alert = page.locator(".markdown-alert");
  await expect(alert.locator("p").count()).resolves.toBeGreaterThanOrEqual(3);
  await expect(alert.locator("pre").count()).resolves.toBe(1);
  const inside = await alert.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const pre = element.querySelector("pre")?.getBoundingClientRect();
    return pre ? pre.left >= box.left && pre.right <= box.right : false;
  });
  expect(inside).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
