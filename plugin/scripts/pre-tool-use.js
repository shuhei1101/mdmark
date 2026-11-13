#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);

// src/plugin/pre-tool-use.ts
var PROJECT_DIR_ENV = "CLAUDE_PROJECT_DIR";
var TOOL_NAME_PREFIX = "mcp__plugin_mdmark_mdmark__";
var PROJECT_DIR_TOOLS = [
  "check",
  "export_html",
  "build_site",
  "list_templates",
  "add_template",
  "apply_template"
];
var PERMISSION_DECISION_REASON = "mdmark \u306E\u30D7\u30E9\u30B0\u30A4\u30F3\u304C\u4F5C\u696D\u306E\u30D5\u30A9\u30EB\u30C0\u3092 project_dir \u306B\u5165\u308C\u305F";
var PROJECT_DIR_ARG = "project_dir";
function runPreToolUse(options) {
  const { env, input, stdout } = options;
  const projectDir = env[PROJECT_DIR_ENV];
  if (!projectDir) {
    return 0;
  }
  const { tool_input: toolInput } = JSON.parse(input);
  stdout(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: PERMISSION_DECISION_REASON,
        updatedInput: { ...toolInput, [PROJECT_DIR_ARG]: projectDir }
      }
    })
  );
  return 0;
}
if (import.meta.main) {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  process.exitCode = runPreToolUse({
    env: process.env,
    input: Buffer.concat(chunks).toString("utf8"),
    stdout: (line) => console.log(line)
  });
}
export {
  PERMISSION_DECISION_REASON,
  PROJECT_DIR_ENV,
  PROJECT_DIR_TOOLS,
  TOOL_NAME_PREFIX,
  runPreToolUse
};
