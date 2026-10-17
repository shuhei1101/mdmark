import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runBuild } from "./build.ts";
import { runCheck } from "./check.ts";
import { runExport } from "./export.ts";
import { runInit } from "./init.ts";

/** コマンドが使う今のフォルダと、標準出力・標準エラーへの書き出し */
export type CliIo = {
  /** 今のフォルダ */
  cwd: string;
  /** 標準出力へ 1 行書く */
  stdout: (line: string) => void;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
};

/** 原因と直し方の 1 文を持ち、`main` が標準エラーに出して終了コード 1 にする誤り */
export class CliError extends Error {}

/** 使えるコマンドの案内 */
const USAGE = [
  "使えるコマンド:",
  "  init [{置く先のフォルダ}] [--js]",
  "  check [--config {設定ファイル}]",
  "  export {文書} [--out {出力}] [--config {設定ファイル}]",
  "  build [--config {設定ファイル}]",
];

/** 雛形と配布物を置いたパッケージの直下を探す印のファイル */
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
        `パッケージの場所を見つけられません（${from} から上を探しました）。mdmark を入れ直してください。`,
      );
    }
    dir = parent;
  }
  return dir;
}

/** 最初の引数のコマンド名で `init`・`check`・`export`・`build` を呼び分け、終了コードを返す */
export async function main(argv: string[], io: CliIo): Promise<0 | 1> {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: {
        out: { type: "string" },
        config: { type: "string" },
        js: { type: "boolean" },
      },
      allowPositionals: true,
    });
    const [command, ...rest] = positionals;
    const root = findPackageRoot(import.meta.dirname);
    switch (command) {
      case "init":
        return await runInit(
          {
            dir: resolve(io.cwd, rest[0] ?? "."),
            js: values.js === true,
            templatesDir: join(root, "templates"),
          },
          io,
        );
      case "check":
        return await runCheck({ config: values.config }, io);
      case "export": {
        const file = rest[0];
        if (file === undefined) {
          throw new CliError("export には書き出す文書のパスが要ります。");
        }
        return await runExport(
          {
            file,
            out: values.out,
            config: values.config,
            distDir: join(root, "dist"),
          },
          io,
        );
      }
      case "build":
        return await runBuild(
          { config: values.config, distDir: join(root, "dist") },
          io,
        );
      default:
        throw new CliError(
          `知らないコマンドです: ${command ?? "（なし）"}\n${USAGE.join("\n")}`,
        );
    }
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

// `node dist/cli.js` などで入口として実行されたときだけ流す
if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line),
  });
}
