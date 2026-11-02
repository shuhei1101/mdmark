import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  contrastRatio,
  createBrowserHolder,
  pageOverflows,
  resolveColorIn,
  resolveLightColor,
} from "../story.ts";

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

/** 色のバッジの面と文字の色と、色のプリセットの値 */
async function readColored(page: Page, color: string) {
  const badge = await page.locator(".mdmark-badge").evaluate((element) => ({
    dataColor: element.getAttribute("data-color"),
    background: getComputedStyle(element).backgroundColor,
    text: getComputedStyle(element).color,
  }));
  const preset = {
    bg: await resolveColorIn(
      page,
      ".mdmark",
      `var(--mdmark-color-accent-${color}-bg)`,
    ),
    text: await resolveColorIn(
      page,
      ".mdmark",
      `var(--mdmark-color-accent-${color}-text)`,
    ),
  };
  return { badge, preset };
}

// 色のバッジは、面の薄い色と文字の色で描く（Colored）
test("test_colored", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-badge--colored");
  // 検証
  await expect(page.locator(".mdmark-badge").innerText()).resolves.toBe(
    "要確認",
  );
  const { badge, preset } = await readColored(page, "red");
  expect(badge.dataColor).toBe("red");
  expect(badge.background).toBe(preset.bg);
  expect(badge.text).toBe(preset.text);
  expect(contrastRatio(badge.text, badge.background)).toBeGreaterThanOrEqual(
    4.5,
  );
});

// 暗い配色の色のバッジは、暗い配色の色のプリセットで描く（ColoredDark）
test("test_colored_dark", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-badge--colored-dark");
  // 検証
  await expect(
    page.locator(".mdmark").getAttribute("class"),
  ).resolves.toContain("mdmark-theme-dark");
  const { badge, preset } = await readColored(page, "green");
  expect(badge.background).toBe(preset.bg);
  expect(badge.text).toBe(preset.text);
  expect(contrastRatio(badge.text, badge.background)).toBeGreaterThanOrEqual(
    4.5,
  );
  // 明るい配色の値と違う
  const light = await resolveLightColor(
    page,
    "var(--mdmark-color-accent-green-bg)",
  );
  expect(badge.background).not.toBe(light);
});

// 色のバッジの文言が長いときも、札の中で折り返し、横スクロールが出ない（ColoredLong）
test("test_colored_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-badge--colored-long");
  // 検証
  const badge = page.locator(".mdmark-badge");
  await expect(badge.getAttribute("data-color")).resolves.toBe("yellow");
  const layout = await badge.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(layout.height).toBeGreaterThan(layout.lineHeight * 1.5);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
