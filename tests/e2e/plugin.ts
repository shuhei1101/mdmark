import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

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
  const run = launch({
    command,
    args,
    cwd: pluginDir,
    env: childEnv({ CLAUDE_PLUGIN_ROOT: pluginDir }),
  });
  run.child.stdin?.end();
  const code = await run.exited;
  return { code, stdout: run.stdout(), stderr: run.stderr() };
}

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

/** `mdmark serve` を流して終わった結果 */
export type ServeExit = {
  /** 終了コード */
  code: number;
  /** 標準出力 */
  stdout: string;
  /** 標準エラー */
  stderr: string;
};

/** 起動した子プロセスと、その出力 */
type Spawned = {
  child: ChildProcess;
  stdout: () => string;
  stderr: () => string;
  /** 終了コード。信号で終わったときは -1 */
  exited: Promise<number>;
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

/** フックを通すクライアントごとの、フックと作業のフォルダの情報 */
type HookContext = {
  pluginDir: string;
  projectDir: string;
  /** フックの標準入力に渡した `tool_input` の記録 */
  inputs: Record<string, unknown>[];
};

// 子プロセスの環境から外す、実機の設定が漏れる環境変数
const LEAKING_ENV = ["CLAUDE_PROJECT_DIR", "MDMARK_PORT"];
// `mdmark serve` が待ち受けを始めたときに標準出力へ出す URL
const LISTENING_URL_PATTERN = /http:\/\/127\.0\.0\.1:\d+\/mcp/;
// 待ち受けるアドレス
const LISTEN_HOST = "127.0.0.1";
// 既定のポート
export const DEFAULT_PORT = 8782;
// 待ち受けの URL が出たかを確かめる間隔（ミリ秒）
const POLL_INTERVAL_MS = 20;
// 空きを確かめたポートを別のプロセスに取られたときの、起動し直す回数の上限
const MAX_START_ATTEMPTS = 5;
// ポートが使われているときに `mdmark serve` が標準エラーに出す文に含まれる語
const PORT_IN_USE_WORD = "別のプロセスが使っています";
// 既定のポートを使うテストの間で譲り合う、ロックのフォルダ
const DEFAULT_PORT_LOCK = join(tmpdir(), "mdmark-e2e-default-port.lock");
// ロックが空くのを確かめる間隔と、待つ上限（ミリ秒）
const LOCK_POLL_MS = 200;
const LOCK_TIMEOUT_MS = 240_000;
// PreToolUse のフックの名前
const PRE_TOOL_USE = "PreToolUse";
// プラグインの MCP サーバーのツール名の頭
const TOOL_NAME_PREFIX = "mcp__plugin_mdmark_mdmark__";

// `withMcpClient` で作ったクライアントごとの、フックの情報
const hookContexts = new WeakMap<Client, HookContext>();

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

/** ポートで待ち受けているプロセスがあるか。つなげたら `true`、接続を拒まれたら `false` */
export async function isListening(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ port, host: LISTEN_HOST });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** 既定のポート 8782 を使うテストの間で譲り合うロックを取り、手放す関数を返す。別のワーカーのテストが使っている間は待つ */
export async function lockDefaultPort(): Promise<() => Promise<void>> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      await mkdir(DEFAULT_PORT_LOCK);
      await writeFile(join(DEFAULT_PORT_LOCK, "pid"), String(process.pid));
      return () => rm(DEFAULT_PORT_LOCK, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    // 持ち主のプロセスが居ないロックは、落ちたテストの残りなので取り直す
    const owner = Number(
      await readFile(join(DEFAULT_PORT_LOCK, "pid"), "utf8").catch(() => "0"),
    );
    if (owner > 0 && !processExists(owner)) {
      await rm(DEFAULT_PORT_LOCK, { recursive: true, force: true });
      continue;
    }
    if (Date.now() > deadline) {
      throw new Error("既定のポートのロックを取れなかった");
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
}

/** プロセスが動いているか */
function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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

/** 子プロセスが動いているか */
function isAlive(spawned: Spawned): boolean {
  return spawned.child.exitCode === null && spawned.child.signalCode === null;
}

/** 動いている子プロセスを SIGKILL で止め、終わるのを待つ */
async function kill(spawned: Spawned): Promise<void> {
  if (isAlive(spawned)) {
    spawned.child.kill("SIGKILL");
  }
  await spawned.exited;
}

/** `builtRoot` の `dist/cli.js serve` を、`env`（`MDMARK_PORT` はここで渡したものだけが届く）で起動する */
function launchServe(options: {
  builtRoot: string;
  env: Record<string, string>;
}): Spawned {
  const { builtRoot, env } = options;
  return launch({
    command: process.execPath,
    args: [join(builtRoot, "dist", "cli.js"), "serve"],
    cwd: builtRoot,
    env: childEnv(env),
  });
}

/** `dist/cli.js serve` を起動し、待ち受けの URL が標準出力に出るまで待つ。先に終わったときは `ServeExitedError` を投げる */
async function startServe(options: {
  builtRoot: string;
  env: Record<string, string>;
}): Promise<{ serve: ServeProcess; spawned: Spawned }> {
  const spawned = launchServe(options);
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setInterval(() => {
      const found = LISTENING_URL_PATTERN.exec(spawned.stdout());
      if (found !== null) {
        clearInterval(timer);
        resolve(found[0]);
      }
    }, POLL_INTERVAL_MS);
    void spawned.exited.then((code) => {
      clearInterval(timer);
      reject(new ServeExitedError(code, spawned.stderr()));
    });
  });
  const serve: ServeProcess = {
    url,
    stdout: spawned.stdout,
    stderr: spawned.stderr,
    isRunning: () => isAlive(spawned),
    interrupt: () => {
      spawned.child.kill("SIGINT");
      return spawned.exited;
    },
  };
  return { serve, spawned };
}

