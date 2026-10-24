import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "../cli.ts";
import { withMcpClient } from "../plugin.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
// マーケットプレイスにするリポジトリ
const REPOSITORY = "shuhei1101/mdmark";

/** `claude plugin list --json` の 1 行のうち、検証に使う項目 */
type InstalledPlugin = {
  id: string;
  enabled: boolean;
  installPath: string;
};

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** コマンドを流し、終了コードと出力を返す。0 以外でも例外を投げない */
async function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      ...options,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof failed.code === "number" ? failed.code : -1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}

// 今の HEAD のブランチをマーケットプレイスとして足し、プラグインを入れ、束ねたサーバーが起動する（正常シナリオ）
// ブランチは push 済みであること。tester が release ブランチで `dist/` と `plugin/` の生成物を commit して push した後に流す
test("test_normal", async ({ tempDir }) => {
  // 準備
  const branch = (
    await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO_ROOT })
  ).stdout.trim();
  if (branch === "HEAD") {
    throw new Error(
      "HEAD が detached で、GitHub のブランチを決められない。ブランチを checkout して流す",
    );
  }
  const committed = await run(
    "git",
    ["cat-file", "-e", "HEAD:plugin/server/mcp.js"],
    {
      cwd: REPO_ROOT,
    },
  );
  if (committed.code !== 0) {
    throw new Error(
      `HEAD（${branch}）に plugin/server/mcp.js が無い。release ブランチで npm run build を流し、dist/ と plugin/ の生成物を commit して push した後に流す`,
    );
  }
  // 手元の HEAD と GitHub のブランチの commit が違うと、手元と違う中身を入れて判定してしまう
  const head = (
    await run("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT })
  ).stdout.trim();
  const remote = await run(
    "git",
    ["ls-remote", "origin", `refs/heads/${branch}`],
    { cwd: REPO_ROOT },
  );
  if (remote.code !== 0) {
    throw new Error(
      `git ls-remote origin refs/heads/${branch} が失敗した: ${remote.stderr}`,
    );
  }
  const pushed = remote.stdout.split(/\s+/)[0] ?? "";
  if (pushed !== head) {
    throw new Error(
      `手元の HEAD（${head}）と GitHub のブランチ（${pushed || "無い"}）の commit が違う。両方の commit を揃えるため、commit して push した後に流す`,
    );
  }
  // 手元の設定を書き換えないよう、設定のフォルダは空の一時フォルダに閉じる
  const configDir = await tempDir();
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  const options = { cwd: configDir, env };
  // 実行
  const added = await run(
    "claude",
    ["plugin", "marketplace", "add", `${REPOSITORY}#${branch}`],
    options,
  );
  const installed = await run(
    "claude",
    ["plugin", "install", "mdmark@mdmark"],
    options,
  );
  const listed = await run("claude", ["plugin", "list", "--json"], options);
  // 検証
  expect(added.code, added.stderr).toBe(0);
  expect(installed.code, installed.stderr).toBe(0);
  const plugin = (JSON.parse(listed.stdout) as InstalledPlugin[]).find(
    (entry) => entry.id === "mdmark@mdmark",
  );
  expect(
    plugin,
    "mdmark@mdmark が claude plugin list --json に出る",
  ).toBeDefined();
  expect(plugin?.enabled).toBe(true);
  const installPath = plugin?.installPath ?? "";
  expect(installPath.startsWith(configDir)).toBe(true);
  for (const path of [
    join("hooks", "hooks.json"),
    ".mcp.json",
    join("server", "mcp.js"),
    join("node_modules", "esbuild"),
  ]) {
    expect(existsSync(join(installPath, path)), path).toBe(true);
  }
  // `.mcp.json` のコマンドで起動すると、ツールの一覧を返す
  const tools = await withMcpClient(
    { pluginDir: installPath, projectDir: await tempDir() },
    async (client) => (await client.listTools()).tools.map((tool) => tool.name),
  );
  expect(tools).toContain("read_guide");
  expect(tools.length).toBeGreaterThan(0);
});
