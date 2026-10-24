import { expect, type Frame, test } from "@playwright/test";
import { longDocument, useVscodeE2E } from "../vscode.ts";

const e2e = useVscodeE2E();

// ダークとライトの `--mdmark-color-bg` の値の地の色の計算値（デザイン方針の dev-swiss）
const DARK_BACKGROUND = "rgb(19, 19, 22)";
const LIGHT_BACKGROUND = "rgb(255, 255, 255)";

/** 描く先の要素の地の色の計算値 */
function background(frame: Frame): Promise<string> {
  return frame
    .locator(".mdmark")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
}

// VS Code のテーマをダークに切り替えると、プレビューを開き直さずにダークの配色になり、本文とスクロールの位置は変わらない（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "long.md": longDocument() },
    userSettings: { "workbench.colorTheme": "Default Light Modern" },
  });
  await session.openFile("long.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h2");
  expect(await background(frame)).toBe(LIGHT_BACKGROUND);
  await frame
    .locator('h2[data-source-line="328"]')
    .evaluate((element) => element.scrollIntoView());
  const scrollTop = await frame.evaluate(() => window.scrollY);
  const heading = await frame.locator("h2").first().innerText();
  // 実行: コマンドパレットでダークのテーマを選ぶ
  await session.runCommand("Preferences: Color Theme");
  await session.win.keyboard.type("Dark Modern");
  await session.win.waitForTimeout(500);
  await session.win.keyboard.press("Enter");
  // 検証
  await expect.poll(() => background(frame)).toBe(DARK_BACKGROUND);
  expect(await frame.evaluate(() => window.scrollY)).toBe(scrollTop);
  expect(await frame.locator("h2").first().innerText()).toBe(heading);
});

// 配色を固定すると、VS Code のテーマがダークでもライトの配色で描く（正常シナリオ（配色を固定する））
test("test_normal_when_theme_fixed", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "long.md": longDocument() },
    settings: {
      "workbench.colorTheme": "Default Dark Modern",
      "mdmark.preview.theme": "light",
    },
  });
  await session.openFile("long.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.frameWith("h2");
  await expect(frame.locator("body")).toHaveClass(/vscode-dark/);
  expect(await background(frame)).toBe(LIGHT_BACKGROUND);
});
