import { accessSync, constants } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { CONNECT_TIMEOUT_MS, isPortListening } from "../port.ts";
import {
  type Launcher,
  type LauncherSetting,
  readLauncherSetting,
  readSessionName,
  readUnitName,
  readYamlFile,
  resolveSetupPaths,
  resolveUnitPath,
  SetupError,
  type SetupPaths,
} from "./paths.ts";
import { hasSession, hasTmux } from "./status.ts";
import {
  buildUnitFile,
  buildUnitPathEnv,
  hasSystemd,
  hasUnitExited,
  readUnitState,
} from "./systemd.ts";

/** コマンドと引数を受け、終了コードと標準出力を返却する */
export type RunCommand = (
  command: string,
  args: string[],
) => Promise<{ code: number; stdout: string }>;

/** ファイルを書き込む */
export type WriteTextFile = (path: string, data: string) => Promise<void>;

/** 待つ */
export type Sleep = (ms: number) => Promise<void>;

/** `MDMARK_START_TIMEOUT_SEC` が無いときの、待ち受けを待つ上限の秒数 */
export const START_TIMEOUT_SEC = 120;

/** 待ち受けを確認する間隔（ミリ秒） */
export const POLL_INTERVAL_MS = 1000;

/** 移し替えで止めた常駐サーバーのポートが解放されるまで待つ上限の秒数 */
export const PORT_RELEASE_TIMEOUT_SEC = 10;

/** 失敗したときに添えるログの末尾の行数 */
const LOG_TAIL_LINES = 20;

/** `start-server` で行った変更 */
export type StartChange =
  | "unit_written"
  | "unit_disabled"
  | "tmux_session_closed";

/** `start-server` の結果 */
export type StartResult = {
  result: "started" | "already_running" | "restarted";
  launcher: Launcher;
  changes: StartChange[];
  unit: string | null;
  session: string | null;
  url: string;
  tools: string[];
  log: string;
  stop: string;
};

/** 使用する起動の方法と、起動しないほうの方法で動いている常駐サーバーを止めるか */
export type LauncherChoice = { launcher: Launcher; migrate: boolean };

/** 起動の結果のうち、起動の方法ごとの処理が決める部分 */
type LaunchOutcome = {
  result: StartResult["result"];
  changes: StartChange[];
  launcher: Launcher;
};

/** 一重引用符で囲み、中の一重引用符を `'\''` にする */
const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

/** `tmux new-session` の引数を作る。環境変数は `-e` で指定し、コマンドは `sh -c` の引数にする */
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
  "-e",
  "MDMARK_LAUNCHER=tmux",
  "sh",
  "-c",
  `${options.command} 2>&1 | tee -a ${quote(options.logPath)}`,
];

/** 常駐サーバーへ `initialize` と `tools/list` を送信し、ツールの名前を返却する */
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

/** ログの末尾を読み込む。無ければ空 */
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

/** unit の journal の末尾を読み込む */
const readJournalTail = async (options: {
  run: RunCommand;
  unit: string;
}): Promise<string> =>
  (
    await options.run("journalctl", [
      "--user",
      "-u",
      options.unit,
      "-n",
      String(LOG_TAIL_LINES),
      "--no-pager",
      "-o",
      "cat",
    ])
  ).stdout.trimEnd();

/** 今の unit のファイルを読み込む。無ければ `undefined` */
const readUnitFile = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
};

