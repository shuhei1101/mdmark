import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, expect, test } from "vitest";
import { useTempDirs } from "../../helpers/cli.ts";

/** MCP サーバーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMcp = () => import("../../../../src/plugin/mcp.ts");

/** ツールの一覧を読み込む */
const loadTools = () => import("../../../../src/plugin/tools.ts");

const createTempDir = useTempDirs();

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

/** サーバーを作り、`InMemoryTransport` で SDK のクライアントとつなぐ */
async function connectClient(): Promise<Client> {
  const { createMcpServer } = await loadMcp();
  const packageDir = await createTempDir();
  const server = createMcpServer({
    roots: {
      guideDir: join(packageDir, "plugin", "guide"),
      distDir: join(packageDir, "dist"),
    },
    version: "v0.0.0",
    stderr: () => {},
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closers.push(
    () => client.close(),
    () => server.close(),
  );
  return client;
}

// 4 つのツールと instructions と annotations を出す（正常系）
test("test_create_mcp_server", async () => {
  // 準備
  const { INSTRUCTIONS } = await loadMcp();
  const { TOOLS } = await loadTools();
  const client = await connectClient();
  // 実行
  const { tools } = await client.listTools();
  // 検証
  expect(tools.map((tool) => tool.name).sort()).toEqual(
    TOOLS.map((tool) => tool.name).sort(),
  );
  expect(tools).toHaveLength(4);
  for (const tool of tools) {
    expect(Object.keys(tool.inputSchema.properties ?? {})).not.toContain(
      "project_dir",
    );
  }
  const readOnlyNames = ["read_guide", "check"];
  for (const name of readOnlyNames) {
    const tool = tools.find((candidate) => candidate.name === name);
    expect(tool?.annotations?.readOnlyHint).toBe(true);
  }
  expect(client.getInstructions()).toBe(INSTRUCTIONS);
});

// 合わない引数は SDK でなく日本語の文で返る（正常系）
test("test_create_mcp_server_when_arguments_invalid", async () => {
  // 準備
  const client = await connectClient();
  // 実行
  const result = await client.callTool({
    name: "read_guide",
    arguments: { names: [] },
  });
  // 検証
  expect(result.isError).toBe(true);
  const text = (result.content as { type: string; text: string }[])
    .map((item) => item.text)
    .join("\n");
  expect(text).not.toContain("Input validation error");
  expect(text).toContain("names");
});
