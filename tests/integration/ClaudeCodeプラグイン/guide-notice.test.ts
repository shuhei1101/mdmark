import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs } from "../cli.ts";
import { builtPluginDir, runGuideNoticeHook } from "../plugin.ts";

const createTempDir = useTempDirs();

/** 案内の文の本体 */
const NOTICE_BODY =
  "記載する前に、mdmark の MCP の instructions のとおりにガイドを参照し、記載した後は check で点検する。";

/** 記録のフォルダを一時フォルダの下に用意し、フックに渡す環境変数と一緒に返却する */
async function createNoticeDir(): Promise<{
  root: string;
  dir: string;
  env: Record<string, string>;
}> {
  const root = await createTempDir();
  const dir = join(root, "notices");
  return { root, dir, env: { MDMARK_GUIDE_NOTICE_DIR: dir } };
}

/** フォルダの中のファイルの名前。フォルダが無ければ空 */
async function listNames(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

/** `file_path` への `tool_name` の PreToolUse の呼び出しの JSON */
function toolInput(options: {
  sessionId: string;
  toolName: "Write" | "Edit";
  filePath: string;
}): string {
  return JSON.stringify({
    session_id: options.sessionId,
    hook_event_name: "PreToolUse",
    tool_name: options.toolName,
    tool_input: { file_path: options.filePath, content: "# A" },
  });
}

/** `prompt` の UserPromptSubmit の呼び出しの JSON */
function promptInput(sessionId: string, prompt: string): string {
  return JSON.stringify({
    session_id: sessionId,
    hook_event_name: "UserPromptSubmit",
    prompt,
  });
}

// .mark.md への Write でセッションの 1 回目だけ案内し、記録してから返却する（正常系）
test("test_normal", async () => {
  // 準備
  const { dir, env } = await createNoticeDir();
  // 実行
  const result = await runGuideNoticeHook({
    pluginDir: builtPluginDir(),
    event: "PreToolUse",
    env,
    input: toolInput({
      sessionId: "s1",
      toolName: "Write",
      filePath: "/w/docs/a.mark.md",
    }),
  });
  // 検証
  expect(result.code).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(output.hookSpecificOutput.additionalContext).toBe(
    `a.mark.md は mdmark の記法で記載する文書。${NOTICE_BODY}`,
  );
  expect(output.hookSpecificOutput.permissionDecision).toBeUndefined();
  expect(output.hookSpecificOutput.updatedInput).toBeUndefined();
  expect(await listNames(dir)).toEqual(["s1"]);
});

// 同じセッションの 2 回目は何も出さない（正常系（案内済みのセッション））
test("test_normal_when_already_noticed", async () => {
  // 準備
  const { env } = await createNoticeDir();
  const pluginDir = builtPluginDir();
  await runGuideNoticeHook({
    pluginDir,
    event: "PreToolUse",
    env,
    input: toolInput({
      sessionId: "s1",
      toolName: "Write",
      filePath: "/w/docs/a.mark.md",
    }),
  });
  // 実行
  const result = await runGuideNoticeHook({
    pluginDir,
    event: "PreToolUse",
    env,
    input: toolInput({
      sessionId: "s1",
      toolName: "Edit",
      filePath: "/w/docs/a.mark.md",
    }),
  });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
});

// .mark.md で終わらないファイルへの Write は案内も記録もしない（正常系（純粋な .md））
test("test_normal_when_plain_md", async () => {
  // 準備
  const { dir, env } = await createNoticeDir();
  // 実行
  const result = await runGuideNoticeHook({
    pluginDir: builtPluginDir(),
    event: "PreToolUse",
    env,
    input: toolInput({
      sessionId: "s2",
      toolName: "Write",
      filePath: "/w/README.md",
    }),
  });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
  expect(await listNames(dir)).toEqual([]);
});

// 発言が語 mdmark を含むとき、セッションの 1 回目だけ案内する（正常系（mdmark で記載するよう指示する））
test("test_normal_when_prompt_asks_mdmark", async () => {
  // 準備
  const { dir, env } = await createNoticeDir();
  // 実行
  const result = await runGuideNoticeHook({
    pluginDir: builtPluginDir(),
    event: "UserPromptSubmit",
    env,
    input: promptInput("s3", "設計メモを MDMark で書いて"),
  });
  // 検証
  expect(result.code).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
  expect(output.hookSpecificOutput.additionalContext).toBe(
    `利用者が mdmark で記載するよう指示した。${NOTICE_BODY}`,
  );
  expect(output.decision).toBeUndefined();
  expect(await listNames(dir)).toEqual(["s3"]);
});

// 語 mdmark を含まない発言は案内も記録もしない（正常系（mdmark を含まない発言））
test("test_normal_when_prompt_without_mdmark", async () => {
  // 準備
  const { dir, env } = await createNoticeDir();
  // 実行
  const result = await runGuideNoticeHook({
    pluginDir: builtPluginDir(),
    event: "UserPromptSubmit",
    env,
    input: promptInput("s4", "README を直して"),
  });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
  expect(await listNames(dir)).toEqual([]);
});

// session_id が使用できない値のときは案内せずに終わる（正常系（記録できない））
test("test_normal_when_session_unusable", async () => {
  // 準備
  const { root, dir, env } = await createNoticeDir();
  // 実行
  const result = await runGuideNoticeHook({
    pluginDir: builtPluginDir(),
    event: "PreToolUse",
    env,
    input: toolInput({
      sessionId: "../x",
      toolName: "Write",
      filePath: "/w/docs/a.mark.md",
    }),
  });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
  expect(await listNames(root)).toEqual([]);
  expect(await listNames(dir)).toEqual([]);
});

// PreCompact でそのセッションの記録を消し、圧縮の後の最初の .mark.md への Write でもう一度案内する（正常系（会話を圧縮する））
test("test_normal_when_compacted", async () => {
  // 準備
  const { env } = await createNoticeDir();
  const pluginDir = builtPluginDir();
  const write = toolInput({
    sessionId: "s1",
    toolName: "Write",
    filePath: "/w/docs/a.mark.md",
  });
  await runGuideNoticeHook({
    pluginDir,
    event: "PreToolUse",
    env,
    input: write,
  });
  // 実行
  const compacted = await runGuideNoticeHook({
    pluginDir,
    event: "PreCompact",
    env,
    input: JSON.stringify({
      session_id: "s1",
      hook_event_name: "PreCompact",
      trigger: "manual",
    }),
  });
  const again = await runGuideNoticeHook({
    pluginDir,
    event: "PreToolUse",
    env,
    input: write,
  });
  const unknown = await runGuideNoticeHook({
    pluginDir,
    event: "PreCompact",
    env,
    input: JSON.stringify({
      session_id: "s9",
      hook_event_name: "PreCompact",
      trigger: "auto",
    }),
  });
  // 検証
  expect(compacted.code).toBe(0);
  expect(compacted.stdout).toBe("");
  expect(JSON.parse(again.stdout).hookSpecificOutput.additionalContext).toBe(
    `a.mark.md は mdmark の記法で記載する文書。${NOTICE_BODY}`,
  );
  expect(unknown.code).toBe(0);
  expect(unknown.stdout).toBe("");
});
