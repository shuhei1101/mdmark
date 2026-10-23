import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  deliver,
  distPath,
  distRequests,
  guideMarkdown,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  openMarkdown,
  recordedPanels,
  resetEnvironment,
  sleep,
  stub,
  tagRequestCount,
  waitFor,
  waitForRendered,
  writeFixture,
} from "./helpers.ts";

suite("プレビューをリロードする", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // 描けないときの「リロード」から、配布物を読み直して描く
  test("test_normal", async () => {
    // 準備: 配布物を読めずにオフラインの理由を出している
    await writeFixture("guide.md", await guideMarkdown());
    await stub.setMode({ tags: "ok", dist: "drop" });
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitFor(() =>
      record.received.some((message) => message.type === "loadFailed"),
    );
    await waitFor(
      async () => (await inspect(".mdmark-preview-notice")).length === 1,
    );
    await stub.setMode({ tags: "ok", dist: "ok" });
    await stub.clear();
    // 実行: 「リロード」のボタンが送る reload を、Webview から届いたことにする
    deliver(record, { type: "reload" });
    // 検証
    await waitForRendered(record);
    assert.strictEqual(await tagRequestCount(), 1);
    await waitFor(
      async () => (await inspect(".mdmark-preview-notice")).length === 0,
    );
    assert.ok((await inspect(".mdmark-diagram-frame")).length > 0);
    assert.ok(
      (await inspect("h1")).some((item) => item.text.includes("見出し")),
    );
  });

  // mdmark.refreshPreview で、新しく打たれたバージョンを読む
  test("test_normal_when_from_command", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    await stub.setTags(["v0.10.0", "v0.11.0"]);
    await stub.clear();
    // 実行
    await vscode.commands.executeCommand("mdmark.refreshPreview");
    // 検証
    await waitForRendered(record, 2);
    assert.ok((await distRequests()).includes(distPath("v0.11.0", "index.js")));
    assert.ok(
      (await distRequests()).includes(distPath("v0.11.0", "index.css")),
    );
    assert.strictEqual(recordedPanels().length, 1);
  });

  // プレビューを開いていないときは何もしない
  test("test_error_when_no_preview", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.refreshPreview");
    await sleep(500);
    // 検証
    assert.strictEqual(recordedPanels().length, 0);
    assert.strictEqual(await tagRequestCount(), 0);
  });
});
