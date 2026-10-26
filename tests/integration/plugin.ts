import { type ChildProcess, spawn } from "node:child_process";
import { cp, readFile, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { afterEach, inject } from "vitest";

/** ツールを呼んだ結果 */
export type ToolResult = {
  /** ツールのエラーか */
  isError: boolean;
  /** 内容のテキストを並べたもの */
  texts: string[];
  /** structuredContent。持たないときは `undefined` */
  structured: Record<string, unknown> | undefined;
};

/** 子プロセスを流して終わった結果 */
export type HookResult = {
  /** 終了コード */
  code: number;
  /** 標準出力 */
  stdout: string;
  /** 標準エラー */
  stderr: string;
};

/** `mdmark serve` を起動したままの子プロセス */
export type ServeProcess = {
  /** 待ち受けている URL（`/mcp` まで） */
  url: string;
  /** 今までの標準出力 */
  stdout: () => string;
  /** 今までの標準エラー */
  stderr: () => string;
  /** 動いているか */
  isRunning: () => boolean;
  /** SIGINT を送り、終わった終了コードを返す */
  interrupt: () => Promise<number>;
};

/** `mdmark serve` が待ち受ける前に終わったときのエラー */
class ServeExitedError extends Error {
  /** 終了コード */
  readonly code: number;
  /** 標準エラー */
  readonly stderr: string;

  constructor(code: number, stderr: string) {
    super(
      `mdmark serve が待ち受ける前に終わった（終了コード ${code}）: ${stderr}`,
    );
    this.code = code;
    this.stderr = stderr;
  }
}

/** 起動した子プロセスと、その出力 */
type Spawned = {
  child: ChildProcess;
  stdout: () => string;
  stderr: () => string;
  /** 終了コード。信号で終わったときは -1 */
  exited: Promise<number>;
};

// 子プロセスの環境から外す、テストを流す Claude Code や実機の設定が漏れる環境変数
const LEAKING_ENV = ["CLAUDE_PROJECT_DIR", "MDMARK_PORT"];
// `mdmark serve` が待ち受けを始めたときに標準出力へ出す URL
const LISTENING_URL_PATTERN = /http:\/\/127\.0\.0\.1:\d+\/mcp/;
// 待ち受けるアドレス
const LISTEN_HOST = "127.0.0.1";
// 待ち受けの URL が出たかを確かめる間隔（ミリ秒）
const POLL_INTERVAL_MS = 20;
// 空きを確かめたポートを別のプロセスに取られたときの、起動し直す回数の上限
const MAX_START_ATTEMPTS = 5;
// ポートが使われているときに `mdmark serve` が標準エラーに出す文に含まれる語
const PORT_IN_USE_WORD = "別のプロセスが使っています";
// 依存の置き場所
const REPO_NODE_MODULES = resolve(import.meta.dirname, "../../node_modules");

// `connectHttp` で作ったクライアントごとの、`project_dir` として入れる作業のフォルダ
const projectDirs = new WeakMap<Client, string>();

/** ビルドした作業ツリーの `plugin/` */
export function builtPluginDir(): string {
  return join(inject("builtRoot"), "plugin");
}

/** ビルドした `plugin/` を別の場所へコピーする */
export async function copyBuiltPlugin(destination: string): Promise<void> {
  await cp(builtPluginDir(), destination, { recursive: true });
}

/** ビルドしたパッケージ（`dist/`・`plugin/`・`package.json`）を別の場所へコピーし、依存の置き場所をつなぐ。コピー先の `dist/cli.js` を `mdmark serve` として起動できる */
export async function copyBuiltPackage(destination: string): Promise<void> {
  const root = inject("builtRoot");
  for (const name of ["dist", "plugin", "package.json"]) {
    await cp(join(root, name), join(destination, name), { recursive: true });
  }
  await symlink(REPO_NODE_MODULES, join(destination, "node_modules"), "dir");
}

/** 環境変数に `overrides` を重ねた子プロセスの環境。実機の `CLAUDE_PROJECT_DIR`・`MDMARK_PORT` は引き継がない */
function childEnv(overrides: Record<string, string>): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) };
  for (const name of LEAKING_ENV) {
    delete env[name];
  }
  return { ...env, ...overrides };
}

/** 空いているポートを 1 つ返す */
export async function findFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) =>
    server.listen(0, LISTEN_HOST, () => resolve()),
  );
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (address === null || typeof address === "string") {
    throw new Error("空いているポートを取れなかった");
  }
  return address.port;
}

/** コマンドを子プロセスとして起動し、出力を溜める */
function launch(options: {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}): Spawned {
  const { command, args, cwd, env } = options;
  const child = spawn(command, args, { cwd, env });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  const exited = new Promise<number>((resolve) => {
    child.once("close", (code) => resolve(code ?? -1));
  });
  return { child, stdout: () => stdout, stderr: () => stderr, exited };
}

/** `hooks/hooks.json` の `event` のコマンドを、`CLAUDE_PLUGIN_ROOT` を `pluginDir` にして子プロセスで流す。`input` を標準入力に渡す。終了コードが 0 以外でも例外を投げず、結果を返す */
async function runHook(options: {
  pluginDir: string;
  event: "SessionStart" | "PreToolUse";
  env: Record<string, string>;
  input: string;
}): Promise<HookResult> {
  const { pluginDir, event, env, input } = options;
  const hooks = JSON.parse(
    await readFile(join(pluginDir, "hooks", "hooks.json"), "utf8"),
  );
  const { command, args } = hooks.hooks[event][0].hooks[0] as {
    command: string;
    args: string[];
  };
  const expanded = args.map((arg) =>
    // biome-ignore lint/suspicious/noTemplateCurlyInString: プラグインの定義に書かれたプレースホルダそのもの
    arg.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginDir),
  );
  const run = launch({
    command: command === "node" ? process.execPath : command,
    args: expanded,
    cwd: pluginDir,
    env: childEnv({ ...env, CLAUDE_PLUGIN_ROOT: pluginDir }),
  });
  run.child.stdin?.end(input);
  const code = await run.exited;
  return { code, stdout: run.stdout(), stderr: run.stderr() };
}

