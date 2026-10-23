import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** SessionStart のフックを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSessionStart = () =>
  import("../../../../src/plugin/session-start.ts");

const createTempDir = useTempDirs();

/** 索引の行を作る（`page` は `docs/{名前}.md`） */
function createEntry(name: string) {
  return {
    name,
    when: `${name} を書くとき`,
    summary: `${name} の概要`,
    page: `docs/${name}.md`,
  };
}

// 索引の文を hookSpecificOutput で書く（正常系）
test("test_run_session_start", async () => {
  // 準備
  const { runSessionStart } = await loadSessionStart();
  const pluginDir = await createTempDir();
  await writeFiles(pluginDir, {
    "guide/index.json": JSON.stringify({
      schema: 1,
      guides: [createEntry("notation"), createEntry("extension")],
    }),
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  // 実行
  const code = await runSessionStart({
    moduleDir: join(pluginDir, "scripts"),
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  const output = JSON.parse(stdout[0] ?? "");
  expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
  expect(output.hookSpecificOutput.additionalContext).toContain("notation");
  expect(output.hookSpecificOutput.additionalContext).toContain("extension");
  expect(stderr).toEqual([]);
});

// 索引が無ければ標準出力を空にして 1 を返す（正常系）
test("test_run_session_start_when_index_missing", async () => {
  // 準備
  const { runSessionStart } = await loadSessionStart();
  const pluginDir = await createTempDir();
  const stdout: string[] = [];
  const stderr: string[] = [];
  // 実行
  const code = await runSessionStart({
    moduleDir: join(pluginDir, "scripts"),
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(code).toBe(1);
  expect(stdout).toEqual([]);
  const logged = stderr.join("\n");
  expect(logged).toContain("index.json");
  expect(logged).toContain("入れ直して");
});
