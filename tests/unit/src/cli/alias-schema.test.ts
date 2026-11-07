import { expect, test } from "vitest";

/** 設定の aliases の行を Schema で検める処理を読み込む（ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む。実装が無い間は各テストが個別に失敗する） */
const loadAliasSchema = (): Promise<
  typeof import("../../../../src/cli/alias-schema.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/cli/alias-schema.ts",
      import.meta.url,
    ).href
  );

/** Schema に合う行 */
const VALID_ROW = {
  id: "terms",
  paths: ["aliases/*.yaml"],
  alias_type: "term",
  records: "terms",
  body_file: "path",
  metadata: { name: "term", description: "meta.summary" },
};

// Schema に合う行はずれにせず、そのまま返す（正常系）
test("test_validate_alias_rows", async () => {
  // 準備
  const { validateAliasRows } = await loadAliasSchema();
  // 実行
  const result = validateAliasRows([VALID_ROW], "mdmark.config.yaml");
  // 検証
  expect(result.issues).toEqual([]);
  expect(result.rows).toEqual([VALID_ROW]);
});

// 必須のキーが無い行を、キーの title を入れた 1 文にする（異常系）
test("test_validate_alias_rows_when_required_missing", async () => {
  // 準備
  const { validateAliasRows } = await loadAliasSchema();
  const { alias_type: _aliasType, ...withoutType } = VALID_ROW;
  // 実行
  const result = validateAliasRows([withoutType], "mdmark.config.yaml");
  // 検証
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.kind).toBe("schema");
  expect(result.issues[0]?.where).toBe("aliases[0]");
  expect(result.issues[0]?.message).toContain("alias_type");
  expect(result.issues[0]?.message).toContain("引用の種類");
  expect(result.rows).toEqual([null]);
});

// 9 つの種類に無い alias_type を、許す値を並べた 1 文にする（異常系）
test("test_validate_alias_rows_when_alias_type_unknown", async () => {
  // 準備
  const { validateAliasRows } = await loadAliasSchema();
  const row = { ...VALID_ROW, alias_type: "memo" };
  // 実行
  const result = validateAliasRows([row], "mdmark.config.yaml");
  // 検証
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.where).toBe("aliases[0].alias_type");
  expect(result.issues[0]?.message).toContain("term");
  expect(result.issues[0]?.message).toContain("avoid");
  expect(result.rows).toEqual([null]);
});

// v0.2.0 の構造の metadata の値を文字列でないずれにする（異常系）
test("test_validate_alias_rows_when_v020_metadata", async () => {
  // 準備
  const { validateAliasRows } = await loadAliasSchema();
  const row = {
    id: "terms",
    paths: ["aliases/*.yaml"],
    alias_type: "term",
    metadata: { name: { type: "ref", field: "term" } },
  };
  // 実行
  const result = validateAliasRows([row], "mdmark.config.yaml");
  // 検証
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.where).toBe("aliases[0].metadata.name");
  expect(result.issues[0]?.message).toContain("文字列にしてください");
});
