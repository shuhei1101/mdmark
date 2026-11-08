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
import { copyPluginInputs, writeRootPackageJson } from "./plugin-inputs.ts";

// 埋めてビルドするバージョン
const BUILT_VERSION = "v0.0.1";
// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

/** `v0.0.1` を埋めてビルドした配布物を、一時フォルダの作業ツリーに作る。作業ツリーの場所と、削除する関数を返却する */
export async function createBuiltRoot(): Promise<{
  root: string;
  dispose: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-dist-"));
  await cp(resolve(import.meta.dirname, "../../src"), join(root, "src"), {
    recursive: true,
  });
  // 設定の Schema と取り込んだ alias-inject の Schema（CLI がまとめる）
  await cp(
    resolve(import.meta.dirname, "../../schemas"),
    join(root, "schemas"),
    {
      recursive: true,
    },
  );
  await writeFile(join(root, "version.ini"), `${BUILT_VERSION}\n`);
  // CLI が配布物と雛形を探す、パッケージの直下のマーカーと雛形の原本
  await writeRootPackageJson(root);
  // プラグインのビルドが読み込む入力
  await copyPluginInputs(root);
  await cp(
    resolve(import.meta.dirname, "../../templates"),
    join(root, "templates"),
    {
      recursive: true,
    },
  );
  // 型定義を記載する `tsc` が読み込む設定
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    await copyFile(
      resolve(import.meta.dirname, "../..", name),
      join(root, name),
    );
  }
  // まとめる依存（markdown-it など）を作業ツリーの node_modules から参照する
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
