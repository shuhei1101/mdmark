import { createServer } from "node:net";
import { expect, test } from "vitest";
import { INSTRUCTIONS } from "../../../src/plugin/mcp.ts";
import { findFreePort, useMcpServers } from "../plugin.ts";

const { startServe, runServeToExit, connectUrl } = useMcpServers();

// 空きポートで待ち受ける URL を出し、instructions と 6 つのツールを返却する（正常系）
test("test_normal", async () => {
  // 準備・実行
  const port = await findFreePort();
  const serve = await startServe({ env: { MDMARK_PORT: String(port) } });
  const client = await connectUrl(serve.url);
  const { tools } = await client.listTools();
  // 検証
  expect(serve.stdout()).toContain(`http://127.0.0.1:${port}/mcp`);
  const instructions = client.getInstructions() ?? "";
  expect(instructions).toBe(
    INSTRUCTIONS.replace("{location}", "tmux のセッション mdmark-mcp"),
  );
  expect(instructions).toContain("mdmark-mcp");
  expect(instructions.length).toBeLessThanOrEqual(4096);
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "add_template",
    "apply_template",
    "build_site",
    "check",
    "export_html",
    "list_templates",
  ]);
  for (const tool of tools) {
    expect(Object.keys(tool.inputSchema.properties ?? {})).not.toContain(
      "project_dir",
    );
  }
  expect(serve.isRunning()).toBe(true);
});

// MDMARK_LAUNCHER=systemd で起動すると、instructions が unit の名前とログを確認する操作を伝える（正常系（unit で動いている））
test("test_normal_when_launched_by_systemd", async () => {
  // 準備・実行
  const port = await findFreePort();
  const serve = await startServe({
    env: { MDMARK_PORT: String(port), MDMARK_LAUNCHER: "systemd" },
  });
  const client = await connectUrl(serve.url);
  // 検証
  const instructions = client.getInstructions() ?? "";
  expect(instructions.length).toBeLessThanOrEqual(4096);
  expect(instructions).toContain("unit mdmark-mcp");
  expect(instructions).toContain("journalctl --user -u mdmark-mcp");
  expect(instructions).not.toContain("tmux のセッション");
});

// MDMARK_PORT のポートで待ち受ける（正常系（ポートを上書きする））
test("test_normal_when_port_overridden", async () => {
  // 準備・実行
  const serve = await startServe({ env: { MDMARK_PORT: "18782" } });
  const client = await connectUrl("http://127.0.0.1:18782/mcp");
  const { tools } = await client.listTools();
  // 検証
  expect(serve.stdout()).toContain("http://127.0.0.1:18782/mcp");
  expect(tools).toHaveLength(6);
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

// ポートを別のプロセスが使用しているとき、対処を出して終わる（異常系（ポートが使用されている・終了コード 1））
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

// MDMARK_PORT が整数でないとき、待ち受けずに終わる（異常系（MDMARK_PORT が使用できない値・終了コード 1））
test("test_error_when_port_invalid", async () => {
  // 実行
  const result = await runServeToExit({ env: { MDMARK_PORT: "abc" } });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("abc");
  expect(result.stderr).toContain("1〜65535");
});
