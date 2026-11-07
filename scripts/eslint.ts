import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** 子プロセスを `cwd` で起動し、終了コードを返却する */
export type RunCommand = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<number>;

/** `tools/eslint/` の ESLint が入っているかを確認するファイル（作業ツリーの直下から） */
const ESLINT_PACKAGE = "tools/eslint/node_modules/eslint/package.json";

/** `tools/eslint/` の ESLint 9 の実行ファイル（作業ツリーの直下から） */
const ESLINT_BIN = "tools/eslint/node_modules/eslint/bin/eslint.js";

/** Webview に適用する ESLint の設定（作業ツリーの直下から） */
const ESLINT_CONFIG = "tools/eslint/eslint.config.js";

/** 入出力を引き継いで子プロセスを起動し、終了コードを返却する */
const runInherited: RunCommand = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

/** `tools/eslint/` の ESLint が無ければ入れてから起動し、終了コードを返却する */
export const runEslint = async (
  argv: string[],
  options: { root: string; run: RunCommand } = {
    root: process.cwd(),
    run: runInherited,
  },
): Promise<number> => {
  const { root, run } = options;
  if (!existsSync(join(root, ESLINT_PACKAGE))) {
    const installed = await run(
      "npm",
      ["ci", "--prefix", "tools/eslint"],
      root,
    );
    if (installed !== 0) {
      return installed;
    }
  }
  return run(
    process.execPath,
    [ESLINT_BIN, "-c", ESLINT_CONFIG, "--max-warnings", "0", ...argv],
    root,
  );
};

// `node scripts/eslint.ts` で入口として実行されたときだけ実行する
if (import.meta.main) {
  process.exitCode = await runEslint(process.argv.slice(2));
}
