import { expect, test } from "vitest";
import { SEQUENCE } from "../../helpers/map.ts";

/** シーケンス図の行を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRows = () => import("../../../../src/map/sequence-rows.ts");
const loadSequence = () => import("../../../../src/map/sequence.ts");

/** 見せ方で行を決める */
async function rows(view: { order?: string[]; collapsed?: number[]; entered?: number }) {
  const { sequenceRows } = await loadRows();
  const { parseSequence } = await loadSequence();
  const sequence = parseSequence(SEQUENCE);
  return sequenceRows(sequence, { order: view.order ?? sequence.participants.map((item) => item.id), collapsed: view.collapsed ?? [], entered: view.entered });
}

// 全体（正常系）
test("test_sequence_rows", async () => {
  // 準備・実行
  const result = await rows({});
  // 検証
  expect(result.rows.filter((row) => row.kind === "message")).toHaveLength(7);
  expect(result.participants).toEqual(["user", "mount", "marker", "mermaid", "layout"]);
});

// 閉じたブロック（正常系）
test("test_sequence_rows_when_collapsed", async () => {
  // 準備・実行
  const result = await rows({ collapsed: [2] });
  // 検証
  expect(result.rows.filter((row) => row.kind === "message")).toHaveLength(3);
  const closed = result.rows.filter((row) => row.kind === "collapsed");
  expect(closed).toHaveLength(1);
  expect(closed[0]).toMatchObject({ fragment: 2, count: 4 });
});

// 中だけを描く（正常系）
test("test_sequence_rows_when_entered", async () => {
  // 準備・実行
  const result = await rows({ entered: 1 });
  // 検証
  expect(result.rows.filter((row) => row.kind === "message")).toHaveLength(5);
  expect(result.participants).toEqual(["mount", "marker", "mermaid", "layout"]);
});

// 並び順（正常系）
test("test_sequence_rows_when_reordered", async () => {
  // 準備・実行
  const result = await rows({ order: ["user", "layout", "mount", "marker", "mermaid"] });
  // 検証
  expect(result.participants).toEqual(["user", "layout", "mount", "marker", "mermaid"]);
});