/** `dist/cli.js serve` を起動して `use` に渡し、終わったら動いていれば止める。`env` に `MDMARK_PORT` を渡さなければ既定のポートで待ち受ける */
export async function withServe<T>(
  options: { builtRoot: string; env: Record<string, string> },
  use: (serve: ServeProcess) => Promise<T>,
): Promise<T> {
  const { serve, spawned } = await startServe(options);
  try {
    return await use(serve);
  } finally {
    await kill(spawned);
  }
}

/** `dist/cli.js serve` を起動し、終わるまで待つ。終了コードが 0 以外でも例外を投げず、結果を返す */
export async function runServeToExit(options: {
  builtRoot: string;
  env: Record<string, string>;
}): Promise<ServeExit> {
  const spawned = launchServe(options);
  const code = await spawned.exited;
  return { code, stdout: spawned.stdout(), stderr: spawned.stderr() };
}

/** `.mcp.json` の MCP サーバー `mdmark` の接続先を返す。`${MDMARK_PORT:-既定}` は `env` の値（無ければ既定）に展開する */
export async function readMcpUrl(options: {
  pluginDir: string;
  env: Record<string, string>;
}): Promise<{ type: string; url: string; hasCommand: boolean }> {
  const { pluginDir, env } = options;
  const mcp = JSON.parse(await readFile(join(pluginDir, ".mcp.json"), "utf8"));
  const entry = mcp.mcpServers.mdmark as {
    type: string;
    url: string;
    command?: string;
  };
  return {
    type: entry.type,
    url: entry.url.replace(
      /\$\{(\w+):-([^}]*)\}/g,
      (_match, name: string, fallback: string) => env[name] ?? fallback,
    ),
    hasCommand: entry.command !== undefined,
  };
}

