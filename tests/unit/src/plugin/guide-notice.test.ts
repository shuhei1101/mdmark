import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

/** 案内のフックを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGuideNotice = () => import("../../../../src/plugin/guide-notice.ts");

/** テストごとに作った一時フォルダ */
const created: string[] = [];

afterEach(async () => {
  await Promise.all(
    created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

/** 一時フォルダを作り、その下の記録のフォルダのパスを返却する */
async function createNoticeDir(): Promise<{ root: string; dir: string }> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-guide-notice-test-"));
  created.push(root);
  return { root, dir: join(root, "notices") };
}

/** ファイルがあるか */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** フックを呼び、書き込んだ行を返却する */
async function run(options: {
  dir: string;
  input: Record<string, unknown> | string;
}): Promise<{ code: number; stdout: string[] }> {
  const { runGuideNotice } = await loadGuideNotice();
  const stdout: string[] = [];
  const code = await runGuideNotice({
    env: { MDMARK_GUIDE_NOTICE_DIR: options.dir },
    input:
      typeof options.input === "string"
        ? options.input
        : JSON.stringify(options.input),
    stdout: (line) => stdout.push(line),
    tmpdir: () => tmpdir(),
  });
  return { code, stdout };
}

/** `a.mark.md` への Write の呼び出し */
const writeMarkMd = (sessionId: string) => ({
  session_id: sessionId,
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: { file_path: "/w/a.mark.md", content: "# A" },
});

// .mark.md への Write で案内し、記録を作る（正常系）
test("test_run_guide_notice", async () => {
  // 準備
  const { NOTICE_BODY } = await loadGuideNotice();
  const { dir } = await createNoticeDir();
  // 実行
  const { code, stdout } = await run({ dir, input: writeMarkMd("s1") });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  const output = JSON.parse(stdout[0] ?? "");
  expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(output.hookSpecificOutput.additionalContext).toBe(
    `a.mark.md は mdmark の記法で記載する文書。${NOTICE_BODY}`,
  );
  expect(output.hookSpecificOutput.permissionDecision).toBeUndefined();
  expect(output.hookSpecificOutput.updatedInput).toBeUndefined();
  expect(await exists(join(dir, "s1"))).toBe(true);
});

// 記録のあるセッションでは何も書き込まない（正常系）
test("test_run_guide_notice_when_already_noticed", async () => {
  // 準備
  const { dir } = await createNoticeDir();
  await run({ dir, input: writeMarkMd("s1") });
  // 実行
  const { code, stdout } = await run({
    dir,
    input: {
      ...writeMarkMd("s1"),
      tool_name: "Edit",
      tool_input: { file_path: "/w/a.mark.md" },
    },
  });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual([]);
});

// 語 mdmark を含む発言で案内する（正常系）
test("test_run_guide_notice_when_prompt", async () => {
  // 準備
  const { NOTICE_BODY } = await loadGuideNotice();
  const { dir } = await createNoticeDir();
  // 実行
  const { code, stdout } = await run({
    dir,
    input: {
      session_id: "s3",
      hook_event_name: "UserPromptSubmit",
      prompt: "設計メモを MDMark で書いて",
    },
  });
  // 検証
  expect(code).toBe(0);
  const output = JSON.parse(stdout[0] ?? "");
  expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
  expect(output.hookSpecificOutput.additionalContext).toBe(
    `利用者が mdmark で記載するよう指示した。${NOTICE_BODY}`,
  );
  expect(output.decision).toBeUndefined();
  expect(await exists(join(dir, "s3"))).toBe(true);
});

// PreCompact で記録を削除し、次の Write でもう一度案内する（正常系）
test("test_run_guide_notice_when_compacted", async () => {
  // 準備
  const { dir } = await createNoticeDir();
  await run({ dir, input: writeMarkMd("s1") });
  // 実行
  const compacted = await run({
    dir,
    input: { session_id: "s1", hook_event_name: "PreCompact", trigger: "auto" },
  });
  const removed = !(await exists(join(dir, "s1")));
  const again = await run({ dir, input: writeMarkMd("s1") });
  // 検証
  expect(compacted.code).toBe(0);
  expect(compacted.stdout).toEqual([]);
  expect(removed).toBe(true);
  expect(again.stdout).toHaveLength(1);
});

// 使用できない session_id では記録も案内もしない（異常系）
test("test_run_guide_notice_when_session_unusable", async () => {
  // 準備
  const { root, dir } = await createNoticeDir();
  // 実行
  const { code, stdout } = await run({ dir, input: writeMarkMd("../x") });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual([]);
  expect(await exists(join(root, "x"))).toBe(false);
  expect(await exists(dir)).toBe(false);
});

// JSON として読めない標準入力では何もしない（異常系）
test("test_run_guide_notice_when_input_unreadable", async () => {
  // 準備
  const { dir } = await createNoticeDir();
  // 実行
  const { code, stdout } = await run({ dir, input: "{" });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual([]);
});

// 記録のフォルダに書き込めないときは案内しない（異常系）
test("test_run_guide_notice_when_dir_unwritable", async () => {
  // 準備
  const { root } = await createNoticeDir();
  const file = join(root, "file");
  await writeFile(file, "");
  // 実行
  const { code, stdout } = await run({ dir: file, input: writeMarkMd("s1") });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual([]);
});

// hooks.json の行が guide-notice.js を起動する（正常系）
test("test_run_guide_notice_when_matcher", async () => {
  // 準備
  const hooks = JSON.parse(
    await readFile(
      join(process.cwd(), "plugin", "hooks", "hooks.json"),
      "utf8",
    ),
  );
  const script = "${CLAUDE_PLUGIN_ROOT}/scripts/guide-notice.js";
  const runs = (entry: { hooks: { args?: string[] }[] }) =>
    entry.hooks.some((hook) => hook.args?.includes(script));
  // 実行
  const preToolUse = hooks.hooks.PreToolUse.filter(runs);
  const prompt = (hooks.hooks.UserPromptSubmit ?? []).filter(runs);
  const compact = (hooks.hooks.PreCompact ?? []).filter(runs);
  // 検証
  expect(preToolUse.map((entry: { matcher: string }) => entry.matcher)).toEqual(
    ["Write|Edit"],
  );
  expect(prompt).toHaveLength(1);
  expect(compact).toHaveLength(1);
});

// 純粋な .md と mdmark を含まない発言では null（正常系）
test("test_notice_head_when_plain_md", async () => {
  // 準備
  const { noticeHead } = await loadGuideNotice();
  // 実行
  const plain = noticeHead({
    hook_event_name: "PreToolUse",
    tool_input: { file_path: "/w/README.md" },
  });
  const prompt = noticeHead({
    hook_event_name: "UserPromptSubmit",
    prompt: "README を直して",
  });
  // 検証
  expect(plain).toBeNull();
  expect(prompt).toBeNull();
});
