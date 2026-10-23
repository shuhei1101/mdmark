import * as assert from "node:assert";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  deliver,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  opened,
  openMarkdown,
  resetEnvironment,
  sleep,
  waitFor,
  waitForRendered,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

/** リンクを持つ文書のプレビューを開く（見出しへの `#` のリンクと、無いファイルへのリンクを含む） */
async function openLinkGuide() {
  await writeFixture(
    "guide.md",
    [
      "# 案内",
      "",
      "[外部](https://example.com/)",
      "",
      "[別の文書](./other.md)",
      "",
      "[ページ内](#末尾)",
      "",
      "[無い文書](./missing.md)",
      "",
      "## 末尾",
      "",
    ].join("\n"),
  );
  await writeFixture("other.md", "# 別の文書\n");
  const editor = await openMarkdown("guide.md");
  await vscode.commands.executeCommand("mdmark.openPreviewToSide");
  const record = lastPanel();
  await waitForRendered(record);
  return { editor, record };
}

suite("プレビューのリンクを開く", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // 外部の URL を既定のブラウザで開く
  test("test_normal_when_external_link", async () => {
    // 準備
    const { record } = await openLinkGuide();
    const sentBefore = record.sent.length;
    // 実行: 外部の URL のリンクを押したことにする
    deliver(record, { type: "openLink", href: "https://example.com/" });
    // 検証
    await waitFor(() => opened.length === 1);
    assert.deepStrictEqual(opened, ["https://example.com/"]);
    assert.strictEqual(record.sent.length, sentBefore);
  });

  // .md へのリンクを VS Code のエディタで開く
  test("test_normal_when_markdown_link", async () => {
    // 準備
    const { editor, record } = await openLinkGuide();
    // 実行
    deliver(record, { type: "openLink", href: "./other.md#使い方" });
    // 検証
    await waitFor(
      () =>
        vscode.window.activeTextEditor?.document.uri.fsPath ===
        join(workspaceDir(), "other.md"),
      { message: "other.md が開かない" },
    );
    assert.strictEqual(
      vscode.window.activeTextEditor?.viewColumn,
      editor.viewColumn,
    );
    assert.deepStrictEqual(opened, []);
  });

  // 相対パスの先にファイルが無いときは何も開かない
  test("test_error_when_link_target_missing", async () => {
    // 準備
    const { record } = await openLinkGuide();
    const editors = vscode.window.visibleTextEditors.length;
    const tabs = vscode.window.tabGroups.all.flatMap(
      (group) => group.tabs,
    ).length;
    // 実行
    deliver(record, { type: "openLink", href: "./missing.md" });
    await sleep(700);
    // 検証
    assert.strictEqual(vscode.window.visibleTextEditors.length, editors);
    assert.strictEqual(
      vscode.window.tabGroups.all.flatMap((group) => group.tabs).length,
      tabs,
    );
    assert.deepStrictEqual(opened, []);
  });
});