/** ファイルが実行できるか */
const isExecutable = (file: string): boolean => {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** 待ち受けを待つ上限の秒数を読み込む */
const readTimeoutSec = (env: NodeJS.ProcessEnv): number => {
  const value = env.MDMARK_START_TIMEOUT_SEC;
  if (value === undefined || value === "") {
    return START_TIMEOUT_SEC;
  }
  if (!/^\d+$/.test(value)) {
    throw new SetupError(
      `MDMARK_START_TIMEOUT_SEC の値 ${value} は 0 以上の整数で記載してください。`,
    );
  }
  return Number(value);
};

/** ポートが使用されているときの誤り */
const portInUse = (port: number, detail: string): SetupError =>
  new SetupError(
    `ポート ${port} で ${detail}。ほかのプロセスが使用しているときは、~/.claude/settings.json の env の MDMARK_PORT を空いたポートに変え、セッションをもう一度開いて /mdmark:global-setup をもう一度呼んでください。`,
  );

/** 引数・端末の設定・使用できる方法から、使用する起動の方法と移し替えをするかを決める */
export const resolveLauncher = (options: {
  argument: Launcher | undefined;
  setting: LauncherSetting;
  systemdAvailable: boolean;
  tmuxAvailable: boolean;
  command: string;
  port: number;
}): LauncherChoice => {
  const fromSetting =
    options.setting === "auto"
      ? options.systemdAvailable
        ? "systemd"
        : "tmux"
      : options.setting;
  const launcher = options.argument ?? fromSetting;
  const usable =
    launcher === "systemd" ? options.systemdAvailable : options.tmuxAvailable;
  if (!usable) {
    const missing =
      options.argument === undefined && options.setting === "auto"
        ? "systemd --user も tmux も使えません"
        : launcher === "systemd"
          ? "systemd --user が使えません"
          : "tmux が見つかりません";
    throw new SetupError(
      `${missing}。端末を開いたまま次のコマンドで常駐サーバーを動かしてください: MDMARK_PORT=${options.port} ${options.command}`,
      2,
    );
  }
  return { launcher, migrate: options.argument === undefined };
};

/** `POLL_INTERVAL_MS` ごとに、終わったか・待ち受けたか・上限を超えたかを確認する */
export const waitForListening = async (options: {
  port: number;
  timeoutSec: number;
  hasExited: () => Promise<boolean>;
  sleep: Sleep;
}): Promise<"listening" | "exited" | "timed_out"> => {
  const deadline = Date.now() + options.timeoutSec * 1000;
  for (;;) {
    if (await options.hasExited()) {
      return "exited";
    }
    if (
      await isPortListening({
        port: options.port,
        timeoutMs: CONNECT_TIMEOUT_MS,
      })
    ) {
      return "listening";
    }
    if (Date.now() >= deadline) {
      return "timed_out";
    }
    await options.sleep(POLL_INTERVAL_MS);
  }
};

/** 止めた常駐サーバーのポートが解放されるまで待つ。上限を超えたら `SetupError`（1） */
const waitForPortReleased = async (options: {
  port: number;
  sleep: Sleep;
}): Promise<void> => {
  const deadline = Date.now() + PORT_RELEASE_TIMEOUT_SEC * 1000;
  while (
    await isPortListening({ port: options.port, timeoutMs: CONNECT_TIMEOUT_MS })
  ) {
    if (Date.now() >= deadline) {
      throw portInUse(
        options.port,
        `止めた常駐サーバーの待ち受けが ${PORT_RELEASE_TIMEOUT_SEC} 秒の間に解放されません`,
      );
    }
    await options.sleep(POLL_INTERVAL_MS);
  }
};

/** 起動の方法ごとの処理が受け取る値 */
type LaunchOptions = {
  env: NodeJS.ProcessEnv;
  paths: SetupPaths;
  unit: string;
  session: string;
  command: string;
  migrate: boolean;
  run: RunCommand;
  sleep: Sleep;
};

/** unit のファイルを記載し、`daemon-reload`・`enable --now` か `restart` で起動して待ち受けを待つ */
const startWithSystemd = async (
  options: LaunchOptions & { writeFile: WriteTextFile },
): Promise<LaunchOutcome> => {
  const { paths, unit, run, sleep } = options;
  const changes: StartChange[] = [];
  if (await closeTmuxSession(options)) {
    changes.push("tmux_session_closed");
  }
  const unitPath = resolveUnitPath({ env: options.env, unit });
  const content = buildUnitFile({
    port: paths.port,
    settingsPath: paths.settingsPath,
    stateDir: paths.stateDir,
    path: buildUnitPathEnv({ path: options.env.PATH, isExecutable }),
    command: options.command,
  });
  const same = (await readUnitFile(unitPath)) === content;
  const state = await readUnitState({ run, unit });
  const active = state.activeState === "active";
  const listening = await isPortListening({
    port: paths.port,
    timeoutMs: CONNECT_TIMEOUT_MS,
  });
  if (
    await isUnitRunning({
      state,
      same,
      listening,
      run,
      unit,
      port: paths.port,
    })
  ) {
    return { result: "already_running", changes, launcher: "systemd" };
  }
  if (!same) {
    await writeUnitFile({ ...options, unitPath, content });
    changes.push("unit_written");
  }
  await run(
    "systemctl",
    active ? ["--user", "restart", unit] : ["--user", "enable", "--now", unit],
  );
  const waited = await waitForListening({
    port: paths.port,
    timeoutSec: readTimeoutSec(options.env),
    hasExited: async () => hasUnitExited(await readUnitState({ run, unit })),
    sleep,
  });
  if (waited === "listening") {
    return {
      result: active ? "restarted" : "started",
      changes,
      launcher: "systemd",
    };
  }
  return await failSystemdStart({ waited, run, unit });
};

/** 同じ unit が待ち受けていれば（自動で起動しなければ自動で起動にして）`true` を返却する。unit の外のプロセスが待ち受けていればポートが使用されている `SetupError` を投げる */
const isUnitRunning = async (options: {
  state: Awaited<ReturnType<typeof readUnitState>>;
  same: boolean;
  listening: boolean;
  run: RunCommand;
  unit: string;
  port: number;
}): Promise<boolean> => {
  const { state, same, listening, run, unit } = options;
  const active = state.activeState === "active";
  if (active && same && listening) {
    if (!state.enabled) {
      await run("systemctl", ["--user", "enable", unit]);
    }
    return true;
  }
  if (!active && listening) {
    throw portInUse(
      options.port,
      `unit ${unit} の外のプロセスが待ち受けているため、起動していません`,
    );
  }
  return false;
};

/** unit のファイルを書き、systemd に読み込み直させる */
const writeUnitFile = async (options: {
  unitPath: string;
  content: string;
  writeFile: WriteTextFile;
  run: RunCommand;
}): Promise<void> => {
  await mkdir(dirname(options.unitPath), { recursive: true });
  await options.writeFile(options.unitPath, options.content);
  await options.run("systemctl", ["--user", "daemon-reload"]);
};

/** systemd へ移すときに、tmux のセッションで動いていれば閉じてポートが空くのを待つ。閉じたかを返却する */
const closeTmuxSession = async (options: LaunchOptions): Promise<boolean> => {
  const { paths, session, run, sleep } = options;
  if (!options.migrate || !(await hasSession({ run, session }))) {
    return false;
  }
  await run("tmux", ["kill-session", "-t", `=${session}`]);
  await waitForPortReleased({ port: paths.port, sleep });
  return true;
};

/** 待ち受けなかった unit を止め、journal の末尾を添えた `SetupError` を投げる */
const failSystemdStart = async (options: {
  waited: "exited" | "timed_out";
  run: RunCommand;
  unit: string;
}): Promise<never> => {
  const { waited, run, unit } = options;
  await run("systemctl", ["--user", "disable", "--now", unit]);
  const journal = await readJournalTail({ run, unit });
  if (waited === "exited") {
    throw new SetupError(
      `mdmark serve が終わったため、unit ${unit} を止めました。journalctl --user -u ${unit} の末尾:\n${journal}\nポートが使用されているときは、~/.claude/settings.json の env の MDMARK_PORT を空いたポートに変え、セッションをもう一度開いて /mdmark:global-setup をもう一度呼んでください。`,
    );
  }
  throw new SetupError(
    `常駐サーバーが待ち受けるまでの上限を超えたため、unit ${unit} を止めました。journalctl --user -u ${unit} の末尾:\n${journal}\n取得に時間がかかっているので、もう一度 /mdmark:global-setup を呼んでください。`,
    3,
  );
};

/** tmux のセッションで `mdmark serve` を起動して待ち受けを待つ */
const startWithTmux = async (
  options: LaunchOptions & { systemdAvailable: boolean },
): Promise<LaunchOutcome> => {
  const { paths, session, run, sleep } = options;
  const changes: StartChange[] = [];
  const listening = () =>
    isPortListening({ port: paths.port, timeoutMs: CONNECT_TIMEOUT_MS });
  if (options.systemdAvailable) {
    const unitStep = await settleUnit({ ...options, listening });
    if (unitStep === "running") {
      return { result: "already_running", changes, launcher: "systemd" };
    }
    if (unitStep === "disabled") {
      changes.push("unit_disabled");
    }
  }
  let result: StartResult["result"] = "started";
  if (await hasSession({ run, session })) {
    if (await listening()) {
      return { result: "already_running", changes, launcher: "tmux" };
    }
    await run("tmux", ["kill-session", "-t", `=${session}`]);
    result = "restarted";
  }
  if (await listening()) {
    throw portInUse(
      paths.port,
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
      command: options.command,
    }),
  );
  const waited = await waitForListening({
    port: paths.port,
    timeoutSec: readTimeoutSec(options.env),
    hasExited: async () => !(await hasSession({ run, session })),
    sleep,
  });
  if (waited === "listening") {
    return { result, changes, launcher: "tmux" };
  }
  return await failTmuxStart({ waited, run, session, logPath: paths.logPath });
};

