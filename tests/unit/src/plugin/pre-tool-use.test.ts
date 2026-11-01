import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

/** PreToolUse のフックを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPreToolUse = () => import("../../../../src/plugin/pre-tool-use.ts");

/** ツールの一覧を読み込む */
const loadTools = () => import("../../../../src/plugin/tools.ts");

/** フックの標準入力に渡す JSON を作る */
function createInput(toolInput: Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "mcp__plugin_mdmark_mdmark__check",
    tool_input: toolInput,
  });
}

// project_dir を入れた updatedInput を書く（正常系）
test("test_run_pre_tool_use", async () => {
  // 準備
  const { runPreToolUse } = await loadPreToolUse();
  const stdout: string[] = [];
  // 実行
  const code = await runPreToolUse({
    env: { CLAUDE_PROJECT_DIR: "/work" },
    input: createInput({ config: "a.yaml" }),
    stdout: (line) => stdout.push(line),
  });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  const output = JSON.parse(stdout[0] ?? "");
  expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(output.hookSpecificOutput.updatedInput).toEqual({
    config: "a.yaml",
    project_dir: "/work",
  });
  expect(output.hookSpecificOutput).not.toHaveProperty("permissionDecision");
});

// エージェントが書いた project_dir を上書きする（正常系）
test("test_run_pre_tool_use_when_project_dir_given", async () => {
  // 準備
  const { runPreToolUse } = await loadPreToolUse();
  const stdout: string[] = [];
  // 実行
  await runPreToolUse({
    env: { CLAUDE_PROJECT_DIR: "/work" },
    input: createInput({ project_dir: "/other" }),
    stdout: (line) => stdout.push(line),
  });
  // 検証
  const output = JSON.parse(stdout[0] ?? "");
  expect(output.hookSpecificOutput.updatedInput.project_dir).toBe("/work");
});

// 環境変数が無ければ何も書かない（正常系）
test("test_run_pre_tool_use_when_project_dir_unknown", async () => {
  // 準備
  const { runPreToolUse } = await loadPreToolUse();
  const stdout: string[] = [];
  // 実行
  const code = await runPreToolUse({
    env: {},
    input: createInput({ config: "a.yaml" }),
    stdout: (line) => stdout.push(line),
  });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual([]);
});

// hooks.json の matcher が `PROJECT_DIR_TOOLS` のツールだけに当たる（正常系）
test("test_run_pre_tool_use_when_matcher", async () => {
  // 準備
  const { PROJECT_DIR_TOOLS, TOOL_NAME_PREFIX } = await loadPreToolUse();
  const { TOOLS } = await loadTools();
  const hooks = JSON.parse(
    await readFile(
      join(process.cwd(), "plugin", "hooks", "hooks.json"),
      "utf8",
    ),
  );
  // 実行
  const matcher: string = hooks.hooks.PreToolUse[0].matcher;
  // 検証
  expect(matcher).toBe(
    PROJECT_DIR_TOOLS.map((name) => `${TOOL_NAME_PREFIX}${name}`).join("|"),
  );
  expect(new RegExp(matcher).test(`${TOOL_NAME_PREFIX}read_guide`)).toBe(false);
  for (const name of PROJECT_DIR_TOOLS) {
    expect(new RegExp(matcher).test(`${TOOL_NAME_PREFIX}${name}`)).toBe(true);
  }
  expect([...PROJECT_DIR_TOOLS].sort()).toEqual([
    "build_site",
    "check",
    "export_html",
  ]);
  expect([...PROJECT_DIR_TOOLS].sort()).toEqual(
    TOOLS.filter((tool) => tool.usesProjectDir)
      .map((tool) => tool.name)
      .sort(),
  );
});
