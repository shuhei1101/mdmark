import { expect, test } from "vitest";

/** ガイドの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGuide = () => import("../../../../src/plugin/guide.ts");

/** 索引の行を作る（`page` は `docs/{名前}.md`） */
function createEntry(name: string, overrides: Record<string, string> = {}) {
  return {
    name,
    when: `${name} を記載するとき`,
    summary: `${name} の概要`,
    page: `docs/${name}.md`,
    ...overrides,
  };
}

// 合う索引の行を全て返却する（正常系）
test("test_parse_guide_index", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  const entries = [createEntry("a"), createEntry("b")];
  // 実行
  const result = parseGuideIndex({ schema: 1, guides: entries });
  // 検証
  expect(result.entries).toEqual(entries);
  expect(result.problems).toEqual([]);
});

// 欠けたキーを場所つきで返却する（正常系）
test("test_parse_guide_index_when_key_missing", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  const { page: _page, ...withoutPage } = createEntry("b");
  // 実行
  const result = parseGuideIndex({
    schema: 1,
    guides: [createEntry("a"), withoutPage],
  });
  // 検証
  expect(result.entries).toHaveLength(1);
  expect(result.problems.map((problem) => problem.where)).toContain(
    "guides[1].page",
  );
});

// 名前の重なりを返却する（正常系）
test("test_parse_guide_index_when_name_duplicated", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  // 実行
  const result = parseGuideIndex({
    schema: 1,
    guides: [createEntry("a"), createEntry("a", { page: "docs/b.md" })],
  });
  // 検証
  expect(result.problems.map((problem) => problem.where)).toContain(
    "guides[1].name",
  );
});

// docs/ の外のページを返却する（正常系）
test("test_parse_guide_index_when_page_outside_docs", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  // 実行
  const result = parseGuideIndex({
    schema: 1,
    guides: [createEntry("a", { page: "src/index.ts" })],
  });
  // 検証
  expect(result.problems.map((problem) => problem.where)).toContain(
    "guides[0].page",
  );
});

// オブジェクトでない値を返却する（正常系）
test("test_parse_guide_index_when_not_object", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  // 実行
  const result = parseGuideIndex([]);
  // 検証
  expect(result.entries).toEqual([]);
  expect(result.problems.map((problem) => problem.where)).toContain("");
});
