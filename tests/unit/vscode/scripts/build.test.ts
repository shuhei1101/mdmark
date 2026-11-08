import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { afterEach, expect, test } from "vitest";

/** 拡張機能のビルドを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBuild = () => import("../../../../vscode/scripts/build.ts");

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const roots: string[] = [];
/** `vscode/` の複製から除外する、依存と生成物・取得物（`vscode/` からの相対パス） */
const EXCLUDED = ["node_modules", ".vscode-test", "out", "dist", "media"];
/** Vite と React Compiler のビルドを含むテストの待ち（単独で 17〜30 秒かかり、他のテストと並べると延びるため、測った最大の 4 倍にする） */
const BUILD_TIMEOUT_MS = 120_000;

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** 作業ツリーの `vscode/` を、依存と生成物・取得物を除外して一時フォルダに複製し、依存とライブラリ本体は作業ツリーのものを読み込む */
const copyExtension = async (): Promise<string> => {
  const temp = await mkdtemp(join(tmpdir(), "mdmark-vscode-build-"));
  roots.push(temp);
  const root = join(temp, "vscode");
  const source = join(REPO_ROOT, "vscode");
  await cp(source, root, {
    recursive: true,
    filter: (path) => {
      const entry = relative(source, path).split(sep).join("/");
      return !EXCLUDED.some(
        (excluded) => entry === excluded || entry.startsWith(`${excluded}/`),
      );
    },
  });
  const dependencies = existsSync(join(REPO_ROOT, "vscode", "node_modules"))
    ? join(REPO_ROOT, "vscode", "node_modules")
    : join(REPO_ROOT, "node_modules");
  await symlink(dependencies, join(root, "node_modules"), "dir");
  // 拡張機能はライブラリ本体の設定を重ねて読み込む処理（`src/`）をまとめるため、`src/`・`schemas/` と、その依存を読み込めるようにする
  for (const name of ["src", "schemas", "node_modules"]) {
    await symlink(join(REPO_ROOT, name), join(temp, name), "dir");
  }
  return root;
};

// 拡張機能と Webview を書き出し、vscode と axe をまとめない（正常系）
test(
  "test_build_extension",
  async () => {
    // 準備
    const { buildExtension } = await loadBuild();
    const root = await copyExtension();
    // 実行
    await buildExtension({ root, tests: false });
    // 検証
    const extension = await readFile(
      join(root, "dist", "extension.cjs"),
      "utf8",
    );
    expect(extension).toContain('require("vscode")');
    expect(extension).toMatch(/var self\d* = globalThis;/);
    expect(existsSync(join(root, "dist", "esbuild.wasm"))).toBe(true);
    const scripts = (await readdir(join(root, "media"))).filter((name) =>
      name.endsWith(".js"),
    );
    expect(scripts).toEqual(["preview.js"]);
    const preview = await readFile(join(root, "media", "preview.js"), "utf8");
    expect(preview).not.toContain("axe-core");
    expect(existsSync(join(root, "media", "preview.css"))).toBe(true);
    expect(existsSync(join(root, "out"))).toBe(false);
    expect(existsSync(join(root, "media", "test"))).toBe(false);
  },
  BUILD_TIMEOUT_MS,
);

// 結合テストのビルドでは axe を media/test に複写する（正常系）
test(
  "test_build_extension_when_tests",
  async () => {
    // 準備
    const { buildExtension } = await loadBuild();
    const root = await copyExtension();
    // 実行
    await buildExtension({ root, tests: true });
    // 検証
    expect(existsSync(join(root, "out", "test", "index.mjs"))).toBe(true);
    expect(existsSync(join(root, "media", "test", "axe.js"))).toBe(true);
    const preview = await readFile(join(root, "media", "preview.js"), "utf8");
    expect(preview).not.toContain("axe-core");
  },
  BUILD_TIMEOUT_MS,
);