/** tmux で起動する前の unit の扱い: 移すときは動いている unit を止め（`disabled`）、移さないときに unit が待ち受けていれば `running`、どちらでもなければ `none` */
const settleUnit = async (
  options: LaunchOptions & { listening: () => Promise<boolean> },
): Promise<"disabled" | "running" | "none"> => {
  const { paths, unit, run, sleep } = options;
  const state = await readUnitState({ run, unit });
  const active = state.activeState === "active";
  if (options.migrate && (active || state.enabled)) {
    await run("systemctl", ["--user", "disable", "--now", unit]);
    await waitForPortReleased({ port: paths.port, sleep });
    return "disabled";
  }
  if (!options.migrate && active && (await options.listening())) {
    return "running";
  }
  return "none";
};

/** 待ち受けなかった tmux のセッションの、ログの末尾を添えた `SetupError` を投げる（上限を超えたときはセッションを閉じる） */
const failTmuxStart = async (options: {
  waited: "exited" | "timed_out";
  run: RunCommand;
  session: string;
  logPath: string;
}): Promise<never> => {
  const { waited, run, session, logPath } = options;
  if (waited === "exited") {
    throw new SetupError(
      `mdmark serve が終わりました。${logPath} の末尾:\n${await readLogTail(logPath)}\nポートが使用されているときは、~/.claude/settings.json の env の MDMARK_PORT を空いたポートに変え、セッションをもう一度開いて /mdmark:global-setup をもう一度呼んでください。`,
    );
  }
  await run("tmux", ["kill-session", "-t", `=${session}`]);
  throw new SetupError(
    `常駐サーバーが待ち受けるまでの上限を超えたため、セッション ${session} を閉じました。${logPath} の末尾:\n${await readLogTail(logPath)}\n取得に時間がかかっているので、もう一度 /mdmark:global-setup を呼んでください。`,
    3,
  );
};

