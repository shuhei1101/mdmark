import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import configSchema from "../../../schemas/mdmark.config.schema.json" with {
  type: "json",
};
import settingsSchema from "../../../schemas/mdmark.settings.schema.json" with {
  type: "json",
};
import { CliError } from "../../cli/errors.ts";
import { type JsonSchema, listConfigKeys } from "./keys.ts";
import { readYamlFile, resolveSetupPaths, SetupError } from "./paths.ts";
import { type RunCommand, startServer } from "./server.ts";
import { readTerminalStatus } from "./status.ts";
import { writeConfig, writeSettings } from "./write.ts";

/** ビルドが埋める mdmark のバージョン */
declare const __MDMARK_VERSION__: string;

/** setup.js の終了コード */
export const SETUP_EXIT = {
  ok: 0,
  failed: 1,
  launcherMissing: 2,
  timedOut: 3,
} as const;

/** 知らないサブコマンドのときの使用方法 */
const USAGE =
  "使用方法: setup.js status | keys --target settings|config [--dir {文書のフォルダ}] | write-settings [--set {キー}={値}]... | start-server [--launcher systemd|tmux] | write-config --dir {文書のフォルダ} [--set {キー}={値}]...";

/** `$ref` のファイル名から、まとめた Schema を返却する */
const SCHEMAS: Record<string, JsonSchema> = {
  "mdmark.config.schema.json": configSchema as JsonSchema,
  "mdmark.settings.schema.json": settingsSchema as JsonSchema,
};

/** `$ref` をまとめた Schema に解決する */
const resolveRef = (ref: string): JsonSchema => {
  const schema = SCHEMAS[ref];
  if (schema === undefined) {
    throw new SetupError(`Schema ${ref} を読み込めません。`);
  }
  return schema;
};

/** `keys` のサブコマンド: 端末の設定か文書のフォルダの設定のキーの一覧を返却する */
const listKeys = async (options: {
  env: NodeJS.ProcessEnv;
  target: string | undefined;
  dir: string | undefined;
}): Promise<{ keys: ReturnType<typeof listConfigKeys> }> => {
  const { env, target, dir } = options;
  const read = (path: string) =>
    readYamlFile({ path, readFile: (file) => readFile(file, "utf8") });
  const settings = (await read(resolveSetupPaths(env).settingsPath))?.raw ?? {};
  if (target === "settings") {
    return {
      keys: listConfigKeys({
        target: "settings",
        schema: resolveRef("mdmark.settings.schema.json"),
        resolveRef,
        current: settings,
      }),
    };
  }
  if (target === "config" && dir) {
    const current = (await read(join(dir, "mdmark.config.yaml")))?.raw ?? {};
    return {
      keys: listConfigKeys({
        target: "config",
        schema: resolveRef("mdmark.config.schema.json"),
        resolveRef,
        current,
        inherited: settings,
      }),
    };
  }
  throw new SetupError(
    "keys は --target settings か、--target config と --dir {文書のフォルダ} で呼んでください。",
  );
};

/** `start-server` の `--launcher` が `systemd`・`tmux`・省略のどれかかを確認する */
const checkLauncher = (
  launcher: string | undefined,
): "systemd" | "tmux" | undefined => {
  if (launcher === undefined || launcher === "systemd" || launcher === "tmux") {
    return launcher;
  }
  throw new SetupError(
    `start-server の --launcher には systemd か tmux を指定してください（${launcher}）。${USAGE}`,
  );
};

/** サブコマンドを実行し、結果の値を返却する */
const runCommand = async (options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  pluginRoot: string;
  version: string;
  run: RunCommand;
}): Promise<unknown> => {
  const { values, positionals } = parseArgs({
    args: options.argv,
    options: {
      target: { type: "string" },
      dir: { type: "string" },
      set: { type: "string", multiple: true },
      launcher: { type: "string" },
    },
    allowPositionals: true,
  });
  const base = {
    env: options.env,
    pluginRoot: options.pluginRoot,
    version: options.version,
  };
  const sets = values.set ?? [];
  switch (positionals[0]) {
    case "status":
      return await readTerminalStatus({ ...base, run: options.run });
    case "keys":
      return await listKeys({
        env: options.env,
        target: values.target,
        dir: values.dir,
      });
    case "write-settings":
      return await writeSettings({ ...base, sets });
    case "start-server":
      return await startServer({
        ...base,
        launcher: checkLauncher(values.launcher),
        run: options.run,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        writeFile: (path, data) => writeFile(path, data, "utf8"),
      });
    case "write-config":
      if (!values.dir) {
        throw new SetupError(
          "write-config は --dir {文書のフォルダ} を付けて呼んでください。",
        );
      }
      return await writeConfig({ ...base, dir: values.dir, sets });
    default:
      throw new SetupError(USAGE);
  }
};

/** サブコマンドを振り分け、結果の JSON を標準出力に 1 行書き、終了コードを返却する */
export const runSetup = async (options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  pluginRoot: string;
  version: string;
  run: RunCommand;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}): Promise<0 | 1 | 2 | 3> => {
  try {
    options.stdout(JSON.stringify(await runCommand(options)));
    return SETUP_EXIT.ok;
  } catch (error) {
    if (error instanceof SetupError) {
      options.stderr(error.message);
      return error.exitCode;
    }
    if (error instanceof CliError) {
      options.stderr(error.message);
      return SETUP_EXIT.failed;
    }
    throw error;
  }
};

/** 外部のコマンドを実行し、終了コードと標準出力を返却する。見つからないコマンドは 127 */
const runExternal: RunCommand = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, (error, stdout) => {
      if (error === null) {
        resolve({ code: 0, stdout });
        return;
      }
      resolve({
        code: typeof error.code === "number" ? error.code : 127,
        stdout,
      });
    });
  });

// まとめた `plugin/bin/setup.js` を入口として実行されたときだけ実行する
if (import.meta.main) {
  process.exitCode = await runSetup({
    argv: process.argv.slice(2),
    env: process.env,
    pluginRoot: join(import.meta.dirname, ".."),
    version: __MDMARK_VERSION__,
    run: runExternal,
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line),
  });
}
