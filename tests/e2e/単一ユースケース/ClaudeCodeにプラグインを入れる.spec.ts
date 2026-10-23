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
  const listed = await run("claude", ["plugin", "list"], options);
  // 検証
  expect(added.code, added.stderr).toBe(0);
  expect(installed.code, installed.stderr).toBe(0);
  expect(listed.stdout).toContain("mdmark@mdmark");
  expect(listed.stdout).toContain("enabled");
  const readFrom = /Read from:\s*(.+)/.exec(listed.stdout)?.[1]?.trim() ?? "";
  expect(readFrom.startsWith(configDir)).toBe(true);
  for (const path of [
    join("hooks", "hooks.json"),
    ".mcp.json",
    join("server", "mcp.js"),
    join("node_modules", "esbuild"),
  ]) {
    expect(existsSync(join(readFrom, path)), path).toBe(true);
  }
  // `.mcp.json` のコマンドで起動すると、ツールの一覧を返す
  const tools = await withMcpClient(
    { pluginDir: readFrom, projectDir: await tempDir() },
    async (client) => (await client.listTools()).tools.map((tool) => tool.name),
  );
  expect(tools).toContain("read_guide");
  expect(tools.length).toBeGreaterThan(0);
});
