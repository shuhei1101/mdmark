import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parse, YAMLParseError } from "yaml";
import {
  type CliConfig,
  CONFIG_FILE,
  ConfigNotFoundError,
  displayConfigPath,
  type LayeredConfig,
  loadLayeredConfig,
  relativizeConfigPaths,
} from "../config-files.ts";
import { CliError } from "./errors.ts";

export {
  type BuildConfig,
  type CheckConfig,
  type CliConfig,
  CONFIG_FILE,
  validateConfig,
} from "../config-files.ts";

/** 見つけた設定ファイルの場所と、読んだ値 */
export type LoadedConfig = {
  /** 設定ファイルの絶対パス */
  path: string;
  /** 設定ファイルのあるフォルダ（設定のパスと glob の基準） */
  dir: string;
  /** 読んだ値 */
  config: CliConfig;
};

/** ファイルが在るか */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** `--config` があればそのパスを、無ければ今のフォルダから上へ順に最初に見つかった設定ファイルの絶対パスを返す */
export async function findConfigFile(
  cwd: string,
  explicit: string | undefined,
): Promise<string> {
  if (explicit !== undefined) {
    const path = resolve(cwd, explicit);
    if (await isFile(path)) {
      return path;
    }
    throw new CliError(
      `${explicit} が見つかりません（--config のパス）。パスを直すか、mdmark init で置いてください。`,
    );
  }
  let dir = cwd;
  for (;;) {
    const path = join(dir, CONFIG_FILE);
    if (await isFile(path)) {
      return path;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new CliError(
        `${CONFIG_FILE} が見つかりません（${cwd} から上を探しました）。mdmark init で置けます。`,
      );
    }
    dir = parent;
  }
}

/** 設定ファイルを YAML として読み、形を検めずに返す */
export async function loadConfig(
  path: string,
): Promise<{ path: string; dir: string; raw: unknown }> {
  const name = basename(path);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliError(
      `${name} を開けません（${error instanceof Error ? error.message : String(error)}）。パスを確かめてください。`,
    );
  }
  try {
    return { path, dir: dirname(path), raw: parse(text) };
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0].line;
      const reason = error.message.split("\n")[0] ?? "";
      throw new CliError(
        `${name} の ${line ?? "?"} 行目を YAML として読めません（${reason}）。字下げと書き方を直してください。`,
      );
    }
    throw error;
  }
}

/** 端末の設定と、今のフォルダから上の設定ファイルを重ねて読む。`--config` のファイルが無ければ `CliError` を投げる */
export async function readLayeredConfig(
  cwd: string,
  explicit: string | undefined,
  purpose: "preview" | "export",
  keepInvalid = false,
): Promise<LayeredConfig> {
  try {
    return await loadLayeredConfig({
      cwd,
      explicit,
      purpose,
      keepInvalid,
      env: process.env,
      home: homedir(),
      readFile: (path) => readFile(path, "utf8"),
      isFile,
      explicitName: "--config のパス",
    });
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      throw new CliError(error.message);
    }
    throw error;
  }
}

/** 端末の設定と上のフォルダの設定ファイルを重ねて読み、読めない・形が合わなければ `mdmark check` で確かめられることを添えた誤りを投げる */
export async function requireConfig(
  cwd: string,
  explicit: string | undefined,
): Promise<LoadedConfig> {
  const layered = await readLayeredConfig(cwd, explicit, "export");
  const shown = (path: string) =>
    displayConfigPath({ path, base: cwd, home: homedir() });
  if (layered.nearest === undefined) {
    throw new CliError(
      `${CONFIG_FILE} が見つかりません（${cwd} から上を探しました）。mdmark init で置けます。`,
    );
  }
  if (layered.unreadable) {
    const { path, line, message } = layered.unreadable;
    throw new CliError(
      `${shown(path)} の ${line} 行目を YAML として読めません（${message}）。字下げと書き方を直してください。`,
    );
  }
  const first = layered.issues[0];
  if (first) {
    const where = first.where === "" ? "全体" : first.where;
    throw new CliError(
      `${shown(first.file)} の ${where} が設定の形に合いません（${first.message}）。mdmark check で合わないところを確かめられます。`,
    );
  }
  const dir = dirname(layered.nearest);
  return {
    path: layered.nearest,
    dir,
    config: relativizeConfigPaths({ config: layered.config, dir }),
  };
}
