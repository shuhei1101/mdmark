import * as assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  closeRepositories,
  createRepo,
  gitUri,
  guideMarkdown,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  openDiffView,
  openMarkdown,
  type RecordedPanel,
  readFixture,
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

/** 長い文書の見出し A の行（0 始まり）。前に 8 つの段落を置き、文書の先頭から離す */
const HEADING_A_LINE = 18;
/** 見えている範囲の先頭を見出し A の途中に置く位置（元の行番号）。見出し A と次の段落の間を 4 分の 1 だけ進めた位置 */
const WITHIN_HEADING_A = HEADING_A_LINE + 0.5;
/** 長い文書の見出し B の行（0 始まり）。見出し A の下で、エディタを先頭から動かさずに見える範囲にある */
const HEADING_B_LINE = 26;

/** 段落を `count` 個並べた行（段落ごとに空行を挟む） */
function paragraphs(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => [
    `${prefix}-${index + 1} 段落の本文です。`,
    "",
  ]).flat();
}

/** 見出し A・B の後ろに画面の高さを大きく超える段落を持つ Markdown。`first` は最初の段落の文 */
function longMarkdown(first = "最初の段落です。"): string {
  const lines = [
    "# 長い文書",
    "",
    first,
    "",
    ...paragraphs("前", 7),
    "## 見出し A",
    "",
    ...paragraphs("A", 3),
    "## 見出し B",
    "",
    ...paragraphs("B", 200),
  ];
  assert.strictEqual(lines[HEADING_A_LINE], "## 見出し A");
  assert.strictEqual(lines[HEADING_B_LINE], "## 見出し B");
  return lines.join("\n");
}

/** Webview で、`text` を含む見出し（h2）の見えている範囲の先頭からの位置 */
async function headingTop(text: string): Promise<number | undefined> {
  return (await inspect("h2")).find((item) => item.text.includes(text))?.top;
}

/** プレビューを `line` の位置が先頭に来るまでスクロールし、止まった後の見出し A の位置を返す（エディタは動かさない） */
async function scrollPreviewTo(
  record: RecordedPanel,
  line: number,
): Promise<number> {
  const start = await headingTop("見出し A");
  // 拡張機能を通さずに Webview へ送り、Webview の中だけでスクロールする
  await record.postRaw({ type: "scrollToLine", line });
  await waitFor(async () => (await headingTop("見出し A")) !== start, {
    message: "プレビューがスクロールしない",
  });
  // スクロールの知らせで見えている先頭の行を保存し終えるまで待つ
  await sleep(500);
  const top = await headingTop("見出し A");
  assert.ok(top !== undefined, "見出し A が無い");
  return top;
}

/** 狭い幅の右側の目次を上端の帯にしているときの、帯の下端（帯が無いときは 0）。帯は 1 行分の高さで、広い幅の右の列は画面の高さいっぱいの縦長 */
async function bandBottom(): Promise<number> {
  const [aside] = await inspect(".mdmark-side-toc");
  return aside !== undefined && aside.height < 120
    ? aside.top + aside.height
    : 0;
}

/** 見出し A の上端が、見えている範囲の先頭（上端の帯があればその下端）より上に出ていることを確かめる */
async function assertWithinHeadingA(top: number): Promise<void> {
  const inset = await bandBottom();
  assert.ok(
    top < inset,
    `見出し A の上端が見えている範囲の先頭より上に出ていない: ${top}（先頭 ${inset}）`,
  );
}

/** `panel` と同じ列で別の Markdown を開き、パネルを背面に回す */
async function hidePanel(record: RecordedPanel): Promise<void> {
  await writeFixture("other.md", "# 別の文書\n");
  const other = await vscode.workspace.openTextDocument(
    vscode.Uri.file(join(workspaceDir(), "other.md")),
  );
  await vscode.window.showTextDocument(other, record.panel.viewColumn);
  await waitFor(() => !record.panel.visible, { message: "背面に回らない" });
}

