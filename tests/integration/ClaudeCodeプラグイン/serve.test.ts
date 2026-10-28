import { createServer } from "node:net";
import { expect, test } from "vitest";
import { findFreePort, useMcpServers } from "../plugin.ts";

const { startServe, runServeToExit, connectUrl } = useMcpServers();

// 空きポートで待ち受ける URL を出す。ツールの数 7 つ（正常系）
test("test_normal", async () => {
  // 準備・実行
  const port = await findFreePort();
  const serve = await startServe({ env: { MDMARK_PORT: String(port) } });
  const client = await connectUrl(serve.url);
  const { tools } = await client.listTools();
  // 検証
  expect(serve.stdout()).toContain(`http://127.0.0.1:${port}/mcp`);
  expect(tools).toHaveLength(7);
  for (const tool of tools) {
    expect(Object.keys(tool.inputSchema.properties ?? {})).not.toContain(
      "project_dir",
    );
  }
  expect(serve.isRunning()).toBe(true);
});

// MDMARK_PORT のポートで待ち受ける（正常系（ポートを上書きする））
test("test_normal_when_port_overridden", async () => {
  // 準備・実行
  const serve = await startServe({ env: { MDMARK_PORT: "18782" } });
  const client = await connectUrl("http://127.0.0.1:18782/mcp");
  const { tools } = await client.listTools();
  // 検証
  expect(serve.stdout()).toContain("http://127.0.0.1:18782/mcp");
  expect(tools).toHaveLength(7);
});

// SIGINT を受けて待ち受けを閉じ、終了コード 0 で終わる（正常系（止める））
test("test_normal_when_stop", async () => {
  // 準備
  const port = await findFreePort();
  const serve = await startServe({ env: { MDMARK_PORT: String(port) } });
  // 実行
  const code = await serve.interrupt();
  // 検証
  expect(code).toBe(0);
  const refused = await fetch(serve.url).catch((error: unknown) => error);
  expect((refused as { cause?: { code?: string } }).cause?.code).toBe(
    "ECONNREFUSED",
  );
});

// ポートを別のプロセスが使っているとき、対処を出して終わる（異常系（ポートが使われている・終了コード 1））
test("test_error_when_port_in_use", async () => {
  // 準備
  const port = await findFreePort();
  const occupant = createServer();
  await new Promise<void>((resolve) =>
    occupant.listen(port, "127.0.0.1", () => resolve()),
  );
  try {
    // 実行
    const result = await runServeToExit({
      env: { MDMARK_PORT: String(port) },
    });
    // 検証
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(String(port));
    expect(result.stderr).toContain("MDMARK_PORT");
    expect(result.stderr).toContain("~/.claude/settings.json");
    expect(result.stderr).toContain("mdmark serve が既に起動している");
  } finally {
    await new Promise<void>((resolve) => occupant.close(() => resolve()));
  }
});

// MDMARK_PORT が整数でないとき、待ち受けずに終わる（異常系（MDMARK_PORT が使えない値・終了コード 1））
test("test_error_when_port_invalid", async () => {
  // 実行
  const result = await runServeToExit({ env: { MDMARK_PORT: "abc" } });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("abc");
  expect(result.stderr).toContain("1〜65535");
});
