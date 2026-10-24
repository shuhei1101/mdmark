import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** MCP サーバーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMcp = () => import("../../../../src/plugin/mcp.ts");

/** ツールの一覧を読み込む */
const loadTools = () => import("../../../../src/plugin/tools.ts");

const createTempDir = useTempDirs();

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

/** サーバーを作り、`InMemoryTransport` で SDK のクライアントとつなぐ（作業のフォルダは渡さなければ空の一時フォルダ） */
async function connectClient(projectDir?: string): Promise<Client> {
  const { createMcpServer } = await loadMcp();
  const server = createMcpServer({
    context: {
      projectDir: projectDir ?? (await createTempDir()),
      pluginDir: await createTempDir(),
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

// 7 つのツールと instructions と annotations を出す（正常系）
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
  expect(tools).toHaveLength(7);
  const readOnlyNames = ["read_guide", "check", "find_docs", "list_tags"];
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

// structuredContent がクライアントまで届く（正常系）
test("test_create_mcp_server_when_structured", async () => {
  // 準備
  const projectDir = await createTempDir();
  await writeFiles(projectDir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    tags: [topic:mcp]",
      "tags:",
      "  - name: topic:mcp",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
  const client = await connectClient(projectDir);
  // 実行
  const result = await client.callTool({
    name: "list_tags",
    arguments: { format: "json" },
  });
  // 検証
  const structured = result.structuredContent as { tags: unknown } | undefined;
  expect(Array.isArray(structured?.tags)).toBe(true);
  const texts = result.content as { type: string; text: string }[];
  expect(texts).toHaveLength(1);
  expect(JSON.parse(texts[0]?.text ?? "")).toEqual(structured);
});

// 作業のフォルダが無ければ待ち受けない（正常系）
test("test_run_mcp_server_when_project_dir_missing", async () => {
  // 準備
  const { runMcpServer } = await loadMcp();
  const stderr: string[] = [];
  // 実行
  const code = await runMcpServer({
    env: {},
    moduleDir: "/plugin/server",
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(code).toBe(1);
  expect(stderr.some((line) => line.includes("CLAUDE_PROJECT_DIR"))).toBe(true);
});