/** `hooks/hooks.json` の SessionStart のコマンドを流す */
export async function runSessionStartHook(
  pluginDir: string,
): Promise<HookResult> {
  return runHook({ pluginDir, event: "SessionStart", env: {}, input: "" });
}

/** `hooks/hooks.json` の PreToolUse のコマンドを、標準入力に `input` を渡して流す。`env` は子プロセスの環境変数に重ねる（`CLAUDE_PROJECT_DIR` はここで渡したものだけが届く） */
export async function runPreToolUseHook(options: {
  pluginDir: string;
  env: Record<string, string>;
  input: string;
}): Promise<HookResult> {
  return runHook({ ...options, event: "PreToolUse" });
}

/** テストごとに起動した `mdmark serve` と作った MCP のクライアントを閉じる。起動・接続する関数を返す */
export function useMcpServers(): {
  /** ビルドした `dist/cli.js serve` を起動し、待ち受けの URL が標準出力に出るまで待つ。`env` は子プロセスの環境変数に重ねる（`MDMARK_PORT` はここで渡したものだけが届く） */
  startServe: (options: {
    env: Record<string, string>;
    packageDir?: string;
  }) => Promise<ServeProcess>;
  /** ビルドした `dist/cli.js serve` を起動し、終わるまで待つ。終了コードが 0 以外でも例外を投げず、結果を返す */
  runServeToExit: (options: {
    env: Record<string, string>;
  }) => Promise<HookResult>;
  /** 空いているポートで `mdmark serve` を起動し、HTTP でつなぐ。`projectDir` を渡すと、`callTool` が `project_dir` として入れる（PreToolUse のフックの代わり） */
  connectHttp: (options?: {
    projectDir?: string;
    packageDir?: string;
  }) => Promise<Client>;
  /** 待ち受けている URL に HTTP でつなぐ */
  connectUrl: (url: string) => Promise<Client>;
} {
  const processes: Spawned[] = [];
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
    for (const { child, exited } of processes.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
      await exited;
    }
  });

  /** `mdmark serve` の子プロセスを起動する */
  const launchServe = (options: {
    env: Record<string, string>;
    packageDir?: string;
  }): Spawned => {
    const root = options.packageDir ?? inject("builtRoot");
    const spawned = launch({
      command: process.execPath,
      args: [join(root, "dist", "cli.js"), "serve"],
      cwd: root,
      env: childEnv(options.env),
    });
    processes.push(spawned);
    return spawned;
  };

  const startServe = async (options: {
    env: Record<string, string>;
    packageDir?: string;
  }): Promise<ServeProcess> => {
    const serve = launchServe(options);
    // 標準出力に URL が出るまで待つ。先に終わったときは出力を添えて失敗にする
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setInterval(() => {
        const found = LISTENING_URL_PATTERN.exec(serve.stdout());
        if (found !== null) {
          clearInterval(timer);
          resolve(found[0]);
        }
      }, POLL_INTERVAL_MS);
      void serve.exited.then((code) => {
        clearInterval(timer);
        reject(new ServeExitedError(code, serve.stderr()));
      });
    });
    return {
      url,
      stdout: serve.stdout,
      stderr: serve.stderr,
      isRunning: () =>
        serve.child.exitCode === null && serve.child.signalCode === null,
      interrupt: () => {
        serve.child.kill("SIGINT");
        return serve.exited;
      },
    };
  };

  const runServeToExit = async (options: {
    env: Record<string, string>;
  }): Promise<HookResult> => {
    const serve = launchServe(options);
    const code = await serve.exited;
    return { code, stdout: serve.stdout(), stderr: serve.stderr() };
  };

  const connectUrl = async (url: string): Promise<Client> => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    closers.push(() => client.close());
    return client;
  };

  const connectHttp = async (
    options: { projectDir?: string; packageDir?: string } = {},
  ): Promise<Client> => {
    // 空きを確かめてから起動するまでに別のプロセスにポートを取られたときは、ポートを選び直す
    for (let attempt = 1; ; attempt++) {
      const port = await findFreePort();
      try {
        const serve = await startServe({
          env: { MDMARK_PORT: String(port) },
          packageDir: options.packageDir,
        });
        const client = await connectUrl(serve.url);
        if (options.projectDir !== undefined) {
          projectDirs.set(client, options.projectDir);
        }
        return client;
      } catch (error) {
        const taken =
          error instanceof ServeExitedError &&
          error.stderr.includes(PORT_IN_USE_WORD);
        if (!taken || attempt >= MAX_START_ATTEMPTS) {
          throw error;
        }
      }
    }
  };

  return { startServe, runServeToExit, connectHttp, connectUrl };
}

/** ツールを呼び、内容のテキストと `isError` を返す。`connectHttp` に作業のフォルダを渡したクライアントでは、`project_dir` にそのフォルダを入れる */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const projectDir = projectDirs.get(client);
  const result = await client.callTool({
    name,
    arguments:
      projectDir === undefined ? args : { ...args, project_dir: projectDir },
  });
  const content = result.content as { type: string; text: string }[];
  return {
    isError: result.isError === true,
    texts: content.map((item) => item.text),
    structured: result.structuredContent as Record<string, unknown> | undefined,
  };
}
