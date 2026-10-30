import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  EXTENSION_ID,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  openMarkdown,
  recordedPanels,
  resetEnvironment,
  sleep,
  waitForRendered,
  writeFixture,
} from "./helpers.ts";

/** 設定画面を開くコマンドの ID */
const OPEN_SETTINGS_COMMAND = "workbench.action.openSettings";

suite("設定を開く", () => {
  /** 設定画面を開くコマンドに渡された引数 */
  const calls: unknown[][] = [];
  const target = vscode.commands as unknown as Record<string, unknown>;
  let original: typeof vscode.commands.executeCommand;

  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  setup(() => {
    calls.length = 0;
    original = vscode.commands.executeCommand;
    // 設定画面を開くコマンドだけ、引数を記録して解決する代役にする（ほかのコマンドは元のものを呼ぶ）
    target.executeCommand = (command: string, ...args: unknown[]) => {
      if (command === OPEN_SETTINGS_COMMAND) {
        calls.push(args);
        return Promise.resolve(undefined);
      }
      return original.call(vscode.commands, command, ...args);
    };
  });
  teardown(async () => {
    target.executeCommand = original;
    await resetEnvironment();
  });

  // プレビューの歯車のボタンから、mdmark の項目に絞って設定画面を開く
  test("test_normal", async () => {
    // 準備
    await writeFixture("guide.md", "# 見出し\n");
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const sentBefore = record.sent.length;
    // 実行: 歯車のボタンはコマンド mdmark.openSettings を呼ぶ
    await vscode.commands.executeCommand("mdmark.openSettings");
    await sleep(500);
    // 検証
    assert.deepStrictEqual(calls, [[`@ext:${EXTENSION_ID}`]]);
    assert.strictEqual(recordedPanels().length, 1);
    assert.strictEqual(record.sent.length, sentBefore);
  });

  // プレビューを開いていなくても、コマンドから同じ絞り込みで設定画面を開き、YAML の設定ファイルは開かない
  test("test_normal_when_command_palette", async () => {
    // 準備
    await writeFixture("mdmark.config.yaml", "features:\n  callout: false\n");
    await writeFixture("guide.md", "# 見出し\n");
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openSettings");
    // 検証
    assert.deepStrictEqual(calls, [[`@ext:${EXTENSION_ID}`]]);
    assert.strictEqual(recordedPanels().length, 0);
    assert.ok(
      vscode.window.activeTextEditor?.document.uri.fsPath.endsWith("guide.md"),
    );
    assert.ok(
      !vscode.window.visibleTextEditors.some((editor) =>
        editor.document.uri.fsPath.endsWith("mdmark.config.yaml"),
      ),
    );
  });
});
