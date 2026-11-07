import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { ACCEPT_ALL_VALIDATOR } from "./arguments.ts";
import { callTool, type ServerRoots, TOOLS } from "./tools.ts";

/** MCP サーバーの名前（`serverInfo.name`） */
export const SERVER_NAME = "mdmark";

/** MCP の `instructions` に渡す、使う場面と順序の事実の文。`{session}` を tmux のセッション名に置き換える */
export const INSTRUCTIONS =
  "mdmark は Markdown 文書の記法・部品・図を描くライブラリで、この MCP サーバーは mdmark の文書の点検（check）・HTML への書き出し（export_html）・1 枚へのまとめ（build_site）を持つ。\n" +
  "mdmark の記法・部品・図の書き方は、使い方集として dev-docs の配信元 mdmark にある。\n" +
  'mdmark の文書を書く前に、dev-docs の search_docs で source: "mdmark" の kind が docs の文書をタグ topic:使い方集 で絞って一覧を引き、当てはまるページを view: "full" で読む。作業場所が mdmark のリポジトリの外なら outside_scope: true を付ける。\n' +
  "dev-docs が無い、または配信元 mdmark が登録されていないときは、dev-docs が無いので見つかりません。\n" +
  "書いた後は check で点検し、図は使い方集の『描いた図を確かめる』の手順で確かめる。\n" +
  "記法を使わない Markdown の編集とコードの調査には、この MCP サーバーと使い方集は要らない。\n" +
  "この常駐サーバーは tmux のセッション {session} で動く。止まったときは /mdmark:global-setup で起動し直せる。";

/** `instructions` を持ち、`TOOLS` のツールを登録した `McpServer` を作る */
export function createMcpServer(options: {
  /** サーバーの読む場所 */
  roots: ServerRoots;
  /** サーバーのバージョン（mdmark のバージョン） */
  version: string;
  /** 常駐サーバーが動いている tmux のセッション名 */
  sessionName: string;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): McpServer {
  const { roots, version, sessionName, stderr } = options;
  const server = new McpServer(
    { name: SERVER_NAME, version },
    {
      capabilities: { tools: {} },
      instructions: INSTRUCTIONS.replace("{session}", sessionName),
    },
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
