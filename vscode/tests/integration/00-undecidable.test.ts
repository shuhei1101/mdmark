import * as assert from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  clearMessages,
  distRequests,
  guideMarkdown,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  messages,
  opened,
  openMarkdown,
  resetEnvironment,
  stub,
  waitFor,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

// 前回のバージョン（globalState）が空の状態で実行する。このファイルより前に、タグ一覧から選んだバージョンを記載するテストを実行しない

suite("バージョンを決められない（前回のバージョンが空）", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // タグ一覧を取れず前回のバージョンも無いとき、配布物を要求せずに理由を出す
  test("test_error_when_version_undecidable", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await stub.setMode({ tags: "hang", dist: "ok" });
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    // 検証
    // Webview のスクリプトが読み込み終わる前の inspect は応答が来ないため、空としてもう一度待つ
    await waitFor(
      async () =>
        (await inspect(".mdmark-preview-notice").catch(() => [])).length === 1,
      { message: "描けない理由が出ない" },
    );
    const [notice] = await inspect(".mdmark-preview-notice");
    assert.ok(notice?.text.includes("プレビューを表示できません"));
    assert.ok(notice?.text.includes("バージョンを決められませんでした"));
    const [button] = await inspect(
      '.mdmark-preview-notice [data-action="reload"]',
    );
    assert.ok(button, "「リロード」のボタンが無い");
    assert.deepStrictEqual(await distRequests(), []);
    assert.strictEqual(
      record.received.filter((message) => message.type === "ready").length,
      0,
    );
  });

  // 書き出すときも、バージョンを決められなければ記載せずに通知する
  test("test_error_when_version_undecidable_on_export", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await stub.setMode({ tags: "hang", dist: "ok" });
    await openMarkdown("guide.md");
    clearMessages();
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    assert.strictEqual(messages.error.length, 1);
    assert.strictEqual(
      messages.error[0],
      "HTML を書き出せませんでした。読み込む mdmark のバージョンを決められません。ネットワークにつながっているかを確認してから、もう一度実行してください。",
    );
    assert.deepStrictEqual(opened, []);
    assert.ok(!existsSync(join(workspaceDir(), "guide.html")));
  });
});
