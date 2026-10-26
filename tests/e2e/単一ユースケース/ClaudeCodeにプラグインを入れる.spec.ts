import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "../cli.ts";
import {
  DEFAULT_PORT,
  isListening,
  lockDefaultPort,
  readMcpUrl,
  withMcpClient,
  withServe,
} from "../plugin.ts";

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

/** 今の HEAD のブランチを返す。push 済みで `plugin/` の生成物を commit してあることを確かめ、満たさないときは理由を添えて投げる */
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

/** 今の HEAD のブランチをマーケットプレイスとして足してプラグインを入れ、入った `mdmark@mdmark` を返す。手元の設定を書き換えないよう、設定のフォルダは空の一時フォルダに閉じる */
async function installPlugin(
  tempDir: () => Promise<string>,
): Promise<InstalledPlugin> {
  const branch = await pushedBranch();
  const configDir = await tempDir();
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  const options = { cwd: configDir, env };
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
  expect(plugin?.installPath.startsWith(configDir)).toBe(true);
  return plugin as InstalledPlugin;
}

/** エラーと、その `cause` をたどって、メッセージとエラーコードを 1 つの文字列にする */
function describeError(error: unknown): string {
  const parts: string[] = [];
  for (let current = error; current instanceof Error; ) {
    parts.push(current.message, String((current as { code?: string }).code));
    current = current.cause;
  }
  return parts.join("\n");
}

// 今の HEAD のブランチをマーケットプレイスとして足し、プラグインを入れ、起動した常駐サーバーにつながる（正常シナリオ）
// ブランチは push 済みであること。tester が release ブランチで `dist/` と `plugin/` の生成物を commit して push した後に流す
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const release = await lockDefaultPort();
  try {
    // 実行
    const { installPath } = await installPlugin(tempDir);
    const mcp = await readMcpUrl({ pluginDir: installPath, env: {} });
    const tools = await withServe({ builtRoot, env: {} }, () =>
      withMcpClient({ builtRoot, serverUrl: mcp.url }, async (client) =>
        (await client.listTools()).tools.map((tool) => tool.name),
      ),
    );
    // 検証
    for (const path of [
      join("hooks", "hooks.json"),
      ".mcp.json",
      join("scripts", "session-start.js"),
      join("scripts", "pre-tool-use.js"),
    ]) {
      expect(existsSync(join(installPath, path)), path).toBe(true);
    }
    expect(existsSync(join(installPath, "node_modules"))).toBe(false);
    expect(mcp.type).toBe("http");
    expect(mcp.url).toBe(`http://127.0.0.1:${DEFAULT_PORT}/mcp`);
    expect(mcp.hasCommand).toBe(false);
    expect(tools).toContain("read_guide");
  } finally {
    await release();
  }
});

// 常駐サーバーが起動していなくてもプラグインは入り、接続だけが拒否される（異常シナリオ（常駐サーバーが起動していない））
test("test_error_when_server_not_running", async ({ builtRoot, tempDir }) => {
  // 準備
  const release = await lockDefaultPort();
  try {
    expect(await isListening(DEFAULT_PORT)).toBe(false);
    // 実行
    const { installPath } = await installPlugin(tempDir);
    const mcp = await readMcpUrl({ pluginDir: installPath, env: {} });
    const connecting = await withMcpClient(
      { builtRoot, serverUrl: mcp.url },
      async () => undefined,
    ).catch((error: unknown) => error);
    // 検証
    expect(connecting).toBeInstanceOf(Error);
    expect(describeError(connecting)).toContain("ECONNREFUSED");
  } finally {
    await release();
  }
});
