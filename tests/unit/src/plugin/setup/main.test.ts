import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs } from "../../../helpers/cli.ts";

/** setup.js の入口を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMain = () => import("../../../../../src/plugin/setup/main.ts");

const createTempDir = useTempDirs();

// status の結果を JSON の 1 行で標準出力に書き込む（正常系）
test("test_run_setup", async () => {
  // 準備
  const { runSetup } = await loadMain();
  const home = await createTempDir();
  const stdout: string[] = [];
  // 実行
  const code = await runSetup({
    argv: ["status"],
    env: {
      HOME: home,
      MDMARK_CONFIG: join(home, "settings.yaml"),
      MDMARK_PORT: "1",
    },
    pluginRoot: home,
    version: "v0.0.0",
    run: async () => ({ code: 127, stdout: "" }),
    stdout: (line) => stdout.push(line),
    stderr: () => {},
  });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  expect(JSON.parse(stdout[0] ?? "").tmux.available).toBe(false);
});

// 知らないサブコマンドは 1（異常系）
test("test_run_setup_when_unknown_command", async () => {
  // 準備
  const { runSetup } = await loadMain();
  const stderr: string[] = [];
  // 実行
  const code = await runSetup({
    argv: ["foo"],
    env: {},
    pluginRoot: "/p",
    version: "v0.0.0",
    run: async () => ({ code: 0, stdout: "" }),
    stdout: () => {},
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(code).toBe(1);
  expect(stderr.join("\n")).toContain("status");
});
