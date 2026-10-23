import * as assert from "node:assert";
import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { REPO_ROOT } from "./helpers.ts";

const execFileAsync = promisify(execFile);

/** 拡張機能の場所 */
const EXTENSION_DIR = join(REPO_ROOT, "vscode");
/** .vsix を作るのにかかる時間の上限（ミリ秒） */
const PACKAGE_TIMEOUT_MS = 180000;

/** `npm --prefix vscode run {script}` を流し、終了コードと出力を返す */
async function runScript(
  script: string,
  args: string[] = [],
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "npm",
      [
        "--prefix",
        "vscode",
        "run",
        script,
        ...(args.length > 0 ? ["--", ...args] : []),
      ],
      {
        cwd: REPO_ROOT,
        timeout: PACKAGE_TIMEOUT_MS,
        // 拡張機能ホストの PATH の先頭は古い Node のことがあるため、テストの入口と同じ Node を先頭にする
        env: {
          ...process.env,
          PATH: `${process.env.MDMARK_TEST_NODE_DIR}${delimiter}${process.env.PATH}`,
        },
      },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failed.code ?? -1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}

/** .vsix の中のファイルの一覧 */
async function listVsix(path: string): Promise<string[]> {
  const { stdout } = await execFileAsync("unzip", ["-Z1", path]);
  return stdout.split("\n").filter((line) => line !== "");
}

/** .vsix の中のファイルを読む */
async function readVsix(path: string, name: string): Promise<string> {
  const { stdout } = await execFileAsync("unzip", ["-p", path, name]);
  return stdout;
}

suite("拡張機能の配布物を作る", () => {
  const vsix = join(EXTENSION_DIR, "mdmark-0.1.0.vsix");

  teardown(async () => {
    await rm(vsix, { force: true });
  });

  // バージョンが合うとき、.vsix を作る
  test("test_normal", async function () {
    this.timeout(PACKAGE_TIMEOUT_MS + 10000);
    // 準備
    const manifest = JSON.parse(
      await readFile(join(EXTENSION_DIR, "package.json"), "utf8"),
    ) as { version: string };
    assert.strictEqual(manifest.version, "0.1.0");
    // 実行
    const check = await runScript("release:check", ["vscode-v0.1.0"]);
    const packaged = await runScript("package");
    // 検証
    assert.strictEqual(check.code, 0);
    assert.strictEqual(packaged.code, 0, packaged.stderr);
    const files = await listVsix(vsix);
    const packageJson = JSON.parse(
      await readVsix(vsix, "extension/package.json"),
    ) as { version: string };
    assert.strictEqual(packageJson.version, "0.1.0");
    assert.ok(files.some((name) => name.startsWith("extension/dist/")));
    assert.ok(!files.some((name) => name.includes("node_modules/")));
    const workflow = parse(
      await readFile(
        join(REPO_ROOT, ".github", "workflows", "vscode-release.yml"),
        "utf8",
      ),
    ) as {
      on: { push: { tags: string[] } };
      permissions: { contents: string };
    };
    assert.deepStrictEqual(workflow.on.push.tags, ["vscode-v*"]);
    assert.strictEqual(workflow.permissions.contents, "write");
  });

  // タグと package.json のバージョンが違うとき、版の比較で止める
  test("test_error_when_version_mismatch", async () => {
    // 実行
    const mismatch = await runScript("release:check", ["vscode-v0.2.0"]);
    const malformed = await runScript("release:check", ["vscode-0.1.0"]);
    // 検証
    assert.strictEqual(mismatch.code, 1);
    assert.ok(mismatch.stderr.includes("0.2.0"));
    assert.ok(mismatch.stderr.includes("0.1.0"));
    assert.strictEqual(malformed.code, 1);
  });
});
