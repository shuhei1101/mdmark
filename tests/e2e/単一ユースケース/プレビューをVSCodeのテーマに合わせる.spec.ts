import { expect, type Frame, test } from "@playwright/test";
import {
  longDocument,
  replaceAllText,
  saveEditor,
  updateWorkspaceSettings,
  useVscodeE2E,
} from "../vscode.ts";

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

// 設定ファイルのテーマを選ぶキーで、VS Code の設定が空のとき、そのテーマの暗い配色で描く（正常シナリオ（設定ファイルのテーマで描く））
test("test_normal_when_config_theme", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "long.md": longDocument(),
      "mdmark.config.yaml": "colorTheme: theme-paper\n",
    },
    settings: { "workbench.colorTheme": "Default Dark Modern" },
  });
  await session.openFile("long.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証: theme-paper の暗い配色
  const frame = await session.frameWith("h2");
  await expect.poll(() => background(frame)).toBe("rgb(28, 25, 21)");
});

// VS Code の設定でテーマを選ぶと、設定ファイルのテーマに勝ち、明暗は mdmark.preview.theme のまま、リロードせずに替わり、本文とスクロールの位置は変わらない（正常シナリオ（VS Code の設定でテーマを選ぶ））
test("test_normal_when_setting_theme", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "long.md": longDocument(),
      "mdmark.config.yaml": "colorTheme: theme-paper\n",
    },
    settings: {
      "workbench.colorTheme": "Default Dark Modern",
      "mdmark.preview.theme": "light",
    },
  });
  await session.openFile("long.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h2");
  // theme-paper の明るい配色（設定ファイルのテーマ）
  await expect.poll(() => background(frame)).toBe("rgb(251, 248, 241)");
  await frame
    .locator('h2[data-source-line="328"]')
    .evaluate((element) => element.scrollIntoView());
  const scrollTop = await frame.evaluate(() => window.scrollY);
  const heading = await frame.locator("h2").first().innerText();
  // 実行: VS Code の設定のテーマを theme-slate にする
  await updateWorkspaceSettings(session, {
    "mdmark.colorTheme": "theme-slate",
  });
  // 検証: theme-slate の明るい配色になり、フレームは入れ替わらない
  await expect.poll(() => background(frame)).toBe("rgb(248, 250, 252)");
  expect(await frame.evaluate(() => window.scrollY)).toBe(scrollTop);
  expect(await frame.locator("h2").first().innerText()).toBe(heading);
});

// 設定ファイルのテーマを書き換えて保存すると、リロードせずに新しいテーマの暗い配色になる（正常シナリオ（設定ファイルのテーマを書き換える））
test("test_normal_when_config_theme_changed", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "long.md": longDocument(),
      "mdmark.config.yaml": "colorTheme: theme-paper\n",
    },
    settings: { "workbench.colorTheme": "Default Dark Modern" },
  });
  await session.openFile("long.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h2");
  await expect.poll(() => background(frame)).toBe("rgb(28, 25, 21)");
  // 実行
  await session.openFile("mdmark.config.yaml");
  await replaceAllText(session, "colorTheme: theme-contrast");
  await saveEditor(session);
  // 検証: theme-contrast の暗い配色
  await expect.poll(() => background(frame)).toBe("rgb(0, 0, 0)");
});
