import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const execFileAsync = promisify(execFile);

/** ツールを呼んだ結果 */
export type ToolResult = {
  /** ツールのエラーか */
  isError: boolean;
  /** 内容のテキストを並べたもの */
  texts: string[];
};

/** フックを子プロセスで流した結果 */
export type HookResult = {
  /** 終了コード */
  code: number;
  /** 標準出力 */
  stdout: string;
  /** 標準エラー */
  stderr: string;
};

/** ずれの一覧の 1 件 */
export type Issue = {
  file: string;
  where: string;
  kind: string;
  message: string;
};

/** `command` と `args` の `${CLAUDE_PLUGIN_ROOT}` を `pluginDir` に展開する */
function expandPluginRoot(
  entry: { command: string; args?: string[] },
  pluginDir: string,
): { command: string; args: string[] } {
  return {
    command: entry.command === "node" ? process.execPath : entry.command,
    args: (entry.args ?? []).map((arg) =>
      // biome-ignore lint/suspicious/noTemplateCurlyInString: プラグインの定義に書かれたプレースホルダそのもの
      arg.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginDir),
    ),
  };
}

/** `hooks/hooks.json` の SessionStart のコマンドを、`CLAUDE_PLUGIN_ROOT` を `pluginDir` にして子プロセスで流す。終了コードが 0 以外でも例外を投げず、結果を返す */
export async function runSessionStartHook(
  pluginDir: string,
): Promise<HookResult> {
  const hooks = JSON.parse(
    await readFile(join(pluginDir, "hooks", "hooks.json"), "utf8"),
  );
  const { command, args } = expandPluginRoot(
    hooks.hooks.SessionStart[0].hooks[0],
    pluginDir,
  );
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: pluginDir,
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginDir },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failed.code ?? -1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}

/** `.mcp.json` の MCP サーバーのコマンドで `pluginDir` のサーバーを子プロセスとして起動し、標準入出力でつないだクライアントを `use` に渡す。終わったら閉じる */
export async function withMcpClient<T>(
  options: { pluginDir: string; projectDir: string },
  use: (client: Client) => Promise<T>,
): Promise<T> {
  const { pluginDir, projectDir } = options;
  const mcp = JSON.parse(await readFile(join(pluginDir, ".mcp.json"), "utf8"));
  const { command, args } = expandPluginRoot(mcp.mcpServers.mdmark, pluginDir);
  const client = new Client({ name: "e2e", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({
      command,
      args,
      env: {
        ...(process.env as Record<string, string>),
        CLAUDE_PLUGIN_ROOT: pluginDir,
        CLAUDE_PROJECT_DIR: projectDir,
      },
    }),
  );
  try {
    return await use(client);
  } finally {
    await client.close();
  }
}

/** ツールを呼び、内容のテキストと `isError` を返す */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return {
    isError: result.isError === true,
    texts: content.map((item) => item.text),
  };
}

/** ずれを `mdmark check` の出力の行にする */
export function issueLine(issue: Issue): string {
  const place =
    issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
  return `${place}: ${issue.kind}: ${issue.message}`;
}

/** 設定の `index` が指す索引の中身。`docs` に文書の ID を並べる（パスは `{ID}.md`、題は大文字の ID） */
export function indexYaml(ids: string[]): string {
  return [
    "schema: 1",
    "docs:",
    ...ids.flatMap((id) => [
      `  - id: ${id}`,
      `    path: ${id}.md`,
      `    title: ${id.toUpperCase()}`,
    ]),
    "",
  ].join("\n");
}

/** 設定の中身: 索引と、文書 2 つに当たる `build` を持つ */
export const CONFIG_WITH_BUILD = [
  "index: index.yaml",
  "build:",
  '  include: ["*.md"]',
  "  out: dist/docs.html",
  "",
].join("\n");

/** 設定の中身: 索引だけを持つ */
export const CONFIG_WITH_INDEX = "index: index.yaml\n";

/** 文書 `a`・`b` の本文 */
export const DOCUMENTS = { "a.md": "# A\n\n[B](b.md)\n", "b.md": "# B\n" };
