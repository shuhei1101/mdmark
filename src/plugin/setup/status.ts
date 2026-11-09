import { readFile } from "node:fs/promises";
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
} from "./paths.ts";
import type { RunCommand } from "./server.ts";
import { hasSystemd, readUnitState } from "./systemd.ts";

/** `status` の結果 */
export type TerminalStatus = {
  settings: {
    path: string;
    default_path: boolean;
    exists: boolean;
    version: string | null;
    target_version: string;
  };
  server: {
    port: number;
    session: string;
    session_exists: boolean;
    unit: string;
    unit_path: string;
    unit_active: boolean;
    unit_enabled: boolean;
    listening: boolean;
  };
  tmux: { available: boolean };
  systemd: { available: boolean };
  launcher: { setting: LauncherSetting; resolved: Launcher };
  state: { dir: string; log: string };
};

/** tmux があるか（`tmux -V` が成功するか） */
export const hasTmux = async (run: RunCommand): Promise<boolean> =>
  (await run("tmux", ["-V"])).code === 0;

/** そのセッション名の tmux のセッションがあるか */
export const hasSession = async (options: {
  run: RunCommand;
  session: string;
}): Promise<boolean> =>
  (await options.run("tmux", ["has-session", "-t", `=${options.session}`]))
    .code === 0;

/** 端末の設定のパスとバージョン・起動の方法・unit の名前と tmux のセッション名・待ち受けているか・ログの場所を返却する。何も書き換えない */
export const readTerminalStatus = async (options: {
  env: NodeJS.ProcessEnv;
  pluginRoot: string;
  version: string;
  run: RunCommand;
}): Promise<TerminalStatus> => {
  const paths = resolveSetupPaths(options.env);
  const settings = await readYamlFile({
    path: paths.settingsPath,
    readFile: (path) => readFile(path, "utf8"),
  });
  const session = readSessionName(settings?.raw);
  const unit = readUnitName(settings?.raw);
  const setting = readLauncherSetting(settings?.raw);
  const available = await hasTmux(options.run);
  const systemdAvailable = await hasSystemd(options.run);
  const unitState = systemdAvailable
    ? await readUnitState({ run: options.run, unit })
    : undefined;
  const version = settings?.raw.version;
  return {
    settings: {
      path: paths.settingsPath,
      default_path: paths.defaultPath,
      exists: settings !== undefined,
      version: typeof version === "string" ? version : null,
      target_version: options.version,
    },
    server: {
      port: paths.port,
      session,
      session_exists:
        available && (await hasSession({ run: options.run, session })),
      unit,
      unit_path: resolveUnitPath({ env: options.env, unit }),
      unit_active: unitState?.activeState === "active",
      unit_enabled: unitState?.enabled === true,
      listening: await isPortListening({
        port: paths.port,
        timeoutMs: CONNECT_TIMEOUT_MS,
      }),
    },
    tmux: { available },
    systemd: { available: systemdAvailable },
    launcher: {
      setting,
      resolved:
        setting === "auto" ? (systemdAvailable ? "systemd" : "tmux") : setting,
    },
    state: { dir: paths.stateDir, log: paths.logPath },
  };
};
