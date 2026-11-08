import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// リポジトリの移行の手順のフォルダ
const MIGRATIONS_ROOT = resolve(import.meta.dirname, "../migrations");

/**
 * 移行の手順のスクリプト `script` を持つフォルダ（`next/` か `v{バージョン}/`）を `root` の下から探して返却する。
 * 持つフォルダが 1 つでなければ例外を投げる
 */
export const migrationsDirOf = (
  script: string,
  root: string = MIGRATIONS_ROOT,
): string => {
  const found = readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(root, entry.name, script)),
    )
    .map((entry) => join(root, entry.name));
  const [dir] = found;
  if (found.length !== 1 || dir === undefined) {
    throw new Error(
      `${root} の下で ${script} を持つフォルダが 1 つではありません: ${found.length} 件`,
    );
  }
  return dir;
};
