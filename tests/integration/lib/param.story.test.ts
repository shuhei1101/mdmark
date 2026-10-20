import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 開いたときは既定の値 5 で、今の値と既定の値の 2 つの系列を描く（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-paramcontrol--default");
  // 検証
  await expect(
    page.locator(".mdmark-param-knob output").innerText(),
  ).resolves.toBe("5");
  await expect(
    page.locator("svg[role=img]").getAttribute("aria-label"),
  ).resolves.toContain("今の値（5）");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 値を 8 に変えると、グラフの今の値の系列が追従する（Changed）
test("test_changed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-paramcontrol--changed");
  // 検証
  await expect(
    page.locator(".mdmark-param-knob output").innerText(),
  ).resolves.toBe("8");
  await expect(
    page.locator("svg[role=img]").getAttribute("aria-label"),
  ).resolves.toContain("今の値（8）: 0・55・80・91・96・98");
});

// 写した状態は、ボタンのそばに写したことを出す（Copied）
test("test_copied", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-paramcontrol--copied");
  // 検証
  await expect(page.locator('[role="status"]').innerText()).resolves.toContain(
    "クリップボードに写しました",
  );
  await expect(
    page.locator("pre.mdmark-param-fallback").isVisible(),
  ).resolves.toBe(false);
});

// 写せなかった状態は、書けなかったことと、選んで写せる JSON を出す（Failed）
test("test_failed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-paramcontrol--failed");
  // 検証
  await expect(page.locator('[role="status"]').innerText()).resolves.toContain(
    "クリップボードへ書けませんでした",
  );
  const fallback = page.locator("pre.mdmark-param-fallback");
  await expect(fallback.isVisible()).resolves.toBe(true);
  await expect(fallback.getAttribute("tabindex")).resolves.toBe("0");
  await expect(fallback.innerText()).resolves.toContain('"value": 8');
  await expect(pageOverflows(page)).resolves.toBe(false);
});
