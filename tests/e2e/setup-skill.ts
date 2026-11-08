import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test as base, expect } from "./cli.ts";
import { findFreePort } from "./plugin.ts";

/** 一時の端末: 子プロセスに指定する環境変数と、端末の設定・状態の配置場所・settings.json のパス */
export type Terminal = {
  env: Record<string, string>;
  settingsPath: string;
  stateDir: string;
  logPath: string;
  claudeSettingsPath: string;
  port: number;
};

/** 子プロセスを実行した結果 */
export type RunResult = { code: number; stdout: string; stderr: string };

/** `setup.js status` の結果のうち、テストが読み込む項目 */
export type TerminalStatus = {
  settings: {
    path: string;
    exists: boolean;
    version: string | null;
    target_version: string;
  };
  server: { session: string; listening: boolean };
};

/** `setup.js start-server` の結果 */
export type StartResult = {
  result: "started" | "already_running" | "restarted";
  session: string;
  url: string;
  tools: string[];
  log: string;
  stop: string;
};

/** global-setup の Mock が利用者として返却する回答し */
export type GlobalSetupAnswers = {
  /** キーごとに回答する値（`--set` の右辺）。無いキーは今の値か既定のまま */
  values: Record<string, string>;
  /** 書き込んでよいかに認めるか */
  approveWrite: boolean;
  /** 古い端末の設定を移行するときに `upgrade --settings` を実行するパッケージの直下 */
  upgradePackage?: string;
};

/** global-setup の Mock が最後の報告に使用する、手順ごとの結果 */
export type GlobalSetupReport = {
  status: TerminalStatus;
  /** 移行したときの `upgrade --settings` の結果 */
  upgrade?: RunResult;
  /** 利用者に聞いたキー */
  askedKeys: string[];
  /** `write-settings` の結果。書き込むことを断ったときは無い */
  written?: { written: string[]; keys: string[] };
  /** `start-server` の結果。終了コードが 0 のときだけ `started` を持つ */
  start: RunResult & { started?: StartResult };
  /** `session-start.js` の結果。`start-server` が失敗したときは無い */
  hook?: RunResult;
};

/** setup の Mock が最後の報告に使用する、手順ごとの結果 */
export type FolderSetupReport = {
  askedKeys: string[];
  written?: { written: string[]; keys: string[] };
};

// 手元と別の tmux サーバーを先に起動しておくためのセッション
const WARMUP_SESSION = "e2e-warmup";
// 子プロセスの環境から除外する変数。`TMUX`・`TMUX_PANE` があると tmux は `TMUX_TMPDIR` を確認せず、テストを実行している手元の tmux サーバーにつなぐ
const LEAKING_ENV = ["TMUX", "TMUX_PANE", "CLAUDE_PROJECT_DIR", "MDMARK_PORT"];
// SessionStart のフックの名前
const SESSION_START = "SessionStart";

/** 手元の環境に `env` を重ね、手元の tmux サーバーと実機の設定につながる変数を削除する */
const isolatedEnv = (env: Record<string, string>): Record<string, string> => {
  const merged: Record<string, string | undefined> = { ...process.env };
  for (const name of LEAKING_ENV) {
    delete merged[name];
  }
  return { ...(merged as Record<string, string>), ...env };
};

/** コマンドを実行し、終了コードと出力を返却する。0 以外でも例外を投げない */
const runFile = (options: {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  stdin?: string;
}): Promise<RunResult> =>
  new Promise((resolve) => {
    const child = execFile(
      options.command,
      options.args,
      { env: isolatedEnv(options.env), cwd: options.cwd },
      (error, stdout, stderr) => {
        const code =
          error === null
            ? 0
            : typeof error.code === "number"
              ? error.code
              : 127;
        resolve({ code, stdout, stderr });
      },
    );
    child.stdin?.end(options.stdin ?? "");
  });

/** 空の一時フォルダに端末を作る。常駐サーバーは `npx` の代わりに `builtRoot` の `dist/cli.js serve` で起動する */
export const createTerminal = async (options: {
  home: string;
  builtRoot: string;
}): Promise<Terminal> => {
  const { home, builtRoot } = options;
  const port = await findFreePort();
  const settingsPath = join(home, "config", "settings.yaml");
  const stateDir = join(home, "state");
  return {
    settingsPath,
    stateDir,
    logPath: join(stateDir, "serve.log"),
    claudeSettingsPath: join(home, "claude", "settings.json"),
    port,
    env: {
      HOME: home,
      MDMARK_CONFIG: settingsPath,
      MDMARK_STATE_DIR: stateDir,
      CLAUDE_CONFIG_DIR: join(home, "claude"),
      TMUX_TMPDIR: home,
      MDMARK_PORT: String(port),
      MDMARK_SERVE_COMMAND: `'${process.execPath}' '${join(builtRoot, "dist", "cli.js")}' serve`,
    },
  };
};

