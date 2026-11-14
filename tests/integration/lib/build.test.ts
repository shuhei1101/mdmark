import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  appendFile,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { main } from "../../../scripts/build.ts";
import { migrationsDirOf } from "../../migrations-dir.ts";
import { copyPluginInputs, writeRootPackageJson } from "../plugin-inputs.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

// ビルド（型定義を記載する `tsc` を含む）を子プロセスで実行するテストの待つ上限（ミリ秒）。
// WSL2 の /mnt/c 上で、このファイル単独 5 回と integration-node 全件 3 回を実行した所要時間の最大は 128.6 秒（削除した test_normal_when_schema_change_listed）。
// 128.6 秒 × 1.5 = 192.9 秒を 10 秒単位で切り上げて 200 秒にした。残したテストの全件 2 回の最大は 99.2 秒（test_normal_when_version_given）で、この上限に収まる
const BUILD_TIMEOUT_MS = 200_000;

const createdRoots: string[] = [];

/** 作業ツリーのコピー元（ファイルで 1 回だけリポジトリから写す。`version.ini` と依存は含めない） */
let templateRoot = "";

beforeAll(async () => {
  templateRoot = await mkdtemp(join(tmpdir(), "mdmark-integration-build-src-"));
  await cp(join(REPO_ROOT, "scripts"), join(templateRoot, "scripts"), {
    recursive: true,
  });
  await cp(join(REPO_ROOT, "src"), join(templateRoot, "src"), {
    recursive: true,
  });
  // CLI がまとめる設定の Schema と取り込んだ alias-inject の Schema
  await cp(join(REPO_ROOT, "schemas"), join(templateRoot, "schemas"), {
    recursive: true,
  });
  // CLI の `init` が写す雛形の原本
  await cp(join(REPO_ROOT, "templates"), join(templateRoot, "templates"), {
    recursive: true,
  });
  await writeRootPackageJson(templateRoot);
  await copyPluginInputs(templateRoot);
  // 型定義を記載する `tsc` が読み込む設定
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    await copyFile(join(REPO_ROOT, name), join(templateRoot, name));
  }
});

afterAll(async () => {
  await rm(templateRoot, { recursive: true, force: true });
});

