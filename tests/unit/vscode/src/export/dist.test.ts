import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

/** 配布物を読み込む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDist = () => import("../../../../../vscode/src/export/dist.ts");
const loadBuild = () => import("../../../../../vscode/scripts/build.ts");

const REPO_ROOT = resolve(import.meta.dirname, "../../../../..");
const DIST_BASE = "https://cdn.example/mdmark";
const VERSION = "v9.9.9";
/** `vscode/` の複製から除外する、依存と生成物・取得物（`vscode/` からの相対パス） */
const EXCLUDED = ["node_modules", ".vscode-test", "out", "dist", "media"];
/** 拡張機能のビルドの待ち（`tests/unit/vscode/scripts/build.test.ts` の `BUILD_TIMEOUT_MS` と同じ） */
const BUILD_TIMEOUT_MS = 120_000;

/** `renderForMount` を公開する ES モジュール */
const SUPPORTED = [
  "export const render = (markdown) => markdown;",
  "export const toPureMarkdown = async (markdown) => ({ markdown, warnings: [] });",
  "export const renderForMount = async (markdown) => ({ rendered: { html: markdown }, pureMarkdown: markdown });",
].join("\n");

/** `render`・`toPureMarkdown` だけを公開する ES モジュール */
const UNSUPPORTED = [
  "export const render = (markdown) => markdown;",
  "export const toPureMarkdown = async (markdown) => ({ markdown, warnings: [] });",
].join("\n");

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** 一時フォルダの保存先 */
const storageOf = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "mdmark-vscode-dist-"));
  roots.push(dir);
  return dir;
};

// 取得して保存し、次は保存したものを読み込む（正常系）
test("test_load_dist_renderer", async () => {
  // 準備
  const { loadDistRenderer } = await loadDist();
  const storageDir = await storageOf();
  const fetchText = vi.fn(async (_url: string) => SUPPORTED);
  const options = {
    version: VERSION,
    storageDir,
    distBase: DIST_BASE,
    fetchText,
  };
  // 実行
  const first = await loadDistRenderer(options);
  const second = await loadDistRenderer(options);
  // 検証
  expect(first.kind).toBe("ok");
  expect(second.kind).toBe("ok");
  expect(fetchText).toHaveBeenCalledTimes(1);
  expect(fetchText).toHaveBeenCalledWith(
    `${DIST_BASE}@${VERSION}/dist/index.js`,
  );
  expect(existsSync(join(storageDir, "dist", VERSION, "index.js"))).toBe(true);
  if (first.kind !== "ok") throw new Error("ok でない");
  const result = await first.renderForMount("# a");
  expect(result.pureMarkdown).toBe("# a");
});

// 取得できない（異常系）
test("test_load_dist_renderer_when_unavailable", async () => {
  // 準備
  const { loadDistRenderer } = await loadDist();
  const storageDir = await storageOf();
  const fetchText = vi.fn(async (_url: string) => {
    throw new Error("接続できません");
  });
  // 実行
  const result = await loadDistRenderer({
    version: VERSION,
    storageDir,
    distBase: DIST_BASE,
    fetchText,
  });
  // 検証
  expect(result.kind).toBe("unavailable");
  if (result.kind !== "unavailable") throw new Error("unavailable でない");
  expect(result.reason).toContain("接続できません");
  expect(existsSync(join(storageDir, "dist", VERSION, "index.js"))).toBe(false);
});

// 描いた HTML から起動できないバージョン（異常系）
test("test_load_dist_renderer_when_unsupported", async () => {
  // 準備
  const { loadDistRenderer } = await loadDist();
  const storageDir = await storageOf();
  // 実行
  const result = await loadDistRenderer({
    version: VERSION,
    storageDir,
    distBase: DIST_BASE,
    fetchText: async () => UNSUPPORTED,
  });
  // 検証
  expect(result.kind).toBe("unsupported");
});

/** 作業ツリーの `vscode/` を、依存と生成物・取得物を除外して一時フォルダに複製する（`build.test.ts` の `copyExtension` と同じ） */
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
  for (const name of ["src", "schemas", "node_modules"]) {
    await symlink(join(REPO_ROOT, name), join(temp, name), "dir");
  }
  return root;
};

// ビルドした拡張機能が import() を保つ（正常系）
test(
  "test_extension_bundle_keeps_dynamic_import",
  async () => {
    // 準備
    const { buildExtension } = await loadBuild();
    const root = await copyExtension();
    // 実行
    await buildExtension({ root, tests: false });
    // 検証
    const bundle = await readFile(join(root, "dist", "extension.cjs"), "utf8");
    const start = bundle.search(
      /(?:async function|var|const|let) loadDistRenderer\b/,
    );
    expect(start).toBeGreaterThan(-1);
    const rest = bundle.slice(start + 1);
    const end = rest.search(/\n(?:async function|function|var|const|let) /);
    const body = rest.slice(0, end < 0 ? undefined : end);
    expect(body).toContain("import(");
    expect(body).not.toContain("require(");
    expect(await readdir(join(root, "dist"))).toContain("extension.cjs");
  },
  BUILD_TIMEOUT_MS,
);
