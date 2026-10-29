import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTests } from "@vscode/test-electron";

/** 検証する VS Code: 対応する下限と、その時点の stable */
const VERSIONS = ["1.141.0", "stable"];

/** 一時のリポジトリの中で git を実行する */
function git(cwd, ...args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

/** a.md を 3 回コミットした一時の Git リポジトリを作る */
async function createRepository() {
  const root = await mkdtemp(join(tmpdir(), "mdmark-poc-repo-"));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "poc@example.com");
  git(root, "config", "user.name", "poc");
  for (const body of ["# 1\n\n一つ目\n", "# 2\n\n二つ目\n", "# 3\n\n三つ目\n"]) {
    await writeFile(join(root, "a.md"), body);
    git(root, "add", "a.md");
    git(root, "commit", "-q", "-m", body.split("\n")[0]);
  }
  return root;
}

const extensionPath = import.meta.dirname;
for (const version of VERSIONS) {
  const repository = await createRepository();
  const userDataDir = await mkdtemp(join(tmpdir(), "mdmark-poc-user-"));
  const extensionsDir = await mkdtemp(join(tmpdir(), "mdmark-poc-ext-"));
  const resultPath = join(userDataDir, "result.json");
  try {
    // 組み込みの Git の拡張機能を使うため --disable-extensions を渡さず、入れた拡張機能だけを空のフォルダで切り離す
    await runTests({
      version,
      extensionDevelopmentPath: extensionPath,
      extensionTestsPath: join(extensionPath, "suite.mjs"),
      launchArgs: [
        repository,
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
      ],
      extensionTestsEnv: { POC_REPOSITORY: repository, POC_RESULT: resultPath },
    });
  } finally {
    console.log(`## VS Code ${version}`);
    console.log(await readFile(resultPath, "utf8").catch(() => "(結果なし)"));
    await rm(repository, { recursive: true, force: true });
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionsDir, { recursive: true, force: true });
  }
}
