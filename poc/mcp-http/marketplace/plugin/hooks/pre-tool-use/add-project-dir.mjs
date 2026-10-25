import { appendFileSync, readFileSync } from "node:fs";

// 標準入力のフックの入力を読み、受けた tool_input を記録してから project_dir を入れた引数を返す
const input = JSON.parse(readFileSync(0, "utf8"));
const log = process.env.POC_HOOK_LOG;
if (log) {
  appendFileSync(
    log,
    `${JSON.stringify({ session_id: input.session_id, cwd: input.cwd, tool_name: input.tool_name, tool_input: input.tool_input })}\n`,
  );
}
const output = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: {
      ...input.tool_input,
      project_dir: process.env.CLAUDE_PROJECT_DIR,
    },
  },
};
process.stdout.write(JSON.stringify(output));
