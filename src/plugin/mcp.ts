import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { ACCEPT_ALL_VALIDATOR } from "./arguments.ts";
import { callTool, type ServerRoots, TOOLS } from "./tools.ts";

/** MCP サーバーの名前（`serverInfo.name`） */
export const SERVER_NAME = "mdmark";

/** MCP の `instructions` に渡す、何のためにどのツールを呼ぶかの事実の文 */
export const INSTRUCTIONS =
  "mdmark の記法・部品・図の描き方・拡張の仕方は、使い方集の索引の名前を read_guide に渡すと読める。文書の書き出しは export_html、まとめは build_site、点検は check で行える。";

/** `instructions` を持ち、`TOOLS` のツールを登録した `McpServer` を作る */
export function createMcpServer(options: {
  /** サーバーの読む場所 */
  roots: ServerRoots;
  /** サーバーのバージョン（mdmark のバージョン） */
  version: string;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): McpServer {
  const { roots, version, stderr } = options;
  const server = new McpServer(
    { name: SERVER_NAME, version },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );
  for (const tool of TOOLS) {
    // SDK の検査は英語の文を返すため素通しにし、`callTool` が日本語の文で検査する
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: fromJsonSchema(tool.inputSchema, ACCEPT_ALL_VALIDATOR),
        ...(tool.annotations !== undefined && {
          annotations: tool.annotations,
        }),
      },
      (args) => callTool({ tool, args, roots, stderr }),
    );
  }
  return server;
}
