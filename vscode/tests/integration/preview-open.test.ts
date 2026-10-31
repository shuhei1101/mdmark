import * as assert from "node:assert";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  distPath,
  distRequests,
  EXTENSION_ID,
  extensionLogSince,
  extensionLogSize,
  guideMarkdown,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  openMarkdown,
  recordedPanels,
  resetEnvironment,
  STUB_ORIGIN,
  setSetting,
  sleep,
  stub,
  tagRequestCount,
  waitFor,
  waitForRendered,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

/** 1 x 1 の PNG */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** パネルを閉じ、プレビューを開いた Markdown のエディタも閉じる */
async function closePreviews(): Promise<void> {
  for (const record of recordedPanels().splice(0)) {
    record.panel.dispose();
  }
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  // 閉じる前の読み込みの要求が、後の要求の記録に混ざらないよう待つ
  await sleep(500);
}

suite("プレビューを開く", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // タグ一覧から最新のバージョンを選び、横の列のパネルに描かせる
  test("test_normal", async () => {
    // 準備
    await stub.setTags(["v0.7.0", "v0.10.0", "v0.6.0", "vscode-v0.11.0"]);
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    assert.strictEqual(record.options.showOptions, vscode.ViewColumn.Beside);
    assert.strictEqual(record.options.title, "プレビュー guide.md");
    assert.deepStrictEqual((await distRequests()).sort(), [
      distPath("v0.10.0", "index.css"),
      distPath("v0.10.0", "index.js"),
    ]);
    assert.strictEqual(await tagRequestCount(), 1);
    // 前回のバージョンが v0.10.0 になったことを、タグ一覧が応えない状態のリロードで確かめる
    await stub.setMode({ tags: "hang", dist: "ok" });
    await stub.clear();
    await vscode.commands.executeCommand("mdmark.refreshPreview");
    await waitForRendered(record, 2);
    assert.ok((await distRequests()).includes(distPath("v0.10.0", "index.js")));
    // Webview の本文
    for (const selector of [
      "h1",
      ".mdmark-table",
      ".markdown-alert",
      ".mdmark-diagram-frame",
    ]) {
      assert.ok(
        (await inspect(selector)).length > 0,
        `${selector} が描かれていない`,
      );
    }
    // CSP と nonce
    const html = record.panel.webview.html;
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
      .exec(html)?.[1]
      ?.replaceAll("&#39;", "'");
    const nonce = /<script[^>]*nonce="([^"]*)"/.exec(html)?.[1];
    assert.ok(csp && nonce);
    const cspSource = record.panel.webview.cspSource;
    assert.strictEqual(
      csp,
      [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' ${STUB_ORIGIN} ${cspSource}`,
        `style-src ${STUB_ORIGIN} ${cspSource} 'unsafe-inline'`,
        `img-src ${cspSource} https: data:`,
        `font-src ${STUB_ORIGIN} ${cspSource}`,
        `connect-src ${STUB_ORIGIN}`,
      ].join("; "),
    );
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    assert.ok(scripts.length > 0);
    for (const tag of scripts) {
      assert.ok(tag.includes(`nonce="${nonce}"`), tag);
    }
  });

  // mdmark.openPreview は同じ列のタブに開く
  test("test_normal_when_same_column", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    const editor = await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreview");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    assert.strictEqual(record.options.showOptions, vscode.ViewColumn.Active);
    assert.strictEqual(record.panel.viewColumn, editor.viewColumn);
  });

  // 同じ Markdown のパネルがあれば、作らずに表に出す
  test("test_normal_when_already_open", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await writeFixture("other.md", "# 別の文書\n");
    const guide = vscode.Uri.file(join(workspaceDir(), "guide.md"));
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // パネルの列で別のタブを表にしておく
    const other = await vscode.workspace.openTextDocument(
      vscode.Uri.file(join(workspaceDir(), "other.md")),
    );
    await vscode.window.showTextDocument(other, record.panel.viewColumn);
    await waitFor(() => !record.panel.visible, {
      message: "パネルが背面に回らない",
    });
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide", guide);
    // 検証
    await waitFor(() => record.panel.visible, {
      message: "パネルが表に出ない",
    });
    assert.strictEqual(recordedPanels().length, 1);
    assert.strictEqual(await tagRequestCount(), 1);
  });

  // mdmark.version に記載したバージョンを、タグ一覧を取らずに読む
  test("test_normal_when_version_pinned", async () => {
    // 準備: 前回のバージョンを v0.7.0 にする
    await stub.setTags(["v0.7.0"]);
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    await closePreviews();
    await setSetting("version", "v0.6.0");
    await stub.clear();
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    assert.deepStrictEqual((await distRequests()).sort(), [
      distPath("v0.6.0", "index.css"),
      distPath("v0.6.0", "index.js"),
    ]);
    assert.strictEqual(await tagRequestCount(), 0);
    // 前回のバージョンが v0.7.0 のままであることを、固定を外してタグ一覧が応えない状態で開いて確かめる
    await closePreviews();
    await setSetting("version", undefined);
    await stub.setMode({ tags: "hang", dist: "ok" });
    await stub.clear();
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    assert.ok((await distRequests()).includes(distPath("v0.7.0", "index.js")));
  });

  // タグ一覧が待ちの上限まで返らないとき、前回のバージョンで描く
  test("test_normal_when_tags_unreachable", async () => {
    // 準備: 前回のバージョンを v0.6.0 にする
    await stub.setTags(["v0.6.0"]);
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    await closePreviews();
    await stub.setTags(["v0.10.0"]);
    await stub.setMode({ tags: "hang", dist: "ok" });
    await stub.clear();
    await openMarkdown("guide.md");
    const logOffset = await extensionLogSize();
    // 実行
    const start = Date.now();
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitFor(async () =>
      (await distRequests()).includes(distPath("v0.6.0", "index.js")),
    );
    const elapsed = Date.now() - start;
    await waitForRendered(record);
    // 検証: 待ちの上限（3 秒）を少し過ぎたところで要求される
    if (!(elapsed >= 2800 && elapsed < 6000)) {
      // 出力チャネルがログファイルへ書き終えるのを待つ
      await sleep(1000);
      const timings = (await stub.tagRequests()).map(
        ({ receivedAt, closedAt }) =>
          `受けた +${receivedAt - start} ms・閉じられた ${closedAt === null ? "まだ" : `+${closedAt - start} ms`}`,
      );
      const reasons = (await extensionLogSince(logOffset)).filter((line) =>
        line.includes("タグ一覧を取れない"),
      );
      assert.fail(
        [
          `要求まで ${elapsed} ms ${JSON.stringify(await stub.requests())}`,
          `/tags の要求（開いた時刻から）: ${timings.join(" / ") || "なし"}`,
          `拡張機能のログ: ${reasons.join(" / ") || "なし"}`,
        ].join("\n"),
      );
    }
    assert.strictEqual((await inspect(".mdmark-preview-notice")).length, 0);
    // 403 を返す代役でも、待たずに前回のバージョンで描く
    await closePreviews();
    await stub.setMode({ tags: "forbidden", dist: "ok" });
    await stub.clear();
    await openMarkdown("guide.md");
    const startForbidden = Date.now();
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    assert.ok(Date.now() - startForbidden < 2800);
    assert.ok((await distRequests()).includes(distPath("v0.6.0", "index.js")));
  });

  // 配色を固定する設定を、描く先を包む要素の class にし、auto に戻すと外す
  test("test_normal_when_theme_fixed", async () => {
    // 準備
    await setSetting("preview.theme", "light");
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証: light の間
    const [fixed] = await inspect("#mdmark-preview");
    assert.ok(fixed?.className.split(" ").includes("mdmark-theme-light"));
    assert.ok(!fixed?.className.split(" ").includes("mdmark-theme-dark"));
    // 実行: auto にする
    await setSetting("preview.theme", "auto");
    await waitForRendered(record, 2);
    // 検証: パネルを開き直さずに class が外れる
    const [released] = await inspect("#mdmark-preview");
    assert.ok(!released?.className.includes("mdmark-theme-"));
    assert.strictEqual(recordedPanels().length, 1);
  });

  // Markdown からの相対パスの画像を読む
  test("test_normal_when_relative_image", async () => {
    // 準備
    await writeFixture("docs/images/figure.png", PNG);
    await writeFixture(
      "docs/guide.md",
      "# 見出し\n\n![図](./images/figure.png)\n",
    );
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    await waitFor(
      async () => ((await inspect("img"))[0]?.naturalWidth ?? 0) > 0,
      {
        message: "画像を読めていない",
      },
    );
  });

  // ワークスペースの外の画像は読まず、他の本文は描く
  test("test_error_when_image_outside_workspace", async () => {
    // 準備: ワークスペースの 1 つ上に画像を置く
    await writeFixture("../mdmark-outside.png", PNG);
    await writeFixture(
      "docs/guide.md",
      "# 見出し\n\n![外の画像](../../mdmark-outside.png)\n",
    );
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    await sleep(500);
    // 検証
    const [image] = await inspect("img");
    assert.strictEqual(image?.naturalWidth, 0);
    assert.strictEqual(image?.attributes.alt, "外の画像");
    assert.ok(
      (await inspect("h1")).some((item) => item.text.includes("見出し")),
    );
  });

  // 配布物の配信元が応えないとき、オフラインの理由と「リロード」を出す
  test("test_error_when_distribution_unreachable", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await writeFixture("mdmark.config.yaml", "features:\n  callout: false\n");
    const markdown = await guideMarkdown();
    await stub.setMode({ tags: "ok", dist: "drop" });
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    // 検証
    await waitFor(() =>
      record.received.some((message) => message.type === "loadFailed"),
    );
    const failed = record.received.find(
      (message) => message.type === "loadFailed",
    );
    assert.strictEqual(
      failed?.type === "loadFailed" ? failed.reason : "",
      "offline",
    );
    await waitFor(
      async () => (await inspect(".mdmark-preview-notice")).length === 1,
    );
    const [notice] = await inspect(".mdmark-preview-notice");
    assert.ok(notice?.text.includes("jsDelivr から読み込めませんでした"));
    assert.strictEqual((await inspect('[data-action="reload"]')).length, 1);
    assert.strictEqual((await inspect(".mdmark-table")).length, 0);
    assert.strictEqual(
      await (async () =>
        (
          await vscode.workspace.openTextDocument(
            vscode.Uri.file(join(workspaceDir(), "guide.md")),
          )
        ).getText())(),
      markdown,
    );
  });

  // 1 秒経っても描き終えないとき、読み込み中を出し、描き終えたら消す
  test("test_normal_when_loading_shown", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await stub.setMode({ tags: "ok", dist: "slow" });
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    // 検証: 開いてから 1 秒を過ぎるまでは出さず、過ぎると出る
    const opened = Date.now();
    let shownAfter = 0;
    await waitFor(
      async () => {
        const found = await inspect(".mdmark-preview-loading").catch(() => []);
        if (found.length === 1) {
          shownAfter = Date.now() - opened;
          return true;
        }
        return false;
      },
      { message: "読み込み中が出ない" },
    );
    assert.ok(shownAfter >= 900, `読み込み中が ${shownAfter} ms で出た`);
    const [loading] = await inspect(".mdmark-preview-loading");
    assert.strictEqual(loading?.attributes.role, "status");
    assert.ok(loading?.text.includes("mdmark を読み込んでいます"));
    assert.strictEqual(
      (await inspect(".mdmark-preview-loading progress")).length,
      1,
    );
    // 描き終えたら消え、文書が出る
    await waitForRendered(record);
    await waitFor(
      async () => (await inspect(".mdmark-preview-loading")).length === 0,
      { message: "読み込み中が消えない" },
    );
    assert.ok((await inspect("h1")).length > 0);
  });

  // 配布物の URL が 404 のとき、指定したバージョンが無い理由と「リロード」を出す
  test("test_error_when_version_missing", async () => {
    // 準備
    await setSetting("version", "v9.9.9");
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    // 検証
    await waitFor(() =>
      record.received.some((message) => message.type === "loadFailed"),
    );
    const failed = record.received.find(
      (message) => message.type === "loadFailed",
    );
    assert.strictEqual(
      failed?.type === "loadFailed" ? failed.reason : "",
      "versionMissing",
    );
    await waitFor(
      async () => (await inspect(".mdmark-preview-notice")).length === 1,
    );
    const [notice] = await inspect(".mdmark-preview-notice");
    assert.ok(notice?.text.includes("v9.9.9"));
    assert.strictEqual((await inspect('[data-action="reload"]')).length, 1);
  });

  // Markdown でない文書でコマンドを呼んでもパネルを開かない
  test("test_error_when_not_markdown", async () => {
    // 準備
    await writeFixture("notes.txt", "メモ\n");
    await openMarkdown("notes.txt");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await sleep(500);
    // 検証
    assert.strictEqual(recordedPanels().length, 0);
    assert.strictEqual(await tagRequestCount(), 0);
    const manifest = vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON;
    assert.ok(
      JSON.stringify(manifest.contributes.menus["editor/title"]).includes(
        "editorLangId == markdown",
      ),
    );
    assert.ok(
      JSON.stringify(manifest.contributes.keybindings).includes(
        "editorLangId == markdown",
      ),
    );
  });
});
