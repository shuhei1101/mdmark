import { join } from "node:path";
import {
  describeError,
  isListening,
  readMcpUrl,
  withMcpClient,
} from "../plugin.ts";
import {
  expect,
  runSessionStartHook,
  runSetupScript,
  startTmuxServer,
  test,
} from "../setup-skill.ts";

// ブラウザを使用しないため、1 つのブラウザのプロジェクトだけで実行する
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 既定のセッション名
const SESSION = "mdmark-mcp";

/** ビルドした作業ツリーの `plugin/` */
const pluginOf = (builtRoot: string) => join(builtRoot, "plugin");

// 常駐サーバーが待ち受けていればフックは何も出さず、instructions がセッション名を伝える（正常シナリオ）
test("test_normal", async ({ builtRoot, terminal }) => {
  // 準備
  const pluginDir = pluginOf(builtRoot);
  await startTmuxServer(terminal);
  const started = await runSetupScript({
    pluginDir,
    terminal,
    args: ["start-server"],
  });
  expect(started.code, started.stderr).toBe(0);
  // 実行
  const hook = await runSessionStartHook({ pluginDir, terminal });
  const mcp = await readMcpUrl({ pluginDir, env: terminal.env });
  const instructions = await withMcpClient(
    { builtRoot, serverUrl: mcp.url },
    async (client) => client.getInstructions() ?? "",
  );
  // 検証
  expect(hook).toEqual({ code: 0, stdout: "", stderr: "" });
  expect(instructions).toContain(SESSION);
  expect(instructions).toContain("/mdmark:global-setup");
});

// 常駐サーバーが待ち受けていなければ、フックが起動の仕方を 1 行で指定し、接続は拒否される（異常シナリオ（起動していない））
test("test_error_when_server_not_running", async ({ builtRoot, terminal }) => {
  // 準備
  const pluginDir = pluginOf(builtRoot);
  expect(await isListening(terminal.port)).toBe(false);
  // 実行
  const hook = await runSessionStartHook({ pluginDir, terminal });
  const mcp = await readMcpUrl({ pluginDir, env: terminal.env });
  const connecting = await withMcpClient(
    { builtRoot, serverUrl: mcp.url },
    async () => undefined,
  ).catch((error: unknown) => error);
  // 検証
  expect(hook.code).toBe(0);
  const lines = hook.stdout.split("\n").filter(Boolean);
  expect(lines).toHaveLength(1);
  const context = JSON.parse(lines[0] ?? "").hookSpecificOutput
    .additionalContext as string;
  expect(context).toContain(`127.0.0.1:${terminal.port}`);
  expect(context).toContain("/mdmark:global-setup");
  expect(connecting).toBeInstanceOf(Error);
  expect(describeError(connecting)).toContain("ECONNREFUSED");
});
