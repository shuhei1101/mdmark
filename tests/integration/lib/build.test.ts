import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, test, vi } from "vitest";
import { main } from "../../../scripts/build.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

const createdRoots: string[] = [];

/** 一時フォルダに作業ツリー（scripts・src・version.ini・依存）を作り、そのパスを返す */
async function createWorkTree(versionIni: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-build-"));
  createdRoots.push(root);
  await cp(join(REPO_ROOT, "scripts"), join(root, "scripts"), {
    recursive: true,
  });
  await cp(join(REPO_ROOT, "src"), join(root, "src"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(join(root, "version.ini"), versionIni);
  await symlink(
    join(REPO_ROOT, "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  return root;
}

/** 入口 `node scripts/build.ts` を子プロセスとして流し、終了コードと標準エラーを返す */
async function runBuild(
  root: string,
  args: string[],
): Promise<{ code: number; stderr: string }> {
  try {
    const { stderr } = await execFileAsync(
      process.execPath,
      ["scripts/build.ts", ...args],
      { cwd: root },
    );
    return { code: 0, stderr };
  } catch (error) {
    const failed = error as { code?: number; stderr?: string };
    return { code: failed.code ?? -1, stderr: failed.stderr ?? "" };
  }
}

/** ビルドした dist/index.js を読み込み、version() の戻り値を返す */
async function readBuiltVersion(root: string): Promise<string> {
  const url = pathToFileURL(join(root, "dist", "index.js")).href;
  const built: { version: () => string } = await import(url);
  return built.version();
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    createdRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

// version.ini の版を埋めてビルドする（正常系）
test("test_normal", async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  // 実行
  const { code } = await runBuild(root, []);
  // 検証
  expect(code).toBe(0);
  expect(existsSync(join(root, "dist", "index.js"))).toBe(true);
  expect(existsSync(join(root, "dist", "index.css"))).toBe(true);
  expect(await readBuiltVersion(root)).toBe("v0.0.0");
});

// --version で渡した版を埋めてビルドする（正常系）
test("test_normal_when_version_given", async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  // 実行
  const { code } = await runBuild(root, ["--version", "v0.0.1"]);
  // 検証
  expect(code).toBe(0);
  expect(await readBuiltVersion(root)).toBe("v0.0.1");
});

// 書式に合わない版を渡すと、配布物を書かずに終わる（異常系）
test("test_error_when_version_format_invalid", async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  // 実行
  const { code, stderr } = await runBuild(root, ["--version", "1.2"]);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr).toContain("v{MAJOR}.{MINOR}.{PATCH}");
});

// 上限を超えた配布ファイルがあると、書いた配布物を消して終わる（異常系）
// コマンドに上限を差し替える口が無いため、main に maxBytes: 1 を渡す
test("test_error_when_dist_file_too_large", async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.join(" "));
  });
  // 実行
  const code = await main([], { root, maxBytes: 1 });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(errors.join("\n")).toMatch(/index\.js[^\n]*\d/);
});
