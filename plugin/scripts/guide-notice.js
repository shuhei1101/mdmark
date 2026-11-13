#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);

// src/plugin/guide-notice.ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir as osTmpdir } from "node:os";
import { basename, join } from "node:path";

// src/knowledge/paths.ts
var MARK_MARKDOWN_SUFFIX = ".mark.md";
function isMarkMarkdown(path) {
  return path.endsWith(MARK_MARKDOWN_SUFFIX);
}

// src/plugin/guide-notice.ts
var NOTICE_DIR_ENV = "MDMARK_GUIDE_NOTICE_DIR";
var DEFAULT_NOTICE_DIR_NAME = "mdmark-guide-notice";
var SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
var PROMPT_KEYWORD = "mdmark";
var NOTICE_BODY = "\u8A18\u8F09\u3059\u308B\u524D\u306B\u3001mdmark \u306E MCP \u306E instructions \u306E\u3068\u304A\u308A\u306B\u30AC\u30A4\u30C9\u3092\u53C2\u7167\u3057\u3001\u8A18\u8F09\u3057\u305F\u5F8C\u306F check \u3067\u70B9\u691C\u3059\u308B\u3002";
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var noticeHead = (input) => {
  if (input.hook_event_name === "PreToolUse") {
    const path = isRecord(input.tool_input) ? input.tool_input.file_path : void 0;
    if (typeof path === "string" && isMarkMarkdown(path)) {
      return `${basename(path)} \u306F mdmark \u306E\u8A18\u6CD5\u3067\u8A18\u8F09\u3059\u308B\u6587\u66F8\u3002`;
    }
    return null;
  }
  if (input.hook_event_name === "UserPromptSubmit" && typeof input.prompt === "string" && input.prompt.toLowerCase().includes(PROMPT_KEYWORD)) {
    return "\u5229\u7528\u8005\u304C mdmark \u3067\u8A18\u8F09\u3059\u308B\u3088\u3046\u6307\u793A\u3057\u305F\u3002";
  }
  return null;
};
var parseInput = (text) => {
  try {
    const value = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
};
var createRecord = async (options) => {
  try {
    await mkdir(options.dir, { recursive: true });
    await writeFile(options.path, "", { flag: "wx" });
    return true;
  } catch {
    return false;
  }
};
var runGuideNotice = async (options) => {
  const input = parseInput(options.input);
  if (input === null || typeof input.session_id !== "string" || !SESSION_ID_PATTERN.test(input.session_id)) {
    return 0;
  }
  const dir = options.env[NOTICE_DIR_ENV] || join(options.tmpdir(), DEFAULT_NOTICE_DIR_NAME);
  const path = join(dir, input.session_id);
  if (input.hook_event_name === "PreCompact") {
    await rm(path, { force: true }).catch(() => void 0);
    return 0;
  }
  const head = noticeHead(input);
  if (head === null || !await createRecord({ dir, path })) {
    return 0;
  }
  options.stdout(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: `${head}${NOTICE_BODY}`
      }
    })
  );
  return 0;
};
var readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};
if (import.meta.main) {
  process.exitCode = await runGuideNotice({
    env: process.env,
    input: await readStdin(),
    stdout: (line) => console.log(line),
    tmpdir: osTmpdir
  });
}
export {
  DEFAULT_NOTICE_DIR_NAME,
  NOTICE_BODY,
  NOTICE_DIR_ENV,
  PROMPT_KEYWORD,
  SESSION_ID_PATTERN,
  noticeHead,
  runGuideNotice
};
