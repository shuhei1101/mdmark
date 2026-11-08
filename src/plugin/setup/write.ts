import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, parseDocument } from "yaml";
import { validateConfig, validateSettingsKeys } from "../../config-files.ts";
import { resolveSetupPaths, SetupError } from "./paths.ts";

/** プラグインの直下からの、端末の設定の雛形 */
export const SETTINGS_TEMPLATE = "settings.sample.yaml";

/** プラグインの直下からの、`mdmark init` と同じ `mdmark.config.yaml` の雛形 */
export const CONFIG_TEMPLATE = join("templates", "mdmark.config.yaml");

/** 文書のフォルダの設定ファイルの名前 */
const CONFIG_FILE = "mdmark.config.yaml";

/** 端末の設定だけが持つキーの頭 */
const SETTINGS_ONLY_ROOTS = ["config", "serve"];

/** `settings.json` に書き込む、端末の設定のパスの環境変数 */
const CONFIG_ENV = "MDMARK_CONFIG";

/** `--set` の 1 つ: キーの区切りと値 */
export type SetArg = { path: string[]; value: unknown };

/** 書き込んだファイルとキー */
export type WriteResult = { written: string[]; keys: string[] };

/** `{キー}={値}` の並びを、ドットで区切ったキーと YAML として読み込んだ値の組にする */
export const parseSetArgs = (args: string[]): SetArg[] =>
  args.map((arg) => {
    const index = arg.indexOf("=");
    if (index <= 0) {
      throw new SetupError(
        `--set ${arg} は {キー}={値} の構造で記載してください。`,
      );
    }
    return {
      path: arg.slice(0, index).split("."),
      value: parse(arg.slice(index + 1)),
    };
  });

/** ファイルを読み込む。無ければ `undefined` */
const readIfExists = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
};

/** ずれの行を 1 つの `SetupError`（1）にする */
const assertNoIssues = (
  issues: Array<{ where: string; message: string }>,
): void => {
  if (issues.length > 0) {
    throw new SetupError(
      `${issues.map((issue) => `${issue.where}: ${issue.message}`).join("\n")}\n何も書き込んでいません。`,
    );
  }
};

/** 既にあるファイルか雛形を読み込み、`--set` を適用した YAML の文書を作る。新しく作るときだけ `version` を入れる */
const applySets = async (options: {
  path: string;
  templatePath: string;
  version: string;
  sets: SetArg[];
}) => {
  const existing = await readIfExists(options.path);
  const doc = parseDocument(
    existing ?? (await readFile(options.templatePath, "utf8")),
  );
  if (existing === undefined) {
    doc.set("version", options.version);
  }
  for (const set of options.sets) {
    doc.setIn(set.path, set.value);
  }
  return doc;
};

/** `settings.json` の `env` の 1 つのキーだけを書き換える。同じ値なら書き込まずに偽を返却する */
export const writeClaudeEnv = async (options: {
  path: string;
  key: string;
  value: string;
}): Promise<boolean> => {
  const text = await readIfExists(options.path);
  const settings = (text === undefined ? {} : JSON.parse(text)) as Record<
    string,
    unknown
  >;
  const env = (settings.env ?? {}) as Record<string, unknown>;
  if (env[options.key] === options.value) {
    return false;
  }
  settings.env = { ...env, [options.key]: options.value };
  await mkdir(dirname(options.path), { recursive: true });
  await writeFile(options.path, `${JSON.stringify(settings, null, 2)}\n`);
  return true;
};

/** `write-settings`: 端末の設定を作る・書き換え、既定のパスでなければ `settings.json` の `env` に `MDMARK_CONFIG` を書き込む */
export const writeSettings = async (options: {
  env: NodeJS.ProcessEnv;
  pluginRoot: string;
  version: string;
  sets: string[];
}): Promise<WriteResult> => {
  const paths = resolveSetupPaths(options.env);
  const sets = parseSetArgs(options.sets);
  const doc = await applySets({
    path: paths.settingsPath,
    templatePath: join(options.pluginRoot, SETTINGS_TEMPLATE),
    version: options.version,
    sets,
  });
  const raw = doc.toJS();
  assertNoIssues([
    ...validateConfig(raw, paths.settingsPath).issues,
    ...validateSettingsKeys(raw, paths.settingsPath),
  ]);
  await mkdir(dirname(paths.settingsPath), { recursive: true });
  await writeFile(
    paths.settingsPath,
    doc.toString({ flowCollectionPadding: false }),
  );
  const written = [paths.settingsPath];
  if (
    !paths.defaultPath &&
    (await writeClaudeEnv({
      path: paths.claudeSettingsPath,
      key: CONFIG_ENV,
      value: paths.settingsPath,
    }))
  ) {
    written.push(paths.claudeSettingsPath);
  }
  return { written, keys: sets.map((set) => set.path.join(".")) };
};

/** `write-config`: 文書のフォルダの `mdmark.config.yaml` を作る・書き換える */
export const writeConfig = async (options: {
  env: NodeJS.ProcessEnv;
  pluginRoot: string;
  version: string;
  dir: string;
  sets: string[];
}): Promise<WriteResult> => {
  const sets = parseSetArgs(options.sets);
  const settingsOnly = sets.find((set) =>
    SETTINGS_ONLY_ROOTS.includes(set.path[0] ?? ""),
  );
  if (settingsOnly) {
    throw new SetupError(
      `${settingsOnly.path.join(".")} は端末の設定だけが持つキーです。mdmark.config.yaml には書き込めません。`,
    );
  }
  const path = join(options.dir, CONFIG_FILE);
  const doc = await applySets({
    path,
    templatePath: join(options.pluginRoot, CONFIG_TEMPLATE),
    version: options.version,
    sets,
  });
  assertNoIssues(validateConfig(doc.toJS(), path).issues);
  await writeFile(path, doc.toString({ flowCollectionPadding: false }));
  return { written: [path], keys: sets.map((set) => set.path.join(".")) };
};
