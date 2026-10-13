import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

/** ビルドのスクリプトを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBuild = () => import("../../../scripts/build.ts");

// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

const entryScript = [
  "declare const __MDMARK_VERSION__: string;",
  "",
  "export function version(): string {",
  "  return __MDMARK_VERSION__;",
  "}",
  "",
].join("\n");

const createdRoots: string[] = [];

/** 一時フォルダに src/ と version.ini を置き、そのパスを返す */
async function createRoot(versionIni: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-build-"));
  createdRoots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "index.ts"), entryScript);
  await writeFile(join(root, "src", "index.css"), "/* entry */\n");
  await writeFile(join(root, "version.ini"), versionIni);
  return root;
}

/** 前回のビルドの dist/index.js を置く */
async function createPreviousDist(root: string): Promise<void> {
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist", "index.js"), "// 前回のビルド\n");
}

/** 標準エラーへの出力を集め、集めた文字列を返す関数を返す */
function captureStderr(): () => string {
  const chunks: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    chunks.push(args.join(" "));
  });
  return () => chunks.join("\n");
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    createdRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

// version.ini の版でビルドする（正常系）
test("test_main", async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  // 実行
  const code = await main([], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(0);
  expect(await readFile(join(root, "dist", "index.js"), "utf8")).toContain(
    "v0.0.0",
  );
});

// 渡した版でビルドする（正常系）
test("test_main_when_version_given", async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  // 実行
  const code = await main(["--version", "v0.0.1"], {
    root,
    maxBytes: MAX_BYTES,
  });
  // 検証
  expect(code).toBe(0);
  expect(await readFile(join(root, "dist", "index.js"), "utf8")).toContain(
    "v0.0.1",
  );
});

// 版の書式が違うと前回の dist/ を残さずに終わる（異常系）
test("test_main_when_version_format_invalid", async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await createPreviousDist(root);
  const stderr = captureStderr();
  // 実行
  const code = await main(["--version", "1.2"], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr()).toContain("v{MAJOR}.{MINOR}.{PATCH}");
});

// version.ini を読めないと前回の dist/ を残さずに終わる（異常系）
test("test_main_when_version_ini_missing", async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await rm(join(root, "version.ini"));
  await createPreviousDist(root);
  const stderr = captureStderr();
  // 実行
  const code = await main([], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr()).toContain("version.ini");
});

// esbuild が失敗すると前回の dist/ を残さずに終わる（異常系）
test("test_main_when_build_fails", async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await writeFile(join(root, "src", "index.ts"), "export const = ;\n");
  await createPreviousDist(root);
  const stderr = captureStderr();
  // 実行
  const code = await main([], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr()).toContain("src/index.ts");
});

// 上限を超えると dist/ を消して終わる（異常系）
test("test_main_when_dist_file_too_large", async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  const stderr = captureStderr();
  // 実行
  const code = await main([], { root, maxBytes: 1 });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr()).toMatch(/index\.js[^\n]*\d/);
});

// version.ini の先頭行を返す（正常系）
test("test_resolve_version", async () => {
  // 準備
  const { resolveVersion } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  // 実行
  const version = resolveVersion([], root);
  // 検証
  expect(version).toBe("v0.0.0");
});

// 渡した版を version.ini より優先する（正常系）
test("test_resolve_version_when_version_given", async () => {
  // 準備
  const { resolveVersion } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  // 実行
  const version = resolveVersion(["--version", "v0.0.1"], root);
  // 検証
  expect(version).toBe("v0.0.1");
});

// 書式の違う版を拒む（異常系）
test("test_resolve_version_when_format_invalid", async () => {
  // 準備
  const { resolveVersion, VersionFormatError } = await loadBuild();
  // 実行・検証
  expect(() => resolveVersion(["--version", "1.2"], tmpdir())).toThrow(
    VersionFormatError,
  );
});

// 版を埋めた JS と CSS を 1 つずつ書く（正常系）
test("test_build_dist", async () => {
  // 準備
  const { buildDist } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  // 実行
  const outputs = await buildDist("v0.0.1", root);
  // 検証
  const paths = Object.keys(outputs).sort();
  expect(paths).toHaveLength(2);
  expect(paths[0]).toMatch(/dist\/index\.css$/);
  expect(paths[1]).toMatch(/dist\/index\.js$/);
  expect(await readFile(join(root, "dist", "index.js"), "utf8")).toContain(
    '"v0.0.1"',
  );
  const css = await readFile(join(root, "dist", "index.css"), "utf8");
  expect(css.slice(0, 100)).toContain('--mdmark-version:"v0.0.1"');
});

// 上限以下なら空を返す（正常系）
test("test_find_too_large_outputs", async () => {
  // 準備
  const { findTooLargeOutputs } = await loadBuild();
  // 実行
  const tooLarge = findTooLargeOutputs(
    { "dist/index.js": 100, "dist/index.css": 200 },
    200,
  );
  // 検証
  expect(tooLarge).toEqual([]);
});

// 上限を超えたファイルだけを返す（正常系）
test("test_find_too_large_outputs_when_over_limit", async () => {
  // 準備
  const { findTooLargeOutputs } = await loadBuild();
  // 実行
  const tooLarge = findTooLargeOutputs(
    { "dist/index.js": 100, "dist/index.css": 201 },
    200,
  );
  // 検証
  expect(tooLarge).toEqual([{ path: "dist/index.css", bytes: 201 }]);
});
