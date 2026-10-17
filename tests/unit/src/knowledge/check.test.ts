import { expect, test } from "vitest";
import { glossaryDocument } from "../../helpers/index-fixtures.ts";

/** 索引の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/knowledge/check.ts");

// ずれの無い索引で空を返す（正常系）
test("test_check_index", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      { id: "arch", path: "arch.md", title: "アーキテクチャ" },
      { id: "api", path: "api.md", title: "API", related: ["arch"] },
    ],
    terms: [
      { id: "ws", term: "ワークスペース", meaning: "記録を置くフォルダ" },
    ],
  };
  const documents = { "arch.md": "# アーキテクチャ\n", "api.md": "# API\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toEqual([]);
});

// 消えた文書・索引に無い文書・切れた id・用語の重複 3 種を返す（正常系）
test("test_check_index_when_drift", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      { id: "api", path: "api.md", title: "API", related: ["gone"] },
      { id: "old", path: "old.md", title: "旧" },
      { id: "guide", path: "guide.md", title: "使い方" },
    ],
    terms: [
      { id: "ws1", term: "ワークスペース", meaning: "一つ目" },
      { id: "ws2", term: "ワークスペース", meaning: "二つ目" },
    ],
  };
  // 用語集の表の最初の行は 5 行目になる
  const documents = {
    "api.md": glossaryDocument([
      ["ワークスペース", "索引と重なる"],
      ["印", "HTML コメントで書く指定"],
    ]),
    "guide.md": glossaryDocument([["印", "api.md と重なる"]]),
    "new.md": "# 新しい文書\n",
  };
  // 実行
  const issues = checkIndex({
    index,
    documents,
    indexFile: "docs/index.yaml",
  });
  // 検証
  expect(issues.map((issue) => issue.kind)).toEqual([
    "missing_doc",
    "orphan_doc",
    "broken_ref",
    "duplicate_term",
    "duplicate_term",
    "duplicate_term",
  ]);
  expect(issues[0]).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[1].path",
  });
  expect(issues[1]).toMatchObject({ file: "new.md", where: "" });
  expect(issues[2]).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[0].related[0]",
  });
  expect(issues[2]?.message).toContain("gone");
  // 用語の重複は、重なった組の後ろの側を指し、message にもう片方の場所を書く
  expect(issues[3]).toMatchObject({
    file: "docs/index.yaml",
    where: "terms[1].term",
  });
  expect(issues[3]?.message).toContain("terms[0]");
  expect(issues[4]).toMatchObject({ file: "api.md", where: "5 行目" });
  expect(issues[4]?.message).toContain("docs/index.yaml");
  expect(issues[5]).toMatchObject({ file: "guide.md", where: "5 行目" });
  expect(issues[5]?.message).toContain("api.md");
});

// Schema に合わない索引で例外を投げず schema のずれを返す（異常系）
test("test_check_index_when_invalid_schema", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    docs: [
      { id: "a", path: "a.md", title: "A" },
      { id: "b", title: "B" },
    ],
  };
  const documents = { "a.md": "# A\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "index.yaml",
      where: "schema",
      kind: "schema",
    }),
  );
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "index.yaml",
      where: "docs[1].path",
      kind: "schema",
    }),
  );
  // docs[0] の文書について、ほかの種類のずれが無い
  expect(issues.every((issue) => issue.kind === "schema")).toBe(true);
});
