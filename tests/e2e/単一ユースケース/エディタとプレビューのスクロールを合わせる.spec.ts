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

/** `n` 番目のセクション（1 始まり）の見出しの行（エディタの行番号。1 始まり） */
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

/** プレビューの `n` 番目のセクションの見出し（元の行番号で選ぶ。「セクション 1」は「セクション 10」にも該当するため）。`removedLines` は、見出しより前で削除した行数 */
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

/** プレビューの `n` 番目のセクションの見出しの、見えている先頭（右側の目次が上端の帯のときは帯の下端）からの位置 */
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

// エディタをスクロールすると、その行のブロックをプレビューの先頭に配置し、エディタをもう一度動かさない（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const session = await e2e.launch({ files: { "long.md": longDocument() } });
  const frame = await openLong(session);
  // 実行: 8 番目のセクションの見出しの行をエディタの先頭にする
  const top = await scrollEditorTo(session, headingLine(8));
  // 検証
  // 行の位置は、見出しと次のブロックの間を行の割合で内分する。エディタの先頭の行が 1〜2 行ずれても、見出しは先頭の付近に出る
  await expect
    .poll(async () => Math.abs(await headingTop(frame, 8)))
    .toBeLessThan(MAX_HEADING_OFFSET);
  await session.win.waitForTimeout(500);
  expect(await session.editorTopLine()).toBe(top);
});

