import { readFile } from "node:fs/promises";
import { CONNECT_TIMEOUT_MS, isPortListening } from "../port.ts";
import { readSessionName, readYamlFile, resolveSetupPaths } from "./paths.ts";
import type { RunCommand } from "./server.ts";

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
    listening: boolean;
  };
  tmux: { available: boolean };
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

/** 端末の設定のパスとバージョン・tmux のセッション名・待ち受けているか・ログの場所を返す。何も書き換えない */
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
  const available = await hasTmux(options.run);
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
      listening: await isPortListening({
        port: paths.port,
        timeoutMs: CONNECT_TIMEOUT_MS,
      }),
    },
    tmux: { available },
    state: { dir: paths.stateDir, log: paths.logPath },
  };
};
