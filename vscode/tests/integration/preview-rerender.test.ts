import * as assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import * as vscode from "vscode";
import { SETTING_DEFAULTS } from "../../src/settings.ts";
import {
  audit,
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
  paramMarkdown,
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

/** 外部ライブラリの代役のモジュール: マーカーの場所の文字を `drawn` にする */
const LIBRARY_SOURCE = `export function draw(slot) {
  slot.textContent = "drawn";
}
`;

/** 拡張機能が待ちを始める時刻と、テストが変更の通知で取る時刻の差、タイマーが早く発火する分の許容（ミリ秒） */
const TIMER_TOLERANCE_MS = 10;

/** 長い文書の見出し A の行（0 始まり）。前に 8 つの段落を配置し、文書の先頭から離す */
const HEADING_A_LINE = 18;
/** 見えている範囲の先頭を見出し A の途中に配置する位置（元の行番号）。見出し A と次の段落の間を 4 分の 1 だけ進めた位置 */
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

/** プレビューを `line` の位置が先頭に来るまでスクロールし、止まった後の見出し A の位置を返却する（エディタは動かさない） */
async function scrollPreviewTo(
  record: RecordedPanel,
  line: number,
): Promise<number> {
  const start = await headingTop("見出し A");
  // 拡張機能を経由せずに Webview へ送信し、Webview の中だけでスクロールする
  await record.postRaw({ type: "scrollToLine", line });
  await waitFor(async () => (await headingTop("見出し A")) !== start, {
    message: "プレビューがスクロールしない",
  });
  // スクロールの通知で見えている先頭の行を保存し終えるまで待つ
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

/** 見出し A の上端が、見えている範囲の先頭（上端の帯があればその下端）より上に出ていることを確認する */
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

suite("プレビューを再描画する", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(async () => {
    await closeRepositories();
    await resetEnvironment();
  });

  // 打つたびに待ち、最後の全文だけを送信する
  test("test_normal", async () => {
    // 準備
    const { editor, record } = await openGuide();
    const before = renders(record).length;
    // 最後の書き換えの時刻は、拡張機能が待ちを始めるのと同じ文書の変更の通知で取る
    let lastEdit = 0;
    const watcher = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === editor.document) {
        lastEdit = Date.now();
      }
    });
    // 実行: 100 ms おきに 3 回書き換える（保存しない）
    try {
      for (const text of ["# 見出し 1", "# 見出し 2", "# 見出し 3"]) {
        await replaceFirstLine(editor, text);
        await sleep(100);
      }
    } finally {
      watcher.dispose();
    }
    // 検証
    await waitFor(() => renders(record).length > before);
    await sleep(600);
    const sent = renders(record).slice(before);
    assert.strictEqual(sent.length, 1);
    assert.ok(sent[0]?.markdown.startsWith("# 見出し 3"));
    const sentAt = record.sentAt[record.sent.indexOf(sent[0] as never)] ?? 0;
    assert.ok(
      sentAt - lastEdit >= SETTING_DEFAULTS.updateDelayMs - TIMER_TOLERANCE_MS,
      `最後の書き換えから ${sentAt - lastEdit} ms`,
    );
    await waitFor(async () =>
      (await inspect("h1")).some((item) => item.text.includes("見出し 3")),
    );
  });

  // liveUpdate が false のときは保存でだけ送信する
  test("test_normal_when_live_update_off", async () => {
    // 準備
    await setSetting("preview.liveUpdate", false);
    const { editor, record } = await openGuide();
    const before = renders(record).length;
    // 実行・検証: 保存する前は送信しない
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

  // 設定ファイルの保存で、新しい features で再描画する
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

  // 設定ファイルの labels を config に入れ、操作できる部品のボタンを設定の文言で再描画する
  test("test_normal_when_param_copy_label_configured", async () => {
    // 準備
    await writeFixture("guide.md", await paramMarkdown());
    await writeFixture("mdmark.config.yaml", "# 設定\n");
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const before = renders(record).length;
    // 実行
    await writeFixture("mdmark.config.yaml", "labels:\n  paramCopy: コピー\n");
    // 検証
    await waitFor(() => renders(record).length > before, {
      message: "再描画されない",
    });
    assert.deepStrictEqual(renders(record).at(-1)?.config.labels, {
      paramCopy: "コピー",
    });
    await waitFor(async () =>
      (await inspect("button.mdmark-param-copy")).some(
        (item) => item.text === "コピー",
      ),
    );
  });

  // 設定ファイルの map を config に入れ、map の図を設定の種類と線で再描画する
  test("test_normal_when_map_configured", async () => {
    // 準備
    await writeFixture(
      "guide.md",
      [
        "# 案内",
        "",
        "<!-- map -->",
        "",
        "```mermaid",
        "flowchart LR",
        '  doc[("文書")]:::store',
        '  read["読み取り"]',
        "  doc -.-> read",
        "```",
        "",
        "<!-- /map -->",
        "",
      ].join("\n"),
    );
    await writeFixture("mdmark.config.yaml", "# 設定\n");
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const config = (shape: string) =>
      [
        "map:",
        "  kinds:",
        `    store: { label: 保存先, icon: database, shape: ${shape} }`,
        "  lines:",
        '    "-.->": { dash: dashed }',
        "",
      ].join("\n");
    const node = '[data-diagram="map"] .mdmark-diagram-node[data-node="doc"]';
    let before = renders(record).length;
    // 実行
    await writeFixture("mdmark.config.yaml", config("rect"));
    // 検証
    await waitFor(() => renders(record).length > before, {
      message: "再描画されない",
    });
    assert.deepStrictEqual(renders(record).at(-1)?.config.map, {
      kinds: { store: { label: "保存先", icon: "database", shape: "rect" } },
      lines: { "-.->": { dash: "dashed" } },
    });
    await waitFor(
      async () =>
        (await inspect(`${node} .mdmark-diagram-node-kind svg`)).length > 0,
      { message: "種類の行のアイコンが描かれない" },
    );
    const [kind] = await inspect(`${node} .mdmark-diagram-node-kind`);
    assert.strictEqual(kind?.text, "保存先");
    const [wire] = await inspect(
      '[data-diagram="map"] .mdmark-diagram-wire[data-wire="doc->read"]',
    );
    assert.ok(wire?.attributes["stroke-dasharray"]);
    // 実行: 知らない形状にする
    before = renders(record).length;
    const sentBefore = record.sent.length;
    await writeFixture("mdmark.config.yaml", config("hexagon"));
    // 検証: その値のまま送り、設定の誤りを送らず、角の丸い四角で描く
    await waitFor(() => renders(record).length > before, {
      message: "再描画されない",
    });
    const map = renders(record).at(-1)?.config.map as
      | { kinds?: { store?: { shape?: string } } }
      | undefined;
    assert.strictEqual(map?.kinds?.store?.shape, "hexagon");
    assert.ok(
      !record.sent
        .slice(sentBefore)
        .some((message) => message.type === "configError"),
    );
    await waitFor(async () =>
      (await inspect(node)).some(
        (item) => item.attributes["data-shape"] === "rounded",
      ),
    );
  });

  // aliases の行が指す YAML を保存すると、再作成したエイリアスで再描画する
  test("test_normal_when_aliases_yaml_saved", async () => {
    // 準備
    await writeFixture(
      "mdmark.config.yaml",
      [
        "aliases:",
        "  - id: terms",
        "    paths: [glossary.yaml]",
        "    alias_type: term",
        "    records: terms",
        "",
      ].join("\n"),
    );
    const glossary = (meaning: string) =>
      [
        "terms:",
        "  - id: render",
        "    name: 描画",
        "    aliases: [レンダリング]",
        `    description: ${meaning}`,
        "",
      ].join("\n");
    await writeFixture("glossary.yaml", glossary("前の意味"));
    await writeFixture("guide.md", "# 案内\n\nレンダリングの段落\n");
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const before = renders(record).length;
    // 実行
    await writeFixture("glossary.yaml", glossary("書き換えた意味"));
    // 検証
    await waitFor(
      () =>
        renders(record).at(-1)?.aliases?.[0]?.description === "書き換えた意味",
      { message: "aliases の YAML の保存で再描画されない" },
    );
    assert.strictEqual(renders(record).length, before + 1);
    await waitFor(async () =>
      (await inspect('[role="tooltip"]')).some((tip) =>
        tip.text.includes("書き換えた意味"),
      ),
    );
  });

  // 取り込んでいるファイルを保存すると、再読み込みした取り込む文書で再描画する
  test("test_normal_when_include_target_saved", async () => {
    // 準備
    await writeFixture(
      "docs/guide.md",
      "# 案内\n\n<!-- include: 共通/手順.md#実行 -->\n",
    );
    await writeFixture("docs/共通/手順.md", "## 実行\n\n前の段落\n");
    await writeFixture("docs/other.md", "# 別の文書\n");
    await openMarkdown("docs/guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const before = renders(record).length;
    // 実行: 取り込んでいないファイルを保存する
    const other = await vscode.workspace.openTextDocument(
      vscode.Uri.file(join(workspaceDir(), "docs/other.md")),
    );
    await other.save();
    await sleep(700);
    // 検証
    assert.strictEqual(renders(record).length, before);
    // 実行: 取り込んでいるファイルを書き換えて保存する
    const procedure = await vscode.workspace.openTextDocument(
      vscode.Uri.file(join(workspaceDir(), "docs/共通/手順.md")),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      procedure.uri,
      new vscode.Range(2, 0, 2, "前の段落".length),
      "書き換えた段落",
    );
    await vscode.workspace.applyEdit(edit);
    await procedure.save();
    // 検証
    await waitFor(() => renders(record).length === before + 1, {
      message: "取り込み先の保存で再描画されない",
    });
    assert.strictEqual(
      renders(record).at(-1)?.includes?.["共通/手順.md"],
      "## 実行\n\n書き換えた段落\n",
    );
    await waitFor(async () =>
      (await inspect(".mdmark-include")).some((item) =>
        item.text.includes("書き換えた段落"),
      ),
    );
  });

  // 設定ファイルが無ければ設定なしで描き、通知を出さない
  test("test_normal_when_config_missing", async () => {
    // 準備・実行
    const { record } = await openGuide();
    // 検証
    assert.deepStrictEqual(renders(record)[0]?.config, {});
    assert.ok(!record.sent.some((message) => message.type === "configError"));
    assert.strictEqual((await inspect(".mdmark-config-band")).length, 0);
  });

  // 背面の間は送信せず、ready を受けて最後の全文を送信し、再作成した Webview を背面に回す前の位置へ戻す
  test("test_normal_when_revealed", async function () {
    // 長い文書の描画と、スクロールが止まるまでの待ちに時間がかかる
    this.timeout(60000);
    // 準備: 左の列のエディタと右の列のプレビューで長い文書を開き、プレビューを見えている範囲の先頭が見出し A の途中に該当するまでスクロールして位置を記録する
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
      message: "戻した後に送信されない",
    });
    assert.ok(
      renders(record).at(-1)?.markdown.includes("## 見出し B 3\n"),
      "3 回目の全文を送信していない",
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
    // 戻したスクロールでは revealLine を送信せず、エディタも動かない
    await sleep(700);
    const revealed = record.received
      .slice(receivedBefore)
      .filter((message) => message.type === "revealLine");
    assert.deepStrictEqual(revealed, []);
    assert.strictEqual(editor.visibleRanges[0]?.start.line, editorStart);
  });

  // 差分のパネルも、再作成した Webview を背面に回す前の位置へ戻す
  test("test_normal_when_diff_revealed", async function () {
    // 長い文書の差分の描画と、スクロールが止まるまでの待ちに時間がかかる
    this.timeout(60000);
    // 準備: 最初の段落だけを書き換えた長い文書の差分ビューから差分のプレビューを開き、見えている範囲の先頭が見出し A の途中に該当するまでスクロールして位置を記録する
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
      message: "戻した後に送信されない",
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

  // 設定ファイルからの相対パスの libraries を Webview で読み込める URL にして指定する
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
        message: "マーカーの場所が描かれない",
      },
    );
    assert.strictEqual((await inspect(".mdmark-notice")).length, 0);
  });

  // 読み込めない YAML を保存すると、前の設定で描いたまま読み込めない行を通知する
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
    assert.strictEqual(
      error?.type === "configError" ? error.path : "",
      "mdmark.config.yaml",
    );
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
    assert.deepStrictEqual(await audit(), []);
  });

  // 読み込めない設定ファイルを修正して保存すると、新しい設定で描き帯を削除する
  test("test_normal_when_config_fixed", async () => {
    // 準備: 読み込めない設定ファイルで開いている
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

  // 開いたまま設定ファイルにまだ CSP に無い origin の libraries を追加して保存すると、HTML をもう一度入れてそのモジュールを読み込む
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
      await writeFixture(
        "guide.md",
        '# 見出し\n\n<!-- my-chart: {"label": "a"} -->\n',
      );
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

  // mdmark.colorTheme を変えると設定ファイルの colorTheme を上書きして再描画し、空に戻すと設定ファイルのテーマで描く
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