/** Markdown の文書の `line` 行目を書き換える（保存はしない） */
async function replaceLine(
  editor: vscode.TextEditor,
  line: number,
  text: string,
): Promise<void> {
  const range = editor.document.lineAt(line).range;
  await editor.edit((builder) => builder.replace(range, text));
}

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
  teardown(async () => {
    await closeRepositories();
    await resetEnvironment();
  });

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

  // 背面の間は送らず、ready を受けて最後の全文を送り、作り直した Webview を背面に回す前の位置へ戻す
  test("test_normal_when_revealed", async function () {
    // 長い文書の描画と、スクロールが止まるまでの待ちに時間がかかる
    this.timeout(60000);
    // 準備: 左の列のエディタと右の列のプレビューで長い文書を開き、プレビューを見えている範囲の先頭が見出し A の途中に当たるまでスクロールして位置を控える
    await writeFixture("long.md", longMarkdown());
    const editor = await openMarkdown("long.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    await sleep(500);
    const savedTop = await scrollPreviewTo(record, WITHIN_HEADING_A);
    await assertWithinHeadingA(savedTop);
    // 右の列で別の Markdown を開き、プレビューのパネルをその後ろに回す
    await hidePanel(record);
    const before = renders(record).length;
    // 実行: 背面の間に、エディタのスクロールを動かさずに見出し B を 3 回書き換える
    for (const text of ["## 見出し B 1", "## 見出し B 2", "## 見出し B 3"]) {
      await replaceLine(editor, HEADING_B_LINE, text);
      await sleep(100);
    }
    await sleep(700);
    assert.strictEqual(renders(record).length, before);
    const editorStart = editor.visibleRanges[0]?.start.line;
    const receivedBefore = record.received.length;
    // 表に戻す
    record.panel.reveal(record.panel.viewColumn);
    // 検証
    await waitFor(() => renders(record).length > before, {
      message: "戻した後に送られない",
    });
    assert.ok(
      renders(record).at(-1)?.markdown.includes("## 見出し B 3\n"),
      "3 回目の全文を送っていない",
    );
    await waitFor(async () => (await headingTop("見出し B 3")) !== undefined, {
      message: "見出し B が 3 回目の文字にならない",
    });
    await waitFor(
      async () => {
        const top = await headingTop("見出し A");
        return top !== undefined && Math.abs(top - savedTop) <= 1;
      },
      { message: "見出し A が背面に回す前の位置に戻らない" },
    );
    // 戻したスクロールでは revealLine を送らず、エディタも動かない
    await sleep(700);
    const revealed = record.received
      .slice(receivedBefore)
      .filter((message) => message.type === "revealLine");
    assert.deepStrictEqual(revealed, []);
    assert.strictEqual(editor.visibleRanges[0]?.start.line, editorStart);
  });

  // 差分のパネルも、作り直した Webview を背面に回す前の位置へ戻す
  test("test_normal_when_diff_revealed", async function () {
    // 長い文書の差分の描画と、スクロールが止まるまでの待ちに時間がかかる
    this.timeout(60000);
    // 準備: 最初の段落だけを書き換えた長い文書の差分ビューから差分のプレビューを開き、見えている範囲の先頭が見出し A の途中に当たるまでスクロールして位置を控える
    const dir = await createRepo("diff-repo-revealed", {
      "guide.md": longMarkdown(),
    });
    const after = longMarkdown("書き換えた最初の段落です。");
    await writeFixture(join("diff-repo-revealed", "guide.md"), after);
    const modified = vscode.Uri.file(join(dir, "guide.md"));
    await openDiffView(await gitUri(modified, "HEAD"), modified);
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    await waitFor(
      async () => (await inspect(".mdmark-diff-block")).length > 0,
      { message: "差分のブロックが出ない" },
    );
    await sleep(500);
    const savedTop = await scrollPreviewTo(record, WITHIN_HEADING_A);
    await assertWithinHeadingA(savedTop);
    // 同じ列で別の Markdown を開き、差分のパネルをその後ろに回す
    await hidePanel(record);
    const before = renders(record).length;
    // 実行
    record.panel.reveal(record.panel.viewColumn);
    // 検証
    await waitFor(() => renders(record).length > before, {
      message: "戻した後に送られない",
    });
    assert.ok(
      renders(record).at(-1)?.previous !== undefined,
      "previous を持たない",
    );
    await waitFor(
      async () => {
        const top = await headingTop("見出し A");
        return top !== undefined && Math.abs(top - savedTop) <= 1;
      },
      { message: "見出し A が背面に回す前の位置に戻らない" },
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

  // mdmark.colorTheme を変えると設定ファイルの colorTheme を上書きして描き直し、空に戻すと設定ファイルのテーマで描く
  test("test_normal_when_color_theme_changed", async () => {
    // 準備
    const config = "colorTheme: theme-paper\n";
    await setSetting("preview.theme", "light");
    const { record } = await openGuide({ config });
    /** Webview の文書に付いたテーマの属性 */
    const shownTheme = async () =>
      (await inspect("[data-mdmark-color-theme]"))[0]?.attributes[
        "data-mdmark-color-theme"
      ];
    await waitFor(async () => (await shownTheme()) === "theme-paper");
    // 実行・検証: theme-slate にする
    let before = renders(record).length;
    await setSetting("colorTheme", "theme-slate");
    await waitFor(() => renders(record).length > before, {
      message: "再描画されない",
    });
    assert.strictEqual(
      renders(record).at(-1)?.config.colorTheme,
      "theme-slate",
    );
    await waitFor(async () => (await shownTheme()) === "theme-slate");
    // 実行・検証: 空に戻す
    before = renders(record).length;
    await setSetting("colorTheme", "");
    await waitFor(() => renders(record).length > before, {
      message: "再描画されない",
    });
    assert.strictEqual(
      renders(record).at(-1)?.config.colorTheme,
      "theme-paper",
    );
    await waitFor(async () => (await shownTheme()) === "theme-paper");
    // 設定ファイルは書き換わらない
    assert.strictEqual(await readFixture("mdmark.config.yaml"), config);
  });
});
