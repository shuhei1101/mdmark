import { afterEach, expect, test } from "vitest";

declare global {
  // ビルドが埋めるバージョン（テストでは globalThis に配置して差し替える）
  var __MDMARK_VERSION__: string | undefined;
}

afterEach(() => {
  delete globalThis.__MDMARK_VERSION__;
});

// 埋めたバージョンを返却する（正常系）
test("test_version", async () => {
  // 準備
  globalThis.__MDMARK_VERSION__ = "v9.9.9";
  const { version } = await import("../../../src/index.ts");
  // 実行
  const result = version();
  // 検証
  expect(result).toBe("v9.9.9");
});
