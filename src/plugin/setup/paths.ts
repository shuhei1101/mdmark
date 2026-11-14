import { homedir } from "node:os";
import { join } from "node:path";
import { parse, YAMLParseError } from "yaml";
import { resolveSettingsPath } from "../../config-files.ts";
import { readPort } from "../port.ts";

/** 端末の設定に `serve.tmuxSession` が無いときのセッション名 */
export const DEFAULT_SESSION_NAME = "mdmark-mcp";

/** 端末の設定に `serve.systemdUnit` が無いときの unit の名前 */
export const DEFAULT_UNIT_NAME = "mdmark-mcp";

/** 常駐サーバーを動かす方法 */
export type Launcher = "systemd" | "tmux";

/** 端末の設定の `serve.launcher` の値 */
export type LauncherSetting = "auto" | Launcher;

/** 状態の配置場所の下の常駐サーバーのログのファイル名 */
export const SERVE_LOG_FILE = "serve.log";

/** `setup.js` のサブコマンドの誤り。`exitCode` を `setup.js` の終了コードにする */
export class SetupError extends Error {
  override name = "SetupError";
  readonly exitCode: 1 | 2 | 3;

  constructor(message: string, exitCode: 1 | 2 | 3 = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

/** 端末の設定・状態の配置場所・ログ・settings.json のパスとポート */
export type SetupPaths = {
  settingsPath: string;
  defaultPath: boolean;
  stateDir: string;
  logPath: string;
  claudeSettingsPath: string;
  port: number;
};

/** 値の先頭の `~` をホームに展開する */
const expandHome = (value: string, home: string): string =>
  value === "~" || value.startsWith("~/") ? join(home, value.slice(1)) : value;

/** 環境変数から、端末の設定・状態の配置場所・ログ・settings.json のパスとポートを決める */
export const resolveSetupPaths = (env: NodeJS.ProcessEnv): SetupPaths => {
  const home = env.HOME || homedir();
  const expanded = (name: string) => {
    const value = env[name];
    return value ? expandHome(value, home) : undefined;
  };
  const defaultSettings = resolveSettingsPath({
    env: { XDG_CONFIG_HOME: expanded("XDG_CONFIG_HOME") },
    home,
  });
  const settingsPath = expanded("MDMARK_CONFIG") ?? defaultSettings;
  const stateDir =
    expanded("MDMARK_STATE_DIR") ??
    join(expanded("XDG_STATE_HOME") ?? join(home, ".local", "state"), "mdmark");
  const claudeDir = expanded("CLAUDE_CONFIG_DIR") ?? join(home, ".claude");
  return {
    settingsPath,
    defaultPath: settingsPath === defaultSettings,
    stateDir,
    logPath: join(stateDir, SERVE_LOG_FILE),
    claudeSettingsPath: join(claudeDir, "settings.json"),
    port: readPort({ env }),
  };
};

/** 端末の設定の `serve` の下のキーの値を返却する。無ければ `undefined` */
const readServeValue = (
  settings: Record<string, unknown> | undefined,
  key: string,
): unknown => {
  const serve = settings?.serve;
  return typeof serve === "object" && serve !== null
    ? (serve as Record<string, unknown>)[key]
    : undefined;
};

/** 端末の設定の `serve.tmuxSession` が文字列ならそれを、ほかは `DEFAULT_SESSION_NAME` を返却する */
export const readSessionName = (
  settings: Record<string, unknown> | undefined,
): string => {
  const session = readServeValue(settings, "tmuxSession");
  return typeof session === "string" ? session : DEFAULT_SESSION_NAME;
};

/** 端末の設定の `serve.systemdUnit` が文字列ならそれを、ほかは `DEFAULT_UNIT_NAME` を返却する */
export const readUnitName = (
  settings: Record<string, unknown> | undefined,
): string => {
  const unit = readServeValue(settings, "systemdUnit");
  return typeof unit === "string" ? unit : DEFAULT_UNIT_NAME;
};

/** 端末の設定の `serve.launcher` が `auto`・`systemd`・`tmux` ならそれを、ほかは `auto` を返却する（値の誤りは `mdmark check` が通知する） */
export const readLauncherSetting = (
  settings: Record<string, unknown> | undefined,
): LauncherSetting => {
  const value = readServeValue(settings, "launcher");
  return value === "systemd" || value === "tmux" ? value : "auto";
};

/** unit のファイルのパス（`${XDG_CONFIG_HOME:-~/.config}/systemd/user/{unit}.service`）を返却する */
export const resolveUnitPath = (options: {
  env: NodeJS.ProcessEnv;
  unit: string;
}): string => {
  const home = options.env.HOME || homedir();
  const config = options.env.XDG_CONFIG_HOME
    ? expandHome(options.env.XDG_CONFIG_HOME, home)
    : join(home, ".config");
  return join(config, "systemd", "user", `${options.unit}.service`);
};

/** YAML のファイルを読み込んだ結果。無ければ `undefined` */
export type ReadYaml =
  | { text: string; raw: Record<string, unknown> }
  | undefined;

/** YAML の文字を読み込む。読み込めなければパスと行を添えて `SetupError`（1）を投げる */
const parseYaml = (text: string, path: string): unknown => {
  try {
    return parse(text);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0].line ?? 1;
      throw new SetupError(
        `${path} の ${line} 行目を YAML として読み込めません。${error.message.split("\n")[0] ?? ""}`,
      );
    }
    throw error;
  }
};

/** YAML のファイルを読み込む。無ければ `undefined`、YAML として読み込めないかキーと値の構造でなければ、パスと行を添えて `SetupError`（1）を投げる */
export const readYamlFile = async (options: {
  path: string;
  readFile: (path: string) => Promise<string>;
}): Promise<ReadYaml> => {
  let text: string;
  try {
    text = await options.readFile(options.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  const raw = parseYaml(text, options.path);
  if (raw === null || raw === undefined) {
    return { text, raw: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new SetupError(`${options.path} がキーと値の構造ではありません。`);
  }
  return { text, raw: raw as Record<string, unknown> };
};
