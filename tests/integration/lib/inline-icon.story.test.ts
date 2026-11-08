import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// まとめた名前のアイコンを、文字の高さにそろえて段落の文字の間に描く（Bundled）
test("test_bundled", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-inlineicon--bundled");
  // 検証
  const icon = page.locator(".mdmark-inline-icon");
  await expect(icon.getAttribute("aria-hidden")).resolves.toBe("true");
  const size = await icon.locator("svg").evaluate((svg) => {
    const rect = svg.getBoundingClientRect();
    const font = Number.parseFloat(
      getComputedStyle(svg.parentElement as Element).fontSize,
    );
    return { width: rect.width, height: rect.height, font };
  });
  expect(size.width).toBeCloseTo(size.font, 0);
  expect(size.height).toBeCloseTo(size.font, 0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 見出しの前のアイコンは、見出しの文字の大きさにそろう（InHeading）
test("test_in_heading", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-inlineicon--in-heading");
  // 検証
  const sizes = await page.locator("h2").evaluate((heading) => ({
    font: Number.parseFloat(getComputedStyle(heading).fontSize),
    icon: heading.querySelector("svg")?.getBoundingClientRect().height ?? 0,
  }));
  expect(sizes.icon).toBeCloseTo(sizes.font, 0);
  await expect(page.locator("h2").innerText()).resolves.toBe("はじめに");
});

// まとめていない名前は、mount が読み込む前は中が空の要素になる（Pending）
test("test_pending", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-inlineicon--pending");
  // 検証
  const icon = page.locator('.mdmark-inline-icon[data-icon="sailboat"]');
  await expect(icon.innerHTML()).resolves.toBe("");
});
