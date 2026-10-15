import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 文中の札は、線で囲んだ角丸の札で、文言をそのまま出す（Inline）
test("test_inline", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-badge--inline");
  // 検証
  const badge = page.locator(".mdmark-badge");
  await expect(badge.innerText()).resolves.toBe("v0.2.0");
  const style = await badge.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      display: computed.display,
      borderStyle: computed.borderTopStyle,
      radius: Number.parseFloat(computed.borderTopLeftRadius),
    };
  });
  expect(style.display).toBe("inline-block");
  expect(style.borderStyle).toBe("solid");
  expect(style.radius).toBeGreaterThan(8);
});

// 文言が長く行の幅を超えても、札の中で折り返し、横スクロールが出ない（Long）
test("test_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-badge--long");
  // 検証
  const badge = page.locator(".mdmark-badge");
  const layout = await badge.evaluate((element) => {
    const rects = element.getClientRects();
    return {
      lines: rects.length,
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    };
  });
  expect(layout.height).toBeGreaterThan(layout.lineHeight * 1.5);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
