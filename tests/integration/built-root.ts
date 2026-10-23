import {
  copyFile,
  cp,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { main } from "../../scripts/build.ts";

// 埋めてビルドする版
const BUILT_VERSION = "v0.0.1";
// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

/** `v0.0.1` を埋めてビルドした配布物を、一時フォルダの作業ツリーに作る。作業ツリーの場所と、消す関数を返す */
export async function createBuiltRoot(): Promise<{
  root: string;
  dispose: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-dist-"));
  await cp(resolve(import.meta.dirname, "../../src"), join(root, "src"), {
    recursive: true,
  });
  await writeFile(join(root, "version.ini"), `${BUILT_VERSION}\n`);
  // CLI が配布物と雛形を探す、パッケージの直下の印と雛形の正本
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await cp(
    resolve(import.meta.dirname, "../../templates"),
    join(root, "templates"),
    {
      recursive: true,
    },
  );
  // 型定義を書く `tsc` が読む設定
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    await copyFile(
      resolve(import.meta.dirname, "../..", name),
      join(root, name),
    );
  }
  // 束ねる依存（markdown-it など）を作業ツリーの node_modules から引く
  await symlink(
    resolve(import.meta.dirname, "../../node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  const code = await main([], { root, maxBytes: MAX_BYTES });
  if (code !== 0) {
    throw new Error("結合テスト用の配布物をビルドできなかった");
  }
  return {
    root,
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}
