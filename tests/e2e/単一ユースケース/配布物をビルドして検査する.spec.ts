import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { main } from "../../../scripts/build.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
// コマンドの出力が大きくなっても切れないようにする
const MAX_BUFFER = 64 * 1024 * 1024;
// クローンした直後には無い、コピーしないもの
const NOT_IN_CLONE = [
  "node_modules/",
  "dist/",
  "test-results/",
  "playwright-report/",
  ".vitest/",
];

// 依存を入れたあとの作業ツリー（最初のテストが作り、後のテストが使う）
let root = "";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);
// 作業ツリーを使い回すため、定義した順に 1 つずつ流す
test.describe.configure({ mode: "serial" });

/** 作業ツリーの中でコマンドを流し、終了コードと出力を返す */
async function run(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: root,
      maxBuffer: MAX_BUFFER,
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

/** ビルドした dist/index.js を読み込み、公開関数 version() の戻り値を返す */
async function readBuiltVersion(): Promise<string> {
  const url = `${pathToFileURL(join(root, "dist", "index.js")).href}?t=${Date.now()}`;
  const built: { version: () => string } = await import(url);
  return built.version();
}

/** クローンした直後の作業ツリー（node_modules/ と dist/ が無い写し）を一時フォルダに作る */
async function createClone(): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: REPO_ROOT, maxBuffer: MAX_BUFFER },
  );
  const clone = await mkdtemp(join(tmpdir(), "mdmark-e2e-clone-"));
  const files = stdout
    .split("\0")
    .filter(
      (file) =>
        file !== "" &&
        !NOT_IN_CLONE.some((prefix) => file.startsWith(prefix)) &&
        existsSync(join(REPO_ROOT, file)),
    );
  for (const file of files) {
    await mkdir(dirname(join(clone, file)), { recursive: true });
    await cp(join(REPO_ROOT, file), join(clone, file));
  }
  return clone;
}

test.afterAll(async () => {
  if (root !== "") {
    await rm(root, { recursive: true, force: true });
  }
});

// クローン直後から、依存の導入・ブラウザの導入・lint・型検査・ビルド・テストを順に流す（正常シナリオ）
test("test_normal", async () => {
  // 準備
  root = await createClone();
  expect(existsSync(join(root, "node_modules"))).toBe(false);
  expect(existsSync(join(root, "dist"))).toBe(false);
  // 実行・検証
  expect((await run("npm", ["ci"])).code).toBe(0);
  expect(
    (await run("npx", ["playwright", "install", "chromium", "firefox"])).code,
  ).toBe(0);
  expect((await run("npm", ["run", "lint"])).code).toBe(0);
  expect((await run("npm", ["run", "typecheck"])).code).toBe(0);
  expect((await run("npm", ["run", "build"])).code).toBe(0);
  expect(existsSync(join(root, "dist", "index.js"))).toBe(true);
  expect(existsSync(join(root, "dist", "index.css"))).toBe(true);
  const declarations = await readFile(join(root, "dist", "index.d.ts"), "utf8");
  for (const name of ["mount", "render", "version", "registerExtension"]) {
    expect(declarations, name).toContain(name);
  }
  expect(declarations).toContain("MdmarkExtension");
  expect(await readBuiltVersion()).toBe("v0.0.0");
  expect((await run("npm", ["test"])).code).toBe(0);
});

// --version で渡した版を埋めてビルドする（正常シナリオ）
test("test_normal_when_version_given", async () => {
  // 実行
  const { code } = await run("npm", [
    "run",
    "build",
    "--",
    "--version",
    "v0.0.1",
  ]);
  // 検証
  expect(code).toBe(0);
  expect(await readBuiltVersion()).toBe("v0.0.1");
});

// 書式に合わない版を渡すと、配布物を書かずに終わる（異常シナリオ）
test("test_error_when_version_format_invalid", async () => {
  // 実行
  const { code, stderr } = await run("npm", [
    "run",
    "build",
    "--",
    "--version",
    "1.2",
  ]);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr).toContain("v{MAJOR}.{MINOR}.{PATCH}");
});

// 上限を超えた配布ファイルがあると、書いた配布物を消して終わる（異常シナリオ）
// コマンドに上限を差し替える口が無いため、main に maxBytes: 1 を渡す
test("test_error_when_dist_file_too_large", async () => {
  // 準備
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.join(" "));
  };
  // 実行
  let code: number;
  try {
    code = await main([], { root, maxBytes: 1 });
  } finally {
    console.error = original;
  }
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(errors.join("\n")).toMatch(/index\.js[^\n]*\d/);
});
