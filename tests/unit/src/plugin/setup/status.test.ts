import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../../helpers/cli.ts";

/** status の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadStatus = () => import("../../../../../src/plugin/setup/status.ts");

const createTempDir = useTempDirs();

/** tmux の -V だけに成功し、has-session には 1 を返却する */
const runWithoutSession = async (_command: string, args: string[]) =>
  args[0] === "-V" ? { code: 0, stdout: "tmux 3.4" } : { code: 1, stdout: "" };

// 空の端末（正常系）
test("test_read_terminal_status", async () => {
  // 準備
  const { readTerminalStatus } = await loadStatus();
  const home = await createTempDir();
  const settingsPath = join(home, "x", "settings.yaml");
  // 実行
  const status = await readTerminalStatus({
    env: { HOME: home, MDMARK_CONFIG: settingsPath, MDMARK_PORT: "1" },
    pluginRoot: home,
    version: "v0.0.0",
    run: runWithoutSession,
  });
  // 検証
  expect(status.settings.path).toBe(settingsPath);
  expect(status.settings.exists).toBe(false);
  expect(status.settings.default_path).toBe(false);
  expect(status.settings.target_version).toBe("v0.0.0");
  expect(status.server.session).toBe("mdmark-mcp");
  expect(status.server.session_exists).toBe(false);
  expect(status.server.listening).toBe(false);
  expect(status.tmux.available).toBe(true);
});

// 読み込めない端末の設定は SetupError（異常系）
test("test_read_terminal_status_when_unreadable", async () => {
  // 準備
  const { readTerminalStatus } = await loadStatus();
  const home = await createTempDir();
  await writeFiles(home, {
    "settings.yaml": "version: v0.9.0\nfeatures:\n  table: a: b\n",
  });
  const settingsPath = join(home, "settings.yaml");
  // 実行
  const result = readTerminalStatus({
    env: { HOME: home, MDMARK_CONFIG: settingsPath, MDMARK_PORT: "1" },
    pluginRoot: home,
    version: "v0.0.0",
    run: runWithoutSession,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  await expect(result).rejects.toThrow(settingsPath);
  await expect(result).rejects.toThrow("3");
});