/** 待ち受けているプロセスから MCP のツールの名前を受け取る。受け取れなければポートが使用されている `SetupError` を投げる */
const listServerTools = async (port: number): Promise<string[]> => {
  try {
    return await listToolNames({ port });
  } catch (error) {
    throw portInUse(
      port,
      `待ち受けているプロセスから MCP のツールの一覧を受け取れません（${error instanceof Error ? error.message : String(error)}）`,
    );
  }
};

/** `start-server`: 起動の方法を決め、systemd --user の unit か tmux のセッションで `mdmark serve` を起動し、待ち受けと `tools/list` を確認する */
export const startServer = async (options: {
  env: NodeJS.ProcessEnv;
  pluginRoot: string;
  version: string;
  launcher: Launcher | undefined;
  run: RunCommand;
  sleep: Sleep;
  writeFile: WriteTextFile;
}): Promise<StartResult> => {
  const { env, run, sleep } = options;
  const paths = resolveSetupPaths(env);
  const command =
    env.MDMARK_SERVE_COMMAND ||
    `npx -y github:shuhei1101/mdmark#${options.version} serve`;
  const settings = await readYamlFile({
    path: paths.settingsPath,
    readFile: (path) => readFile(path, "utf8"),
  });
  const unit = readUnitName(settings?.raw);
  const session = readSessionName(settings?.raw);
  const systemdAvailable = await hasSystemd(run);
  const choice = resolveLauncher({
    argument: options.launcher,
    setting: readLauncherSetting(settings?.raw),
    systemdAvailable,
    tmuxAvailable: await hasTmux(run),
    command,
    port: paths.port,
  });
  const launch: LaunchOptions = {
    env,
    paths,
    unit,
    session,
    command,
    migrate: choice.migrate,
    run,
    sleep,
  };
  const outcome =
    choice.launcher === "systemd"
      ? await startWithSystemd({ ...launch, writeFile: options.writeFile })
      : await startWithTmux({ ...launch, systemdAvailable });
  const tools = await listServerTools(paths.port);
  const bySystemd = outcome.launcher === "systemd";
  return {
    result: outcome.result,
    launcher: outcome.launcher,
    changes: outcome.changes,
    unit: bySystemd ? unit : null,
    session: bySystemd ? null : session,
    url: `http://127.0.0.1:${paths.port}/mcp`,
    tools,
    log: bySystemd ? `journalctl --user -u ${unit}` : paths.logPath,
    stop: bySystemd
      ? `systemctl --user disable --now ${unit}`
      : `tmux kill-session -t =${session}`,
  };
};
