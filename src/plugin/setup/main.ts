import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
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
  tmuxMissing: 2,
  timedOut: 3,
} as const;

/** 知らないサブコマンドのときの使い方 */
const USAGE =
  "使い方: setup.js status | keys --target settings|config [--dir {文書のフォルダ}] | write-settings [--set {キー}={値}]... | start-server | write-config --dir {文書のフォルダ} [--set {キー}={値}]...";

/** `$ref` のファイル名から、束ねた Schema を返す */
const SCHEMAS: Record<string, JsonSchema> = {
  "mdmark.config.schema.json": configSchema as JsonSchema,
  "mdmark.settings.schema.json": settingsSchema as JsonSchema,
};

/** `$ref` を束ねた Schema に解決する */
const resolveRef = (ref: string): JsonSchema => {
  const schema = SCHEMAS[ref];
  if (schema === undefined) {
    throw new SetupError(`Schema ${ref} を読めません。`);
  }
  return schema;
};

/** サブコマンドを流し、結果の値を返す */
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
    case "keys": {
      const read = (path: string) =>
        readYamlFile({ path, readFile: (file) => readFile(file, "utf8") });
      const settings =
        (await read(resolveSetupPaths(options.env).settingsPath))?.raw ?? {};
      if (values.target === "settings") {
        return {
          keys: listConfigKeys({
            target: "settings",
            schema: resolveRef("mdmark.settings.schema.json"),
            resolveRef,
            current: settings,
          }),
        };
      }
      if (values.target === "config" && values.dir) {
        const current =
          (await read(join(values.dir, "mdmark.config.yaml")))?.raw ?? {};
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
    }
    case "write-settings":
      return await writeSettings({ ...base, sets });
    case "start-server":
      return await startServer({
        ...base,
        run: options.run,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
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

/** サブコマンドを振り分け、結果の JSON を標準出力に 1 行書き、終了コードを返す */
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

/** 外部のコマンドを流し、終了コードと標準出力を返す。見つからないコマンドは 127 */
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

// 束ねた `plugin/bin/setup.js` を入口として実行されたときだけ流す
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
