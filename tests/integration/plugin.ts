import { execFile } from "node:child_process";
import { cp, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, inject } from "vitest";

const execFileAsync = promisify(execFile);

/** ツールを呼んだ結果 */
export type ToolResult = {
  /** ツールのエラーか */
  isError: boolean;
  /** 内容のテキストを並べたもの */
  texts: string[];
  /** structuredContent。持たないときは `undefined` */
  structured: Record<string, unknown> | undefined;
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

/** ビルドした作業ツリーの `plugin/` */
export function builtPluginDir(): string {
  return join(inject("builtRoot"), "plugin");
}

/** ビルドした `plugin/` を別の場所へ写す（依存の置き場所 `node_modules` は写さない） */
export async function copyBuiltPlugin(destination: string): Promise<void> {
  const source = builtPluginDir();
  await cp(source, destination, {
    recursive: true,
    filter: (path) => relative(source, path).split(sep)[0] !== "node_modules",
  });
}

/** `hooks/hooks.json` の SessionStart のコマンドを、`CLAUDE_PLUGIN_ROOT` を `pluginDir` にして子プロセスで流す。終了コードが 0 以外でも例外を投げず、結果を返す */
export async function runSessionStartHook(
  pluginDir: string,
): Promise<HookResult> {
  const hooks = JSON.parse(
    await readFile(join(pluginDir, "hooks", "hooks.json"), "utf8"),
  );
  const { command, args } = hooks.hooks.SessionStart[0].hooks[0] as {
    command: string;
    args: string[];
  };
  const expanded = args.map((arg) =>
    // biome-ignore lint/suspicious/noTemplateCurlyInString: プラグインの定義に書かれたプレースホルダそのもの
    arg.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginDir),
  );
  try {
    const { stdout, stderr } = await execFileAsync(
      command === "node" ? process.execPath : command,
      expanded,
      {
        cwd: pluginDir,
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginDir },
      },
    );
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

/** テストごとに作った MCP のクライアントを閉じる。サーバーにつなぐ関数を返す */
export function useMcpClients(): {
  /** ビルドした `mcp.js` の `createMcpServer` で作ったサーバーを `InMemoryTransport` でつなぐ */
  connectInMemory: (options: {
    projectDir: string;
    pluginDir: string;
  }) => Promise<Client>;
  /** ビルドした `mcp.js` を子プロセスとして起動し、標準入出力でつなぐ */
  connectStdio: (options: { projectDir: string }) => Promise<Client>;
} {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });
  return {
    connectInMemory: async ({ projectDir, pluginDir }) => {
      const bundle = (await import(
        pathToFileURL(join(builtPluginDir(), "server", "mcp.js")).href
      )) as {
        createMcpServer: (options: {
          context: { projectDir: string; pluginDir: string };
          version: string;
          stderr: (line: string) => void;
        }) => {
          connect: (transport: unknown) => Promise<void>;
          close: () => Promise<void>;
        };
      };
      const server = bundle.createMcpServer({
        context: { projectDir, pluginDir },
        version: "v0.0.1",
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
    },
    connectStdio: async ({ projectDir }) => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(builtPluginDir(), "server", "mcp.js")],
        env: {
          ...(process.env as Record<string, string>),
          CLAUDE_PROJECT_DIR: projectDir,
        },
      });
      const client = new Client({ name: "test", version: "0.0.0" });
      await client.connect(transport);
      closers.push(() => client.close());
      return client;
    },
  };
}

/** ツールを呼び、内容のテキストと `isError` を返す */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return {
    isError: result.isError === true,
    texts: content.map((item) => item.text),
    structured: result.structuredContent as Record<string, unknown> | undefined,
  };
}
