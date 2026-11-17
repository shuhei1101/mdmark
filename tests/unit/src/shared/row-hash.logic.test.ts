import { expect, test } from "vitest";

/** URL の `#` の読み込みを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLogic = () => import("../../../../src/shared/row-hash.logic.ts");

// 最後の # の後ろを戻した文字を返却する（正常系）
test("test_row_id_from_hash", async () => {
  // 準備
  const { rowIdFromHash } = await loadLogic();
  // 実行
  const ids = [
    "#%E3%81%BF%E3%81%8B%E3%82%93",
    "#/a.md#%E3%81%BF%E3%81%8B%E3%82%93",
    "#%E3%81",
    "",
  ].map((hash) => rowIdFromHash(hash));
  // 検証
  expect(ids).toEqual(["みかん", "みかん", "%E3%81", ""]);
});
