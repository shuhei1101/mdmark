import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect } from "./cli.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../..");
// マーケットプレイスにするリポジトリ
const REPOSITORY = "shuhei1101/mdmark";
// 入れるプラグイン
const PLUGIN_ID = "mdmark@mdmark";

/** `claude plugin list --json` の 1 行のうち、検証に使用する項目 */
export type InstalledPlugin = {
  id: string;
  enabled: boolean;
  installPath: string;
};

/** コマンドを実行し、終了コードと出力を返却する。0 以外でも例外を投げない */
export async function run(
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

/** 今の HEAD のブランチを返却する。push 済みで `plugin/` の生成物を commit してあることを確認し、満たさないときは理由を添えて投げる */
async function pushedBranch(): Promise<string> {
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
    ["cat-file", "-e", "HEAD:plugin/scripts/pre-tool-use.js"],
    { cwd: REPO_ROOT },
  );
  if (committed.code !== 0) {
    throw new Error(
      `HEAD（${branch}）に plugin/scripts/pre-tool-use.js が無い。release ブランチで npm run build を流し、dist/ と plugin/ の生成物を commit して push した後に流す`,
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
  return branch;
}

/** 今の HEAD のブランチをマーケットプレイスとして追加し、設定のフォルダ `configDir` にプラグインを入れて、入った `mdmark@mdmark` を返却する */
export async function installPlugin(
  configDir: string,
): Promise<InstalledPlugin> {
  const branch = await pushedBranch();
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  const options = { cwd: configDir, env };
  const added = await run(
    "claude",
    ["plugin", "marketplace", "add", `${REPOSITORY}#${branch}`],
    options,
  );
  const installed = await run(
    "claude",
    ["plugin", "install", PLUGIN_ID],
    options,
  );
  const listed = await run("claude", ["plugin", "list", "--json"], options);
  expect(added.code, added.stderr).toBe(0);
  expect(installed.code, installed.stderr).toBe(0);
  const plugin = (JSON.parse(listed.stdout) as InstalledPlugin[]).find(
    (entry) => entry.id === PLUGIN_ID,
  );
  expect(
    plugin,
    `${PLUGIN_ID} が claude plugin list --json に出る`,
  ).toBeDefined();
  expect(plugin?.enabled).toBe(true);
  expect(plugin?.installPath.startsWith(configDir)).toBe(true);
  return plugin as InstalledPlugin;
}

/** 設定のフォルダ `configDir` から、プラグインとマーケットプレイスの追加を削除する */
export async function uninstallPlugin(configDir: string): Promise<void> {
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  const options = { cwd: configDir, env };
  const removed = await run(
    "claude",
    ["plugin", "uninstall", PLUGIN_ID],
    options,
  );
  const unlisted = await run(
    "claude",
    ["plugin", "marketplace", "remove", "mdmark"],
    options,
  );
  expect(removed.code, removed.stderr).toBe(0);
  expect(unlisted.code, unlisted.stderr).toBe(0);
}
