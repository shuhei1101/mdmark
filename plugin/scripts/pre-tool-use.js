#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);

// src/plugin/pre-tool-use.ts
var PROJECT_DIR_ENV = "CLAUDE_PROJECT_DIR";
var TOOL_NAME_PREFIX = "mcp__plugin_mdmark_mdmark__";
var PROJECT_DIR_TOOLS = [
  "find_docs",
  "list_tags",
  "update_index",
  "check",
  "export_html",
  "build_site"
];
var PROJECT_DIR_ARG = "project_dir";
async function runPreToolUse(options) {
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
  process.exitCode = await runPreToolUse({
    env: process.env,
    input: Buffer.concat(chunks).toString("utf8"),
    stdout: (line) => console.log(line)
  });
}
export {
  PROJECT_DIR_ENV,
  PROJECT_DIR_TOOLS,
  TOOL_NAME_PREFIX,
  runPreToolUse
};
