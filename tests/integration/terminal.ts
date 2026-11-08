import { execFile, execFileSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, inject } from "vitest";
import { useTempDirs } from "./cli.ts";
import { findFreePort } from "./plugin.ts";

/** 一時の端末: 環境変数と、端末の設定・状態の配置場所・settings.json のパス */
export type Terminal = {
  home: string;
  env: Record<string, string>;
  settingsPath: string;
  stateDir: string;
  logPath: string;
  claudeSettingsPath: string;
  port: number;
};

/** tmux が使用できるか */
export const HAS_TMUX = (() => {
  try {
    execFileSync("tmux", ["-V"]);
    return true;
  } catch {
    return false;
  }
})();

/** `TMUX`・`TMUX_PANE` を削除した環境。あると tmux は `TMUX_TMPDIR` を確認せず、テストを実行している手元の tmux サーバーにつなぐ */
const isolatedEnv = (env: Record<string, string>): Record<string, string> => {
  const merged: Record<string, string | undefined> = { ...process.env, ...env };
  delete merged.TMUX;
  delete merged.TMUX_PANE;
  return merged as Record<string, string>;
};

/** 一時の端末の tmux サーバーで tmux を実行し、終了コードと標準出力を返却する */
const runTmux = (terminal: Terminal, args: string[]) =>
  new Promise<{ code: number; stdout: string }>((resolve) => {
    execFile(
      "tmux",
      args,
      { env: isolatedEnv(terminal.env) },
      (error, stdout) => {
        resolve({ code: error ? Number(error.code ?? 1) : 0, stdout });
      },
    );
  });

/** テストごとに一時の端末を作り、終わったらその tmux サーバーのセッションを 1 つずつ閉じる */
export function useTerminals(): {
  createTerminal: (extra?: Record<string, string>) => Promise<Terminal>;
  tmux: (
    terminal: Terminal,
    args: string[],
  ) => Promise<{ code: number; stdout: string }>;
} {
  const createTempDir = useTempDirs();
  const created: Terminal[] = [];
  afterEach(async () => {
    for (const terminal of created.splice(0)) {
      if (!HAS_TMUX) {
        continue;
      }
      const { stdout } = await runTmux(terminal, [
        "list-sessions",
        "-F",
        "#{session_name}",
      ]);
      for (const name of stdout.split("\n").filter(Boolean)) {
        await runTmux(terminal, ["kill-session", "-t", `=${name}`]);
      }
    }
  });
  const createTerminal = async (extra: Record<string, string> = {}) => {
    const home = await createTempDir();
    const port = await findFreePort();
    const terminal: Terminal = {
      home,
      settingsPath: join(home, "config", "settings.yaml"),
      stateDir: join(home, "state"),
      logPath: join(home, "state", "serve.log"),
      claudeSettingsPath: join(home, "claude", "settings.json"),
      port,
      env: {
        HOME: home,
        MDMARK_CONFIG: join(home, "config", "settings.yaml"),
        MDMARK_STATE_DIR: join(home, "state"),
        CLAUDE_CONFIG_DIR: join(home, "claude"),
        TMUX_TMPDIR: home,
        MDMARK_PORT: String(port),
        MDMARK_SERVE_COMMAND: `'${process.execPath}' '${join(inject("builtRoot"), "dist", "cli.js")}' serve`,
        ...extra,
      },
    };
    created.push(terminal);
    return terminal;
  };
  return { createTerminal, tmux: runTmux };
}
