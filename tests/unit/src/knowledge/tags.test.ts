import { expect, test } from "vitest";
import type { MdmarkIndexTag } from "../../../../src/knowledge/index-shape.ts";

/** タグの語彙の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTags = () => import("../../../../src/knowledge/tags.ts");

/** 語彙のタグから引き表を作る */
async function createVocabulary(tags: MdmarkIndexTag[]) {
  const { buildTagVocabulary } = await loadTags();
  const vocabulary = buildTagVocabulary(tags);
  if (vocabulary === undefined) {
    throw new Error("語彙の引き表を作れませんでした");
  }
  return vocabulary;
}

// 文字列とオブジェクトの要素を同じ型で返す（正常系）
test("test_read_doc_tag", async () => {
  // 準備
  const { readDocTag } = await loadTags();
  // 実行
  const results = [
    readDocTag("設計"),
    readDocTag({ name: "topic:mcp", main: true }),
    readDocTag({ name: "topic:yaml" }),
  ];
  // 検証
  expect(results).toEqual([
    { name: "設計", main: false },
    { name: "topic:mcp", main: true },
    { name: "topic:yaml", main: false },
  ]);
});

// 名前と別名から先のタグを引ける（正常系）
test("test_build_tag_vocabulary", async () => {
  // 準備
  const mcp: MdmarkIndexTag = { name: "topic:mcp", aliases: ["MCP"] };
  const yaml: MdmarkIndexTag = { name: "topic:yaml", aliases: ["MCP", "YAML"] };
  const duplicate: MdmarkIndexTag = { name: "topic:yaml", group: "kind" };
  // 実行
  const vocabulary = await createVocabulary([mcp, yaml, duplicate]);
  // 検証
  expect(vocabulary.tags).toEqual([mcp, yaml]);
  expect(vocabulary.byWord.get("MCP")).toEqual(mcp);
  expect(vocabulary.byWord.get("YAML")).toEqual(yaml);
  expect(vocabulary.byWord.get("topic:yaml")).toEqual(yaml);
  expect(vocabulary.order.get("topic:mcp")).toBe(0);
  expect(vocabulary.order.get("topic:yaml")).toBe(1);
});

// 語彙が無ければ `undefined`、空なら空の引き表を返す（正常系）
test("test_build_tag_vocabulary_when_absent", async () => {
  // 準備
  const { buildTagVocabulary } = await loadTags();
  // 実行
  const absent = buildTagVocabulary(undefined);
  const empty = buildTagVocabulary([]);
  // 検証
  expect(absent).toBeUndefined();
  expect(empty?.tags).toEqual([]);
});

// 挿入・削除・置換を 1 回ずつ数える（正常系）
test("test_edit_distance", async () => {
  // 準備
  const { editDistance } = await loadTags();
  // 実行
  const distances = [
    editDistance("topic:mcp", "topic:mcq"),
    editDistance("mcp", "mcps"),
    editDistance("abc", "abc"),
    editDistance("設計😀", "設計"),
  ];
  // 検証
  expect(distances).toEqual([1, 1, 0, 1]);
});

// 1 文字違いのタグを選ぶ（正常系）
test("test_nearest_tag", async () => {
  // 準備
  const { nearestTag } = await loadTags();
  const vocabulary = await createVocabulary([
    { name: "topic:mcp" },
    { name: "topic:yaml" },
  ]);
  // 実行
  const result = nearestTag({ vocabulary, tag: "topic:mcq" });
  // 検証
  expect(result).toBe("topic:mcp");
});

// 別名に近いときはそのタグの `name` を返す（正常系）
test("test_nearest_tag_when_alias", async () => {
  // 準備
  const { nearestTag } = await loadTags();
  const vocabulary = await createVocabulary([
    { name: "topic:mcp", aliases: ["MCP"] },
  ]);
  // 実行
  const result = nearestTag({ vocabulary, tag: "MPC" });
  // 検証
  expect(result).toBe("topic:mcp");
});

// やめたタグを候補にしない（正常系）
test("test_nearest_tag_skips_deprecated", async () => {
  // 準備
  const { nearestTag } = await loadTags();
  const vocabulary = await createVocabulary([
    { name: "topic:mcq", deprecated: "topic:mcp" },
    { name: "topic:mcp" },
  ]);
  // 実行
  const result = nearestTag({ vocabulary, tag: "topic:mcr" });
  // 検証
  expect(result).toBe("topic:mcp");
});

// 同じ距離は語彙の並びで先のタグを選ぶ（正常系）
test("test_nearest_tag_when_tie", async () => {
  // 準備
  const { nearestTag } = await loadTags();
  const vocabulary = await createVocabulary([
    { name: "topic:mcq" },
    { name: "topic:mcp" },
  ]);
  // 実行
  const result = nearestTag({ vocabulary, tag: "topic:mcr" });
  // 検証
  expect(result).toBe("topic:mcq");
});

// 編集距離が上限を超える候補しか無ければ `undefined`（正常系）
test("test_nearest_tag_when_too_far", async () => {
  // 準備
  const { nearestTag } = await loadTags();
  const vocabulary = await createVocabulary([{ name: "topic:mcp" }]);
  // 実行
  const result = nearestTag({ vocabulary, tag: "kind:guide" });
  // 検証
  expect(result).toBeUndefined();
});

// 名前と別名で同じタグを引き、当たらなければ `undefined`（正常系）
test("test_resolve_tag", async () => {
  // 準備
  const { resolveTag } = await loadTags();
  const mcp: MdmarkIndexTag = { name: "topic:mcp", aliases: ["MCP"] };
  const vocabulary = await createVocabulary([mcp]);
  // 実行
  const results = ["topic:mcp", "MCP", "mcp"].map((name) =>
    resolveTag({ vocabulary, name }),
  );
  // 検証
  expect(results).toEqual([mcp, mcp, undefined]);
});
