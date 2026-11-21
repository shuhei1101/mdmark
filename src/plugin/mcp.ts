import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { ACCEPT_ALL_VALIDATOR } from "./arguments.ts";
import { loadPrompt, renderPrompt } from "./prompt.ts";
import { callTool, type ServerRoots, TOOLS } from "./tools.ts";

/** MCP サーバーの名前（`serverInfo.name`） */
export const SERVER_NAME = "mdmark";

/** MCP の `instructions` の本文を持つプロンプトファイルの id。変数 `location` に常駐サーバーが動いている場所を指定する */
export const INSTRUCTIONS_PROMPT_ID = "mcp/mdmark/instructions";

/** ツールの description のプロンプトファイルの id の頭。id は `{TOOL_PROMPT_DIR}/{ツールの名前の _ を - にしたもの}` */
export const TOOL_PROMPT_DIR = "mcp/mdmark/tools";

/** `loadServerPrompts` で描いた instructions と、ツールの名前ごとの description */
export type ServerPrompts = {
  instructions: string;
  descriptions: Record<string, string>;
};

/** `instructions` の `{location}` に入れる、常駐サーバーが動いている場所の文を作る */
export const describeServerLocation = (options: {
  launcher: string | undefined;
  unit: string;
  session: string;
}): string =>
  options.launcher === "systemd"
    ? `systemd --user の unit ${options.unit}（ログは journalctl --user -u ${options.unit}）`
    : `tmux のセッション ${options.session}`;

/** instructions と各ツールの description をプロンプトファイルから描く（`mdmark serve` が待ち受ける前に 1 回呼ぶ） */
export const loadServerPrompts = async (options: {
  /** パッケージの直下の絶対パス */
  root: string;
  /** 常駐サーバーが動いている場所の文 */
  serverLocation: string;
}): Promise<ServerPrompts> => {
  const { root, serverLocation } = options;
  const instructions = renderPrompt(
    await loadPrompt({ root, id: INSTRUCTIONS_PROMPT_ID }),
    { location: serverLocation },
  );
  const descriptions: Record<string, string> = {};
  for (const tool of TOOLS) {
    const id = `${TOOL_PROMPT_DIR}/${tool.name.replaceAll("_", "-")}`;
    descriptions[tool.name] = renderPrompt(await loadPrompt({ root, id }), {});
  }
  return { instructions, descriptions };
};

/** `instructions` を持ち、`TOOLS` のツールを登録した `McpServer` を作る */
export function createMcpServer(options: {
  /** サーバーの読み込む場所 */
  roots: ServerRoots;
  /** サーバーのバージョン（mdmark のバージョン） */
  version: string;
  /** `loadServerPrompts` で描いた instructions と description */
  prompts: ServerPrompts;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): McpServer {
  const { roots, version, prompts, stderr } = options;
  const server = new McpServer(
    { name: SERVER_NAME, version },
    {
      capabilities: { tools: {} },
      instructions: prompts.instructions,
    },
  );
  for (const tool of TOOLS) {
    // SDK の検査は英語の文を返却するため素通しにし、`callTool` が日本語の文で検査する
    server.registerTool(
      tool.name,
      {
        description: prompts.descriptions[tool.name],
        inputSchema: fromJsonSchema(tool.inputSchema, ACCEPT_ALL_VALIDATOR),
        annotations: tool.annotations,
      },
      (args) => callTool({ tool, args, roots, stderr }),
    );
  }
  return server;
}
