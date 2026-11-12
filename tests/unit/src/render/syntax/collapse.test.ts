import { expect, test } from "vitest";

/** 折り畳みの指定の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCollapse = () =>
  import("../../../../../src/render/syntax/collapse.ts");

// 閉じた折り畳みと見出しを読み込む（正常系）
test("test_read_collapse", async () => {
  // 準備
  const { readCollapse } = await loadCollapse();
  // 実行
  const spec = readCollapse({
    kind: "data",
    collapse: { title: "リリースの一覧" },
  });
  // 検証
  expect(spec).toEqual({ collapse: "closed", title: "リリースの一覧" });
});

// collapse が無ければ折り畳まない（正常系）
test("test_read_collapse_when_none", async () => {
  // 準備
  const { readCollapse } = await loadCollapse();
  // 実行
  const spec = readCollapse({ group: "os" });
  // 検証
  expect(spec.collapse).toBe("none");
  expect(spec.title).toBeUndefined();
});

// open の true を開いた折り畳みにし、空の見出しを入れない（正常系）
test("test_read_collapse_when_open", async () => {
  // 準備
  const { readCollapse } = await loadCollapse();
  // 実行
  const spec = readCollapse({ collapse: { open: true, title: "" } });
  // 検証
  expect(spec.collapse).toBe("open");
  expect(spec.title).toBeUndefined();
});

// title= の直後の単語だけを返却する（正常系）
test("test_title_tail_of", async () => {
  // 準備
  const { titleTailOf } = await loadCollapse();
  // 実行
  const tails = [
    "title=My App.ts color=red",
    "title=app.ts color=red",
    "lines App.ts",
  ].map((text) => titleTailOf(text));
  // 検証
  expect(tails).toEqual(["App.ts", undefined, undefined]);
});
