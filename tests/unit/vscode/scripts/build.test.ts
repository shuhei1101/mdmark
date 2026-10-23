import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

/** 拡張機能のビルドを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBuild = () => import("../../../../vscode/scripts/build.ts");

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

// 拡張機能と Webview のスクリプトを束ね、vscode を束ねない（正常系）
test("test_build_extension", async () => {
  // 準備
  const { buildExtension } = await loadBuild();
  const temp = await mkdtemp(join(tmpdir(), "mdmark-vscode-build-"));
  roots.push(temp);
  const root = join(temp, "vscode");
  // 作業ツリーの `vscode/` を複製し、依存は作業ツリーのものを読む
  await cp(join(REPO_ROOT, "vscode"), root, {
    recursive: true,
    filter: (source) => !source.includes("node_modules"),
  });
  const dependencies = existsSync(join(REPO_ROOT, "vscode", "node_modules"))
    ? join(REPO_ROOT, "vscode", "node_modules")
    : join(REPO_ROOT, "node_modules");
  await symlink(dependencies, join(root, "node_modules"), "dir");
  // 実行
  await buildExtension({ root, tests: false });
  // 検証
  const extension = await readFile(join(root, "dist", "extension.cjs"), "utf8");
  expect(extension).toContain('require("vscode")');
  expect(existsSync(join(root, "media", "preview.js"))).toBe(true);
  expect(existsSync(join(root, "media", "preview.css"))).toBe(true);
  expect(existsSync(join(root, "out"))).toBe(false);
});
