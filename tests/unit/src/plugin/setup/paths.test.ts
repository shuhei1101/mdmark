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

// 無ければ既定、あれば端末の設定の値（正常系）
test("test_read_unit_name", async () => {
  // 準備
  const { readUnitName } = await loadPaths();
  // 実行・検証
  expect(readUnitName(undefined)).toBe("mdmark-mcp");
  expect(readUnitName({ serve: { systemdUnit: "x" } })).toBe("x");
});

// 知らない値と無いときは auto（正常系）
test("test_read_launcher_setting", async () => {
  // 準備
  const { readLauncherSetting } = await loadPaths();
  // 実行・検証
  expect(readLauncherSetting(undefined)).toBe("auto");
  expect(readLauncherSetting({ serve: { launcher: "tmux" } })).toBe("tmux");
  expect(readLauncherSetting({ serve: { launcher: "x" } })).toBe("auto");
});

// XDG_CONFIG_HOME と HOME から決める（正常系）
test("test_resolve_unit_path", async () => {
  // 準備
  const { resolveUnitPath } = await loadPaths();
  // 実行・検証
  expect(
    resolveUnitPath({ env: { XDG_CONFIG_HOME: "/x", HOME: "/h" }, unit: "u" }),
  ).toBe("/x/systemd/user/u.service");
  expect(resolveUnitPath({ env: { HOME: "/h" }, unit: "u" })).toBe(
    "/h/.config/systemd/user/u.service",
  );
});
