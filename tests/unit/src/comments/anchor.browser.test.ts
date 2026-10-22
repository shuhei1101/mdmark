import { afterEach, expect, test } from "vitest";
import { loadSource } from "../../helpers/lazy.ts";

/** 範囲から下書きを作る処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAnchor = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/comments/anchor.ts")>(
      "../../../../src/comments/anchor.ts",
    ),
  );

const roots: HTMLElement[] = [];

/** HTML を入れた範囲の要素をページに置く */
function createRoot(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  roots.push(root);
  return root;
}

/** 要素の最初の文字の節の、始まりと終わりの位置の間を選んだ範囲 */
function selectText(root: HTMLElement, start: number, end: number): Range {
  const textNode = root.querySelector("p")?.firstChild;
  if (textNode === null || textNode === undefined) {
    throw new Error("段落の文字が無い");
  }
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  return range;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    root.remove();
  }
});

// 前後 32 文字までを取る（正常系）
test("test_draft_from_range", async () => {
  // 準備
  const { draftFromRange } = await loadAnchor();
  const before = "0123456789".repeat(4);
  const after = "ABCDEFGHIJ";
  const root = createRoot(`<p>${before}導入の手順${after}</p>`);
  const range = selectText(root, 40, 45);
  // 実行
  const draft = draftFromRange({ root, range, body: "手順の数を 3 にする" });
  // 検証
  expect(draft).toEqual({
    quote: "導入の手順",
    prefix: before.slice(-32),
    suffix: after,
    body: "手順の数を 3 にする",
  });
});

// 選んだ文字の前後の空白を落とす（正常系）
test("test_draft_from_range_when_spaces", async () => {
  // 準備
  const { draftFromRange } = await loadAnchor();
  const root = createRoot("<p>導入の 手順 を整える。</p>");
  const range = selectText(root, 3, 7);
  // 実行
  const draft = draftFromRange({ root, range, body: "  本文  " });
  // 検証
  expect(draft.quote).toBe("手順");
  expect(draft.prefix.endsWith(" ")).toBe(true);
  expect(draft.suffix.startsWith(" ")).toBe(true);
  expect(draft.body).toBe("本文");
});

// 前後の文字の外側の空白（ブロックの間の改行）を落とす（正常系）
test("test_draft_from_range_when_block_end", async () => {
  // 準備
  const { draftFromRange } = await loadAnchor();
  const root = createRoot("\n<p>先頭で選ぶ。</p>\n");
  const range = selectText(root, 0, 2);
  // 実行
  const draft = draftFromRange({ root, range, body: "本文" });
  // 検証
  expect(draft.quote).toBe("先頭");
  expect(draft.prefix).toBe("");
  expect(draft.suffix).toBe("で選ぶ。");
});

// コードとビューの操作の文字を除く（正常系）
test("test_comment_text", async () => {
  // 準備
  const { commentText } = await loadAnchor();
  const root = createRoot(
    '<p>段落の文字</p><code>コードの文字</code><div class="mdmark-view-switch">切り替えの文字</div>',
  );
  // 実行
  const { text } = commentText(root);
  // 検証
  expect(text).toBe("段落の文字");
});
