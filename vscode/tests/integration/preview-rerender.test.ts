import * as assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  guideMarkdown,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  openMarkdown,
  type RecordedPanel,
  recordedPanels,
  renders,
  replaceFirstLine,
  resetEnvironment,
  setSetting,
  sleep,
  waitFor,
  waitForRendered,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

/** 外部ライブラリの代役のモジュール: 印の場所の文字を `drawn` にする */
const LIBRARY_SOURCE = `export function draw(slot) {
  slot.textContent = "drawn";
}
`;

/** 設定ファイルを持たず注意書きを持つ Markdown でプレビューを開き、最初の描画を待つ */
async function openGuide(
  options: { config?: string; configPath?: string } = {},
): Promise<{ editor: vscode.TextEditor; record: RecordedPanel }> {
  await writeFixture("guide.md", await guideMarkdown());
  if (options.config !== undefined) {
    await writeFixture(
      options.configPath ?? "mdmark.config.yaml",
      options.config,
    );
  }
  const editor = await openMarkdown("guide.md");
  await vscode.commands.executeCommand("mdmark.openPreviewToSide");
  const record = lastPanel();
  await waitForRendered(record);
  return { editor, record };
}

suite("プレビューを描き直す", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // 打つたびに待ち、最後の全文だけを送る
  test("test_normal", async () => {
    // 準備
    const { editor, record } = await openGuide();
    const before = renders(record).length;
    // 実行: 100 ms おきに 3 回書き換える（保存しない）
    let lastEdit = 0;
    for (const text of ["# 見出し 1", "# 見出し 2", "# 見出し 3"]) {
      await replaceFirstLine(editor, text);
      lastEdit = Date.now();
      await sleep(100);
    }
    // 検証
    await waitFor(() => renders(record).length > before);
    await sleep(600);
    const sent = renders(record).slice(before);
    assert.strictEqual(sent.length, 1);
    assert.ok(sent[0]?.markdown.startsWith("# 見出し 3"));
    const sentAt = record.sentAt[record.sent.indexOf(sent[0] as never)] ?? 0;
    assert.ok(
      sentAt - lastEdit >= 150,
      `最後の書き換えから ${sentAt - lastEdit} ms`,
    );
    await waitFor(async () =>
      (await inspect("h1")).some((item) => item.text.includes("見出し 3")),
    );
  });

  // liveUpdate が false のときは保存でだけ送る
  test("test_normal_when_live_update_off", async () => {
    // 準備
    await setSetting("preview.liveUpdate", false);
    const { editor, record } = await openGuide();
    const before = renders(record).length;
    // 実行・検証: 保存する前は送らない
    await replaceFirstLine(editor, "# 書き換えた見出し");
    await sleep(700);
    assert.strictEqual(renders(record).length, before);
    // 保存すると 1 回送る
    await editor.document.save();
    await waitFor(() => renders(record).length === before + 1);
    await waitFor(async () =>
      (await inspect("h1")).some((item) =>
        item.text.includes("書き換えた見出し"),
      ),
    );
  });

  // 設定ファイルの保存で、新しい features で描き直す
  test("test_normal_when_config_saved", async () => {
    // 準備
    const { record } = await openGuide({ config: "# 設定\n" });
    assert.ok((await inspect(".markdown-alert")).length > 0);
    const before = renders(record).length;
    // 実行
    await writeFixture("mdmark.config.yaml", "features:\n  callout: false\n");
    // 検証
    await waitFor(() => renders(record).length > before, {
      message: "再描画されない",
    });
    assert.deepStrictEqual(renders(record).at(-1)?.config.features, {
      callout: false,
    });
    await waitFor(async () => (await inspect(".markdown-alert")).length === 0);
    assert.ok((await inspect("blockquote")).length > 0);
  });

  // 設定ファイルが無ければ設定なしで描き、知らせを出さない
  test("test_normal_when_config_missing", async () => {
    // 準備・実行
    const { record } = await openGuide();
    // 検証
    assert.deepStrictEqual(renders(record)[0]?.config, {});
    assert.ok(!record.sent.some((message) => message.type === "configError"));
    assert.strictEqual((await inspect(".mdmark-config-band")).length, 0);
  });

  // 背面の間は送らず、ready を受けて最後の全文を送る
  test("test_normal_when_revealed", async () => {
    // 準備: プレビューのパネルを同じ列の別のタブの後ろに回す
    const { editor, record } = await openGuide();
    await writeFixture("other.md", "# 別の文書\n");
    const other = await vscode.workspace.openTextDocument(
      vscode.Uri.file(join(workspaceDir(), "other.md")),
    );
    await vscode.window.showTextDocument(other, record.panel.viewColumn);
    await waitFor(() => !record.panel.visible, { message: "背面に回らない" });
    const before = renders(record).length;
    // 実行: 背面の間に 3 回書き換える
    for (const text of ["# 見出し 1", "# 見出し 2", "# 見出し 3"]) {
      await replaceFirstLine(editor, text);
      await sleep(100);
    }
    await sleep(700);
    assert.strictEqual(renders(record).length, before);
    // 表に戻す
    record.panel.reveal(record.panel.viewColumn);
    // 検証
    await waitFor(() => renders(record).length > before, {
      message: "戻した後に送られない",
    });
    assert.ok(renders(record).at(-1)?.markdown.startsWith("# 見出し 3"));
    await waitFor(async () =>
      (await inspect("h1")).some((item) => item.text.includes("見出し 3")),
    );
  });

  // 設定ファイルからの相対パスの libraries を Webview で読める URL にして渡す
  test("test_normal_when_relative_library", async () => {
    // 準備
    await writeFixture("config/libs/my-lib.js", LIBRARY_SOURCE);
    await writeFixture(
      "config/mdmark.config.yaml",
      "libraries:\n  my-lib: ./libs/my-lib.js\n",
    );
    await setSetting("configPath", "config/mdmark.config.yaml");
    await writeFixture("docs/guide.md", "# 見出し\n\n<!-- my-lib -->\n");
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    const expected = record.panel.webview
      .asWebviewUri(
        vscode.Uri.file(join(workspaceDir(), "config", "libs", "my-lib.js")),
      )
      .toString();
    const libraries = renders(record)[0]?.config.libraries as Record<
      string,
      string
    >;
    assert.strictEqual(libraries["my-lib"], expected);
    await waitFor(
      async () =>
        (await inspect(".mdmark-embed[data-mdmark-drawn]")).length === 1,
      {
        message: "印の場所が描かれない",
      },
    );
    assert.strictEqual((await inspect(".mdmark-notice")).length, 0);
  });

  // 読めない YAML を保存すると、前の設定で描いたまま読めない行を知らせる
  test("test_error_when_config_unreadable", async () => {
    // 準備
    const { record } = await openGuide({
      config: "features:\n  callout: false\n",
    });
    await waitFor(async () => (await inspect(".markdown-alert")).length === 0);
    const before = renders(record).length;
    // 実行: 4 行目に閉じていない `[` を持つ設定ファイル
    await writeFixture("mdmark.config.yaml", "a: 1\nb: 2\nc: 3\nfeatures: [");
    // 検証
    await waitFor(() =>
      record.sent.some((message) => message.type === "configError"),
    );
    const error = record.sent.find((message) => message.type === "configError");
    assert.strictEqual(error?.type === "configError" ? error.line : 0, 4);
    await sleep(500);
    assert.strictEqual(renders(record).length, before);
    await waitFor(
      async () => (await inspect(".mdmark-config-band")).length === 1,
      {
        message: "帯が出ない",
      },
    );
    const buttons = await inspect(
      '.mdmark-config-band [data-action="openConfig"]',
    );
    assert.strictEqual(buttons.length, 1);
    assert.strictEqual((await inspect(".markdown-alert")).length, 0);
  });

  // 読めない設定ファイルを直して保存すると、新しい設定で描き帯を消す
  test("test_normal_when_config_fixed", async () => {
    // 準備: 読めない設定ファイルで開いている
    const { record } = await openGuide({
      config: "a: 1\nb: 2\nc: 3\nfeatures: [",
    });
    await waitFor(
      async () => (await inspect(".mdmark-config-band")).length === 1,
    );
    const before = renders(record).length;
    // 実行
    await writeFixture("mdmark.config.yaml", "features:\n  callout: false\n");
    // 検証
    await waitFor(() => renders(record).length > before);
    assert.deepStrictEqual(renders(record).at(-1)?.config.features, {
      callout: false,
    });
    await waitFor(() =>
      record.sent.some((message) => message.type === "configOk"),
    );
    await waitFor(
      async () => (await inspect(".mdmark-config-band")).length === 0,
    );
  });

  // 開いたまま設定ファイルにまだ CSP に無い origin の libraries を足して保存すると、HTML を入れ直してそのモジュールを読む
  test("test_normal_when_library_origin_added", async () => {
    // 準備: 別の配信元
    const requested: string[] = [];
    const library = createServer((request, response) => {
      requested.push(request.url ?? "");
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(LIBRARY_SOURCE);
    });
    await new Promise<void>((resolve) =>
      library.listen(0, "127.0.0.1", resolve),
    );
    try {
      const origin = `http://127.0.0.1:${(library.address() as AddressInfo).port}`;
      await writeFixture("guide.md", "# 見出し\n\n<!-- my-chart: a -->\n");
      await writeFixture("mdmark.config.yaml", "# 設定\n");
      await openMarkdown("guide.md");
      await vscode.commands.executeCommand("mdmark.openPreviewToSide");
      const record = lastPanel();
      await waitForRendered(record);
      // 実行
      await writeFixture(
        "mdmark.config.yaml",
        `libraries:\n  my-chart: ${origin}/my-chart.js\n`,
      );
      // 検証
      await waitForRendered(record, 2);
      assert.ok(record.panel.webview.html.includes(origin));
      await waitFor(() => requested.includes("/my-chart.js"), {
        message: "別の配信元がモジュールの要求を受けない",
      });
      await waitFor(
        async () =>
          (await inspect(".mdmark-embed[data-mdmark-drawn]")).length === 1,
      );
      assert.strictEqual((await inspect(".mdmark-notice")).length, 0);
      assert.strictEqual(recordedPanels().length, 1);
    } finally {
      library.close();
    }
  });
});
