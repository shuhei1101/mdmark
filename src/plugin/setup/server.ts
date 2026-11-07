import { mkdir, readFile } from "node:fs/promises";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { CONNECT_TIMEOUT_MS, isPortListening } from "../port.ts";
import {
  readSessionName,
  readYamlFile,
  resolveSetupPaths,
  SetupError,
} from "./paths.ts";
import { hasSession, hasTmux } from "./status.ts";

/** コマンドと引数を受け、終了コードと標準出力を返す */
export type RunCommand = (
  command: string,
  args: string[],
) => Promise<{ code: number; stdout: string }>;

/** `MDMARK_START_TIMEOUT_SEC` が無いときの、待ち受けを待つ上限の秒数 */
export const START_TIMEOUT_SEC = 120;

/** 待ち受けを確かめる間隔（ミリ秒） */
export const POLL_INTERVAL_MS = 1000;

/** 失敗したときに添えるログの末尾の行数 */
const LOG_TAIL_LINES = 20;

/** `start-server` の結果 */
export type StartResult = {
  result: "started" | "already_running" | "restarted";
  session: string;
  url: string;
  tools: string[];
  log: string;
  stop: string;
};

/** 一重引用符で囲み、中の一重引用符を `'\''` にする */
const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

/** `tmux new-session` の引数を作る。環境変数は `-e` で渡し、コマンドは `sh -c` の引数にする */
export const buildTmuxArgs = (options: {
  session: string;
  port: number;
  settingsPath: string;
  stateDir: string;
  logPath: string;
  command: string;
}): string[] => [
  "new-session",
  "-d",
  "-s",
  options.session,
  "-e",
  `MDMARK_PORT=${options.port}`,
  "-e",
  `MDMARK_CONFIG=${options.settingsPath}`,
  "-e",
  `MDMARK_STATE_DIR=${options.stateDir}`,
  "sh",
  "-c",
  `${options.command} 2>&1 | tee -a ${quote(options.logPath)}`,
];

/** 常駐サーバーへ `initialize` と `tools/list` を送り、ツールの名前を返す */
export const listToolNames = async (options: {
  port: number;
}): Promise<string[]> => {
  const client = new Client({ name: "mdmark-setup", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${options.port}/mcp`),
  );
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    return tools.map((tool) => tool.name);
  } finally {
    await client.close();
  }
};

/** ログの末尾を読む。無ければ空 */
const readLogTail = async (path: string): Promise<string> => {
  try {
    return (await readFile(path, "utf8"))
      .trimEnd()
      .split("\n")
      .slice(-LOG_TAIL_LINES)
      .join("\n");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
};

/** 待ち受けを待つ上限の秒数を読む */
const readTimeoutSec = (env: NodeJS.ProcessEnv): number => {
  const value = env.MDMARK_START_TIMEOUT_SEC;
  if (value === undefined || value === "") {
    return START_TIMEOUT_SEC;
  }
  if (!/^\d+$/.test(value)) {
    throw new SetupError(
      `MDMARK_START_TIMEOUT_SEC の値 ${value} は 0 以上の整数で書いてください。`,
    );
  }
  return Number(value);
};

/** `start-server`: tmux のセッションで `mdmark serve` を起動し、待ち受けと `tools/list` を確かめる */
export const startServer = async (options: {
  env: NodeJS.ProcessEnv;
  pluginRoot: string;
  version: string;
  run: RunCommand;
  sleep: (ms: number) => Promise<void>;
}): Promise<StartResult> => {
  const { env, run, sleep } = options;
  const paths = resolveSetupPaths(env);
  const command =
    env.MDMARK_SERVE_COMMAND ||
    `npx -y github:shuhei1101/mdmark#${options.version} serve`;
  if (!(await hasTmux(run))) {
    throw new SetupError(
      `tmux が見つかりません。端末を開いたまま次のコマンドで常駐サーバーを動かしてください: MDMARK_PORT=${paths.port} ${command}`,
      2,
    );
  }
  const settings = await readYamlFile({
    path: paths.settingsPath,
    readFile: (path) => readFile(path, "utf8"),
  });
  const session = readSessionName(settings?.raw);
  const listening = () =>
    isPortListening({ port: paths.port, timeoutMs: CONNECT_TIMEOUT_MS });
  const portInUse = (detail: string) =>
    new SetupError(
      `ポート ${paths.port} で ${detail}。ほかのプロセスが使っているときは、~/.claude/settings.json の env の MDMARK_PORT を空いたポートに変え、セッションを開き直して /mdmark:global-setup を呼び直してください。`,
    );
  const done = async (result: StartResult["result"]): Promise<StartResult> => {
    let tools: string[];
    try {
      tools = await listToolNames({ port: paths.port });
    } catch (error) {
      throw portInUse(
        `待ち受けているプロセスから MCP のツールの一覧を受け取れません（${error instanceof Error ? error.message : String(error)}）`,
      );
    }
    return {
      result,
      session,
      url: `http://127.0.0.1:${paths.port}/mcp`,
      tools,
      log: paths.logPath,
      stop: `tmux kill-session -t =${session}`,
    };
  };
  let result: StartResult["result"] = "started";
  if (await hasSession({ run, session })) {
    if (await listening()) {
      return await done("already_running");
    }
    await run("tmux", ["kill-session", "-t", `=${session}`]);
    result = "restarted";
  }
  if (await listening()) {
    throw portInUse(
      `セッション ${session} の外のプロセスが待ち受けているため、起動していません`,
    );
  }
  await mkdir(paths.stateDir, { recursive: true });
  await run(
    "tmux",
    buildTmuxArgs({
      session,
      port: paths.port,
      settingsPath: paths.settingsPath,
      stateDir: paths.stateDir,
      logPath: paths.logPath,
      command,
    }),
  );
  const deadline = Date.now() + readTimeoutSec(env) * 1000;
  for (;;) {
    if (!(await hasSession({ run, session }))) {
      throw new SetupError(
        `mdmark serve が終わりました。${paths.logPath} の末尾:\n${await readLogTail(paths.logPath)}\nポートが使われているときは、~/.claude/settings.json の env の MDMARK_PORT を空いたポートに変え、セッションを開き直して /mdmark:global-setup を呼び直してください。`,
      );
    }
    if (await listening()) {
      return await done(result);
    }
    if (Date.now() >= deadline) {
      await run("tmux", ["kill-session", "-t", `=${session}`]);
      throw new SetupError(
        `常駐サーバーが待ち受けるまでの上限を超えたため、セッション ${session} を閉じました。${paths.logPath} の末尾:\n${await readLogTail(paths.logPath)}\n取得に時間がかかっているので、もう一度 /mdmark:global-setup を呼んでください。`,
        3,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
};
