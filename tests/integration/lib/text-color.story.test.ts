import { afterAll, beforeAll, expect, test } from "vitest";
import {
  contrastRatio,
  createBrowserHolder,
  resolveColorIn,
  resolveLightColor,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 文字の色のストーリーを開き、文字の色・太さ・地の色と色のプリセットの値を返す */
async function open(id: string, color: string) {
  const page = await holder.openStory(`parts-textcolor--${id}`);
  const span = page.locator("span.mdmark-color");
  const computed = await span.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      dataColor: element.getAttribute("data-color"),
      color: computed.color,
      weight: computed.fontWeight,
    };
  });
  const background = await resolveColorIn(
    page,
    ".mdmark",
    "var(--mdmark-color-bg)",
  );
  const preset = await resolveColorIn(
    page,
    ".mdmark",
    `var(--mdmark-color-accent-${color}-text)`,
  );
  return { page, span, style: { ...computed, background }, preset };
}

// blue の文字は、色のプリセットの文字の色と太字で強調する（Blue）
test("test_blue", async () => {
  // 準備・実行
  const { span, style, preset } = await open("blue", "blue");
  // 検証
  await expect(span.innerText()).resolves.toBe(
    "版を固定すると、使う側のページの見た目が mdmark の更新で勝手に変わりません。",
  );
  expect(style.dataColor).toBe("blue");
  expect(style.color).toBe(preset);
  expect(style.weight).toBe("700");
  expect(contrastRatio(style.color, style.background)).toBeGreaterThanOrEqual(
    4.5,
  );
});

// red の文字は、赤の文字の色と太字で強調する（Red）
test("test_red", async () => {
  // 準備・実行
  const { style, preset } = await open("red", "red");
  // 検証
  expect(style.dataColor).toBe("red");
  expect(style.color).toBe(preset);
  expect(style.weight).toBe("700");
  expect(contrastRatio(style.color, style.background)).toBeGreaterThanOrEqual(
    4.5,
  );
});

// 強調した文字の中のリンクは、下線で見分ける（WithLink）
test("test_with_link", async () => {
  // 準備・実行
  const { span, style, preset } = await open("with-link", "green");
  // 検証
  expect(style.color).toBe(preset);
  const link = span.locator("a");
  await expect(link.innerText()).resolves.toBe("配布物を読み込む");
  await expect(
    link.evaluate((element) => getComputedStyle(element).textDecorationLine),
  ).resolves.toContain("underline");
});

// 暗い配色では、暗い配色の色のプリセットの文字の色にする（Dark）
test("test_dark", async () => {
  // 準備・実行
  const { page, style, preset } = await open("dark", "orange");
  // 検証
  await expect(
    page.locator(".mdmark").getAttribute("class"),
  ).resolves.toContain("mdmark-theme-dark");
  expect(style.color).toBe(preset);
  expect(style.weight).toBe("700");
  expect(contrastRatio(style.color, style.background)).toBeGreaterThanOrEqual(
    4.5,
  );
  // 明るい配色の値と違う
  const light = await resolveLightColor(
    page,
    "var(--mdmark-color-accent-orange-text)",
  );
  expect(style.color).not.toBe(light);
});
