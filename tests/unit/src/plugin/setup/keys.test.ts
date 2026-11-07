import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/** keys の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadKeys = () => import("../../../../../src/plugin/setup/keys.ts");

const SCHEMAS = join(import.meta.dirname, "../../../../../schemas");

/** schemas/ の JSON Schema を読む */
const readSchema = (name: string) =>
  JSON.parse(readFileSync(join(SCHEMAS, name), "utf8"));

// 端末の設定のキー（正常系）
test("test_list_config_keys", async () => {
  // 準備
  const { listConfigKeys } = await loadKeys();
  // 実行
  const keys = listConfigKeys({
    target: "settings",
    schema: readSchema("mdmark.settings.schema.json"),
    resolveRef: readSchema,
    current: { features: { table: false } },
  });
  // 検証
  const byKey = new Map(keys.map((entry) => [entry.key, entry]));
  expect(byKey.get("features.table")?.current).toBe(false);
  expect(byKey.has("config.cascade")).toBe(true);
  expect(byKey.has("serve.tmuxSession")).toBe(true);
  expect(byKey.has("version")).toBe(false);
  for (const entry of keys) {
    expect(entry).toHaveProperty("default");
    expect(entry).toHaveProperty("description");
  }
});

// 文書のフォルダの設定では端末の設定だけのキーを除く（正常系）
test("test_list_config_keys_when_config", async () => {
  // 準備
  const { listConfigKeys } = await loadKeys();
  // 実行
  const keys = listConfigKeys({
    target: "config",
    schema: readSchema("mdmark.config.schema.json"),
    resolveRef: readSchema,
    current: {},
    inherited: { features: { table: false } },
  });
  // 検証
  const byKey = new Map(keys.map((entry) => [entry.key, entry]));
  expect(byKey.get("features.table")?.current).toBeNull();
  expect(byKey.get("features.table")?.inherited).toBe(false);
  expect(byKey.has("config.cascade")).toBe(false);
  expect(byKey.has("serve.tmuxSession")).toBe(false);
});
