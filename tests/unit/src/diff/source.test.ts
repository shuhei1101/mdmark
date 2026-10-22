import { expect, test } from "vitest";

/** 取り出し元の値の検査を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSource = () => import("../../../../src/diff/source.ts");

// 形が合う一覧をそのまま返す（正常系）
test("test_check_revisions", async () => {
  // 準備
  const { checkRevisions } = await loadSource();
  const revisions = [
    {
      id: "r2",
      at: "2026-10-19T07:40:00Z",
      label: "件数を直す",
      author: "鈴木",
    },
    { id: "r1", at: "2026-10-18T00:12:00Z" },
  ];
  // 実行
  const result = checkRevisions(revisions);
  // 検証
  expect(result).toEqual(revisions);
  expect(result.map((revision) => revision.id)).toEqual(["r2", "r1"]);
});

// 配列でなければ投げる（異常系）
test("test_check_revisions_when_not_array", async () => {
  // 準備
  const { checkRevisions } = await loadSource();
  // 実行・検証
  expect(() => checkRevisions({})).toThrow(TypeError);
});

// `at` が無い要素を拒む（異常系）
test("test_check_revisions_when_at_missing", async () => {
  // 準備
  const { checkRevisions } = await loadSource();
  // 実行・検証
  expect(() => checkRevisions([{ id: "r1" }])).toThrow(TypeError);
  expect(() => checkRevisions([{ id: "r1" }])).toThrow(/at/);
  expect(() => checkRevisions([{ id: "r1" }])).toThrow(/0/);
});

// `id` が重なる一覧を拒む（異常系）
test("test_check_revisions_when_id_duplicated", async () => {
  // 準備
  const { checkRevisions } = await loadSource();
  const revisions = [
    { id: "r1", at: "2026-10-19T07:40:00Z" },
    { id: "r1", at: "2026-10-18T00:12:00Z" },
  ];
  // 実行・検証
  expect(() => checkRevisions(revisions)).toThrow(TypeError);
});
