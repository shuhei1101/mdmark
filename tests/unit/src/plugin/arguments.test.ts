import { expect, test } from "vitest";

/** 引数の検査を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadArguments = () => import("../../../../src/plugin/arguments.ts");

/** ツールの一覧を読み込む */
const loadTools = () => import("../../../../src/plugin/tools.ts");

/** 名前のツールの引数の形を引く */
async function schemaOf(name: string) {
  const { TOOLS } = await loadTools();
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`ツール ${name} が無い`);
  }
  return tool.inputSchema;
}

// 合う引数は undefined（正常系）
test("test_check_arguments", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("update_index");
  // 実行
  const result = checkArguments({
    schema,
    args: { kind: "doc", id: "b", item: { path: "b.md" } },
  });
  // 検証
  expect(result).toBeUndefined();
});

// 必須の引数が無い（正常系）
test("test_check_arguments_when_required_missing", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("read_guide");
  // 実行
  const result = checkArguments({ schema, args: {} });
  // 検証
  expect(result).toContain("names");
});

// 知らない引数（正常系）
test("test_check_arguments_when_unknown_key", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("check");
  // 実行
  const result = checkArguments({ schema, args: { path: "a" } });
  // 検証
  expect(result).toContain("path");
  expect(result).toContain("config");
});

// 型の違う引数（正常系）
test("test_check_arguments_when_type_mismatch", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("read_guide");
  // 実行
  const result = checkArguments({ schema, args: { names: "notation" } });
  // 検証
  expect(result).toContain("names");
  expect(result).toContain("文字列の配列");
});

// 空の配列（正常系）
test("test_check_arguments_when_empty_array", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("read_guide");
  // 実行
  const result = checkArguments({ schema, args: { names: [] } });
  // 検証
  expect(result).toContain("names");
  expect(result).toContain("1 件以上");
});

// 選べない値（正常系）
test("test_check_arguments_when_enum_mismatch", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("update_index");
  // 実行
  const result = checkArguments({
    schema,
    args: { kind: "docs", id: "b", item: { path: "b.md" } },
  });
  // 検証
  expect(result).toContain("kind");
  expect(result).toContain("doc か term か tag");
});

// null を許す引数（正常系）
test("test_check_arguments_when_null_allowed", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("update_index");
  // 実行
  const result = checkArguments({
    schema,
    args: { kind: "doc", id: "b", item: null },
  });
  // 検証
  expect(result).toBeUndefined();
});

// 引数がオブジェクトでない（正常系）
test("test_check_arguments_when_not_object", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("check");
  // 実行
  const result = checkArguments({ schema, args: [] });
  // 検証
  expect(result).toContain("オブジェクト");
});

// 範囲の外か整数でない数（正常系）
test("test_check_arguments_when_integer_out_of_range", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("find_docs");
  // 実行
  const results = [101, 1.5].map((limit) =>
    checkArguments({ schema, args: { limit } }),
  );
  // 検証
  for (const result of results) {
    expect(result).toContain("limit");
    expect(result).toContain("1 以上 100 以下の整数");
  }
});

// 真偽値でない値（正常系）
test("test_check_arguments_when_boolean_mismatch", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("find_docs");
  // 実行
  const result = checkArguments({ schema, args: { count_only: "true" } });
  // 検証
  expect(result).toContain("count_only");
  expect(result).toContain("真偽値");
});

// 配列の要素が選べない値（正常系）
test("test_check_arguments_when_item_enum_mismatch", async () => {
  // 準備
  const { checkArguments } = await loadArguments();
  const schema = await schemaOf("find_docs");
  // 実行
  const result = checkArguments({ schema, args: { include: ["body"] } });
  // 検証
  expect(result).toContain("include");
  expect(result).toContain(
    "path か aliases か related か referenced_by の配列",
  );
});
