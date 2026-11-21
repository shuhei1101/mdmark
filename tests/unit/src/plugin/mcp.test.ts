import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, expect, test } from "vitest";
import { stringify } from "yaml";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** MCP サーバーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMcp = () => import("../../../../src/plugin/mcp.ts");

/** ツールの一覧を読み込む */
const loadTools = () => import("../../../../src/plugin/tools.ts");

const createTempDir = useTempDirs();

/** リポジトリの直下 */
const REPOSITORY_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

/** テストで指定する instructions と description */
const createPrompts = (names: string[]) => ({
  instructions: "テストの instructions",
  descriptions: Object.fromEntries(names.map((name) => [name, `${name} の説明`])),
});

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

/** サーバーを作り、`InMemoryTransport` で SDK のクライアントとつなぐ */
async function connectClient(): Promise<Client> {
  const { createMcpServer } = await loadMcp();
  const { TOOLS } = await loadTools();
  const packageDir = await createTempDir();
  const server = createMcpServer({
    roots: { distDir: join(packageDir, "dist") },
    version: "v0.0.0",
    prompts: createPrompts(TOOLS.map((tool) => tool.name)),
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
  const { TOOLS } = await loadTools();
  const prompts = createPrompts(TOOLS.map((tool) => tool.name));
  const client = await connectClient();
  // 実行
  const { tools } = await client.listTools();
  // 検証
  expect(tools.map((tool) => tool.name).sort()).toEqual(
    TOOLS.map((tool) => tool.name).sort(),
  );
  expect(tools).toHaveLength(7);
  for (const tool of tools) {
    expect(Object.keys(tool.inputSchema.properties ?? {})).not.toContain(
      "project_dir",
    );
    expect(tool.description).toBe(prompts.descriptions[tool.name]);
    if (tool.name === "check" || tool.name === "list_templates") {
      expect(tool.annotations).toEqual({ readOnlyHint: true });
    } else {
      expect(tool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
      });
    }
  }
  expect(client.getInstructions()).toBe(prompts.instructions);
});

// 合わない引数は SDK でなく日本語の文で返る（正常系）
test("test_create_mcp_server_when_arguments_invalid", async () => {
  // 準備
  const client = await connectClient();
  const projectDir = await createTempDir();
  // 実行
  const result = await client.callTool({
    name: "export_html",
    arguments: { project_dir: projectDir },
  });
  // 検証
  expect(result.isError).toBe(true);
  const text = (result.content as { type: string; text: string }[])
    .map((item) => item.text)
    .join("\n");
  expect(text).not.toContain("Input validation error");
  expect(text).toContain("file");
});

// systemd なら unit とログ、ほかは tmux のセッション（正常系）
test("test_describe_server_location", async () => {
  // 準備
  const { describeServerLocation } = await loadMcp();
  // 実行・検証
  expect(
    describeServerLocation({ launcher: "systemd", unit: "u", session: "s" }),
  ).toBe("systemd --user の unit u（ログは journalctl --user -u u）");
  expect(
    describeServerLocation({ launcher: "tmux", unit: "u", session: "s" }),
  ).toBe("tmux のセッション s");
  expect(
    describeServerLocation({ launcher: undefined, unit: "u", session: "s" }),
  ).toBe("tmux のセッション s");
});

// リポジトリのプロンプトファイルから全てのツールの文を描く（正常系）
test("test_load_server_prompts", async () => {
  // 準備
  const { loadServerPrompts } = await loadMcp();
  const { TOOLS } = await loadTools();
  // 実行
  const prompts = await loadServerPrompts({
    root: REPOSITORY_ROOT,
    serverLocation: "tmux のセッション s",
  });
  // 検証
  expect(prompts.instructions).toContain("tmux のセッション s");
  expect(prompts.instructions.length).toBeLessThanOrEqual(4096);
  expect(Object.keys(prompts.descriptions).sort()).toEqual(
    TOOLS.map((tool) => tool.name).sort(),
  );
  for (const description of Object.values(prompts.descriptions)) {
    expect(description.length).toBeGreaterThan(0);
  }
});

// ツールのプロンプトファイルが無いと誤りにする（異常系）
test("test_load_server_prompts_when_prompt_missing", async () => {
  // 準備
  const { loadServerPrompts } = await loadMcp();
  const { PromptError } = await import("../../../../src/plugin/prompt.ts");
  const root = await createTempDir();
  await writeFiles(root, {
    "content/prompts/mcp/mdmark/instructions.yaml": stringify({
      id: "mcp/mdmark/instructions",
      name: "mdmark の MCP の instructions",
      description: "mdmark の MCP サーバーの使用方法を伝える",
      kind: "instructions",
      lang: "ja",
      vars: {
        location: {
          type: "string",
          required: true,
          description: "常駐サーバーが動いている場所",
          example: "tmux のセッション s",
        },
      },
      parts: [
        { id: "location", texts: [{ lang: "ja", text: "{{ location }}で動く\n" }] },
      ],
    }),
  });
  // 実行・検証
  await expect(
    loadServerPrompts({ root, serverLocation: "tmux のセッション s" }),
  ).rejects.toThrow(PromptError);
});
