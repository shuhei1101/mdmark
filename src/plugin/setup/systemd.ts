import { join } from "node:path";
import type { RunCommand } from "./server.ts";

/** unit の `PATH` で、`node`・`npx` のフォルダの後ろに続けるフォルダ */
export const UNIT_BASE_PATH = "/usr/local/bin:/usr/bin:/bin";

/** `systemctl --user is-system-running` の標準出力のうち、user のマネージャーが動いている値 */
export const SYSTEMD_USABLE_STATES = ["running", "degraded", "starting"];

/** `systemctl --user show` から取得した unit の状態 */
export type UnitState = {
  activeState: string;
  subState: string;
  nRestarts: number;
  mainPid: number;
  enabled: boolean;
};

/** systemd --user が使えるか。終了コードは見ない（`degraded` でも 0 以外、`systemctl` が無いと標準出力が空） */
export const hasSystemd = async (run: RunCommand): Promise<boolean> =>
  SYSTEMD_USABLE_STATES.includes(
    (await run("systemctl", ["--user", "is-system-running"])).stdout.trim(),
  );

/** unit のファイルに記載する値の `\`・`"` を `\` で、`%` を `%%` で打ち消す */
export const escapeUnitValue = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%");

/** 常駐サーバーの unit のファイルの中身を作る */
export const buildUnitFile = (options: {
  port: number;
  settingsPath: string;
  stateDir: string;
  path: string;
  command: string;
}): string => {
  const environment = [
    `MDMARK_PORT=${options.port}`,
    `MDMARK_CONFIG=${options.settingsPath}`,
    `MDMARK_STATE_DIR=${options.stateDir}`,
    "MDMARK_LAUNCHER=systemd",
    `PATH=${options.path}`,
  ].map((value) => `Environment="${escapeUnitValue(value)}"`);
  const command = options.command
    .replaceAll("'", "'\\''")
    .replaceAll("%", "%%")
    .replaceAll("$", "$$$$");
  return [
    "[Unit]",
    "Description=mdmark MCP server",
    "",
    "[Service]",
    ...environment,
    `ExecStart=/bin/sh -c '${command}'`,
    "Restart=on-failure",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
};

/** 呼んだ側の `PATH` から `node`・`npx` のあるフォルダだけを取り、`UNIT_BASE_PATH` を続けた値を作る */
export const buildUnitPathEnv = (options: {
  path: string | undefined;
  isExecutable: (file: string) => boolean;
}): string => {
  const dirs = (options.path ?? "").split(":").filter((dir) => dir !== "");
  const found = ["node", "npx"].flatMap((name) => {
    const dir = dirs.find((candidate) =>
      options.isExecutable(join(candidate, name)),
    );
    return dir === undefined ? [] : [dir];
  });
  return [...new Set([...found, ...UNIT_BASE_PATH.split(":")])].join(":");
};

/** `systemctl --user show` の `Key=Value` の行から unit の状態を作る。`--value` は行の順が `-p` の順にならない */
export const readUnitState = async (options: {
  run: RunCommand;
  unit: string;
}): Promise<UnitState> => {
  const { stdout } = await options.run("systemctl", [
    "--user",
    "show",
    "-p",
    "ActiveState",
    "-p",
    "SubState",
    "-p",
    "NRestarts",
    "-p",
    "MainPID",
    "-p",
    "UnitFileState",
    `${options.unit}.service`,
  ]);
  const values = new Map(
    stdout
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1)] as const;
      }),
  );
  return {
    activeState: values.get("ActiveState") ?? "",
    subState: values.get("SubState") ?? "",
    nRestarts: Number(values.get("NRestarts") ?? "0"),
    mainPid: Number(values.get("MainPID") ?? "0"),
    enabled: values.get("UnitFileState") === "enabled",
  };
};

/** unit の常駐サーバーが終わったか（起動し直した・起動し直す前・failed） */
export const hasUnitExited = (state: UnitState): boolean =>
  state.nRestarts >= 1 ||
  state.subState === "auto-restart" ||
  state.activeState === "failed";
