import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { ACCEPT_ALL_VALIDATOR } from "./arguments.ts";
import { callTool, type ServerRoots, TOOLS } from "./tools.ts";

/** MCP サーバーの名前（`serverInfo.name`） */
export const SERVER_NAME = "mdmark";

/** MCP の `instructions` に指定する、使用する場面と順序の事実の文。`{location}` を常駐サーバーが動いている場所の文に置き換える */
export const INSTRUCTIONS =
  "mdmark は Markdown 文書の記法・部品・図を描くライブラリで、この MCP サーバーは mdmark の文書の点検（check）・HTML への書き出し（export_html）・1 枚へのまとめ（build_site）と、利用側の CSS のテンプレートの一覧（list_templates）・登録（add_template）・配置（apply_template）を持つ。\n" +
  "mdmark の記法・部品・図の記載方法は、ガイドとして dev-docs の配信元 mdmark にある。\n" +
  'mdmark の文書を記載する前に、dev-docs の search_docs で source: "mdmark" の kind が docs の文書をタグ topic:ガイド で絞って一覧を引き、当てはまるページを view: "full" で読み込む。作業場所が mdmark のリポジトリの外なら outside_scope: true を付ける。\n' +
  "dev-docs が無い、または配信元 mdmark が登録されていないときは、dev-docs が無いので見つかりません。\n" +
  "記載した後は check で点検し、図はガイドの『描いた図を確認する』の手順で確認する。\n" +
  "利用側の CSS を探すときは list_templates で一覧を引き、選んだテンプレートを apply_template で配置して、返った theme の値を設定の theme に記載する。作った CSS を使い回すときは add_template で登録する。\n" +
  "mdmark の記法で記載する文書の拡張子は .mark.md で、利用者の指示が無い限り、純粋な .md には記法を使用しない。\n" +
  "記法を使用しない Markdown の編集とコードの調査には、この MCP サーバーとガイドは要らない。\n" +
  "この常駐サーバーは {location} で動く。止まったときは /mdmark:global-setup でもう一度起動できる。";

/** `instructions` の `{location}` に入れる、常駐サーバーが動いている場所の文を作る */
export const describeServerLocation = (options: {
  launcher: string | undefined;
  unit: string;
  session: string;
}): string =>
  options.launcher === "systemd"
    ? `systemd --user の unit ${options.unit}（ログは journalctl --user -u ${options.unit}）`
    : `tmux のセッション ${options.session}`;

/** `instructions` を持ち、`TOOLS` のツールを登録した `McpServer` を作る */
export function createMcpServer(options: {
  /** サーバーの読み込む場所 */
  roots: ServerRoots;
  /** サーバーのバージョン（mdmark のバージョン） */
  version: string;
  /** 常駐サーバーが動いている場所の文 */
  serverLocation: string;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): McpServer {
  const { roots, version, serverLocation, stderr } = options;
  const server = new McpServer(
    { name: SERVER_NAME, version },
    {
      capabilities: { tools: {} },
      instructions: INSTRUCTIONS.replace("{location}", serverLocation),
    },
  );
  for (const tool of TOOLS) {
    // SDK の検査は英語の文を返却するため素通しにし、`callTool` が日本語の文で検査する
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
