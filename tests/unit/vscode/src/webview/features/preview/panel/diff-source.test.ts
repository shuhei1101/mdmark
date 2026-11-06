import { expect, test } from "vitest";

/** 差分の取り出し元を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiffSource = () =>
  import(
    "../../../../../../../../vscode/src/webview/features/preview/panel/diff-source.ts"
  );

// 呼ばれた時点の全文を返す（正常系）
test("test_create_diff_source", async () => {
  // 準備
  const { createDiffSource } = await loadDiffSource();
  const texts = { modified: "A2", original: "A1" };
  const source = createDiffSource(texts);
  // 実行
  texts.modified = "A3";
  const revisions = await source.revisions("diff");
  const modified = await source.content({
    docId: "diff",
    revisionId: "modified",
  });
  const original = await source.content({
    docId: "diff",
    revisionId: "original",
  });
  const otherRejected = await source
    .content({ docId: "diff", revisionId: "other" })
    .then(
      () => false,
      () => true,
    );
  // 検証
  expect(revisions.map((revision) => revision.id)).toEqual([
    "modified",
    "original",
  ]);
  expect(
    revisions.every((revision) => !Number.isNaN(Date.parse(revision.at))),
  ).toBe(true);
  expect(modified).toBe("A3");
  expect(original).toBe("A1");
  expect(otherRejected).toBe(true);
});
