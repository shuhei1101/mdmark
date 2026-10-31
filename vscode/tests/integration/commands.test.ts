import * as assert from "node:assert";
import * as vscode from "vscode";
import { EXTENSION_ID } from "./helpers.ts";

/** コマンドの ID と表示名 */
const COMMAND_TITLES: Record<string, string> = {
  "mdmark.openPreviewToSide": "プレビューを横に開く",
  "mdmark.openPreview": "プレビューを開く",
  "mdmark.refreshPreview": "プレビューをリロード",
  "mdmark.openConfig": "設定ファイルを開く",
  "mdmark.openSettings": "設定を開く",
  "mdmark.exportHtml": "HTML に書き出す",
  "mdmark.openInBrowser": "ブラウザで開く",
  "mdmark.printToPdf": "PDF に印刷",
};

/** Markdown を開いているか mdmark のプレビューにフォーカスがあるときの条件 */
const MARKDOWN_OR_PREVIEW =
  "editorLangId == markdown || activeWebviewPanelId == 'mdmark.preview'";

type Contributes = {
  commands: Array<{
    command: string;
    title: string;
    category: string;
    icon?: string;
  }>;
  menus: Record<
    string,
    Array<{ command: string; when?: string; group?: string }>
  >;
  keybindings: Array<{
    command: string;
    key: string;
    mac: string;
    when: string;
  }>;
};

/** 拡張機能が足すもの */
function contributes(): Contributes {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, "拡張機能が見つからない");
  return extension.packageJSON.contributes as Contributes;
}

suite("コマンドと通知の入口", () => {
  // コマンドの表示名・カテゴリ・登録
  test("test_normal_when_command_titles", async () => {
    // 準備
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    const registered = await vscode.commands.getCommands(true);
    // 検証
    const commands = contributes().commands;
    assert.deepStrictEqual(
      Object.fromEntries(commands.map((item) => [item.command, item.title])),
      COMMAND_TITLES,
    );
    for (const item of commands) {
      assert.strictEqual(item.category, "mdmark");
      assert.ok(
        registered.includes(item.command),
        `${item.command} が登録されていない`,
      );
    }
  });

  // エディタのタイトルのボタンと既定のショートカット
  test("test_normal_when_editor_title_button", () => {
    const { menus, keybindings, commands } = contributes();
    assert.deepStrictEqual(menus["editor/title"], [
      {
        command: "mdmark.openPreviewToSide",
        when: "editorLangId == markdown",
        group: "navigation",
      },
      {
        command: "mdmark.openSettings",
        when: "activeWebviewPanelId == 'mdmark.preview'",
        group: "navigation",
      },
    ]);
    assert.strictEqual(
      commands.find((item) => item.command === "mdmark.openPreviewToSide")
        ?.icon,
      "$(open-preview)",
    );
    assert.deepStrictEqual(keybindings, [
      {
        command: "mdmark.openPreviewToSide",
        key: "shift+alt+d",
        mac: "shift+alt+d",
        when: "editorLangId == markdown",
      },
    ]);
  });

  // 設定を開くボタン: プレビューがアクティブなときだけ出る歯車で、表示名がツールチップと読み上げの名前になる
  test("test_normal_when_settings_button", () => {
    const { menus, commands } = contributes();
    const button = (menus["editor/title"] ?? []).find(
      (item) => item.command === "mdmark.openSettings",
    );
    assert.deepStrictEqual(button, {
      command: "mdmark.openSettings",
      when: "activeWebviewPanelId == 'mdmark.preview'",
      group: "navigation",
    });
    const command = commands.find(
      (item) => item.command === "mdmark.openSettings",
    );
    assert.strictEqual(command?.icon, "$(gear)");
    assert.strictEqual(command?.category, "mdmark");
    assert.strictEqual(command?.title, "設定を開く");
  });

  // コマンドパレットに出す条件
  test("test_normal_when_command_palette_conditions", () => {
    const palette = contributes().menus.commandPalette ?? [];
    const conditions = Object.fromEntries(
      palette.map((item) => [item.command, item.when]),
    );
    assert.deepStrictEqual(conditions, {
      "mdmark.openPreviewToSide": MARKDOWN_OR_PREVIEW,
      "mdmark.openPreview": MARKDOWN_OR_PREVIEW,
      "mdmark.refreshPreview": "mdmark.previewOpen",
      "mdmark.openConfig": undefined,
      "mdmark.openSettings": undefined,
      "mdmark.exportHtml": MARKDOWN_OR_PREVIEW,
      "mdmark.openInBrowser": MARKDOWN_OR_PREVIEW,
      "mdmark.printToPdf": MARKDOWN_OR_PREVIEW,
    });
  });
});
