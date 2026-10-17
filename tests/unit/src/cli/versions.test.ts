import { afterEach, expect, test, vi } from "vitest";

/** 版の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/versions.ts");

afterEach(() => {
  vi.unstubAllGlobals();
});

// 版を 3 つの数にする（正常系）
test("test_parse_version", async () => {
  // 準備
  const { parseVersion } = await loadModule();
  // 実行
  const parsed = parseVersion("v0.12.3");
  // 検証
  expect(parsed).toEqual([0, 12, 3]);
});

// 書式の違う版は undefined（異常系）
test("test_parse_version_when_invalid", async () => {
  // 準備
  const { parseVersion } = await loadModule();
  // 実行・検証
  for (const text of ["0.3", "v0.3", "v0.3.0-rc"]) {
    expect(parseVersion(text)).toBeUndefined();
  }
});

// 桁ごとに数として比べる（正常系）
test("test_compare_versions", async () => {
  // 準備
  const { compareVersions } = await loadModule();
  // 実行・検証
  expect(compareVersions("v0.10.0", "v0.9.9")).toBe(1);
  expect(compareVersions("v1.0.0", "v1.0.0")).toBe(0);
  expect(compareVersions("v0.3.0", "v0.4.0")).toBe(-1);
});

// ビルドが埋めた版を返す（正常系）
test("test_cli_version", async () => {
  // 準備
  const { cliVersion } = await loadModule();
  vi.stubGlobal("__MDMARK_VERSION__", "v0.5.0");
  // 実行
  const version = cliVersion();
  // 検証
  expect(version).toBe("v0.5.0");
});
