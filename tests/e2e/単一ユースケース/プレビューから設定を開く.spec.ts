import { expect, test } from "@playwright/test";
import {
  guideMarkdown,
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

// プレビューの歯車のボタンを押すと、VS Code の設定画面が mdmark の項目に絞って開き、プレビューは閉じない（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
  });
  await openGuidePreview(session);
  // 実行
  await gearButton(session).click();
  // 検証
  await expectSettingsFiltered(session);
  await expect(
    session.win.locator('.tab[aria-label*="プレビュー guide.md"]'),
  ).toHaveCount(1);
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
