import { expect, test } from "vitest";
import { useTempDirs } from "../cli.ts";
import { builtPluginDir, runPreToolUseHook } from "../plugin.ts";

const createTempDir = useTempDirs();

/** Claude Code が標準入力に渡す呼び出しの JSON。`check` に設定のパスと、エージェントが書いた `project_dir` を入れる */
const INPUT = JSON.stringify({
  hook_event_name: "PreToolUse",
  tool_name: "mcp__plugin_mdmark_mdmark__check",
  tool_input: { config: "docs/mdmark.config.yaml", project_dir: "/tmp/other" },
});

// 引数の project_dir を CLAUDE_PROJECT_DIR の値に置き換えて返す（正常系）
test("test_normal", async () => {
  // 準備
  const projectDir = await createTempDir();
  // 実行
  const result = await runPreToolUseHook({
    pluginDir: builtPluginDir(),
    env: { CLAUDE_PROJECT_DIR: projectDir },
    input: INPUT,
  });
  // 検証
  expect(result.code).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(output.hookSpecificOutput.updatedInput).toEqual({
    config: "docs/mdmark.config.yaml",
    project_dir: projectDir,
  });
  expect(output.hookSpecificOutput).not.toHaveProperty("permissionDecision");
});

// CLAUDE_PROJECT_DIR が無いときは何も出さずに終わる（正常系（作業のフォルダが分からない））
test("test_normal_when_project_dir_unknown", async () => {
  // 実行
  const result = await runPreToolUseHook({
    pluginDir: builtPluginDir(),
    env: {},
    input: INPUT,
  });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
});