/** 一時フォルダに作業ツリー（コピー元・version.ini・依存）を作り、そのパスを返却する */
async function createWorkTree(versionIni: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-build-"));
  createdRoots.push(root);
  await cp(templateRoot, root, { recursive: true });
  await writeFile(join(root, "version.ini"), versionIni);
  await symlink(
    join(REPO_ROOT, "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  return root;
}

/** 一時フォルダの git で、署名なしに git を実行する */
async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync(
    "git",
    [
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd: root },
  );
}

/** 手順を 1 つ持つ `steps.yaml` の本文（`to` を省いて構造の誤りにもできる） */
function stepsYaml(options?: { withoutTo?: boolean }): string {
  return [
    "steps:",
    "  - op: rename_key",
    "    description: legacy を renamed に改める",
    "    file: config",
    "    from: legacy",
    ...(options?.withoutTo ? [] : ["    to: renamed"]),
    "",
  ].join("\n");
}

/** `v0.3.0` のタグを打った作業ツリーを作る。タグの commit は今の Schema と、手順なしの一覧が空の `migrations/` を持つ */
async function createTaggedWorkTree(versionIni: string): Promise<string> {
  const root = await createWorkTree(versionIni);
  await mkdir(join(root, "migrations"), { recursive: true });
  await writeFile(join(root, "migrations", "no-steps.yaml"), "entries: []\n");
  await git(root, ["init", "--quiet"]);
  await git(root, ["add", "schemas", "migrations", "version.ini"]);
  await git(root, ["commit", "--quiet", "-m", "初期"]);
  await git(root, ["tag", "v0.3.0"]);
  return root;
}

/** ファイルの中身の SHA-256（16 進数） */
function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** 手順なしの一覧の本文を 1 行で作る */
function noStepsYaml(schema: string, hash: string): string {
  return [
    "entries:",
    "  - version: next",
    `    schema: ${schema}`,
    `    sha256: ${hash}`,
    "    reason: 省いてよいキーを追加しただけで、古い設定もそのまま合う",
    "",
  ].join("\n");
}

/** 入口 `node scripts/build.ts` を子プロセスとして実行し、終了コードと標準エラーを返却する */
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

/** 作業ツリーの `plugin/.claude-plugin/plugin.json` の本文を返却する */
async function readPluginManifest(root: string): Promise<string> {
  return readFile(
    join(root, "plugin", ".claude-plugin", "plugin.json"),
    "utf8",
  );
}

/** ビルドした dist/index.js を読み込み、version() の戻り値を返却する */
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

// version.ini のバージョンを埋めてビルドする（正常系）
test("test_normal", { timeout: BUILD_TIMEOUT_MS }, async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  // `retired-diagrams.mjs` を持つ移行の手順のフォルダ
  await cp(
    migrationsDirOf("retired-diagrams.mjs"),
    join(root, "migrations", "next"),
    { recursive: true },
  );
  // 書き込み済みのライセンスは消し、ビルドが書き込むことを確かめる
  await rm(join(root, "migrations", "next", "THIRD_PARTY_LICENSES.txt"), {
    force: true,
  });
  const manifestBefore = await readPluginManifest(root);
  // 実行
  const { code } = await runBuild(root, []);
  // 検証
  expect(code).toBe(0);
  expect(existsSync(join(root, "dist", "index.js"))).toBe(true);
  expect(existsSync(join(root, "dist", "index.css"))).toBe(true);
  expect(await readBuiltVersion(root)).toBe("v0.0.0");
  const licenses = await readFile(
    join(root, "dist", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  for (const name of ["markdown-it", "sanitize-html"]) {
    expect(licenses).toContain(name);
  }
  // `dist/cli.js` にまとめた MCP の SDK と、その配布物に取り込まれた依存
  for (const name of ["@modelcontextprotocol/server", "ajv"]) {
    expect(licenses).toContain(name);
  }
  expect(licenses).toMatch(/permission is hereby granted|MIT|BSD/i);
  // 移行の手順のフォルダの `retired-diagrams.js` にまとめた依存（まとめずに読み込む esbuild・yaml を除く）
  expect(
    existsSync(join(root, "migrations", "next", "retired-diagrams.js")),
  ).toBe(true);
  const migrationLicenses = await readFile(
    join(root, "migrations", "next", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  for (const name of ["markdown-it", "sanitize-html"]) {
    expect(migrationLicenses).toContain(name);
  }
  for (const name of ["esbuild ", "yaml "]) {
    expect(migrationLicenses).not.toContain(`\n${name}`);
  }
  expect(migrationLicenses).toMatch(/permission is hereby granted/i);
  const declarations = await readFile(join(root, "dist", "index.d.ts"), "utf8");
  for (const name of [
    "version",
    "mount",
    "render",
    "registerExtension",
    "MdmarkExtension",
    "MdmarkExtensionModule",
    "MdmarkMarkArgs",
    "StandardSchemaV1",
  ]) {
    expect(declarations).toMatch(new RegExp(`export[^;]*\\b${name}\\b`));
  }
  // CLI と、書き出した HTML の起動の処理と画面の規則を記載する
  for (const name of ["cli.js", "viewer.js", "viewer.css"]) {
    expect(existsSync(join(root, "dist", name))).toBe(true);
  }
  // Claude Code のプラグインの生成物。MCP サーバーはまとめず、plugin.json は書き換えない
  for (const path of ["scripts/pre-tool-use.js", "scripts/session-start.js"]) {
    expect(existsSync(join(root, "plugin", path))).toBe(true);
  }
  for (const path of ["guide", "server", "dist"]) {
    expect(existsSync(join(root, "plugin", path))).toBe(false);
  }
  const manifest = await readPluginManifest(root);
  expect(JSON.parse(manifest)).not.toHaveProperty("version");
  expect(manifest).toBe(manifestBefore);
  const initTarget = await mkdtemp(join(tmpdir(), "mdmark-integration-init-"));
  createdRoots.push(initTarget);
  const init = await execFileAsync(
    process.execPath,
    [join(root, "dist", "cli.js"), "init", initTarget],
    { cwd: root },
  );
  expect(init.stdout).toContain("配置した: mdmark.config.yaml");
  expect(existsSync(join(initTarget, "mdmark.config.yaml"))).toBe(true);
  await writeFile(
    join(root, "consumer.ts"),
    'import { mount, registerExtension, render, version } from "./dist/index.js";\nexport { mount, registerExtension, render, version };\n',
  );
  await writeFile(
    join(root, "tsconfig.consumer.json"),
    JSON.stringify({
      compilerOptions: {
        target: "es2022",
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        lib: ["es2022", "dom"],
        types: [],
      },
      files: ["consumer.ts"],
    }),
  );
  await execFileAsync(
    join(root, "node_modules", ".bin", "tsc"),
    ["--project", "tsconfig.consumer.json"],
    { cwd: root },
  );
});

// --version で指定したバージョンを埋めてビルドする（正常系）
test("test_normal_when_version_given", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  const manifestBefore = await readPluginManifest(root);
  // 実行
  const { code } = await runBuild(root, ["--version", "v0.0.1"]);
  // 検証
  expect(code).toBe(0);
  expect(await readBuiltVersion(root)).toBe("v0.0.1");
  const manifest = await readPluginManifest(root);
  expect(JSON.parse(manifest)).not.toHaveProperty("version");
  expect(manifest).toBe(manifestBefore);
});

// 書式に合わないバージョンを指定すると、配布物を書き込まずに終わる（異常系）
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

// 上限を超えた配布ファイルがあると、記載した配布物を削除して終わる（異常系）
// コマンドに上限を差し替えるインターフェースが無いため、main に maxBytes: 1 を指定する
test("test_error_when_dist_file_too_large", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
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

/** 作業ツリーの `src/index.ts` の末尾（最上位）に、コードを追加する */
async function appendToEntry(root: string, code: string): Promise<void> {
  await appendFile(join(root, "src", "index.ts"), `\n${code}\n`);
}

// 下限に無い API を確認せずに使用すると、記載した配布物を削除して終わる（異常系）
test("test_error_when_api_missing_in_baseline_browser", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  await appendToEntry(root, 'new Intl.Segmenter("ja");');
  // 実行
  const { code, stderr } = await runBuild(root, []);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  for (const expected of ["Intl.Segmenter", "dist/index.js", "Firefox 98"]) {
    expect(stderr).toContain(expected);
  }
});

// スキーマを変えたのに手順も一覧の合う行も無ければ、配布物を書き込まずに終わる（異常系）
test("test_error_when_schema_changed_without_steps", async () => {
  // 準備
  const root = await createTaggedWorkTree("v0.3.0\n");
  const before = await readFile(
    join(root, "schemas", "mdmark.index.schema.json"),
    "utf8",
  );
  await writeFile(
    join(root, "schemas", "mdmark.index.schema.json"),
    '{ "type": "object", "required": ["documents"] }\n',
  );
  // SHA-256 が変える前の Schema のものの行は、合わない
  await writeFile(
    join(root, "migrations", "no-steps.yaml"),
    noStepsYaml("mdmark.index.schema.json", sha256(before)),
  );
  // 実行
  const { code, stderr } = await runBuild(root, []);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr).toContain("schemas/mdmark.index.schema.json");
  expect(stderr).toContain("migrations/next/steps.yaml");
  expect(stderr).toContain("migrations/no-steps.yaml");
});

// release のビルドで migrations/next/ が残っていれば、移し方を示して終わる（異常系）
test("test_error_when_next_steps_left_in_release", async () => {
  // 準備
  const root = await createTaggedWorkTree("v0.4.0\n");
  await mkdir(join(root, "migrations", "next"), { recursive: true });
  await writeFile(join(root, "migrations", "next", "steps.yaml"), stepsYaml());
  // 実行
  const { code, stderr } = await runBuild(root, []);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr).toContain("migrations/next/");
  expect(stderr).toContain("migrations/v0.4.0/");
  expect(stderr).toContain("no-steps.yaml");
});

// steps.yaml が Schema に合わなければ、配布物を書き込まずに終わる（異常系）
test("test_error_when_steps_invalid", async () => {
  // 準備
  const root = await createTaggedWorkTree("v0.3.0\n");
  await writeFile(
    join(root, "schemas", "mdmark.index.schema.json"),
    '{ "type": "object", "required": ["documents"] }\n',
  );
  await mkdir(join(root, "migrations", "next"), { recursive: true });
  await writeFile(
    join(root, "migrations", "next", "steps.yaml"),
    stepsYaml({ withoutTo: true }),
  );
  // 実行
  const { code, stderr } = await runBuild(root, []);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr).toContain("migrations/next/steps.yaml");
  expect(stderr).toContain("to");
});
