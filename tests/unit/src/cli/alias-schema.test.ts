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

/** Schema に合う行（`alias_type` を列から取る） */
const VALID_ROW = {
  id: "terms",
  paths: ["aliases/*.yaml"],
  metadata: { alias_type: { type: "ref", field: "alias_type" } },
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
  const { paths: _paths, ...withoutPaths } = VALID_ROW;
  // 実行
  const result = validateAliasRows([withoutPaths], "mdmark.config.yaml");
  // 検証
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.kind).toBe("schema");
  expect(result.issues[0]?.where).toBe("aliases[0]");
  expect(result.issues[0]?.message).toContain("paths");
  expect(result.issues[0]?.message).toContain("読む YAML");
  expect(result.rows).toEqual([null]);
});

// anyOf の枝のエラーを判別子に合う枝のものだけにする（異常系）
test("test_validate_alias_rows_when_any_of_branch", async () => {
  // 準備
  const { validateAliasRows } = await loadAliasSchema();
  const row = { ...VALID_ROW, metadata: { alias_type: { type: "ref" } } };
  // 実行
  const result = validateAliasRows([row], "mdmark.config.yaml");
  // 検証
  // `ref` の枝の `field` だけを求め、`custom` の枝の `value` は求めない
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.where).toBe("aliases[0].metadata.alias_type");
  expect(result.issues[0]?.message).toContain("field");
  expect(result.issues[0]?.message).not.toContain("value");
});

// 判別子がどの枝にも合わなければ、許す値を並べた 1 件にする（異常系）
test("test_validate_alias_rows_when_discriminator_unknown", async () => {
  // 準備
  const { validateAliasRows } = await loadAliasSchema();
  const row = {
    ...VALID_ROW,
    metadata: { alias_type: { type: "copy", field: "alias_type" } },
  };
  // 実行
  const result = validateAliasRows([row], "mdmark.config.yaml");
  // 検証
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.message).toContain("ref");
  expect(result.issues[0]?.message).toContain("custom");
});
