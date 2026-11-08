import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** ESLint の起動を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../scripts/eslint.ts");

const createTempDir = useTempDirs();

/** `run` に渡された 1 回分の呼び出し */
type RunCall = { command: string; args: string[]; cwd: string };

/** 呼び出しを記録し、`exitCodeOf` が返す終了コードを返す `run` を作る */
const createRun = (exitCodeOf: (command: string) => number) => {
  const calls: RunCall[] = [];
  const run = async (
    command: string,
    args: string[],
    cwd: string,
  ): Promise<number> => {
    calls.push({ command, args, cwd });
    return exitCodeOf(command);
  };
  return { calls, run };
};

// ESLint が入っていれば入れずに起動する
test("test_run_eslint", async () => {
  // 準備
  const { runEslint } = await loadModule();
  const root = await createTempDir();
  await writeFiles(root, {
    "tools/eslint/node_modules/eslint/package.json": "{}",
  });
  const { calls, run } = createRun(() => 0);

  // 実行
  const code = await runEslint(["a.ts"], { root, run });

  // 検証
  expect(code).toBe(0);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.command).toBe(process.execPath);
  expect(calls[0]?.cwd).toBe(root);
  expect(calls[0]?.args).toEqual([
    "tools/eslint/node_modules/eslint/bin/eslint.js",
    "-c",
    "tools/eslint/eslint.config.js",
    "--max-warnings",
    "0",
    "a.ts",
  ]);
});

// ESLint が無ければ入れてから起動する
test("test_run_eslint_when_not_installed", async () => {
  // 準備
  const { runEslint } = await loadModule();
  const root = await createTempDir();
  const { calls, run } = createRun(() => 0);

  // 実行
  const code = await runEslint(["a.ts"], { root, run });

  // 検証
  expect(code).toBe(0);
  expect(calls.map(({ command, args }) => [command, ...args])).toEqual([
    ["npm", "ci", "--prefix", "tools/eslint"],
    [
      process.execPath,
      "tools/eslint/node_modules/eslint/bin/eslint.js",
      "-c",
      "tools/eslint/eslint.config.js",
      "--max-warnings",
      "0",
      "a.ts",
    ],
  ]);
  expect(calls.every(({ cwd }) => cwd === root)).toBe(true);
});

// 依存の導入が失敗すると ESLint を起動しない
test("test_run_eslint_when_install_fails", async () => {
  // 準備
  const { runEslint } = await loadModule();
  const root = await createTempDir();
  const { calls, run } = createRun((command) => (command === "npm" ? 1 : 0));

  // 実行
  const code = await runEslint(["a.ts"], { root, run });

  // 検証
  expect(code).toBe(1);
  expect(calls.map(({ command }) => command)).toEqual(["npm"]);
});
