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
import { afterEach, expect, test, vi } from "vitest";
import { main } from "../../../scripts/build.ts";
import { copyPluginInputs, writeRootPackageJson } from "../plugin-inputs.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

// ビルド（型定義を書く `tsc` を含む）を子プロセスで流すテストの待つ上限（ミリ秒）
const BUILD_TIMEOUT_MS = 120_000;

const createdRoots: string[] = [];

/** 一時フォルダに作業ツリー（scripts・src・version.ini・依存）を作り、そのパスを返す */
async function createWorkTree(versionIni: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-build-"));
  createdRoots.push(root);
  await cp(join(REPO_ROOT, "scripts"), join(root, "scripts"), {
    recursive: true,
  });
  await cp(join(REPO_ROOT, "src"), join(root, "src"), { recursive: true });
  // CLI の `init` が写す雛形の正本
  await cp(join(REPO_ROOT, "templates"), join(root, "templates"), {
    recursive: true,
  });
  await writeRootPackageJson(root);
  await copyPluginInputs(root);
  await writeFile(join(root, "version.ini"), versionIni);
  // 型定義を書く `tsc` が読む設定
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    await copyFile(join(REPO_ROOT, name), join(root, name));
  }
  await symlink(
    join(REPO_ROOT, "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  return root;
}

/** 一時フォルダの git で、署名なしに git を流す */
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

/** 手順を 1 つ持つ `steps.yaml` の本文（`to` を省いて形の誤りにもできる） */
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
  await cp(join(REPO_ROOT, "schemas"), join(root, "schemas"), {
    recursive: true,
  });
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
    "    reason: 省いてよいキーを足しただけで、古い設定もそのまま合う",
    "",
  ].join("\n");
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
test("test_normal", { timeout: BUILD_TIMEOUT_MS }, async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
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
  // `dist/cli.js` に束ねた MCP の SDK と、その配布物に取り込まれた依存
  for (const name of ["@modelcontextprotocol/server", "ajv"]) {
    expect(licenses).toContain(name);
  }
  expect(licenses).toMatch(/permission is hereby granted|MIT|BSD/i);
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
  // CLI と、書き出した HTML の起動の処理と画面の規則を書く
  for (const name of ["cli.js", "viewer.js", "viewer.css"]) {
    expect(existsSync(join(root, "dist", name))).toBe(true);
  }
  // Claude Code のプラグインの生成物と、バージョン。MCP サーバーは束ねない
  for (const path of [
    "scripts/session-start.js",
    "scripts/pre-tool-use.js",
    "guide/index.json",
  ]) {
    expect(existsSync(join(root, "plugin", path))).toBe(true);
  }
  for (const path of ["server", "dist"]) {
    expect(existsSync(join(root, "plugin", path))).toBe(false);
  }
  const manifest = JSON.parse(
    await readFile(
      join(root, "plugin", ".claude-plugin", "plugin.json"),
      "utf8",
    ),
  );
  expect(manifest.version).toBe("v0.0.0");
  const initTarget = await mkdtemp(join(tmpdir(), "mdmark-integration-init-"));
  createdRoots.push(initTarget);
  const init = await execFileAsync(
    process.execPath,
    [join(root, "dist", "cli.js"), "init", initTarget],
    { cwd: root },
  );
  expect(init.stdout).toContain("置いた: mdmark.config.yaml");
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

// --version で渡した版を埋めてビルドする（正常系）
test("test_normal_when_version_given", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  // 実行
  const { code } = await runBuild(root, ["--version", "v0.0.1"]);
  // 検証
  expect(code).toBe(0);
  expect(await readBuiltVersion(root)).toBe("v0.0.1");
  const manifest = JSON.parse(
    await readFile(
      join(root, "plugin", ".claude-plugin", "plugin.json"),
      "utf8",
    ),
  );
  expect(manifest.version).toBe("v0.0.1");
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

// セッションに渡す索引の文が上限を超えると、配布物を残さずに終わる（異常系）
// コマンドに上限を差し替える口が無いため、main に guideContextLimit: 1 を渡す
test("test_error_when_guide_index_too_long", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.join(" "));
  });
  // 実行
  const code = await main([], {
    root,
    maxBytes: 20 * 1024 * 1024,
    guideContextLimit: 1,
  });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(existsSync(join(root, "plugin", "scripts"))).toBe(false);
  expect(existsSync(join(root, "plugin", "guide"))).toBe(false);
  expect(errors.join("\n")).toMatch(/使い方集の索引が \d+ 文字で、上限 1 文字/);
});

/** 作業ツリーの `src/index.ts` の末尾（最上位）に、コードを足す */
async function appendToEntry(root: string, code: string): Promise<void> {
  await appendFile(join(root, "src", "index.ts"), `\n${code}\n`);
}

// 有無を確かめてから下限に無い API を使うと、止めずにビルドする（正常系）
test("test_normal_when_api_checked_before_use", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const root = await createWorkTree("v0.0.0\n");
  await appendToEntry(
    root,
    'if (typeof Intl.Segmenter !== "undefined") { new Intl.Segmenter("ja"); }',
  );
  // 実行
  const { code, stderr } = await runBuild(root, []);
  // 検証
  expect(code).toBe(0);
  expect(existsSync(join(root, "dist", "index.js"))).toBe(true);
  expect(stderr).not.toContain("Intl.Segmenter");
});

// 下限に無い API を確かめずに使うと、書いた配布物を消して終わる（異常系）
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

// スキーマを変えても migrations/next/steps.yaml があれば通す（正常系）
test("test_normal_when_schema_changed_with_steps", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const root = await createTaggedWorkTree("v0.3.0\n");
  await writeFile(
    join(root, "schemas", "mdmark.index.schema.json"),
    '{ "type": "object", "required": ["documents"] }\n',
  );
  await mkdir(join(root, "migrations", "next"), { recursive: true });
  await writeFile(join(root, "migrations", "next", "steps.yaml"), stepsYaml());
  // 実行
  const { code } = await runBuild(root, []);
  // 検証
  expect(code).toBe(0);
  expect(existsSync(join(root, "dist", "index.js"))).toBe(true);
});

// 手順なしの一覧に今の Schema の SHA-256 の行があれば通す（正常系）
test("test_normal_when_schema_change_listed", {
  timeout: BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const root = await createTaggedWorkTree("v0.3.0\n");
  const changed =
    '{ "type": "object", "properties": { "title": { "type": "string" } } }\n';
  await writeFile(join(root, "schemas", "mdmark.config.schema.json"), changed);
  await writeFile(
    join(root, "migrations", "no-steps.yaml"),
    noStepsYaml("mdmark.config.schema.json", sha256(changed)),
  );
  // 実行
  const { code } = await runBuild(root, []);
  // 検証
  expect(code).toBe(0);
  expect(existsSync(join(root, "dist", "index.js"))).toBe(true);
});

// スキーマを変えたのに手順も一覧の合う行も無ければ、配布物を書かずに終わる（異常系）
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

// steps.yaml が Schema に合わなければ、配布物を書かずに終わる（異常系）
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