/** HTTP でつないだクライアントを `use` に渡し、終わったら閉じる。`serverUrl` を渡すとその URL につなぎ、渡さなければ空きポートで `mdmark serve` を起動してつなぐ。`projectDir` を渡すと、`callTool` が PreToolUse のフック（`builtRoot` の `plugin/`）を通した引数で呼ぶ */
export async function withMcpClient<T>(
  options: { builtRoot: string; projectDir?: string; serverUrl?: string },
  use: (client: Client) => Promise<T>,
): Promise<T> {
  const { builtRoot, projectDir, serverUrl } = options;
  // 空きを確かめてから起動するまでに別のプロセスにポートを取られたときは、ポートを選び直す
  let started: { serve: ServeProcess; spawned: Spawned } | undefined;
  if (serverUrl === undefined) {
    for (let attempt = 1; started === undefined; attempt++) {
      const port = await findFreePort();
      try {
        started = await startServe({
          builtRoot,
          env: { MDMARK_PORT: String(port) },
        });
      } catch (error) {
        const taken =
          error instanceof ServeExitedError &&
          error.stderr.includes(PORT_IN_USE_WORD);
        if (!taken || attempt >= MAX_START_ATTEMPTS) {
          throw error;
        }
      }
    }
  }
  const client = new Client({ name: "e2e", version: "0.0.0" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(serverUrl ?? started?.serve.url ?? ""),
      ),
    );
    if (projectDir !== undefined) {
      hookContexts.set(client, {
        pluginDir: join(builtRoot, "plugin"),
        projectDir,
        inputs: [],
      });
    }
    return await use(client);
  } finally {
    await client.close();
    if (started !== undefined) {
      await kill(started.spawned);
    }
  }
}

/** クライアントが PreToolUse のフックに渡した `tool_input` の記録 */
export function hookInputs(client: Client): Record<string, unknown>[] {
  return hookContexts.get(client)?.inputs ?? [];
}

/** `hooks/hooks.json` の PreToolUse の `matcher` が `toolName` に当たるか */
function matchesHook(matcher: string, toolName: string): boolean {
  return new RegExp(`^(?:${matcher})$`).test(toolName);
}

/** PreToolUse のフックを通した引数を返す。`matcher` に当たらないツールと、フックが何も返さないときは `args` のまま */
async function applyHook(
  context: HookContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { pluginDir, projectDir } = context;
  const hooks = JSON.parse(
    await readFile(join(pluginDir, "hooks", "hooks.json"), "utf8"),
  );
  const toolName = `${TOOL_NAME_PREFIX}${name}`;
  const entry = (
    hooks.hooks[PRE_TOOL_USE] as { matcher: string; hooks: unknown[] }[]
  ).find((candidate) => matchesHook(candidate.matcher, toolName));
  if (entry === undefined) {
    return args;
  }
  const { command, args: commandArgs } = expandPluginRoot(
    entry.hooks[0] as { command: string; args?: string[] },
    pluginDir,
  );
  context.inputs.push(args);
  const run = launch({
    command,
    args: commandArgs,
    cwd: pluginDir,
    env: childEnv({
      CLAUDE_PLUGIN_ROOT: pluginDir,
      CLAUDE_PROJECT_DIR: projectDir,
    }),
  });
  run.child.stdin?.end(
    JSON.stringify({
      hook_event_name: PRE_TOOL_USE,
      tool_name: toolName,
      tool_input: args,
    }),
  );
  const code = await run.exited;
  if (code !== 0) {
    throw new Error(`PreToolUse のフックが失敗した: ${run.stderr()}`);
  }
  if (run.stdout().trim() === "") {
    return args;
  }
  return JSON.parse(run.stdout()).hookSpecificOutput.updatedInput;
}

/** ツールを呼び、内容のテキストと `isError` を返す。フックを通すクライアントでは、フックが返した引数で呼ぶ */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const context = hookContexts.get(client);
  const result = await client.callTool({
    name,
    arguments:
      context === undefined ? args : await applyHook(context, name, args),
  });
  const content = result.content as { type: string; text: string }[];
  return {
    isError: result.isError === true,
    texts: content.map((item) => item.text),
    structured: result.structuredContent as Record<string, unknown> | undefined,
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
