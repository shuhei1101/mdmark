import { expect, test } from "vitest";
import type { MdmarkConfig } from "../../../src/config.ts";

/** 設定の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadConfig = () => import("../../../src/config.ts");

// 設定が無ければ既定を返す（正常系）
test("test_resolve_config", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  // 実行
  const resolved = resolveConfig({});
  // 検証
  expect(resolved).toEqual({ features: { print: true }, libraries: {} });
});

// 知っている機能の真偽値だけを置き換える（正常系）
test("test_resolve_config_when_features_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const config = {
    features: { print: false, unknown: true, other: "yes" },
  } as unknown as MdmarkConfig;
  // 実行
  const resolved = resolveConfig({ config });
  // 検証
  expect(resolved.features).toEqual({ print: false });
});

// 書式に合う名前と文字列の URL だけを足す（正常系）
test("test_resolve_config_when_libraries_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const config = {
    libraries: {
      "test-lib": "/fixtures/test-lib.js",
      "Bad Name": "/x.js",
      num: 1,
    },
  } as unknown as MdmarkConfig;
  // 実行
  const resolved = resolveConfig({ config });
  // 検証
  expect(resolved.libraries).toEqual({
    "test-lib": { url: "/fixtures/test-lib.js", figure: true },
  });
});

// 既定の行は URL だけを置き換え、figure は既定のままにする（正常系）
test("test_resolve_config_when_default_library_overridden", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const defaultLibraries = { block: { url: "https://a/x.js", figure: false } };
  const config: MdmarkConfig = { libraries: { block: "/y.js" } };
  // 実行
  const resolved = resolveConfig({ config, defaultLibraries });
  // 検証
  expect(resolved.libraries.block).toEqual({ url: "/y.js", figure: false });
});
