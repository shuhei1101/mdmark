import { createServer } from "node:net";
import { expect, test } from "../cli.ts";
import {
  findFreePort,
  isListening,
  runServeToExit,
  withMcpClient,
  withServe,
} from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 接続先を呼んで、MCP のツールの名前を並べる */
async function listToolNames(
  builtRoot: string,
  serverUrl: string,
): Promise<string[]> {
  return withMcpClient({ builtRoot, serverUrl }, async (client) =>
    (await client.listTools()).tools.map((tool) => tool.name),
  );
}

// MDMARK_PORT に指定したポートで待ち受ける URL を出し、クライアントがツールの一覧を受け取る（正常シナリオ（起動する））
test("test_normal_when_start", async ({ builtRoot }) => {
  // 準備
  const port = await findFreePort();
  // 実行
  const { url, listening, running, tools, stdout } = await withServe(
    { builtRoot, env: { MDMARK_PORT: String(port) } },
    async (serve) => ({
      url: serve.url,
      stdout: serve.stdout(),
      listening: await isListening(port),
      running: serve.isRunning(),
      tools: await listToolNames(builtRoot, serve.url),
    }),
  );
  // 検証
  expect(url).toBe(`http://127.0.0.1:${port}/mcp`);
  expect(stdout).toContain(`http://127.0.0.1:${port}/mcp`);
  expect(listening).toBe(true);
  expect(running).toBe(true);
  expect([...tools].sort()).toEqual(["build_site", "check", "export_html"]);
});

// SIGINT で終了コード 0 で終わり、待ち受けるプロセスが残らない（正常シナリオ（止める））
test("test_normal_when_stop", async ({ builtRoot }) => {
  // 実行
  const { code, listening, running } = await withServe(
    { builtRoot, env: {} },
    async (serve) => {
      const code = await serve.interrupt();
      return {
        code,
        listening: await isListening(serve.port),
        running: serve.isRunning(),
      };
    },
  );
  // 検証
  expect(code).toBe(0);
  expect(listening).toBe(false);
  expect(running).toBe(false);
});

// ポートをほかのプロセスが使っているとき、理由と修正方法を出して終わり、ほかのプロセスはそのまま待ち受ける（異常シナリオ（ポートが使われている））
test("test_error_when_port_in_use", async ({ builtRoot }) => {
  // 準備
  const occupant = createServer();
  await new Promise<void>((resolve) =>
    occupant.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = occupant.address();
  if (address === null || typeof address === "string") {
    throw new Error("ほかのプロセスのポートを取れなかった");
  }
  const port = address.port;
  try {
    // 実行
    const result = await runServeToExit({
      builtRoot,
      env: { MDMARK_PORT: String(port) },
    });
    // 検証
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(String(port));
    expect(result.stderr).toContain("MDMARK_PORT");
    expect(result.stderr).toContain("~/.claude/settings.json");
    expect(await isListening(port)).toBe(true);
  } finally {
    await new Promise<void>((resolve) => occupant.close(() => resolve()));
  }
});

// MDMARK_PORT がポートとして使えない値のとき、理由と修正方法を出して終わる（異常シナリオ（MDMARK_PORT が使えない値））
test("test_error_when_port_invalid", async ({ builtRoot }) => {
  // 実行
  const result = await runServeToExit({
    builtRoot,
    env: { MDMARK_PORT: "abc" },
  });
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("abc");
  expect(result.stderr).toContain("1〜65535");
  expect(result.stdout).toBe("");
});
