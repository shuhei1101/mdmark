import { type ChildProcess, execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, git, test } from "../cli.ts";
import { findFreePort, withMcpClient } from "../plugin.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
// コマンドの出力が大きくなっても切れないようにする
const MAX_BUFFER = 64 * 1024 * 1024;
// 一時のリポジトリに打つバージョンのタグ
const TAG = "v0.0.1";
// バージョンのタグの中身に含めない、作業ツリーにだけあるもの（`dist/` はビルドした作業ツリーのものに替える）
const NOT_IN_TAG = [
  "node_modules/",
  "dist/",
  "test-results/",
  "playwright-report/",
  ".vitest/",
];
// `mdmark serve` が待ち受けを始めたときに標準出力へ出す URL
const LISTENING_URL_PATTERN = /http:\/\/127\.0\.0\.1:\d+\/mcp/;
// 待ち受けの URL が出たかを確認する間隔（ミリ秒）
const POLL_INTERVAL_MS = 500;
// 依存を npm レジストリから入れてから起動するまで待つ上限（ミリ秒）。`prepare` が残っていると devDependencies も入れるため、その時間（実測で約 3 分）を含める
const INSTALL_TIMEOUT_MS = 480_000;
// テスト 1 件の上限（ミリ秒）。導入の待ちの上限に、一時のリポジトリの用意とツールの一覧の取得の分を加算する
const TEST_TIMEOUT_MS = 600_000;
// `npm ci --prefix tools/eslint` が出す導入の集計の行
const ESLINT_INSTALL_OUTPUT = /added \d+ packages/;

// ブラウザを使用しないため、1 つのブラウザのプロジェクトだけで実行する
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 起動した `npm exec` と、その出力 */
type Exec = {
  child: ChildProcess;
  output: () => string;
  exited: Promise<number>;
};

/** Git のリポジトリの場所を指す環境変数（`GIT_DIR` など）を削除した環境に、`overrides` を重ねる */
function childEnv(overrides: Record<string, string>): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) };
  for (const name of Object.keys(env)) {
    if (name.startsWith("GIT_")) {
      delete env[name];
    }
  }
  delete env.MDMARK_PORT;
  return { ...env, ...overrides };
}

/** 作業ツリーのファイルに、ビルドした作業ツリーの `dist/` を重ねて commit し、バージョンのタグを打った Git のリポジトリを作る */
async function createTaggedRepo(options: {
  builtRoot: string;
  repo: string;
}): Promise<void> {
  const { builtRoot, repo } = options;
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: REPO_ROOT, maxBuffer: MAX_BUFFER, env: childEnv({}) },
  );
  const files = stdout
    .split("\0")
    .filter(
      (file) =>
        file !== "" &&
        !NOT_IN_TAG.some((prefix) => file.startsWith(prefix)) &&
        existsSync(join(REPO_ROOT, file)),
    );
  for (const file of files) {
    await mkdir(dirname(join(repo, file)), { recursive: true });
    await cp(join(REPO_ROOT, file), join(repo, file));
  }
  await cp(join(builtRoot, "dist"), join(repo, "dist"), { recursive: true });
  await git(repo, "init", "--quiet");
  await git(repo, "add", "--all", "--force");
  await git(
    repo,
    "-c",
    "user.name=e2e",
    "-c",
    "user.email=e2e@example.com",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-m",
    TAG,
  );
  await git(repo, "tag", TAG);
}

/** `npm exec --yes {参照} serve` を、子プロセスごと止められるように別のプロセスグループで起動する */
function launchExec(options: {
  ref: string;
  cwd: string;
  env: Record<string, string>;
}): Exec {
  const { ref, cwd, env } = options;
  const child = spawn("npm", ["exec", "--yes", ref, "serve"], {
    cwd,
    env: childEnv(env),
    detached: true,
  });
  let output = "";
  const append = (chunk: Buffer) => {
    output += chunk.toString("utf8");
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  const exited = new Promise<number>((resolve) => {
    child.once("close", (code) => resolve(code ?? -1));
  });
  return { child, output: () => output, exited };
}

/** 待ち受けの URL が出るまで待って返却する。先に終わったか上限を過ぎたときは、出力を添えて投げる */
async function waitListening(exec: Exec): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setInterval(() => {
      const found = LISTENING_URL_PATTERN.exec(exec.output());
      if (found !== null) {
        clearInterval(timer);
        clearTimeout(deadline);
        resolve(found[0]);
      }
    }, POLL_INTERVAL_MS);
    const deadline = setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`待ち受けの URL が出なかった: ${exec.output()}`));
    }, INSTALL_TIMEOUT_MS);
    void exec.exited.then((code) => {
      clearInterval(timer);
      clearTimeout(deadline);
      reject(
        new Error(
          `npm exec が待ち受ける前に終わった（終了コード ${code}）: ${exec.output()}`,
        ),
      );
    });
  });
}

/** `npm exec` と、その下で動く `mdmark serve` をまとめて止める */
async function stopExec(exec: Exec): Promise<void> {
  const { child } = exec;
  if (
    child.pid !== undefined &&
    child.exitCode === null &&
    child.signalCode === null
  ) {
    process.kill(-child.pid, "SIGKILL");
  }
  await exec.exited;
}

// バージョンのタグを指す参照から入れて serve を起動し、開発用の処理を実行せずにツールの一覧を返却する（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  // 準備
  const repo = await tempDir();
  const cache = await tempDir();
  const cwd = await tempDir();
  await createTaggedRepo({ builtRoot, repo });
  const port = await findFreePort();
  const ref = `git+${pathToFileURL(repo).href}#${TAG}`;

  // 実行
  const exec = launchExec({
    ref,
    cwd,
    env: {
      MDMARK_PORT: String(port),
      npm_config_cache: cache,
      npm_config_foreground_scripts: "true",
    },
  });
  try {
    const url = await waitListening(exec);
    const tools = await withMcpClient(
      { builtRoot, serverUrl: url },
      async (client) =>
        (await client.listTools()).tools.map(({ name }) => name),
    );

    // 検証
    expect(url).toBe(`http://127.0.0.1:${port}/mcp`);
    expect(exec.child.exitCode).toBeNull();
    expect(exec.output()).not.toMatch(ESLINT_INSTALL_OUTPUT);
    expect(tools).toEqual(
      expect.arrayContaining(["build_site", "check", "export_html"]),
    );
  } finally {
    await stopExec(exec);
  }
});
