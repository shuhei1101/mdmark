import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFiles } from "./cli.ts";

const execFileAsync = promisify(execFile);

/** 最初のコミットに付けるタグの名前 */
export const BASE_TAG = "base";

/** フォルダで git を 1 回呼び、標準出力を返す */
export async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

/** フォルダを git のリポジトリにする（コミットに要る名前・メールを、このリポジトリだけに置く） */
export async function initRepository(dir: string): Promise<void> {
  await git(dir, "init", "-q");
  await git(dir, "config", "user.email", "test@example.com");
  await git(dir, "config", "user.name", "test");
  await git(dir, "config", "commit.gpgsign", "false");
}

/** 全ての変更をコミットする */
export async function commitAll(dir: string, message: string): Promise<void> {
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", message);
}

/** 文書 `a`・`b` が互いを `change_together` で記載した索引の中身 */
export const CHANGE_TOGETHER_INDEX_YAML = [
  "schema: 1",
  "docs:",
  "  - id: a",
  "    path: a.md",
  "    title: A",
  "    related:",
  "      - to: b",
  "        type: change_together",
  "        when: 索引の Schema を変えるとき",
  "  - id: b",
  "    path: b.md",
  "    title: B",
  "    related:",
  "      - to: a",
  "        type: change_together",
  "        when: 索引の Schema を変えるとき",
  "",
].join("\n");

/**
 * 互いを `change_together` で記載した文書 `a`・`b` を持つ git のフォルダを作る。
 * 全てをコミットしてタグ `base` を付け、その後 `a.md` だけを書き換えてコミットする
 */
export async function setUpChangeTogetherRepository(
  dir: string,
): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": CHANGE_TOGETHER_INDEX_YAML,
    "a.md": "# A\n",
    "b.md": "# B\n",
  });
  await initRepository(dir);
  await commitAll(dir, "最初のコミット");
  await git(dir, "tag", BASE_TAG);
  await writeFiles(dir, { "a.md": "# A\n\n書き換えた。\n" });
  await commitAll(dir, "a を書き換える");
}
