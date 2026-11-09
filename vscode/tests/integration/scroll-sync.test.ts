import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  deliver,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  openMarkdown,
  type RecordedPanel,
  renders,
  resetEnvironment,
  setSetting,
  settledStart,
  sleep,
  waitFor,
  waitForRendered,
  writeFixture,
} from "./helpers.ts";

/** セクションの数 */
const SECTIONS = 10;
/** 1 つのセクションの行数（見出し 1 行・空行 1 行・40 段落 × 2 行） */
const SECTION_LINES = 82;

/** 見出しで区切った 10 のセクションを持ち、画面の高さの 3 倍を超える Markdown */
function longDocument(): string {
  return Array.from({ length: SECTIONS }, (_, section) =>
    [
      `## セクション ${section + 1}`,
      "",
      ...Array.from({ length: 40 }, (_, paragraph) => [
        `${section + 1}-${paragraph + 1} 段落の本文です。`,
        "",
      ]).flat(),
    ].join("\n"),
  ).join("\n");
}

/** 閉じたセクションの番号（1 始まり） */
const CLOSED_SECTION = 8;

/** 長い文書の `CLOSED_SECTION` 番目のセクションを `<!-- section: closed -->` で閉じ、3 つの段落にした Markdown と、その見出し・最後の段落・次の見出しの行（0 始まり） */
function closedDocument(): {
  markdown: string;
  heading: number;
  lastParagraph: number;
  nextHeading: number;
} {
  const lines: string[] = [];
  let heading = -1;
  let lastParagraph = -1;
  let nextHeading = -1;
  for (let section = 1; section <= SECTIONS; section += 1) {
    if (section === CLOSED_SECTION) {
      heading = lines.length;
    }
    if (section === CLOSED_SECTION + 1) {
      nextHeading = lines.length;
    }
    lines.push(`## セクション ${section}`);
    if (section === CLOSED_SECTION) {
      lines.push("<!-- section: closed -->");
    }
    lines.push("");
    const paragraphs = section === CLOSED_SECTION ? 3 : 40;
    for (let paragraph = 1; paragraph <= paragraphs; paragraph += 1) {
      if (section === CLOSED_SECTION) {
        lastParagraph = lines.length;
      }
      lines.push(`${section}-${paragraph} 段落の本文です。`, "");
    }
  }
  return { markdown: lines.join("\n"), heading, lastParagraph, nextHeading };
}

/** 狭い幅の帯とみなす右側の目次の高さの上限（px） */
const BAND_MAX_HEIGHT = 120;

/** `n` 番目のセクション（1 始まり）の見出しの行（0 始まり） */
function headingLine(n: number): number {
  return (n - 1) * SECTION_LINES;
}

/** 長い文書をエディタと横の列のプレビューで開く */
async function openLong(): Promise<{
  editor: vscode.TextEditor;
  record: RecordedPanel;
}> {
  await writeFixture("long.md", longDocument());
  const editor = await openMarkdown("long.md");
  await vscode.commands.executeCommand("mdmark.openPreviewToSide");
  const record = lastPanel();
  await waitForRendered(record);
  // 開いた直後の位置合わせが落ち着くまで待つ
  await sleep(500);
  return { editor, record };
}

/** 先頭の行 */
function visibleStart(editor: vscode.TextEditor): number {
  return editor.visibleRanges[0]?.start.line ?? 0;
}

/** 最後に送信した `scrollToLine` の行 */
function lastScrollLine(record: RecordedPanel): number | undefined {
  const sent = record.sent
    .filter((message) => message.type === "scrollToLine")
    .at(-1);
  return sent?.type === "scrollToLine" ? sent.line : undefined;
}

/** `line` 以前で最も後ろから始まるブロック */
async function blockAt(line: number) {
  const blocks = (await inspect("[data-source-line]"))
    .map((item) => ({
      ...item,
      source: Number(item.attributes["data-source-line"]),
    }))
    .filter((item) => item.source <= line);
  return blocks.sort((x, y) => y.source - x.source)[0];
}