/** 一時の端末を使用できるようにした `test`。テストが終わると、端末の tmux サーバーのセッションを閉じる */
export const test = base.extend<{ terminal: Terminal }>({
  terminal: async ({ builtRoot, tempDir }, use) => {
    const terminal = await createTerminal({ home: await tempDir(), builtRoot });
    await use(terminal);
    await closeSessions(terminal);
  },
});

export { expect };

/** 端末の tmux サーバーで tmux を実行する */
export const runTmux = (terminal: Terminal, args: string[]) =>
  runFile({ command: "tmux", args, env: terminal.env });

/** 端末の tmux サーバーを、`MDMARK_PORT` を持たない環境で先に起動しておく */
export const startTmuxServer = async (terminal: Terminal): Promise<void> => {
  const { MDMARK_PORT: _port, ...env } = terminal.env;
  const started = await runFile({
    command: "tmux",
    args: ["new-session", "-d", "-s", WARMUP_SESSION],
    env,
  });
  expect(started.code, started.stderr).toBe(0);
};

/** 端末の tmux サーバーのセッション名を並べる。サーバーが無ければ空 */
export const sessionNames = async (terminal: Terminal): Promise<string[]> => {
  const { stdout } = await runTmux(terminal, [
    "list-sessions",
    "-F",
    "#{session_name}",
  ]);
  return stdout.split("\n").filter((name) => name !== "");
};

/** セッションのペインで動くプロセスの ID */
export const panePid = async (
  terminal: Terminal,
  session: string,
): Promise<string> =>
  (
    await runTmux(terminal, [
      "list-panes",
      "-t",
      `=${session}`,
      "-F",
      "#{pane_pid}",
    ])
  ).stdout.trim();

/** 端末の tmux サーバーのセッションを 1 つずつ閉じる */
export const closeSessions = async (terminal: Terminal): Promise<void> => {
  for (const name of await sessionNames(terminal)) {
    await runTmux(terminal, ["kill-session", "-t", `=${name}`]);
  }
};

/** プラグインの `bin/setup.js` を実行する。`env` は端末の環境変数に重ねる */
export const runSetupScript = (options: {
  pluginDir: string;
  terminal: Terminal;
  args: string[];
  env?: Record<string, string>;
}): Promise<RunResult> =>
  runFile({
    command: process.execPath,
    args: [join(options.pluginDir, "bin", "setup.js"), ...options.args],
    env: { ...options.terminal.env, ...options.env },
    cwd: options.pluginDir,
  });

/** 終了コードが 0 であることを確認し、標準出力の JSON を読み込む */
const parseOk = <T>(result: RunResult): T => {
  expect(result.code, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as T;
};

/** プラグインの `hooks/hooks.json` の SessionStart のコマンドを、Claude Code と同じく `${CLAUDE_PLUGIN_ROOT}` を展開して実行する */
export const runSessionStartHook = async (options: {
  pluginDir: string;
  terminal: Terminal;
}): Promise<RunResult> => {
  const { pluginDir, terminal } = options;
  const hooks = JSON.parse(
    await readFile(join(pluginDir, "hooks", "hooks.json"), "utf8"),
  );
  const entry = hooks.hooks[SESSION_START][0].hooks[0] as {
    command: string;
    args: string[];
  };
  return runFile({
    command: entry.command === "node" ? process.execPath : entry.command,
    args: entry.args.map((arg) =>
      // biome-ignore lint/suspicious/noTemplateCurlyInString: プラグインの定義に記載されたプレースホルダそのもの
      arg.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginDir),
    ),
    env: { ...terminal.env, CLAUDE_PLUGIN_ROOT: pluginDir },
    cwd: pluginDir,
    stdin: JSON.stringify({ hook_event_name: SESSION_START }),
  });
};

/** キーの一覧を実行し、回答のあるキーを `--set` の引数にする */
const askKeys = (
  keys: Array<{ key: string }>,
  values: Record<string, string>,
): { askedKeys: string[]; sets: string[] } => ({
  askedKeys: keys.map((entry) => entry.key),
  sets: keys
    .filter((entry) => values[entry.key] !== undefined)
    .flatMap((entry) => ["--set", `${entry.key}=${values[entry.key]}`]),
});

