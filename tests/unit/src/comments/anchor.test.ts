import { expect, test } from "vitest";

/** コメントの箇所を探す処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAnchor = () => import("../../../../src/comments/anchor.ts");

/** 「手順」が 2 か所ある本文 */
const TEXT = "導入の手順を整える。次に実行の手順を確認する。";

/** 本文の中の「手順」の 2 か所目の始まりの位置 */
const SECOND = TEXT.lastIndexOf("手順");

/** `quote` が「手順」のコメント */
function comment(id: string, prefix: string, suffix: string) {
  return { id, quote: "手順", prefix, suffix, body: `本文 ${id}` };
}

// 前後の文字で箇所を決める（正常系）
test("test_locate_comments", async () => {
  // 準備
  const { locateComments } = await loadAnchor();
  const target = comment("c1", "次に実行の", "を確認する。");
  // 実行
  const { anchors, orphans } = locateComments({
    text: TEXT,
    comments: [target],
  });
  // 検証
  expect(anchors).toEqual([
    { start: SECOND, end: SECOND + 2, comments: [target] },
  ]);
  expect(orphans).toEqual([]);
});

// 前後が変わっても 1 か所だけなら付く（正常系）
test("test_locate_comments_when_context_changed", async () => {
  // 準備
  const { locateComments } = await loadAnchor();
  const text = "導入の手順を整える。";
  const target = comment("c1", "書き換わった前", "書き換わった後");
  // 実行
  const { anchors, orphans } = locateComments({ text, comments: [target] });
  // 検証
  const start = text.indexOf("手順");
  expect(anchors).toEqual([{ start, end: start + 2, comments: [target] }]);
  expect(orphans).toEqual([]);
});

// 前後が合わず 2 か所あると見つからないにする（正常系）
test("test_locate_comments_when_ambiguous", async () => {
  // 準備
  const { locateComments } = await loadAnchor();
  const target = comment("c1", "書き換わった前", "書き換わった後");
  // 実行
  const { anchors, orphans } = locateComments({
    text: TEXT,
    comments: [target],
  });
  // 検証
  expect(anchors).toEqual([]);
  expect(orphans).toEqual([target]);
});

// 同じ箇所のコメントをまとめる（正常系）
test("test_locate_comments_when_same_place", async () => {
  // 準備
  const { locateComments } = await loadAnchor();
  const first = comment("c1", "次に実行の", "を確認する。");
  const second = comment("c2", "次に実行の", "を確認する。");
  // 実行
  const { anchors, orphans } = locateComments({
    text: TEXT,
    comments: [first, second],
  });
  // 検証
  expect(anchors).toEqual([
    { start: SECOND, end: SECOND + 2, comments: [first, second] },
  ]);
  expect(orphans).toEqual([]);
});
