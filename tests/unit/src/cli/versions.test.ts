import { afterEach, expect, test, vi } from "vitest";

/** バージョンの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/versions.ts");

afterEach(() => {
  vi.unstubAllGlobals();
});

// バージョンを 3 つの数にする（正常系）
test("test_parse_version", async () => {
  // 準備
  const { parseVersion } = await loadModule();
  // 実行
  const parsed = parseVersion("v0.12.3");
  // 検証
  expect(parsed).toEqual([0, 12, 3]);
});

// 書式の違うバージョンは undefined（異常系）
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

// ビルドが埋めたバージョンを返却する（正常系）
test("test_cli_version", async () => {
  // 準備
  const { cliVersion } = await loadModule();
  vi.stubGlobal("__MDMARK_VERSION__", "v0.5.0");
  // 実行
  const version = cliVersion();
  // 検証
  expect(version).toBe("v0.5.0");
});

// ビルドメタデータの有無で分ける（正常系）
test("test_is_develop_build", async () => {
  // 準備
  const { isDevelopBuild } = await loadModule();
  // 実行・検証
  expect(isDevelopBuild("v0.5.0+develop.abc1234")).toBe(true);
  expect(isDevelopBuild("v0.5.0")).toBe(false);
  expect(isDevelopBuild("v0.5.0-develop.abc1234")).toBe(false);
});

// ビルドメタデータを除く（正常系）
test("test_release_version_of", async () => {
  // 準備
  const { releaseVersionOf } = await loadModule();
  // 実行・検証
  expect(releaseVersionOf("v0.5.0+develop.abc1234")).toBe("v0.5.0");
  expect(releaseVersionOf("v0.5.0")).toBe("v0.5.0");
});

// develop のビルドだけ develop にする（正常系）
test("test_local_version_of", async () => {
  // 準備
  const { localVersionOf } = await loadModule();
  // 実行・検証
  expect(localVersionOf("v0.5.0+develop.abc1234")).toBe("develop");
  expect(localVersionOf("v0.5.0")).toBe("v0.5.0");
});

// タグの書式と develop を受け付ける（正常系）
test("test_is_local_version", async () => {
  // 準備
  const { isLocalVersion } = await loadModule();
  // 実行・検証
  expect(isLocalVersion("v0.5.0")).toBe(true);
  expect(isLocalVersion("develop")).toBe(true);
  expect(isLocalVersion("latest")).toBe(false);
  expect(isLocalVersion("v0.5.0+develop.abc1234")).toBe(false);
  expect(isLocalVersion(1)).toBe(false);
});
