import { expect, test } from "vitest";

/** アイコンの形を集める処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadIcons = () => import("../../../../src/cli/icons.ts");

// 束ねていない名前の形だけを取り出す（正常系）
test("test_collect_icon_nodes", async () => {
  // 準備
  const { collectIconNodes } = await loadIcons();
  const markdowns = [
    "`icon:sailboat` と `icon:flag`",
    "`icon:no-such-icon` と `icon:sailboat`",
  ];
  // 実行
  const result = collectIconNodes(markdowns);
  // 検証
  expect(Object.keys(result.icons)).toEqual(["sailboat"]);
  expect(result.icons.sailboat?.[0]?.[0]).toBe("path");
  expect(result.missing).toEqual(["no-such-icon"]);
});
