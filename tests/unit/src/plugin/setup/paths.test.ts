import { expect, test } from "vitest";

/** 端末のパスを決める処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPaths = () => import("../../../../../src/plugin/setup/paths.ts");

// 環境変数が無ければ既定のパス（正常系）
test("test_resolve_setup_paths", async () => {
  // 準備
  const { resolveSetupPaths } = await loadPaths();
  // 実行
  const paths = resolveSetupPaths({ HOME: "/h" });
  // 検証
  expect(paths.settingsPath).toBe("/h/.config/mdmark/settings.yaml");
  expect(paths.defaultPath).toBe(true);
  expect(paths.stateDir).toBe("/h/.local/state/mdmark");
  expect(paths.logPath).toBe("/h/.local/state/mdmark/serve.log");
  expect(paths.claudeSettingsPath).toBe("/h/.claude/settings.json");
  expect(paths.port).toBe(8782);
});

// 環境変数で上書きする（正常系）
test("test_resolve_setup_paths_when_overridden", async () => {
  // 準備
  const { resolveSetupPaths } = await loadPaths();
  // 実行
  const paths = resolveSetupPaths({
    HOME: "/h",
    MDMARK_CONFIG: "~/x.yaml",
    MDMARK_STATE_DIR: "/s",
    CLAUDE_CONFIG_DIR: "/c",
  });
  // 検証
  expect(paths.settingsPath).toBe("/h/x.yaml");
  expect(paths.defaultPath).toBe(false);
  expect(paths.logPath).toBe("/s/serve.log");
  expect(paths.claudeSettingsPath).toBe("/c/settings.json");
});

// 無ければ既定（正常系）
test("test_read_session_name", async () => {
  // 準備
  const { readSessionName } = await loadPaths();
  // 実行・検証
  expect(readSessionName(undefined)).toBe("mdmark-mcp");
});

// 端末の設定の値（正常系）
test("test_read_session_name_when_set", async () => {
  // 準備
  const { readSessionName } = await loadPaths();
  // 実行・検証
  expect(readSessionName({ serve: { tmuxSession: "x" } })).toBe("x");
});
