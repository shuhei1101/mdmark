import * as assert from "node:assert";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  closeRepositories,
  commitAll,
  createRepo,
  git,
  gitUri,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  modifiedEditor,
  openDiffView,
  openMarkdown,
  type RecordedPanel,
  readFixture,
  recordedPanels,
  renders,
  resetEnvironment,
  setSetting,
  settledStart,
  sleep,
  waitFor,
  waitForRendered,
  watchChildProcesses,
  writeFixture,
} from "./helpers.ts";

/** 変更前の `guide.md` */
const BEFORE_GUIDE =
  "# ガイド\n\n最初の段落です。\n\n古い手順を消します。\n\n最後の段落です。\n";

/** 変更後の `guide.md`: 2 番目の段落を共通する語の無い段落に入れ替える */
const AFTER_GUIDE =
  "# ガイド\n\n最初の段落です。\n\n表の列を増やす案をまとめました。\n\n最後の段落です。\n";

/** 追加・削除のブロックの選択子 */
const ADDED = 'div.mdmark-diff-block[data-kind="add"]';
const DELETED = 'div.mdmark-diff-block[data-kind="del"]';

/** テストごとに別のフォルダへリポジトリを作るための通し番号 */
let serial = 0;

/** 差分ビューを開いた状態 */
type DiffView = {
  /** リポジトリのフォルダの絶対パス */
  dir: string;
  /** 変更後の `guide.md` の URI（`file:`） */
  modified: vscode.Uri;
  /** リポジトリの `guide.md` の、ワークスペースからの相対パス */
  relative: string;
};

/** 見出しで区切った 10 の節を持つ長い Markdown。`edit` が `true` のとき、5 番目の節の最初の段落を消し、8 番目の節の末尾に段落を足す */
function longDocument(edit: boolean): string {
  return Array.from({ length: 10 }, (_, index) => {
    const section = index + 1;
    const paragraphs = Array.from(
      { length: 40 },
      (_, paragraph) => `${section}-${paragraph + 1} 段落の本文です。`,
    ).filter((text) => !(edit && section === 5 && text.startsWith("5-1 ")));
    if (edit && section === 8) {
      paragraphs.push("8-41 追加した段落です。");
    }
    return [`## 節 ${section}`, "", ...paragraphs.flatMap((p) => [p, ""])].join(
      "\n",
    );
  }).join("\n");
}

/** 新しいリポジトリに `before` をコミットして `guide.md` を置く。`after` があれば、作業ツリーの `guide.md` を `after` に書き換える（保存した状態でステージはしない） */
async function createDiffRepo(
  before: string,
  after?: string,
): Promise<DiffView> {
  serial += 1;
  const name = `diff-repo-${serial}`;
  const dir = await createRepo(name, { "guide.md": before });
  const relative = join(name, "guide.md");
  if (after !== undefined) {
    await writeFixture(relative, after);
  }
  return { dir, modified: vscode.Uri.file(join(dir, "guide.md")), relative };
}

/** 作業ツリーの変更の差分ビュー（変更前は `HEAD`、変更後は作業ツリーのファイル）を開き、プレビューを横に開いて最初の描画を待つ */
async function openWorkingTreePreview(view: DiffView): Promise<RecordedPanel> {
  await openDiffView(await gitUri(view.modified, "HEAD"), view.modified);
  await vscode.commands.executeCommand("mdmark.openPreviewToSide");
  const record = lastPanel();
  await waitForRendered(record);
  return record;
}

/** 変更後の側のエディタで、`line` の行を先頭にして、止まった先頭の行を返す。差分エディタでは `AtTop` が指定した行の手前に空ける行数が通常のエディタと違うため、`line` が先頭になるまで手前の行数を替えて試す */
async function revealAtTop(
  editor: vscode.TextEditor,
  line: number,
): Promise<number> {
  let start = -1;
  for (const offset of [4, 3, 5, 2, 1, 0]) {
    const target = line + offset;
    editor.revealRange(
      new vscode.Range(target, 0, target, 0),
      vscode.TextEditorRevealType.AtTop,
    );
    start = await settledStart(editor);
    if (start === line) {
      return start;
    }
  }
  return start;
}

/** 狭い幅の右側の目次を上端の帯にしているときの、帯の下端（帯が無いときは 0）。帯は 1 行分の高さで、広い幅の右の列は画面の高さいっぱいの縦長 */
async function bandBottom(): Promise<number> {
  const [aside] = await inspect(".mdmark-side-toc");
  return aside !== undefined && aside.height < 120
    ? aside.top + aside.height
    : 0;
}

