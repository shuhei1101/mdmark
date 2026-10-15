import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// h2 と h3 を入れ子にした目次を、見出しへのリンクで並べる（Nested）
test("test_nested", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-toc--nested");
  // 検証
  const nav = page.locator("nav.mdmark-toc");
  await expect(nav.getAttribute("aria-label")).resolves.toBe("目次");
  await expect(nav.locator(".mdmark-toc-title").innerText()).resolves.toBe(
    "目次",
  );
  const hrefs = await nav
    .locator("a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(["#導入", "#前提", "#使い方"]);
  await expect(
    nav.locator("li:has(> a[href='#導入']) > ul a").getAttribute("href"),
  ).resolves.toBe("#前提");
});

// h2 だけの目次は、入れ子を持たない（Flat）
test("test_flat", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-toc--flat");
  // 検証
  await expect(page.locator("nav.mdmark-toc a").count()).resolves.toBe(2);
  await expect(page.locator("nav.mdmark-toc ul ul").count()).resolves.toBe(0);
});

// 見出しが長く折り返しても、枠の中に収まる（LongHeading）
test("test_long_heading", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-toc--long-heading");
  // 検証
  const link = page.locator("nav.mdmark-toc a");
  const lines = await link.evaluate(
    (element) => element.getClientRects().length,
  );
  expect(lines).toBeGreaterThan(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
