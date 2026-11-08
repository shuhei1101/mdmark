import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareVersions, VERSION_PATTERN } from "../src/cli/versions.ts";

// リポジトリの移行の手順のフォルダ
const MIGRATIONS_ROOT = resolve(import.meta.dirname, "../migrations");

/**
 * リポジトリの移行の手順のうち、次のリリースで適用するフォルダを返却する。
 * `root` の下に `next/` が有ればそれを、無ければ `v{バージョン}/` のうちバージョンが最も新しいフォルダを返却する
 */
export const latestMigrationsDir = (root: string = MIGRATIONS_ROOT): string => {
  const next = join(root, "next");
  if (existsSync(next)) {
    return next;
  }
  const versions = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && VERSION_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareVersions);
  const latest = versions.at(-1);
  if (latest === undefined) {
    throw new Error(
      `移行の手順のフォルダがありません: ${root} に next/ も v{バージョン}/ もありません`,
    );
  }
  return join(root, latest);
};
