import { expect, test } from "vitest";

/** 差分ビューの対象を決める処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiffTarget = () =>
  import("../../../../../vscode/src/preview/diff-target.ts");

// 差分ビューの変更前・変更後
const DIFF_TAB = { original: "git:/a.md", modified: "file:///a.md" };

// 差分ビューでは uri が無いか、どちらかの側と同じなら対象にする（正常系）
test("test_pick_diff_target", async () => {
  // 準備
  const { pickDiffTarget } = await loadDiffTarget();
  const uris = [undefined, "file:///a.md", "git:/a.md"];
  // 実行
  const targets = uris.map((uri) => pickDiffTarget({ tab: DIFF_TAB, uri }));
  // 検証
  expect(targets).toEqual([DIFF_TAB, DIFF_TAB, DIFF_TAB]);
});

// 差分ビューでないか、別の文書の uri なら対象にしない（正常系）
test("test_pick_diff_target_when_not_diff", async () => {
  // 準備
  const { pickDiffTarget } = await loadDiffTarget();
  // 実行
  const notDiff = pickDiffTarget({ tab: undefined, uri: "file:///a.md" });
  const otherDocument = pickDiffTarget({ tab: DIFF_TAB, uri: "file:///b.md" });
  // 検証
  expect(notDiff).toBeUndefined();
  expect(otherDocument).toBeUndefined();
});

// 差分のパネルは変更前と変更後の組でキーを作る（正常系）
test("test_panel_key", async () => {
  // 準備
  const { panelKey } = await loadDiffTarget();
  // 実行
  const normal = panelKey({ uri: "file:///a.md" });
  const diff = panelKey({ uri: "file:///a.md", original: "git:/a.md" });
  // 検証
  expect(normal).toBe("file:///a.md");
  expect(diff).toBe("diff:git:/a.md|file:///a.md");
});
