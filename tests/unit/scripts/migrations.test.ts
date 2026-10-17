import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** 移行の手順の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../scripts/migrations.ts");

const execFileAsync = promisify(execFile);

const createTempDir = useTempDirs();

/** 変える前の設定の Schema */
const CONFIG_SCHEMA = '{ "type": "object" }\n';
/** 変える前の索引の Schema */
const INDEX_SCHEMA = '{ "type": "object", "required": ["docs"] }\n';
/** 変えた後の設定の Schema（省いてよいキーを足した） */
const CONFIG_SCHEMA_CHANGED =
  '{ "type": "object", "properties": { "title": { "type": "string" } } }\n';
/** 変えた後の索引の Schema（必須のキーの名前を変えた） */
const INDEX_SCHEMA_CHANGED =
  '{ "type": "object", "required": ["documents"] }\n';

/** 手順を 1 つ持つ `steps.yaml` */
const STEPS = [
  "steps:",
  "  - op: rename_key",
  "    description: legacy を renamed に改める",
  "    file: config",
  "    from: legacy",
  "    to: renamed",
  "",
].join("\n");

/** 一時フォルダで git を流す */
async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
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
  return stdout;
}

/** 文字列の SHA-256（16 進数） */
function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Schema を commit した git のリポジトリを作る（`tag` があれば最初の commit に打つ） */
async function createRepo(options?: { tag?: string }): Promise<string> {
  const root = await createTempDir();
  await writeFiles(root, {
    "schemas/mdmark.config.schema.json": CONFIG_SCHEMA,
    "schemas/mdmark.index.schema.json": INDEX_SCHEMA,
    "migrations/no-steps.yaml": "entries: []\n",
  });
  await git(root, ["init", "--quiet"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "--quiet", "-m", "初期"]);
  if (options?.tag !== undefined) {
    await git(root, ["tag", options.tag]);
  }
  return root;
}

/** 手順なしの一覧の本文を作る */
function noStepsYaml(
  rows: Array<{ version: string; schema: string; sha256: string }>,
): string {
  return [
    "entries:",
    ...rows.flatMap((row) => [
      `  - version: ${row.version}`,
      `    schema: ${row.schema}`,
      `    sha256: ${row.sha256}`,
      "    reason: 省いてよいキーを足しただけで、古い設定もそのまま合う",
    ]),
    "",
  ].join("\n");
}

// 数として最も新しいタグを返す（正常系）
test("test_latest_version_tag", async () => {
  // 準備
  const { latestVersionTag } = await loadModule();
  const root = await createRepo({ tag: "v0.9.0" });
  await git(root, ["tag", "v0.10.0"]);
  await git(root, ["tag", "foo"]);
  // 実行
  const tag = await latestVersionTag(root);
  // 検証
  expect(tag).toBe("v0.10.0");
});

// タグが無ければ undefined（正常系）
test("test_latest_version_tag_when_none", async () => {
  // 準備
  const { latestVersionTag } = await loadModule();
  const repoWithoutTag = await createRepo();
  const notRepo = await createTempDir();
  // 実行
  const withoutTag = await latestVersionTag(repoWithoutTag);
  const outsideRepo = await latestVersionTag(notRepo);
  // 検証
  expect(withoutTag).toBeUndefined();
  expect(outsideRepo).toBeUndefined();
});

// スキーマを変えて next に手順があれば誤り 0 件（正常系）
test("test_check_migrations", async () => {
  // 準備
  const { checkMigrations } = await loadModule();
  const root = await createRepo({ tag: "v0.3.0" });
  await writeFiles(root, {
    "schemas/mdmark.index.schema.json": INDEX_SCHEMA_CHANGED,
    "migrations/next/steps.yaml": STEPS,
  });
  // 実行
  const problems = await checkMigrations({ root, version: "v0.3.0" });
  // 検証
  expect(problems).toEqual([]);
});

// SHA-256 の合う手順なしの行があれば誤り 0 件（正常系）
test("test_check_migrations_when_listed", async () => {
  // 準備
  const { checkMigrations } = await loadModule();
  const root = await createRepo({ tag: "v0.3.0" });
  await writeFiles(root, {
    "schemas/mdmark.config.schema.json": CONFIG_SCHEMA_CHANGED,
    "migrations/no-steps.yaml": noStepsYaml([
      {
        version: "next",
        schema: "mdmark.config.schema.json",
        sha256: sha256(CONFIG_SCHEMA_CHANGED),
      },
    ]),
  });
  // 実行
  const problems = await checkMigrations({ root, version: "v0.3.0" });
  // 検証
  expect(problems).toEqual([]);
});

// スキーマを変えて手順も合う行も無ければ誤り（異常系）
test("test_check_migrations_when_steps_missing", async () => {
  // 準備
  const { checkMigrations } = await loadModule();
  const root = await createRepo({ tag: "v0.3.0" });
  await writeFiles(root, {
    "schemas/mdmark.index.schema.json": INDEX_SCHEMA_CHANGED,
    "migrations/no-steps.yaml": noStepsYaml([
      {
        version: "next",
        schema: "mdmark.index.schema.json",
        sha256: sha256(INDEX_SCHEMA),
      },
    ]),
  });
  // 実行
  const problems = await checkMigrations({ root, version: "v0.3.0" });
  // 検証
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("schemas/mdmark.index.schema.json");
  expect(problems[0]).toContain("migrations/next/steps.yaml");
});

// release のビルドで next が残れば誤り（異常系）
test("test_check_migrations_when_next_left", async () => {
  // 準備
  const { checkMigrations } = await loadModule();
  const root = await createRepo({ tag: "v0.3.0" });
  await writeFiles(root, { "migrations/next/steps.yaml": STEPS });
  // 実行
  const problems = await checkMigrations({ root, version: "v0.4.0" });
  // 検証
  expect(
    problems.some((problem) => problem.includes("migrations/v0.4.0/")),
  ).toBe(true);
});

// タグが無ければスキーマを比べない（正常系）
test("test_check_migrations_when_no_tag", async () => {
  // 準備
  const { checkMigrations } = await loadModule();
  const root = await createRepo();
  await writeFiles(root, {
    "schemas/mdmark.index.schema.json": INDEX_SCHEMA_CHANGED,
  });
  // 実行
  const problems = await checkMigrations({ root, version: "v0.3.0" });
  // 検証
  expect(problems).toEqual([]);
});
