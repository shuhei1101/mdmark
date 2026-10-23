import * as assert from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { parse } from "yaml";
import {
  clearMessages,
  installMessages,
  installOpenExternal,
  installRecorder,
  messages,
  openMarkdown,
  readFixture,
  resetEnvironment,
  trackFile,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

suite("設定ファイルを開く", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  setup(clearMessages);
  teardown(resetEnvironment);

  // 設定ファイルがあれば、そのままエディタで開く
  test("test_normal", async () => {
    // 準備
    await writeFixture("guide.md", "# 見出し\n");
    await writeFixture("mdmark.config.yaml", "features:\n  callout: false\n");
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openConfig");
    // 検証
    assert.strictEqual(
      vscode.window.activeTextEditor?.document.uri.fsPath,
      join(workspaceDir(), "mdmark.config.yaml"),
    );
    assert.deepStrictEqual(messages.info, []);
    assert.strictEqual(
      await readFixture("mdmark.config.yaml"),
      "features:\n  callout: false\n",
    );
  });

  // 設定ファイルが無いとき、作ると答えると雛形を書いて開く
  test("test_normal_when_template_created", async () => {
    // 準備
    await writeFixture("guide.md", "# 見出し\n");
    await openMarkdown("guide.md");
    trackFile("mdmark.config.yaml");
    messages.answer = "作る";
    // 実行
    await vscode.commands.executeCommand("mdmark.openConfig");
    // 検証
    assert.strictEqual(messages.info.length, 1);
    assert.strictEqual(
      messages.info[0],
      "mdmark.config.yaml がありません。雛形を作りますか？",
    );
    assert.deepStrictEqual(messages.infoItems[0], ["作る"]);
    assert.deepStrictEqual(messages.infoOptions[0], {
      modal: true,
      detail:
        "features と libraries の書き方をコメントで添えたファイルを作ります。作った直後は、プレビューの見た目は変わりません。",
    });
    const path = join(workspaceDir(), "mdmark.config.yaml");
    assert.ok(existsSync(path));
    assert.strictEqual(
      vscode.window.activeTextEditor?.document.uri.fsPath,
      path,
    );
    const text = await readFixture("mdmark.config.yaml");
    assert.ok(text.includes("# features:") && text.includes("# libraries:"));
    const parsed = parse(text) as Record<string, unknown> | null;
    assert.ok(
      parsed === null || (!("features" in parsed) && !("libraries" in parsed)),
    );
  });

  // 作らないを選ぶとファイルを書かない
  test("test_error_when_template_declined", async () => {
    // 準備
    await writeFixture("guide.md", "# 見出し\n");
    await openMarkdown("guide.md");
    messages.answer = undefined;
    const editors = vscode.window.visibleTextEditors.length;
    // 実行
    await vscode.commands.executeCommand("mdmark.openConfig");
    // 検証
    assert.strictEqual(messages.info.length, 1);
    assert.ok(!existsSync(join(workspaceDir(), "mdmark.config.yaml")));
    assert.strictEqual(vscode.window.visibleTextEditors.length, editors);
  });
});