/** global-setup のスキルの手順を、利用者への確認に `answers` を返却して実行する */
export const runGlobalSetup = async (options: {
  pluginDir: string;
  terminal: Terminal;
  answers: GlobalSetupAnswers;
  /** `PATH` を差し替えるときの値 */
  path?: string;
}): Promise<GlobalSetupReport> => {
  const { pluginDir, terminal, answers } = options;
  const env: Record<string, string> =
    options.path === undefined ? {} : { PATH: options.path };
  const setup = (args: string[]) =>
    runSetupScript({ pluginDir, terminal, args, env });
  // 1. 端末の設定のパス・バージョン・セッション名・待ち受けているか
  const status = parseOk<TerminalStatus>(await setup(["status"]));
  // 2. 古い端末の設定は、適用する手順を示してから移行する
  let upgrade: RunResult | undefined;
  const { settings } = status;
  if (settings.exists && settings.version !== settings.target_version) {
    if (answers.upgradePackage === undefined) {
      throw new Error("古い端末の設定を移行するパッケージを渡していない");
    }
    const upgradeArgs = (plan: boolean) => ({
      command: process.execPath,
      args: [
        join(answers.upgradePackage ?? "", "dist", "cli.js"),
        "upgrade",
        "--settings",
        ...(plan ? ["--plan"] : []),
      ],
      env: terminal.env,
      cwd: answers.upgradePackage,
    });
    expect((await runFile(upgradeArgs(true))).code).toBe(0);
    upgrade = await runFile(upgradeArgs(false));
    expect(upgrade.code, upgrade.stderr).toBe(0);
  }
  // 3. キーを 1 つずつ聞く
  const { keys } = parseOk<{ keys: Array<{ key: string }> }>(
    await setup(["keys", "--target", "settings"]),
  );
  const { askedKeys, sets } = askKeys(keys, answers.values);
  // 4. 書き込んでよいかを聞き、認めたら書き込む
  const written = answers.approveWrite
    ? parseOk<{ written: string[]; keys: string[] }>(
        await setup(["write-settings", ...sets]),
      )
    : undefined;
  // 5. 常駐サーバーを起動する
  const start: GlobalSetupReport["start"] = await setup(["start-server"]);
  if (start.code !== 0) {
    return { status, upgrade, askedKeys, written, start };
  }
  start.started = JSON.parse(start.stdout) as StartResult;
  // 6. フックを実行する
  const hook = await runSessionStartHook({ pluginDir, terminal });
  return { status, upgrade, askedKeys, written, start, hook };
};

/** setup のスキルの手順を、利用者への確認に回答を返却して実行する */
export const runFolderSetup = async (options: {
  pluginDir: string;
  terminal: Terminal;
  dir: string;
  values: Record<string, string>;
  approveWrite: boolean;
}): Promise<FolderSetupReport> => {
  const { pluginDir, terminal, dir } = options;
  const setup = (args: string[]) =>
    runSetupScript({ pluginDir, terminal, args });
  const { keys } = parseOk<{ keys: Array<{ key: string }> }>(
    await setup(["keys", "--target", "config", "--dir", dir]),
  );
  const { askedKeys, sets } = askKeys(keys, options.values);
  if (!options.approveWrite) {
    return { askedKeys };
  }
  const written = parseOk<{ written: string[]; keys: string[] }>(
    await setup(["write-config", "--dir", dir, ...sets]),
  );
  return { askedKeys, written };
};

/** `mdmark check` を実行し、出力のうち `path` を指すずれの行を返却する */
export const checkIssuesOf = async (options: {
  builtRoot: string;
  terminal: Terminal;
  cwd: string;
  path: string;
}): Promise<string[]> => {
  const result = await runFile({
    command: process.execPath,
    args: [join(options.builtRoot, "dist", "cli.js"), "check"],
    env: options.terminal.env,
    cwd: options.cwd,
  });
  return `${result.stdout}\n${result.stderr}`
    .split("\n")
    .filter((line) => line.includes(options.path));
};

/** 常駐サーバーのログのうち、待ち受ける URL の行 */
export const listeningLines = async (terminal: Terminal): Promise<string[]> =>
  (await readFile(terminal.logPath, "utf8"))
    .split("\n")
    .filter((line) => line.includes(`http://127.0.0.1:${terminal.port}/mcp`));
