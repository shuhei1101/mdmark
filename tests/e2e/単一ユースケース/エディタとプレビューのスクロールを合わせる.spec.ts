import { expect, type Frame, test } from "@playwright/test";
import {
  longDocument,
  SECTION_LINES,
  SECTIONS,
  scrollEditorTo,
  useVscodeE2E,
  type VscodeSession,
} from "../vscode.ts";
import {
  modifiedTopLine,
  openDiffPreview,
  openWorkingTreeDiff,
  prepareDiffRepo,
  scrollModifiedTo,
} from "../vscode-diff.ts";

const e2e = useVscodeE2E();

// 見出しが先頭に来ているとみなす、見えている範囲の先頭からのずれ（px）
const MAX_HEADING_OFFSET = 70;

/** `n` 番目の節（1 始まり）の見出しの行（エディタの行番号。1 始まり） */
function headingLine(n: number): number {
  return (n - 1) * SECTION_LINES + 1;
}

/** 長い文書をエディタと横の列のプレビューで開き、描き終えるまで待つ */
async function openLong(session: VscodeSession): Promise<Frame> {
  await session.openFile("long.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h2");
  await expect(frame.locator("h2")).toHaveCount(SECTIONS);
  // 開いた直後の位置合わせが落ち着くまで待つ
  await session.win.waitForTimeout(500);
  await session.focusEditor();
  return frame;
}

/** プレビューの `n` 番目の節の見出し（元の行番号で選ぶ。「節 1」は「節 10」にも当たるため）。`removedLines` は、見出しより前で消した行数 */
function heading(frame: Frame, n: number, removedLines = 0) {
  return frame.locator(
    `h2[data-source-line="${headingLine(n) - 1 - removedLines}"]`,
  );
}

/** 狭い幅で右側の目次を上端の帯にしているときの、帯の下端（帯が無いときは 0） */
function bandBottom(frame: Frame): Promise<number> {
  return frame.evaluate(() => {
    const aside = document.querySelector(".mdmark-side-toc");
    const content = document.querySelector(".mdmark-content");
    if (
      !aside ||
      !content ||
      aside.getBoundingClientRect().width <
        content.getBoundingClientRect().width
    ) {
      return 0;
    }
    return aside.getBoundingClientRect().bottom;
  });
}

/** プレビューの `n` 番目の節の見出しの、見えている先頭（右側の目次が上端の帯のときは帯の下端）からの位置 */
async function headingTop(
  frame: Frame,
  n: number,
  removedLines = 0,
): Promise<number> {
  const top = await heading(frame, n, removedLines).evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  return top - (await bandBottom(frame));
}

// エディタをスクロールすると、その行のブロックをプレビューの先頭に置き、エディタを動かし直さない（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const session = await e2e.launch({ files: { "long.md": longDocument() } });
  const frame = await openLong(session);
  // 実行: 8 番目の節の見出しの行をエディタの先頭にする
  const top = await scrollEditorTo(session, headingLine(8));
  // 検証
  // 行の位置は、見出しと次のブロックの間を行の割合で内分する。エディタの先頭の行が 1〜2 行ずれても、見出しは先頭の付近に出る
  await expect
    .poll(async () => Math.abs(await headingTop(frame, 8)))
    .toBeLessThan(MAX_HEADING_OFFSET);
  await session.win.waitForTimeout(500);
  expect(await session.editorTopLine()).toBe(top);
});

// プレビューをスクロールすると、そのブロックの行をエディタの先頭に置く（正常シナリオ（プレビューから合わせる））
test("test_normal_when_from_preview", async () => {
  // 準備
  const session = await e2e.launch({ files: { "long.md": longDocument() } });
  const frame = await openLong(session);
  // 実行: 5 番目の節の見出しが先頭に来るまでプレビューをスクロールする
  await heading(frame, 5).evaluate((element) => element.scrollIntoView());
  // 検証
  await expect
    .poll(async () =>
      Math.abs((await session.editorTopLine()) - headingLine(5)),
    )
    .toBeLessThanOrEqual(1);
});

// 同期を切ると、片方を動かしてももう片方は動かない（正常シナリオ（同期を切る））
test("test_normal_when_sync_off", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "long.md": longDocument() },
    settings: {
      "mdmark.preview.scrollPreviewWithEditor": false,
      "mdmark.preview.scrollEditorWithPreview": false,
    },
  });
  const frame = await openLong(session);
  const before = await headingTop(frame, 1);
  // 実行: エディタをスクロールする
  const top = await scrollEditorTo(session, headingLine(8));
  await session.win.waitForTimeout(1000);
  // 検証: プレビューは動かない
  expect(await headingTop(frame, 1)).toBe(before);
  // 実行: プレビューをスクロールする
  await heading(frame, 3).evaluate((element) => element.scrollIntoView());
  await session.win.waitForTimeout(1000);
  // 検証: エディタは動かない
  expect(await session.editorTopLine()).toBe(top);
});

// 差分ビューの変更後の側で消す 3 番目の節の最初の段落（本文 1 行と空行 1 行）
const REMOVED_PARAGRAPH = "3-1 段落の本文です。\n\n";
const REMOVED_LINES = 2;

// 差分で描いたプレビューでも、変更後の側とプレビューのスクロールを元の行番号で合わせる（正常シナリオ（差分で描いたプレビュー））
test("test_normal_when_diff_preview", async () => {
  // 準備: 長い文書の 3 番目の節の最初の段落を消した差分ビューから、差分で描いたプレビューを開く
  const before = longDocument();
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({
      before,
      after: before.replace(REMOVED_PARAGRAPH, ""),
    }),
  });
  await openWorkingTreeDiff(session);
  await openDiffPreview(session);
  const frame = await session.frameWith("h2");
  await expect(frame.locator("h2")).toHaveCount(SECTIONS);
  // 開いた直後の位置合わせが落ち着くまで待つ
  await session.win.waitForTimeout(500);
  // 実行: 変更後の側を 8 番目の節の見出しの行までスクロールする（変更後の側では消した行数だけ前にある）
  const line = headingLine(8) - REMOVED_LINES;
  await scrollModifiedTo(session, line);
  // 検証: プレビューの見えている先頭に 8 番目の節の見出しが来る
  await expect
    .poll(async () => Math.abs(await headingTop(frame, 8, REMOVED_LINES)))
    .toBeLessThan(MAX_HEADING_OFFSET);
  // 実行: 5 番目の節の見出しが先頭に来るまでプレビューをスクロールする
  await heading(frame, 5, REMOVED_LINES).evaluate((element) =>
    element.scrollIntoView(),
  );
  // 検証: 変更後の側の見えている先頭の行が 5 番目の節の見出しの行になる
  await expect
    .poll(async () =>
      Math.abs(
        (await modifiedTopLine(session)) - (headingLine(5) - REMOVED_LINES),
      ),
    )
    .toBeLessThanOrEqual(1);
  // 検証: 削除の色で差し込んだ段落は変更後の側の行を持たず、合わせる先にならない
  await expect(
    frame.locator('div.mdmark-diff-block[data-kind="del"] [data-source-line]'),
  ).toHaveCount(0);
});
