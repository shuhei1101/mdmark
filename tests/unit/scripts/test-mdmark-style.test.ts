import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

/** 結合テストを並べるスクリプト（実装が無い間は各テストが個別に失敗する） */
const loadScript = () => import("../../../scripts/test-mdmark-style.ts");

/** 作業ツリーの代わりの一時フォルダを作る */
const createRoot = async (options: { built: boolean }) => {
  const root = await mkdtemp(join(tmpdir(), "mdmark-style-root-"));
  await mkdir(join(root, "mdmark-style/hooks/mod"), { recursive: true });
  if (options.built) {
    await writeFile(join(root, "mdmark-style/hooks/mod/mod.js"), "export {}\n");
  }
  const tests = join(root, "tests/integration/ClaudeCodeプラグイン/mdmark-style");
  await mkdir(tests, { recursive: true });
  await writeFile(join(tests, "a.test.tsx"), "// test\n");
  return root;
};

// プラグインとテストを並べる（正常系）
test("test_stage_plugin_tests", async () => {
  // 準備
  const { stagePluginTests } = await loadScript();
  const root = await createRoot({ built: true });
  const tmpDir = await mkdtemp(join(tmpdir(), "mdmark-style-stage-"));
  // 実行
  const staged = await stagePluginTests({ root, tmpDir });
  // 検証
  expect(staged).toBe(join(tmpDir, "mdmark-style"));
  expect(await readdir(join(staged, "hooks/mod"))).toContain("mod.js");
  expect(await readdir(join(staged, "tests"))).toContain("a.test.tsx");
  expect(await readdir(join(root, "mdmark-style"))).not.toContain("tests");
});

// ビルドしていない（異常系）
test("test_stage_plugin_tests_when_not_built", async () => {
  // 準備
  const { stagePluginTests } = await loadScript();
  const root = await createRoot({ built: false });
  const tmpDir = await mkdtemp(join(tmpdir(), "mdmark-style-stage-"));
  // 実行・検証
  await expect(stagePluginTests({ root, tmpDir })).rejects.toThrow(
    "npm run build",
  );
});
