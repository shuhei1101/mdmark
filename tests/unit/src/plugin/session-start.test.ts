import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

/** SessionStart のフックを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSessionStart = () =>
  import("../../../../src/plugin/session-start.ts");

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

/** 127.0.0.1 の空いたポートで待ち受け、そのポートを返却する */
async function listen(): Promise<number> {
  const server = createServer();
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

/** 空いたポートを取って閉じ、待ち受けていないポートを返却する */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

// 待ち受けていれば何も書き込まない（正常系）
test("test_run_session_start", async () => {
  // 準備
  const { runSessionStart } = await loadSessionStart();
  const port = await listen();
  const stdout: string[] = [];
  // 実行
  const code = await runSessionStart({
    env: { MDMARK_PORT: String(port) },
    stdout: (line) => stdout.push(line),
  });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual([]);
});

// 待ち受けていなければ 1 行を記載する（正常系）
test("test_run_session_start_when_not_listening", async () => {
  // 準備
  const { runSessionStart } = await loadSessionStart();
  const port = await closedPort();
  const stdout: string[] = [];
  // 実行
  const code = await runSessionStart({
    env: { MDMARK_PORT: String(port) },
    stdout: (line) => stdout.push(line),
  });
  // 検証
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  const output = JSON.parse(stdout[0] ?? "");
  expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
  const context: string = output.hookSpecificOutput.additionalContext;
  expect(context).not.toContain("\n");
  expect(context).toContain(`127.0.0.1:${port}`);
  expect(context).toContain("/mdmark:global-setup");
});

// 使用できないポートでも 0（正常系）
test("test_run_session_start_when_port_invalid", async () => {
  // 準備
  const { runSessionStart } = await loadSessionStart();
  const stdout: string[] = [];
  // 実行
  const code = await runSessionStart({
    env: { MDMARK_PORT: "abc" },
    stdout: (line) => stdout.push(line),
  });
  // 検証
  expect(code).toBe(0);
  const output = JSON.parse(stdout[0] ?? "");
  expect(output.hookSpecificOutput.additionalContext).toContain("abc");
});

// hooks.json の SessionStart の行（正常系）
test("test_run_session_start_when_hooks_json", async () => {
  // 準備
  const path = join(import.meta.dirname, "../../../../plugin/hooks/hooks.json");
  // 実行
  const hooks = JSON.parse(await readFile(path, "utf8")).hooks;
  // 検証
  expect(hooks.SessionStart).toHaveLength(1);
  const [entry] = hooks.SessionStart;
  expect(entry).not.toHaveProperty("matcher");
  expect(entry.hooks).toEqual([
    {
      type: "command",
      command: "node",
      // hooks.json の文字列をそのまま比べる（Claude Code が展開する）
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 展開しない文字列そのもの
      args: ["${CLAUDE_PLUGIN_ROOT}/scripts/session-start.js"],
    },
  ]);
});
