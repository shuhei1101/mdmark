import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** リポジトリの直下からの mdmark-style の結合テストのフォルダ */
const INTEGRATION_TESTS_DIR =
  "tests/integration/ClaudeCodeプラグイン/mdmark-style";

/** リポジトリの直下からの配るプラグインのフォルダ */
const PLUGIN_DIR = "mdmark-style";

/** ビルドした mod の、プラグインのフォルダからのパス */
const BUILT_MOD = "hooks/mod/mod.js";

/** 一時フォルダに `PLUGIN_DIR` をコピーし、その中の `tests/` に結合テストのファイルをコピーする。`only` を指定したときは、そのファイル名のテストと共通のファイルだけをコピーする */
export const stagePluginTests = async (options: {
  root: string;
  tmpDir: string;
  only?: string[];
}): Promise<string> => {
  const { root, tmpDir, only = [] } = options;
  if (!existsSync(join(root, PLUGIN_DIR, BUILT_MOD))) {
    throw new Error(
      `${PLUGIN_DIR}/${BUILT_MOD} が無い。npm run build を先に実行する`,
    );
  }
  const staged = join(tmpDir, PLUGIN_DIR);
  await cp(join(root, PLUGIN_DIR), staged, { recursive: true });
  const testsDir = join(staged, "tests");
  await mkdir(testsDir, { recursive: true });
  const source = join(root, INTEGRATION_TESTS_DIR);
  for (const name of await readdir(source)) {
    const isTest = /\.test\.tsx?$/.test(name);
    if (isTest && only.length > 0 && !only.includes(name)) {
      continue;
    }
    await cp(join(source, name), join(testsDir, name), { recursive: true });
  }
  return staged;
};

/** 入出力を引き継いで `claude` を起動し、終了コードを返却する */
const runClaude = (args: string[]): Promise<number> =>
  new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

/** テストをプラグインの横に並べ、`claude plugin validate` と `claude plugin test` を実行して、一時フォルダを削除する */
export const main = async (argv: string[]): Promise<number> => {
  const tmpDir = await mkdtemp(join(tmpdir(), "mdmark-style-test-"));
  try {
    const staged = await stagePluginTests({
      root: process.cwd(),
      tmpDir,
      only: argv,
    });
    const validated = await runClaude(["plugin", "validate", staged]);
    if (validated !== 0) {
      return validated;
    }
    return await runClaude(["plugin", "test", staged]);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