/** 追加・削除のブロックが出るのを待つ */
async function waitForBlocks(selector: string): Promise<void> {
  await waitFor(async () => (await inspect(selector)).length > 0, {
    message: `${selector} が出ない`,
  });
}

/** `selector` に当たる要素の文字を並べて返す */
async function texts(selector: string): Promise<string[]> {
  return (await inspect(selector)).map((item) => item.text);
}

suite("差分ビューの変更をプレビューで見る", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(async () => {
    await closeRepositories();
    await resetEnvironment();
  });

  // 作業ツリーの差分ビューから開くと、変更後の文書のブロックを色分けした差分のパネルを開く
  test("test_normal_when_opened_from_diff_view", async () => {
    // 準備
    const view = await createDiffRepo(BEFORE_GUIDE, AFTER_GUIDE);
    const watcher = watchChildProcesses();
    try {
      // 実行
      const record = await openWorkingTreePreview(view);
      await waitForBlocks(DELETED);
      // 検証
      assert.strictEqual(record.options.showOptions, vscode.ViewColumn.Beside);
      assert.strictEqual(record.options.title, "差分プレビュー guide.md");
      const first = renders(record)[0];
      assert.strictEqual(first?.markdown, AFTER_GUIDE);
      assert.strictEqual(first?.previous, BEFORE_GUIDE);
      assert.strictEqual((await inspect(ADDED)).length, 1);
      assert.ok((await texts(ADDED))[0]?.includes("表の列を増やす案"));
      assert.strictEqual((await inspect(DELETED)).length, 1);
      assert.ok((await texts(DELETED))[0]?.includes("古い手順を消します"));
      assert.strictEqual((await inspect(".mdmark-diff-toggle")).length, 0);
      // 拡張機能は Git のコマンドを実行しない（子プロセスを作らない）
      assert.strictEqual(watcher.fromExtension(), 0);
    } finally {
      watcher.stop();
    }
    // 差分でない普通のエディタから開いたプレビューは、別のパネルになる
    await openMarkdown(view.relative);
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    assert.strictEqual(recordedPanels().length, 2);
    assert.strictEqual(lastPanel().options.title, "プレビュー guide.md");
  });

  // 両側が Git の URI のコミットの差分でも、両方の内容を読んで差分のパネルを開く
  test("test_normal_when_commit_diff", async () => {
    // 準備
    const view = await createDiffRepo(BEFORE_GUIDE, AFTER_GUIDE);
    const secondCommit = await commitAll(view.dir, "2 回目のコミット");
    const firstCommit = await git(view.dir, ["rev-parse", "HEAD~1"]);
    await openDiffView(
      await gitUri(view.modified, firstCommit),
      await gitUri(view.modified, secondCommit),
    );
    const watcher = watchChildProcesses();
    try {
      // 実行
      await vscode.commands.executeCommand("mdmark.openPreviewToSide");
      const record = lastPanel();
      await waitForRendered(record);
      await waitForBlocks(DELETED);
      // 検証
      assert.strictEqual(record.options.title, "差分プレビュー guide.md");
      const first = renders(record)[0];
      assert.strictEqual(first?.markdown, AFTER_GUIDE);
      assert.strictEqual(first?.previous, BEFORE_GUIDE);
      assert.strictEqual((await inspect(ADDED)).length, 1);
      assert.strictEqual((await inspect(DELETED)).length, 1);
      assert.strictEqual(watcher.fromExtension(), 0);
    } finally {
      watcher.stop();
    }
  });

  // 差分に対応しないバージョンを読んだときは、変更後の文書だけを描かず、理由とリロードを出す
  test("test_error_when_version_without_diff", async () => {
    // 準備
    await setSetting("version", "v0.8.0");
    const view = await createDiffRepo(BEFORE_GUIDE, AFTER_GUIDE);
    await openDiffView(await gitUri(view.modified, "HEAD"), view.modified);
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitFor(
      () => record.received.some((message) => message.type === "loadFailed"),
      { message: "loadFailed を受けていない" },
    );
    // 検証
    const failed = record.received.find(
      (message) => message.type === "loadFailed",
    );
    assert.strictEqual(
      failed?.type === "loadFailed" ? failed.reason : undefined,
      "diffUnsupported",
    );
    assert.ok(!record.received.some((message) => message.type === "rendered"));
    await waitFor(
      async () =>
        (await texts(".mdmark-preview-notice")).some((text) =>
          text.includes("v0.8.0"),
        ),
      { message: "描けない理由が出ない" },
    );
    const [notice] = await texts(".mdmark-preview-notice");
    assert.ok(notice?.includes("差分の表示に対応していません"));
    assert.strictEqual(
      (await inspect('button[data-action="reload"]')).length,
      1,
    );
    // 変更後の文書だけの表示を出さない
    assert.strictEqual((await inspect(".mdmark")).length, 0);
    assert.strictEqual((await inspect(".mdmark-diff-block")).length, 0);
    // Markdown と差分ビューは変わらない
    assert.strictEqual(await readFixture(view.relative), AFTER_GUIDE);
    assert.ok(
      vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .some((tab) => tab.input instanceof vscode.TabInputTextDiff),
    );
  });

  // 変更後の側を書き換えると、待ってから同じパネルを描き直し、色を当てたブロックは同じまま出る
  test("test_normal_when_diff_modified_side_edited", async () => {
    // 準備
    const view = await createDiffRepo(BEFORE_GUIDE, AFTER_GUIDE);
    const record = await openWorkingTreePreview(view);
    await waitForBlocks(DELETED);
    const addedBefore = await texts(ADDED);
    const deletedBefore = await texts(DELETED);
    const before = renders(record).length;
    // 実行: 変更後の側の末尾に段落を 1 つ書き足す（保存しない）
    const editor = modifiedEditor(view.modified);
    const end = editor.document.lineAt(editor.document.lineCount - 1).range.end;
    await editor.edit((builder) => {
      builder.insert(end, "\n新しく書き足した段落です。\n");
    });
    // 検証
    await waitFor(() => renders(record).length > before, {
      message: "再描画されない",
    });
    await sleep(600);
    const sent = renders(record).slice(before);
    assert.strictEqual(sent.length, 1);
    assert.ok(sent[0]?.markdown.includes("新しく書き足した段落です。"));
    assert.strictEqual(sent[0]?.previous, BEFORE_GUIDE);
    await waitFor(async () =>
      (await texts(ADDED)).some((text) => text.includes("新しく書き足した")),
    );
    const addedAfter = await texts(ADDED);
    assert.deepStrictEqual(
      addedAfter.slice(0, addedBefore.length),
      addedBefore,
    );
    assert.deepStrictEqual(await texts(DELETED), deletedBefore);
    assert.strictEqual(recordedPanels().length, 1);
  });

  // 差分のパネルは変更後の側のエディタと合わせ、削除したブロックを飛ばしてその行のブロックを先頭に置く
  test("test_normal_when_diff_preview", async function () {
    // 長い文書の差分の描画と、先頭の行が止まるまでの待ちに時間がかかる
    this.timeout(60000);
    // 準備
    const after = longDocument(true);
    const view = await createDiffRepo(longDocument(false), after);
    const record = await openWorkingTreePreview(view);
    await waitForBlocks(DELETED);
    await sleep(500);
    const editor = modifiedEditor(view.modified);
    const heading = after.split("\n").indexOf("## 節 8");
    const scrolls = () =>
      record.sent.filter((message) => message.type === "scrollToLine");
    const before = scrolls().length;
    // 実行: 変更後の側で 8 番目の節の見出しの行を先頭にする
    const start = await revealAtTop(editor, heading);
    // 検証
    await waitFor(() => scrolls().length > before, {
      message: "scrollToLine が送られない",
    });
    await waitFor(
      () => {
        const last = scrolls().at(-1);
        return last?.type === "scrollToLine" && last.line === start;
      },
      { message: "止まった先頭の行を送っていない" },
    );
    assert.strictEqual(start, heading);
    // 先頭の行のブロックが、プレビューの見えている先頭（狭い幅の帯があればその下端）から 1 行分の高さの中に来る
    await waitFor(
      async () => {
        const block = (await inspect(`[data-source-line="${start}"]`))[0];
        const inset = await bandBottom();
        return (
          block !== undefined &&
          block.top - inset <= block.height &&
          block.top + block.height > inset
        );
      },
      { message: "8 番目の節の見出しがプレビューの先頭に来ない" },
    );
    assert.ok(
      (await texts(`[data-source-line="${start}"]`))[0]?.includes("節 8"),
    );
    // 5 番目の節の削除したブロックは、行を持たず、合わせる先にならない
    assert.strictEqual((await inspect(DELETED)).length, 1);
    assert.strictEqual(
      (await inspect(`${DELETED}, ${DELETED} [data-source-line]`)).filter(
        (item) => "data-source-line" in item.attributes,
      ).length,
      0,
    );
  });
});
