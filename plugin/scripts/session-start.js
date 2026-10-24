#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);

// src/plugin/session-start.ts
import { join as join2, resolve as resolve2 } from "node:path";

// src/cli/errors.ts
var CliError = class extends Error {
};

// src/plugin/guide.ts
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
var GUIDE_INDEX_FILE = "index.json";
var GUIDE_CONTEXT_LEAD = "mdmark \u306E\u4F7F\u3044\u65B9\u96C6\u306E\u7D22\u5F15\u3002\u672C\u6587\u306F MCP \u306E read_guide \u306B\u540D\u524D\u3092\u6E21\u3059\u3068\u8AAD\u3081\u308B\u3002";
var GUIDE_SCHEMA = 1;
var ENTRY_KEYS = ["name", "when", "summary", "page"];
var PAGE_PREFIX = "docs/";
var PAGE_SUFFIX = ".md";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseGuideIndex(value) {
  const entries = [];
  const problems = [];
  if (!isRecord(value)) {
    problems.push({ where: "", message: "\u7D22\u5F15\u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059" });
    return { entries, problems };
  }
  for (const key of Object.keys(value)) {
    if (key !== "schema" && key !== "guides") {
      problems.push({ where: key, message: `\`${key}\` \u306F\u66F8\u3051\u307E\u305B\u3093` });
    }
  }
  if (value.schema !== GUIDE_SCHEMA) {
    problems.push({
      where: "schema",
      message: `\`schema\` \u306F ${GUIDE_SCHEMA} \u306B\u3057\u307E\u3059`
    });
  }
  if (!Array.isArray(value.guides)) {
    problems.push({
      where: "guides",
      message: "`guides` \u306F\u884C\u306E\u4E26\u3073\u306B\u3057\u307E\u3059"
    });
    return { entries, problems };
  }
  const names = /* @__PURE__ */ new Set();
  value.guides.forEach((item, position) => {
    const where = `guides[${position}]`;
    if (!isRecord(item)) {
      problems.push({ where, message: "\u884C\u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059" });
      return;
    }
    const before = problems.length;
    for (const key of Object.keys(item)) {
      if (!ENTRY_KEYS.includes(key)) {
        problems.push({
          where: `${where}.${key}`,
          message: `\`${key}\` \u306F\u66F8\u3051\u307E\u305B\u3093`
        });
      }
    }
    for (const key of ENTRY_KEYS) {
      const field = item[key];
      if (typeof field !== "string" || field === "") {
        problems.push({
          where: `${where}.${key}`,
          message: `\`${key}\` \u306F\u7A7A\u3067\u306A\u3044\u6587\u5B57\u5217\u306B\u3057\u307E\u3059`
        });
      }
    }
    const { name, page } = item;
    if (typeof name === "string" && name !== "") {
      if (names.has(name)) {
        problems.push({
          where: `${where}.name`,
          message: `\u540D\u524D \`${name}\` \u304C\u91CD\u306A\u3063\u3066\u3044\u307E\u3059`
        });
      }
      names.add(name);
    }
    if (typeof page === "string" && page !== "" && !(page.startsWith(PAGE_PREFIX) && page.endsWith(PAGE_SUFFIX))) {
      problems.push({
        where: `${where}.page`,
        message: `\`page\` \u306F \`${PAGE_PREFIX}\` \u3067\u59CB\u307E\u308A \`${PAGE_SUFFIX}\` \u3067\u7D42\u308F\u308B\u30D1\u30B9\u306B\u3057\u307E\u3059`
      });
    }
    if (problems.length === before) {
      entries.push(item);
    }
  });
  return { entries, problems };
}
async function readGuideIndex(guideDir) {
  const path = join(guideDir, GUIDE_INDEX_FILE);
  let reason;
  try {
    const { entries, problems } = parseGuideIndex(
      JSON.parse(await readFile(path, "utf8"))
    );
    const first = problems[0];
    if (first === void 0) {
      return entries;
    }
    reason = `${first.where}: ${first.message}`;
  } catch (error) {
    reason = error instanceof Error ? error.message.split("\n")[0] ?? error.message : String(error);
  }
  throw new CliError(
    `\u4F7F\u3044\u65B9\u96C6\u306E\u7D22\u5F15 ${path} \u3092\u8AAD\u3081\u307E\u305B\u3093\uFF08${reason}\uFF09\u3002\u30D7\u30E9\u30B0\u30A4\u30F3\u3092\u5165\u308C\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
  );
}
function toCell(text) {
  return text.replaceAll("|", "\\|").replace(/\s*\n\s*/g, " ");
}
function formatGuideContext(entries) {
  return [
    GUIDE_CONTEXT_LEAD,
    "| \u540D\u524D | \u8AAD\u3080\u3068\u304D | \u6982\u8981 |",
    "| --- | --- | --- |",
    ...entries.map(
      (entry) => `| ${toCell(entry.name)} | ${toCell(entry.when)} | ${toCell(entry.summary)} |`
    )
  ].join("\n");
}

// src/plugin/session-start.ts
var GUIDE_DIR = "guide";
async function runSessionStart(options) {
  const { moduleDir, stdout, stderr } = options;
  let additionalContext;
  try {
    const entries = await readGuideIndex(
      join2(resolve2(moduleDir, ".."), GUIDE_DIR)
    );
    additionalContext = formatGuideContext(entries);
  } catch (error) {
    if (error instanceof CliError) {
      stderr(error.message);
      return 1;
    }
    throw error;
  }
  stdout(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext }
    })
  );
  return 0;
}
if (import.meta.main) {
  process.exitCode = await runSessionStart({
    moduleDir: import.meta.dirname,
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line)
  });
}
export {
  runSessionStart
};
