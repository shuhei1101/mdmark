import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
// シナリオのセットアップの `version.ini` の先頭行（リリースで作業ツリーの値が進んでも変わらない）
const CLONE_VERSION = "v0.0.0";
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

/** クローンした直後の作業ツリー（node_modules/ と dist/ が無く、`version.ini` が `v0.0.0` の写し）を一時フォルダに作る */
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
  await writeFile(join(clone, "version.ini"), `${CLONE_VERSION}\n`);
  return clone;
}

/** ビルドした `plugin/.claude-plugin/plugin.json` の `version` を返す */
async function readPluginVersion(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(
      join(root, "plugin", ".claude-plugin", "plugin.json"),
      "utf8",
    ),
  );
  return manifest.version;
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
  expect(await readBuiltVersion()).toBe(CLONE_VERSION);
  // Claude Code のプラグインの生成物と、バージョン
  for (const path of [
    "scripts/session-start.js",
    "scripts/pre-tool-use.js",
    "guide/index.json",
  ]) {
    expect(existsSync(join(root, "plugin", path)), path).toBe(true);
  }
  for (const path of ["server", "dist"]) {
    expect(existsSync(join(root, "plugin", path)), path).toBe(false);
  }
  expect(await readPluginVersion()).toBe(CLONE_VERSION);
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
  expect(await readPluginVersion()).toBe("v0.0.1");
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

// セッションに渡す索引の文が上限を超えると、配布物を残さずに終わる（異常シナリオ）
// コマンドに上限を差し替える口が無いため、main に guideContextLimit: 1 を渡す
test("test_error_when_guide_index_too_long", async () => {
  // 準備
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.join(" "));
  };
  // 実行
  let code: number;
  try {
    code = await main([], {
      root,
      maxBytes: 20 * 1024 * 1024,
      guideContextLimit: 1,
    });
  } finally {
    console.error = original;
  }
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(existsSync(join(root, "plugin", "scripts"))).toBe(false);
  expect(existsSync(join(root, "plugin", "guide"))).toBe(false);
  expect(errors.join("\n")).toMatch(/使い方集の索引が \d+ 文字で、上限 1 文字/);
});

// 対応ブラウザの下限に無い API を確かめずに使うと、書いた配布物を消して終わる（異常シナリオ）
// 後のテストが同じ作業ツリーを使うため、足した行は終わりに元へ戻す
test("test_error_when_api_missing_in_baseline_browser", async () => {
  // 準備
  const entry = join(root, "src", "index.ts");
  const original = await readFile(entry, "utf8");
  await writeFile(entry, `${original}\nnew Intl.Segmenter("ja");\n`);
  // 実行
  let result: { code: number; stderr: string };
  try {
    result = await run("npm", ["run", "build"]);
  } finally {
    await writeFile(entry, original);
  }
  // 検証
  expect(result.code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  for (const expected of ["Intl.Segmenter", "dist/index.js", "Firefox 98"]) {
    expect(result.stderr).toContain(expected);
  }
});

// 最新の版のタグ（シナリオのセットアップの `version.ini` もこの版）
const TAG = "v0.3.0";

/** 作業ツリーの中で git を流す（署名なし） */
async function git(args: string[]): Promise<void> {
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

/** 作業ツリーを git のリポジトリにして、Schema・移行の手順・`version.ini` を commit して版のタグを打つ。打ってあれば、それらをタグの状態に戻す */
async function resetTaggedWorkTree(): Promise<void> {
  if (!existsSync(join(root, ".git"))) {
    await writeFile(join(root, "version.ini"), `${TAG}\n`);
    await git(["init", "--quiet"]);
    await git(["add", "schemas", "migrations", "version.ini"]);
    await git(["commit", "--quiet", "-m", "初期"]);
    await git(["tag", TAG]);
    return;
  }
  await git([
    "checkout",
    "--quiet",
    "--",
    "schemas",
    "migrations",
    "version.ini",
  ]);
  await git(["clean", "--quiet", "-fd", "migrations"]);
}

/** Schema の JSON を読み、`change` で変えて書き戻し、書いた中身を返す */
async function changeSchema(
  name: string,
  change: (schema: Record<string, unknown>) => void,
): Promise<string> {
  const path = join(root, "schemas", name);
  const schema = JSON.parse(await readFile(path, "utf8"));
  change(schema);
  const text = `${JSON.stringify(schema, null, 2)}\n`;
  await writeFile(path, text);
  return text;
}

// 設定の Schema に省いてよいキーを足し、手順なしの一覧に今の Schema の SHA-256 の行があれば通す（正常シナリオ（広げるだけのスキーマの変更を一覧に載せる））
test("test_normal_when_schema_change_listed", async () => {
  // 準備
  await resetTaggedWorkTree();
  const changed = await changeSchema("mdmark.config.schema.json", (schema) => {
    (schema.properties as Record<string, unknown>).title = { type: "string" };
  });
  await writeFile(
    join(root, "migrations", "no-steps.yaml"),
    [
      "entries:",
      "  - version: next",
      "    schema: mdmark.config.schema.json",
      `    sha256: ${createHash("sha256").update(changed).digest("hex")}`,
      "    reason: 省いてよいキーを足しただけで、古い設定もそのまま合う",
      "",
    ].join("\n"),
  );
  // 実行
  const { code } = await run("npm", ["run", "build"]);
  // 検証
  expect(code).toBe(0);
  expect(existsSync(join(root, "dist", "index.js"))).toBe(true);
  expect(existsSync(join(root, "dist", "index.css"))).toBe(true);
});

// 索引の Schema を変えたのに移行の手順も一覧の行も無いと、配布物を書かずに終わる（異常シナリオ（スキーマを変えたのに移行の手順が無い））
test("test_error_when_schema_changed_without_steps", async () => {
  // 準備
  await resetTaggedWorkTree();
  await changeSchema("mdmark.index.schema.json", (schema) => {
    schema.required = ["documents"];
  });
  await writeFile(join(root, "migrations", "no-steps.yaml"), "entries: []\n");
  // 実行
  const { code, stderr } = await run("npm", ["run", "build"]);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr).toContain("schemas/mdmark.index.schema.json");
  expect(stderr).toContain("migrations/next/steps.yaml");
  expect(stderr).toContain("no-steps.yaml");
});

// version.ini を最新の版のタグより新しく上げたのに migrations/next/ が残っていると、移し方を示して終わる（異常シナリオ（release のビルドで出していない版の手順が残る））
test("test_error_when_next_steps_left_in_release", async () => {
  // 準備
  await resetTaggedWorkTree();
  await writeFile(join(root, "version.ini"), "v0.4.0\n");
  await mkdir(join(root, "migrations", "next"), { recursive: true });
  await writeFile(
    join(root, "migrations", "next", "steps.yaml"),
    [
      "steps:",
      "  - op: rename_key",
      "    description: legacy を renamed に改める",
      "    file: config",
      "    from: legacy",
      "    to: renamed",
      "",
    ].join("\n"),
  );
  // 実行
  const { code, stderr } = await run("npm", ["run", "build"]);
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr).toContain("migrations/next/");
  expect(stderr).toContain("migrations/v0.4.0/");
  expect(stderr).toContain("no-steps.yaml");
});