/** 狭い幅で右側の目次を上端の帯にしているときの、帯の下端（帯が無いときは 0） */
async function bandBottom(): Promise<number> {
  const [aside] = await inspect(".mdmark-side-toc");
  // 広い幅の右の列は画面の高さいっぱいの縦長で、帯は 1 行分の高さ
  return aside !== undefined && aside.height < BAND_MAX_HEIGHT
    ? aside.top + aside.height
    : 0;
}

/** `scrollToLine` を送信した数 */
function scrollCount(record: RecordedPanel): number {
  return record.sent.filter((message) => message.type === "scrollToLine")
    .length;
}

suite("エディタとプレビューのスクロールを合わせる", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // エディタを動かすと、その行のブロックをプレビューの先頭に配置し、エディタをもう一度動かさない
  test("test_normal", async () => {
    // 準備
    const { editor, record } = await openLong();
    const before = scrollCount(record);
    // 実行: 8 番目のセクションの見出しの行をエディタの先頭にする
    const line = headingLine(8);
    editor.revealRange(
      new vscode.Range(line, 0, line, 0),
      vscode.TextEditorRevealType.AtTop,
    );
    // 検証
    await waitFor(() => scrollCount(record) > before, {
      message: "scrollToLine が送信されない",
    });
    const start = await settledStart(editor);
    await waitFor(() => lastScrollLine(record) === start, {
      message: "止まった先頭の行を送信していない",
    });
    // 先頭の行を含むブロックが、プレビューの先頭（狭い幅の帯があればその下端）に来る
    await waitFor(
      async () => {
        const block = await blockAt(start);
        const inset = await bandBottom();
        return (
          block !== undefined &&
          block.top - inset <= 5 &&
          block.top + block.height > inset
        );
      },
      { message: "ブロックがプレビューの先頭に来ない" },
    );
    await sleep(300);
    assert.strictEqual(visibleStart(editor), start);
  });

  // プレビューを動かすと、そのブロックの行をエディタの先頭にする
  test("test_normal_when_from_preview", async () => {
    // 準備
    const { editor, record } = await openLong();
    const selection = editor.selection;
    const before = scrollCount(record);
    // 実行: 5 番目のセクションの見出しを先頭までスクロールしたことにする
    const line = headingLine(5);
    deliver(record, { type: "revealLine", line });
    // 検証
    await waitFor(() => Math.abs(visibleStart(editor) - line) <= 6, {
      message: "エディタが動かない",
    });
    assert.ok(
      line - visibleStart(editor) >= 0 || visibleStart(editor) - line <= 6,
    );
    await sleep(300);
    assert.strictEqual(scrollCount(record), before);
    assert.deepStrictEqual(
      [editor.selection.active.line, editor.selection.active.character],
      [selection.active.line, selection.active.character],
    );
  });

  // 設定で切った向きは動かさない
  test("test_normal_when_sync_off", async () => {
    // 準備
    await setSetting("preview.scrollPreviewWithEditor", false);
    await setSetting("preview.scrollEditorWithPreview", false);
    const { editor, record } = await openLong();
    await sleep(1000);
    const top = (await inspect("h2")).find((item) =>
      item.text.includes("セクション 1"),
    )?.top;
    const line = headingLine(8);
    // 実行
    editor.revealRange(
      new vscode.Range(line, 0, line, 0),
      vscode.TextEditorRevealType.AtTop,
    );
    await waitFor(() => visibleStart(editor) > 0);
    const start = await settledStart(editor);
    deliver(record, { type: "revealLine", line: headingLine(3) });
    await sleep(700);
    // 検証
    assert.strictEqual(scrollCount(record), 0);
    assert.strictEqual(
      (await inspect("h2")).find((item) => item.text.includes("セクション 1"))
        ?.top,
      top,
    );
    assert.strictEqual(visibleStart(editor), start);
  });

  // エディタを閉じたセクションの中の行へ動かすと、そのセクションの見出しを先頭に配置し、セクションは閉じたまま
  test("test_normal_when_in_closed_section", async () => {
    // 準備: 8 番目のセクションを閉じた長い文書をエディタと横の列のプレビューで開く
    const { markdown, heading, lastParagraph, nextHeading } = closedDocument();
    await writeFixture("closed.md", markdown);
    const editor = await openMarkdown("closed.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    await sleep(500);
    const before = scrollCount(record);
    // 実行: 8 番目のセクションの 3 つ目の段落の行をエディタの先頭にする
    editor.revealRange(
      new vscode.Range(lastParagraph, 0, lastParagraph, 0),
      vscode.TextEditorRevealType.AtTop,
    );
    await waitFor(() => scrollCount(record) > before, {
      message: "scrollToLine が送信されない",
    });
    const start = await settledStart(editor);
    assert.ok(
      start > heading && start < nextHeading,
      `先頭の行 ${start} が閉じたセクションの中（${heading} より後で ${nextHeading} より前）に無い`,
    );
    await waitFor(() => lastScrollLine(record) === start, {
      message: "止まった先頭の行を送信していない",
    });
    // 検証: 8 番目の見出しが見えている先頭にかかり、9 番目の見出しは先頭より下にある
    const placed = async (): Promise<boolean> => {
      const headings = await inspect("h2");
      const closed = headings.find((item) =>
        item.text.includes(`セクション ${CLOSED_SECTION}`),
      );
      const next = headings.find((item) =>
        item.text.includes(`セクション ${CLOSED_SECTION + 1}`),
      );
      const [paragraph] = await inspect("p[data-source-line]");
      const inset = await bandBottom();
      return (
        closed !== undefined &&
        next !== undefined &&
        paragraph !== undefined &&
        closed.top + closed.height > inset &&
        closed.top <= inset + paragraph.height &&
        next.top > inset
      );
    };
    await waitFor(placed, {
      message: "閉じたセクションの見出しが見えている先頭に来ない",
    });
    const expanded = async (): Promise<string | undefined> =>
      (await inspect("button.mdmark-section-toggle")).find((item) =>
        item.text.includes(`セクション ${CLOSED_SECTION}`),
      )?.attributes["aria-expanded"];
    assert.strictEqual(await expanded(), "false");
    // 実行: 3 つ目の段落に文字を入力する
    const rendered = renders(record).length;
    await editor.edit((builder) =>
      builder.insert(new vscode.Position(lastParagraph, 0), "追記"),
    );
    await waitFor(() => renders(record).length > rendered, {
      message: "書き換えた Markdown を描き直さない",
    });
    await sleep(500);
    // 検証: 描き直した後も同じ位置の関係で、セクションは閉じたまま、エディタは動かない
    assert.ok(await placed(), "描き直した後に見出しの位置がずれた");
    assert.strictEqual(await expanded(), "false");
    const after = visibleStart(editor);
    await sleep(200);
    assert.strictEqual(visibleStart(editor), after);
    assert.strictEqual(after, start);
  });

  // 同じ列に開いてエディタが隠れているときは、エディタをもう一度開かない
  test("test_error_when_editor_hidden", async () => {
    // 準備: 長い文書を同じ列に開く
    await writeFixture("long.md", longDocument());
    await openMarkdown("long.md");
    await vscode.commands.executeCommand("mdmark.openPreview");
    const record = lastPanel();
    await waitForRendered(record);
    await waitFor(() => vscode.window.visibleTextEditors.length === 0, {
      message: "エディタが背面に回らない",
    });
    // 実行
    deliver(record, { type: "revealLine", line: headingLine(4) });
    await sleep(700);
    // 検証
    const active = vscode.window.tabGroups.activeTabGroup.activeTab;
    assert.ok(active?.input instanceof vscode.TabInputWebview);
    assert.strictEqual(vscode.window.visibleTextEditors.length, 0);
  });
});
