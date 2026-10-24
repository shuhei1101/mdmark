import type { TestProject } from "vitest/node";
import { createBuiltRoot } from "./built-root.ts";

declare module "vitest" {
  interface ProvidedContext {
    /** `v0.0.1` を埋めてビルドした `dist/` を置いた作業ツリーの場所 */
    builtRoot: string;
  }
}

/** ブラウザの結合テストが読む配布物を、一時フォルダの作業ツリーにビルドする */
export default async function setup(project: TestProject) {
  const { root, dispose } = await createBuiltRoot();
  project.provide("builtRoot", root);
  return dispose;
}
