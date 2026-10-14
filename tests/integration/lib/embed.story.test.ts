import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

// 読み込み中の枠が先に取る高さ（12rem。ルートの文字の大きさ 16px のとき 192px）
const MIN_HEIGHT_PX = 192;

beforeAll(holder.launch);
afterAll(holder.close);

// 外部ライブラリを読み込んでいる間、図の高さを先に取り、破線の枠に「図を読み込んでいます」を出す（Loading）
test("test_loading", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-embed--loading");
  // 検証
  const embed = page.locator(".mdmark-embed");
  await expect(embed.getAttribute("role")).resolves.toBe("status");
  await expect(embed.getAttribute("data-mdmark-slot")).resolves.toBe("chart");
  await expect(embed.getAttribute("data-mdmark-args")).resolves.toBe("a b");
  await expect(embed.innerText()).resolves.toBe("図を読み込んでいます");
  const style = await embed.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      borderStyle: computed.borderTopStyle,
      height: element.getBoundingClientRect().height,
    };
  });
  expect(style.borderStyle).toBe("dashed");
  expect(style.height).toBeGreaterThanOrEqual(MIN_HEIGHT_PX);
});
