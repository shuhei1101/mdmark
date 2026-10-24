import { expect, test } from "vitest";
import type {
  MdmarkIndex,
  MdmarkIndexTag,
} from "../../../../src/knowledge/index-shape.ts";

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

// 別名を語彙のタグにそろえ、件数・語彙の並び・名前の順に並べる（正常系）
test("test_count_tags", async () => {
  // 準備
  const { countTags } = await loadTags();
  const vocabulary = await createVocabulary([
    { name: "topic:yaml" },
    { name: "topic:mcp", aliases: ["MCP"] },
  ]);
  const docs: MdmarkIndex["docs"] = [
    { id: "a", path: "a.md", title: "A", tags: ["MCP", "topic:mcp"] },
    { id: "b", path: "b.md", title: "B", tags: ["topic:yaml", "設計"] },
    {
      id: "c",
      path: "c.md",
      title: "C",
      tags: [{ name: "topic:mcp", main: true }, "設計", "API"],
    },
    { id: "d", path: "d.md", title: "D", tags: ["topic:yaml"] },
  ];
  // 実行
  const result = countTags({ docs, vocabulary });
  // 検証
  expect(result).toEqual([
    { name: "topic:yaml", count: 2 },
    { name: "topic:mcp", count: 2 },
    { name: "設計", count: 2 },
    { name: "API", count: 1 },
  ]);
});

// 語彙が無ければ書いたとおりの名前で数える（正常系）
test("test_count_tags_without_vocabulary", async () => {
  // 準備
  const { countTags } = await loadTags();
  const docs: MdmarkIndex["docs"] = [
    { id: "a", path: "a.md", title: "A", tags: ["b", "a"] },
    { id: "b", path: "b.md", title: "B", tags: ["a"] },
  ];
  // 実行
  const result = countTags({ docs, vocabulary: undefined });
  // 検証
  expect(result).toEqual([
    { name: "a", count: 2 },
    { name: "b", count: 1 },
  ]);
});

// 別名で付いた文書も数え、0 件のタグも返す（正常系）
test("test_list_tags", async () => {
  // 準備
  const { listTags } = await loadTags();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "a", path: "a.md", title: "A", tags: ["MCP"] },
      {
        id: "b",
        path: "b.md",
        title: "B",
        tags: [{ name: "topic:mcp", main: true }],
      },
      { id: "c", path: "c.md", title: "C", tags: ["設計"] },
    ],
    tags: [
      {
        name: "topic:mcp",
        group: "topic",
        description: "含める: MCP のツール",
        aliases: ["MCP"],
      },
      { name: "topic:unused" },
    ],
  };
  // 実行
  const result = listTags({ index });
  // 検証
  expect(result).toEqual([
    {
      name: "topic:mcp",
      group: "topic",
      description: "含める: MCP のツール",
      aliases: ["MCP"],
      deprecated: null,
      docs: 2,
    },
    {
      name: "topic:unused",
      group: null,
      description: null,
      aliases: [],
      deprecated: null,
      docs: 0,
    },
  ]);
});

// 名前・別名・説明の部分一致で絞る（正常系）
test("test_list_tags_when_query", async () => {
  // 準備
  const { listTags } = await loadTags();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [],
    tags: [
      { name: "topic:mcp", aliases: ["MCP"] },
      { name: "topic:yaml", description: "mcp の設定は含めない" },
      { name: "kind:guide" },
    ],
  };
  // 実行
  const result = listTags({ index, query: "Mcp" });
  // 検証
  expect(result.map((entry) => entry.name)).toEqual([
    "topic:mcp",
    "topic:yaml",
  ]);
});

// 語彙が無ければ空を返す（正常系）
test("test_list_tags_without_vocabulary", async () => {
  // 準備
  const { listTags } = await loadTags();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: "a", path: "a.md", title: "A", tags: ["設計"] }],
  };
  // 実行
  const result = listTags({ index });
  // 検証
  expect(result).toEqual([]);
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
