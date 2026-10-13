import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { TestProject } from "vitest/node";
import { main } from "../../scripts/build.ts";

declare module "vitest" {
  interface ProvidedContext {
    /** `v0.0.1` を埋めてビルドした `dist/` を置いた作業ツリーの場所 */
    builtRoot: string;
  }
}

// 埋めてビルドする版
const BUILT_VERSION = "v0.0.1";
// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

/** ブラウザの結合テストが読む配布物を、一時フォルダの作業ツリーにビルドする */
export default async function setup(project: TestProject) {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-dist-"));
  await cp(resolve(import.meta.dirname, "../../src"), join(root, "src"), {
    recursive: true,
  });
  await writeFile(join(root, "version.ini"), `${BUILT_VERSION}\n`);
  const code = await main([], { root, maxBytes: MAX_BYTES });
  if (code !== 0) {
    throw new Error("結合テスト用の配布物をビルドできなかった");
  }
  project.provide("builtRoot", root);
  return async () => {
    await rm(root, { recursive: true, force: true });
  };
}
