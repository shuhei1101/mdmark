import { resolve } from "node:path";
import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { cliVersion } from "../cli/versions.ts";
import { ACCEPT_ALL_VALIDATOR } from "./arguments.ts";
import { callTool, TOOLS, type ToolContext } from "./tools.ts";

/** MCP サーバーの名前（`serverInfo.name`） */
export const SERVER_NAME = "mdmark";

/** MCP の `instructions` に渡す、何のためにどのツールを呼ぶかの事実の文 */
export const INSTRUCTIONS =
  "mdmark の記法・部品・図の描き方・拡張の仕方は、使い方集の索引の名前を read_guide に渡すと読める。文書の書き出しは export_html、まとめは build_site、点検は check、索引の文書の検索は find_docs、索引の書き換えは update_index で行える。";

/** Claude Code が MCP サーバーに渡すセッションのフォルダの環境変数の名前 */
export const PROJECT_DIR_ENV = "CLAUDE_PROJECT_DIR";

/** `instructions` を持ち、`TOOLS` のツールを登録した `McpServer` を作る */
export function createMcpServer(options: {
  /** ツールの前提 */
  context: ToolContext;
  /** サーバーのバージョン（mdmark のバージョン） */
  version: string;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): McpServer {
  const { context, version, stderr } = options;
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
      },
      (args) => callTool({ tool, args, context, stderr }),
    );
  }
  return server;
}

/** 環境変数から作業のフォルダを取り、標準入出力で MCP サーバーを動かす。作業のフォルダが無ければ 1 を返す */
export async function runMcpServer(options: {
  /** 環境変数 */
  env: Record<string, string | undefined>;
  /** このファイルのあるフォルダ（`plugin/server`） */
  moduleDir: string;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): Promise<0 | 1> {
  const { env, moduleDir, stderr } = options;
  const projectDir = env[PROJECT_DIR_ENV];
  if (!projectDir) {
    stderr(
      `環境変数 ${PROJECT_DIR_ENV} がありません。Claude Code のプラグインから起動してください。`,
    );
    return 1;
  }
  const context = { projectDir, pluginDir: resolve(moduleDir, "..") };
  serveStdio(() => createMcpServer({ context, version: cliVersion(), stderr }));
  return 0;
}

// 束ねた `plugin/server/mcp.js` を入口として実行されたときだけ流す
if (import.meta.main) {
  process.exitCode = await runMcpServer({
    env: process.env,
    moduleDir: import.meta.dirname,
    stderr: (line) => console.error(line),
  });
}
