import { expect, test } from "@playwright/test";
import {
  guideMarkdown,
  longDocument,
  updateWorkspaceSettings,
  useVscodeE2E,
  type VscodeSession,
} from "../vscode.ts";

const e2e = useVscodeE2E();

// 設定画面を mdmark の項目に絞る検索欄の文字
const EXTENSION_FILTER = "@ext:ShuheiNishikawa.mdmark";

/** プレビューのパネルがアクティブなときにエディタのタイトルに出る、設定を開く歯車のボタン */
function gearButton(session: VscodeSession) {
  return session.win
    .locator(".editor-actions .action-label[aria-label*='設定を開く']")
    .first();
}

/** VS Code の設定画面が、mdmark の拡張機能の項目に絞られて開いている */
async function expectSettingsFiltered(session: VscodeSession): Promise<void> {
  const settings = session.win.locator(".settings-editor");
  await expect(settings).toBeVisible();
  await expect(
    settings.locator(".suggest-input-container .view-lines"),
  ).toContainText(EXTENSION_FILTER);
}

/** 見出しを持つ Markdown でプレビューを開き、描き終えるまで待つ */
async function openGuidePreview(session: VscodeSession): Promise<void> {
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  await session.guideFrame();
}

// プレビューの歯車のボタンを押すと、VS Code の設定画面が mdmark の項目に絞って開き、プレビューは閉じず、本文とスクロールの位置は押す前と同じ（正常シナリオ）
test("test_normal", async () => {
  // 準備: プレビューを途中までスクロールし、本文とスクロールの位置を控える
  const session = await e2e.launch({
    files: { "long.md": longDocument() },
  });
  await session.openFile("long.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h2");
  await frame
    .locator('h2[data-source-line="328"]')
    .evaluate((element) => element.scrollIntoView());
  const scrollTop = await frame.evaluate(() => window.scrollY);
  const heading = await frame.locator("h2").first().innerText();
  // 実行
  await gearButton(session).click();
  // 検証: 設定画面が絞って開き、プレビューのタブが 1 つ残る
  await expectSettingsFiltered(session);
  const previewTab = session.win.locator(
    '.tab[aria-label*="プレビュー long.md"]',
  );
  await expect(previewTab).toHaveCount(1);
  // プレビューのタブを表に戻すと、本文とスクロールの位置が押す前と同じ
  await previewTab.first().click();
  const shown = await session.frameWith("h2");
  await expect.poll(() => shown.evaluate(() => window.scrollY)).toBe(scrollTop);
  expect(await shown.locator("h2").first().innerText()).toBe(heading);
});

// プレビューを開いていなくても、コマンドパレットから同じ絞り込みで設定画面を開き、YAML の設定ファイルは開かない（正常シナリオ（コマンドパレットから開く））
test("test_normal_when_command_palette", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "guide.md": await guideMarkdown(),
      "mdmark.config.yaml": "features:\n  callout: false\n",
    },
  });
  await session.openFile("guide.md");
  // 実行
  await session.runCommand("mdmark: 設定を開く");
  // 検証
  await expectSettingsFiltered(session);
  await expect(
    session.win.locator('.tab[aria-label*="mdmark.config.yaml"]'),
  ).toHaveCount(0);
});

// 設定画面で変えた設定が、リロードせずにプレビューに映る（正常シナリオ（変えた設定がプレビューに映る））
test("test_normal_when_setting_changed", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
    settings: {
      "workbench.colorTheme": "Default Light Modern",
      "mdmark.preview.theme": "auto",
    },
  });
  await openGuidePreview(session);
  await gearButton(session).click();
  await expectSettingsFiltered(session);
  // 実行: テーマを theme-slate にする（設定画面で値を変えたときと同じ変更が、設定ファイルを通して届く）
  await updateWorkspaceSettings(session, {
    "mdmark.colorTheme": "theme-slate",
  });
  // 検証: プレビューのタブを表に出すと、theme-slate の明るい配色で描かれている
  await session.win
    .locator('.tab[aria-label*="プレビュー guide.md"]')
    .first()
    .click();
  const frame = await session.guideFrame();
  await expect
    .poll(() =>
      frame
        .locator(".mdmark")
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(248, 250, 252)");
});
