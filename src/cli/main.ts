import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runServe } from "../plugin/http.ts";
import { runBuild } from "./build.ts";
import { runCheck } from "./check.ts";
import { CliError, type CliIo } from "./errors.ts";
import { runExport } from "./export.ts";
import { runInit } from "./init.ts";
import { createLinePrompter, type Prompter } from "./prompt.ts";
import { runUpgrade } from "./upgrade.ts";
import { cliVersion } from "./versions.ts";

// 既存の呼び出し元のために、誤りと入出力の型を再読み込みして出す
export { CliError, type CliIo } from "./errors.ts";

/** 使用できるコマンドの案内 */
const USAGE = [
  "使用できるコマンド:",
  "  init [{配置先のフォルダ}] [--js]",
  "  check [--config {設定ファイル}] [--base {git の ref}]",
  "  check --text {Markdown か -} [--config {設定ファイル}]",
  "  check --file {YAML のファイル} --key {キーのパス} [--config {設定ファイル}]",
  "  export {文書} [--out {出力}] [--config {設定ファイル}]",
  "  build [--config {設定ファイル}]",
  "  upgrade [--plan] [--yes] [--config {設定ファイル} | --settings]",
  "  serve",
];

/** `check --text` に指定すると標準入力から読み込む値 */
const STDIN_TEXT = "-";

/** 標準入力を終わりまで読み込む */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** 雛形と配布物を配置したパッケージの直下を探すマーカーのファイル */
const PACKAGE_FILE = "package.json";

/** `parseArgs` が投げる、知らない引数・値の足りない引数の誤りか */
function isParseArgsError(error: unknown): error is TypeError {
  return (
    error instanceof TypeError &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("ERR_PARSE_ARGS")
  );
}

/** このファイルのあるフォルダから上へ、`package.json` を持つ最初のフォルダ（パッケージの直下）を探す */
function findPackageRoot(from: string): string {
  let dir = from;
  while (!existsSync(join(dir, PACKAGE_FILE))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new CliError(
        `パッケージの場所を見つけられません（${from} から上を探しました）。mdmark をもう一度入れてください。`,
      );
    }
    dir = parent;
  }
  return dir;
}

/** コマンドの引数の決まり */
const ARG_OPTIONS = {
  out: { type: "string" },
  config: { type: "string" },
  base: { type: "string" },
  text: { type: "string" },
  file: { type: "string" },
  key: { type: "string" },
  js: { type: "boolean" },
  plan: { type: "boolean" },
  yes: { type: "boolean" },
  settings: { type: "boolean" },
  "keep-traces": { type: "boolean" },
} as const;

/** コマンドを動かすときに渡す、読み込んだ引数と入出力 */
type CommandContext = {
  values: ReturnType<
    typeof parseArgs<{ options: typeof ARG_OPTIONS; allowPositionals: true }>
  >["values"];
  /** コマンドの名前の後ろの位置引数 */
  rest: string[];
  /** パッケージの根のフォルダ */
  root: string;
  io: CliIo;
  ask: Prompter;
};

/** コマンドの名前から、動かす関数を参照する表 */
const COMMANDS: Record<string, (context: CommandContext) => Promise<0 | 1>> = {
  init: ({ values, rest, root, io }) =>
    runInit(
      {
        dir: resolve(io.cwd, rest[0] ?? "."),
        js: values.js === true,
        templatesDir: join(root, "templates"),
        version: cliVersion(),
      },
      io,
    ),
  check: async ({ values, io }) =>
    runCheck(
      {
        config: values.config,
        base: values.base,
        text: values.text === STDIN_TEXT ? await readStdin() : values.text,
        file: values.file,
        key: values.key,
      },
      io,
    ),
  export: ({ values, rest, root, io }) => {
    const file = rest[0];
    if (file === undefined) {
      throw new CliError("export には書き出す文書のパスが要ります。");
    }
    return runExport(
      {
        file,
        out: values.out,
        config: values.config,
        distDir: join(root, "dist"),
        keepTraces: values["keep-traces"] === true,
      },
      io,
    );
  },
  build: ({ values, root, io }) =>
    runBuild(
      {
        config: values.config,
        distDir: join(root, "dist"),
        keepTraces: values["keep-traces"] === true,
      },
      io,
    ),
  upgrade: ({ values, root, io, ask }) =>
    runUpgrade(
      {
        config: values.config,
        settings: values.settings === true,
        plan: values.plan === true,
        yes: values.yes === true,
        packageDir: root,
        cliVersion: cliVersion(),
        now: new Date(),
      },
      io,
      ask,
    ),
  serve: ({ root, io }) => {
    // SIGINT と SIGTERM を、常駐サーバーを止める合図にする
    const controller = new AbortController();
    process.once("SIGINT", () => controller.abort());
    process.once("SIGTERM", () => controller.abort());
    return runServe({
      env: process.env,
      packageDir: root,
      version: cliVersion(),
      signal: controller.signal,
      stdout: io.stdout,
      stderr: io.stderr,
    });
  },
};

/** 最初の引数のコマンド名で `init`・`check`・`export`・`build`・`upgrade`・`serve` を呼び分け、終了コードを返却する */
export async function main(
  argv: string[],
  io: CliIo,
  ask: Prompter,
): Promise<0 | 1> {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: ARG_OPTIONS,
      allowPositionals: true,
    });
    const [command, ...rest] = positionals;
    const root = findPackageRoot(import.meta.dirname);
    const run =
      command !== undefined && Object.hasOwn(COMMANDS, command)
        ? COMMANDS[command]
        : undefined;
    if (!run) {
      throw new CliError(
        `知らないコマンドです: ${command ?? "（なし）"}\n${USAGE.join("\n")}`,
      );
    }
    return await run({ values, rest, root, io, ask });
  } catch (error) {
    if (error instanceof CliError) {
      io.stderr(error.message);
    } else if (isParseArgsError(error)) {
      io.stderr(`${error.message}\n${USAGE.join("\n")}`);
    } else {
      throw error;
    }
    return 1;
  }
}

// `node dist/cli.js` などで入口として実行されたときだけ実行する
if (import.meta.main) {
  process.exitCode = await main(
    process.argv.slice(2),
    {
      cwd: process.cwd(),
      stdout: (line) => console.log(line),
      stderr: (line) => console.error(line),
    },
    createLinePrompter({
      input: process.stdin,
      write: (line) => console.error(line),
    }),
  );
}
