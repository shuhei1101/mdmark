import { access } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";
import { BASE_TAG, commitAll, git, initRepository } from "../../helpers/git.ts";

/** 比べる基準から変わったファイルの引き出しを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGit = () => import("../../../../src/cli/git.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const createTempDir = useTempDirs();

/**
 * `docs/a.md`・`docs/b.md`・`docs/c.md` と `.gitignore`（`*.log`）をコミットしてタグ `base` を付け、
 * `docs/a.md` を書き換えてコミットし、`docs/b.md` をコミットせずに書き換え、
 * `docs/d.md` と `docs/x.log` を新しく置いた git のフォルダを作る
 */
async function createChangedRepository(): Promise<string> {
  const dir = await createTempDir();
  await writeFiles(dir, {
    ".gitignore": "*.log\n",
    "docs/a.md": "# A\n",
    "docs/b.md": "# B\n",
    "docs/c.md": "# C\n",
  });
  await initRepository(dir);
  await commitAll(dir, "最初のコミット");
  await git(dir, "tag", BASE_TAG);
  await writeFiles(dir, { "docs/a.md": "# A\n\n書き換えた。\n" });
  await commitAll(dir, "a を書き換える");
  await writeFiles(dir, {
    "docs/b.md": "# B\n\nコミットしていない。\n",
    "docs/d.md": "# D\n",
    "docs/x.log": "ログ\n",
  });
  return dir;
}

// merge-base からのコミット済み・未コミットの変更と新しいファイルを、索引のフォルダからのパスで返す（正常系）
test("test_changed_paths_since", async () => {
  // 準備
  const { changedPathsSince } = await loadGit();
  const dir = await createChangedRepository();
  // 実行
  const paths = await changedPathsSince({
    cwd: dir,
    base: BASE_TAG,
    indexDir: join(dir, "docs"),
  });
  // 検証
  expect([...paths].sort()).toEqual(["a.md", "b.md", "d.md"]);
});

// merge-base を引けない ref は、ref と履歴の取得を案内して CliError にする（異常系）
test("test_changed_paths_since_when_ref_unknown", async () => {
  // 準備
  const { changedPathsSince } = await loadGit();
  const { CliError } = await loadErrors();
  const dir = await createChangedRepository();
  // 実行
  const error = await changedPathsSince({
    cwd: dir,
    base: "no-such-ref",
    indexDir: join(dir, "docs"),
  }).catch((caught: unknown) => caught);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("no-such-ref");
  expect((error as Error).message).toContain("fetch-depth");
});

// git のリポジトリの中に無いフォルダは CliError にする（異常系）
test("test_changed_paths_since_when_not_repository", async () => {
  // 準備
  const { changedPathsSince } = await loadGit();
  const { CliError } = await loadErrors();
  const dir = await createTempDir();
  // 実行
  const error = await changedPathsSince({
    cwd: dir,
    base: "main",
    indexDir: dir,
  }).catch((caught: unknown) => caught);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("main");
});

// `-` で始まる ref を git の引数に渡さない（異常系）
test("test_changed_paths_since_when_ref_starts_with_dash", async () => {
  // 準備
  const { changedPathsSince } = await loadGit();
  const { CliError } = await loadErrors();
  const dir = await createChangedRepository();
  // 実行
  const error = await changedPathsSince({
    cwd: dir,
    base: "--output=x",
    indexDir: join(dir, "docs"),
  }).catch((caught: unknown) => caught);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  await expect(access(join(dir, "x"))).rejects.toThrow();
});