// プレビューをスクロールすると、そのブロックの行をエディタの先頭に配置する（正常シナリオ（プレビューから合わせる））
test("test_normal_when_from_preview", async () => {
  // 準備
  const session = await e2e.launch({ files: { "long.md": longDocument() } });
  const frame = await openLong(session);
  // 実行: 5 番目のセクションの見出しが先頭に来るまでプレビューをスクロールする
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

// 差分ビューの変更後の側で削除する 3 番目のセクションの最初の段落（本文 1 行と空行 1 行）
const REMOVED_PARAGRAPH = "3-1 段落の本文です。\n\n";
const REMOVED_LINES = 2;

// 差分で描いたプレビューでも、変更後の側とプレビューのスクロールを元の行番号で合わせる（正常シナリオ（差分で描いたプレビュー））
test("test_normal_when_diff_preview", async () => {
  // 準備: 長い文書の 3 番目のセクションの最初の段落を削除した差分ビューから、差分で描いたプレビューを開く
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
  // 実行: 変更後の側を 8 番目のセクションの見出しの行までスクロールする（変更後の側では削除した行数だけ前にある）
  const line = headingLine(8) - REMOVED_LINES;
  await scrollModifiedTo(session, line);
  // 検証: プレビューの見えている先頭に 8 番目のセクションの見出しが来る
  await expect
    .poll(async () => Math.abs(await headingTop(frame, 8, REMOVED_LINES)))
    .toBeLessThan(MAX_HEADING_OFFSET);
  // 実行: 5 番目のセクションの見出しが先頭に来るまでプレビューをスクロールする
  await heading(frame, 5, REMOVED_LINES).evaluate((element) =>
    element.scrollIntoView(),
  );
  // 検証: 変更後の側の見えている先頭の行が 5 番目のセクションの見出しの行になる
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

/** 閉じるセクションの番号（1 始まり） */
const CLOSED_SECTION = 8;

/** 長い文書の `CLOSED_SECTION` 番目のセクションを `<!-- section: closed -->` で閉じ、3 つの段落にした Markdown と、その見出し・最後の段落・次の見出しの行（エディタの行番号。1 始まり） */
function closedDocument(): {
  markdown: string;
  heading: number;
  lastParagraph: number;
  nextHeading: number;
} {
  const lines: string[] = [];
  let heading = 0;
  let lastParagraph = 0;
  let nextHeading = 0;
  for (let section = 1; section <= SECTIONS; section += 1) {
    if (section === CLOSED_SECTION) {
      heading = lines.length + 1;
    }
    if (section === CLOSED_SECTION + 1) {
      nextHeading = lines.length + 1;
    }
    lines.push(`## 節 ${section}`);
    if (section === CLOSED_SECTION) {
      lines.push("<!-- section: closed -->");
    }
    lines.push("");
    const paragraphs = section === CLOSED_SECTION ? 3 : 40;
    for (let paragraph = 1; paragraph <= paragraphs; paragraph += 1) {
      if (section === CLOSED_SECTION) {
        lastParagraph = lines.length + 1;
      }
      lines.push(`${section}-${paragraph} 段落の本文です。`, "");
    }
  }
  return { markdown: lines.join("\n"), heading, lastParagraph, nextHeading };
}

/** 閉じたセクションの見出しが見えている先頭にかかり、本文 1 行分（最初の段落の高さ）より下へ離れておらず、次の見出しが先頭より下にあるか */
function closedHeadingPlaced(
  frame: Frame,
  heading: number,
  nextHeading: number,
): Promise<boolean> {
  return frame.evaluate(
    ([closedLine, nextLine]) => {
      const closed = document.querySelector(
        `h2[data-source-line="${closedLine}"]`,
      );
      const next = document.querySelector(`h2[data-source-line="${nextLine}"]`);
      const paragraph = document.querySelector("p[data-source-line]");
      if (!closed || !next || !paragraph) {
        return false;
      }
      const aside = document.querySelector(".mdmark-side-toc");
      const content = document.querySelector(".mdmark-content");
      const inset =
        aside &&
        content &&
        aside.getBoundingClientRect().width >=
          content.getBoundingClientRect().width
          ? aside.getBoundingClientRect().bottom
          : 0;
      const rect = closed.getBoundingClientRect();
      return (
        rect.bottom > inset &&
        rect.top <= inset + paragraph.getBoundingClientRect().height &&
        next.getBoundingClientRect().top > inset
      );
    },
    [heading - 1, nextHeading - 1],
  );
}

// 閉じたセクションの中を編集しても、プレビューはそのセクションの見出しの辺りに追従し、セクションを開かない（正常シナリオ（折りたたんだセクションの中を編集する））
test("test_normal_when_in_closed_section", async () => {
  // 準備: 8 番目のセクションを閉じた長い文書をエディタと横の列のプレビューで開く
  const { markdown, heading, lastParagraph, nextHeading } = closedDocument();
  const session = await e2e.launch({ files: { "closed.md": markdown } });
  await session.openFile("closed.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h2");
  await expect(frame.locator("h2")).toHaveCount(SECTIONS);
  // 開いた直後の位置合わせが落ち着くまで待つ
  await session.win.waitForTimeout(500);
  await session.focusEditor();
  // 実行: 8 番目のセクションの 3 つ目の段落の行までエディタをスクロールする
  const top = await scrollEditorTo(session, lastParagraph);
  expect(top).toBeGreaterThan(heading);
  expect(top).toBeLessThan(nextHeading);
  // 検証: 8 番目の見出しが見えている先頭の辺りに来て、セクションは閉じたまま
  await expect
    .poll(() => closedHeadingPlaced(frame, heading, nextHeading))
    .toBe(true);
  const toggle = frame.locator(
    `h2[data-source-line="${heading - 1}"] .mdmark-section-toggle`,
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // 実行: 3 つ目の段落の行の先頭に文字を入力する
  await session.win.keyboard.press("Control+G");
  await session.win.keyboard.type(String(lastParagraph));
  await session.win.keyboard.press("Enter");
  await session.win.keyboard.press("Home");
  await session.win.keyboard.type("追記");
  // 検証: 描き直した後も同じ位置の関係で、セクションは閉じたまま、エディタは動かない
  await expect(
    frame.locator(`p[data-source-line="${lastParagraph - 1}"]`),
  ).toContainText("追記");
  await session.win.waitForTimeout(500);
  expect(await closedHeadingPlaced(frame, heading, nextHeading)).toBe(true);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await session.editorTopLine()).toBe(top);
});
