import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { Metafile } from "esbuild";
import { afterEach, expect, test, vi } from "vitest";

/** ビルドのスクリプトを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBuild = () => import("../../../scripts/build.ts");

// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

// ビルドを丸ごと実行するテスト 1 件の待つ上限（ミリ秒）。
// WSL2 の /mnt/c 上で、このファイル単独 5 回と test:unit 全件 6 回を実行した所要時間の最大は 40.8 秒（test_main）。
// 40.8 秒 × 1.5 = 61.2 秒を 10 秒単位で切り上げて 70 秒にした
const MAIN_BUILD_TIMEOUT_MS = 70_000;

const entryScript = [
  "declare const __MDMARK_VERSION__: string;",
  "",
  "export function version(): string {",
  "  return __MDMARK_VERSION__;",
  "}",
  "",
].join("\n");

const createdRoots: string[] = [];

/** 一時フォルダに src/ と version.ini を配置し、そのパスを返却する */
async function createRoot(versionIni: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-build-"));
  createdRoots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "index.ts"), entryScript);
  await writeFile(join(root, "src", "index.css"), "/* entry */\n");
  await writeFile(join(root, "version.ini"), versionIni);
  return root;
}

/** 作業ツリーの node_modules へのリンクと tsconfig を一時フォルダに配置する（型定義を記載する tsc を実行できるようにする）。`entriesOnly` なら、中身を 1 つずつリンクした node_modules を配置し、一時フォルダにだけパッケージを追加できるようにする */
async function linkTooling(
  root: string,
  options: { entriesOnly?: boolean } = {},
): Promise<void> {
  const source = join(process.cwd(), "node_modules");
  if (options.entriesOnly) {
    await mkdir(join(root, "node_modules"));
    for (const name of await readdir(source)) {
      await symlink(join(source, name), join(root, "node_modules", name));
    }
  } else {
    await symlink(source, join(root, "node_modules"), "dir");
  }
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    if (existsSync(join(process.cwd(), name))) {
      await copyFile(join(process.cwd(), name), join(root, name));
    }
  }
}

/** 型定義まで記載できるビルドの一時フォルダを作る（src/ と version.ini に加えて tsc の道具を配置する） */
async function createBuildRoot(versionIni: string): Promise<string> {
  const root = await createRoot(versionIni);
  await linkTooling(root);
  return root;
}

/** src/ を持たず tsc の道具だけを配置した一時フォルダを作る */
async function createToolingRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-tooling-"));
  createdRoots.push(root);
  await linkTooling(root);
  return root;
}

/** 一時フォルダの node_modules にパッケージを配置する（licenseText があれば直下の LICENSE に記載する） */
async function createPackage(
  root: string,
  name: string,
  options: { version: string; license: string; licenseText?: string },
): Promise<void> {
  const dir = join(root, "node_modules", name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({
      name,
      version: options.version,
      license: options.license,
    }),
  );
  if (options.licenseText !== undefined) {
    await writeFile(join(dir, "LICENSE"), options.licenseText);
  }
}

/** 入力のパスだけを持つ esbuild の metafile を作る */
function createMetafile(inputPaths: string[]): Metafile {
  return {
    inputs: Object.fromEntries(
      inputPaths.map((path) => [path, { bytes: 1, imports: [] }]),
    ),
    outputs: {},
  };
}

/** 前回のビルドの dist/index.js を配置する */
async function createPreviousDist(root: string): Promise<void> {
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist", "index.js"), "// 前回のビルド\n");
}

/** 標準エラーへの出力を集め、集めた文字列を返却する関数を返却する */
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

// version.ini のバージョンでビルドする（正常系）
test("test_main", { timeout: MAIN_BUILD_TIMEOUT_MS }, async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  // 実行
  const code = await main([], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(0);
  expect(await readFile(join(root, "dist", "index.js"), "utf8")).toContain(
    "v0.0.0",
  );
});

// 指定したバージョンでビルドする（正常系）
test("test_main_when_version_given", {
  timeout: MAIN_BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
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

// バージョンの書式が違うと前回の dist/ を残さずに終わる（異常系）
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

// version.ini を読み込めないと前回の dist/ を残さずに終わる（異常系）
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

// 上限を超えると dist/ を削除して終わる（異常系）
test("test_main_when_dist_file_too_large", {
  timeout: MAIN_BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  const stderr = captureStderr();
  // 実行
  const code = await main([], { root, maxBytes: 1 });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr()).toMatch(/index\.js[^\n]*\d/);
});

// 移行の手順の点検に誤りがあれば dist/ を書き込まずに終わる（異常系）
test("test_main_when_migrations_invalid", {
  timeout: MAIN_BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  await mkdir(join(root, "migrations", "next"), { recursive: true });
  await writeFile(
    join(root, "migrations", "next", "steps.yaml"),
    [
      "steps:",
      "  - description: op が無い",
      "    file: config",
      "    from: legacy",
      "    to: renamed",
      "",
    ].join("\n"),
  );
  const stderr = captureStderr();
  // 実行
  const code = await main([], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(stderr()).toContain("migrations/next/steps.yaml");
});

// ガイドの索引が無いページを指すと dist/ とプラグインの生成物を残さずに終わる（異常系）
test("test_main_when_guide_index_invalid", {
  timeout: MAIN_BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  const files: Record<string, string> = {
    "src/plugin/pre-tool-use.ts": "export {};\n",
    "guide/index.yaml": [
      "schema: 1",
      "guides:",
      "  - name: a",
      "    when: a を記載するとき",
      "    summary: a の概要",
      "    page: docs/a.md",
      "",
    ].join("\n"),
    "plugin/.claude-plugin/plugin.json": '{"name":"mdmark"}\n',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  const stderr = captureStderr();
  // 実行
  const code = await main([], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  expect(existsSync(join(root, "plugin", "scripts"))).toBe(false);
  expect(stderr()).toContain("guide/index.yaml:guides[0].page");
});

// 対応ブラウザの下限に無い API を確認せずに使用すると dist/ を削除して終わる（異常系）
test("test_main_when_api_missing_in_baseline_browser", {
  timeout: MAIN_BUILD_TIMEOUT_MS,
}, async () => {
  // 準備
  const { main } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  await writeFile(
    join(root, "src", "index.ts"),
    'new Intl.Segmenter("ja");\nexport const a = 1;\n',
  );
  const stderr = captureStderr();
  // 実行
  const code = await main([], { root, maxBytes: MAX_BYTES });
  // 検証
  expect(code).toBe(1);
  expect(existsSync(join(root, "dist"))).toBe(false);
  for (const expected of ["dist/index.js", "Intl.Segmenter", "Firefox 98"]) {
    expect(stderr()).toContain(expected);
  }
});

// version.ini の先頭行を返却する（正常系）
test("test_resolve_version", async () => {
  // 準備
  const { resolveVersion } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  // 実行
  const version = resolveVersion([], root);
  // 検証
  expect(version).toBe("v0.0.0");
});

// 指定したバージョンを version.ini より優先する（正常系）
test("test_resolve_version_when_version_given", async () => {
  // 準備
  const { resolveVersion } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  // 実行
  const version = resolveVersion(["--version", "v0.0.1"], root);
  // 検証
  expect(version).toBe("v0.0.1");
});

// 書式の違うバージョンを拒む（異常系）
test("test_resolve_version_when_format_invalid", async () => {
  // 準備
  const { resolveVersion, VersionFormatError } = await loadBuild();
  // 実行・検証
  expect(() => resolveVersion(["--version", "1.2"], tmpdir())).toThrow(
    VersionFormatError,
  );
});

// バージョンを埋めた JS と CSS とライセンスのファイルを 1 つずつ記載する（正常系）
test("test_build_dist", async () => {
  // 準備
  const { buildDist } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  // 実行
  const outputs = await buildDist("v0.0.1", root);
  // 検証
  const paths = Object.keys(outputs).sort();
  expect(paths).toHaveLength(3);
  expect(paths[0]).toMatch(/dist\/THIRD_PARTY_LICENSES\.txt$/);
  expect(paths[1]).toMatch(/dist\/index\.css$/);
  expect(paths[2]).toMatch(/dist\/index\.js$/);
  expect(await readFile(join(root, "dist", "index.js"), "utf8")).toContain(
    '"v0.0.1"',
  );
  const css = await readFile(join(root, "dist", "index.css"), "utf8");
  expect(css.slice(0, 100)).toContain('--mdmark-version:"v0.0.1"');
});

// CSS の入れ子を展開する（正常系）
test("test_build_dist_when_nested_css", async () => {
  // 準備
  const { buildDist } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  await writeFile(join(root, "src", "index.css"), ".a { .b { color: red } }\n");
  // 実行
  await buildDist("v0.0.1", root);
  // 検証
  const css = await readFile(join(root, "dist", "index.css"), "utf8");
  expect(css).toContain(".a .b{color:red}");
  expect(css).not.toMatch(/\.a\s*\{[^}]*\.b\s*\{/);
});

// postcss の import を差し替え、配布物に postcss を含めない（正常系）
test("test_build_dist_when_postcss_imported", async () => {
  // 準備
  const { buildDist } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  await writeFile(
    join(root, "src", "index.ts"),
    'import { parse } from "postcss";\nexport { parse };\n',
  );
  // 実行
  await buildDist("v0.0.1", root);
  // 検証
  const js = await readFile(join(root, "dist", "index.js"), "utf8");
  expect(js).not.toContain("CssSyntaxError");
});

// CLI と起動の処理をまとめる（正常系）
test("test_build_dist_when_cli_and_viewer", async () => {
  // 準備
  const { buildDist } = await loadBuild();
  const root = await createBuildRoot("v0.0.0\n");
  await mkdir(join(root, "src", "cli"));
  await mkdir(join(root, "src", "viewer"));
  await writeFile(
    join(root, "src", "cli", "main.ts"),
    [
      'import { parse } from "yaml";',
      "",
      "export function main(): unknown {",
      '  return parse("a: 1");',
      "}",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(root, "src", "viewer", "index.ts"),
    'export const closing: string = "</script>";\n',
  );
  await writeFile(
    join(root, "src", "viewer", "viewer.css"),
    ".a { color: red }\n",
  );
  // 実行
  const outputs = await buildDist("v0.0.1", root);
  // 検証
  const paths = Object.keys(outputs);
  for (const name of ["dist/cli.js", "dist/viewer.js", "dist/viewer.css"]) {
    expect(paths.some((path) => path.endsWith(name))).toBe(true);
  }
  const cli = await readFile(join(root, "dist", "cli.js"), "utf8");
  expect(cli.split("\n")[0]).toBe("#!/usr/bin/env node");
  expect(cli).toMatch(/from\s*["']yaml["']/);
  const viewer = await readFile(join(root, "dist", "viewer.js"), "utf8");
  expect(viewer).toContain("<\\/script>");
  expect(viewer).not.toContain("</script>");
});

// 書き換えの処理を、移行のスクリプトを持つフォルダにだけまとめる（正常系）
test("test_build_legacy_marks", async () => {
  // 準備
  const { buildLegacyMarks } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await mkdir(join(root, "src", "render"), { recursive: true });
  await writeFile(
    join(root, "src", "render", "legacy-marks.ts"),
    'export const rewriteLegacyMarks = (markdown: string): string => markdown + "!";\n',
  );
  await mkdir(join(root, "migrations", "next"), { recursive: true });
  await mkdir(join(root, "migrations", "v0.1.0"), { recursive: true });
  await writeFile(join(root, "migrations", "next", "marker-json.mjs"), "\n");
  await writeFile(
    join(root, "migrations", "v0.1.0", "steps.yaml"),
    "steps: []\n",
  );
  // 実行
  const written = await buildLegacyMarks("v0.0.1", root);
  // 検証
  expect(written).toEqual(["migrations/next/legacy-marks.js"]);
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(root, "migrations", "next", "legacy-marks.js"),
    ).href
  )) as { rewriteLegacyMarks: (markdown: string) => string };
  expect(module.rewriteLegacyMarks("a")).toBe("a!");
  expect(
    existsSync(join(root, "migrations", "v0.1.0", "legacy-marks.js")),
  ).toBe(false);
  expect(
    existsSync(join(root, "migrations", "v0.1.0", "THIRD_PARTY_LICENSES.txt")),
  ).toBe(false);
});

// まとめた依存のライセンスを同じフォルダに記載する（正常系）
test("test_build_legacy_marks_when_package_bundled", async () => {
  // 準備
  const { buildLegacyMarks } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await createPackage(root, "legacy-only-pkg", {
    version: "3.0.0",
    license: "MIT",
    licenseText: "Copyright LEGACY holder",
  });
  await writeFile(
    join(root, "node_modules", "legacy-only-pkg", "index.js"),
    "export const suffix = '!';\n",
  );
  await mkdir(join(root, "src", "render"), { recursive: true });
  await writeFile(
    join(root, "src", "render", "legacy-marks.ts"),
    [
      "// @ts-expect-error 型定義の無い一時のパッケージ",
      'import { suffix } from "legacy-only-pkg";',
      "",
      "export const rewriteLegacyMarks = (markdown: string): string => markdown + suffix;",
      "",
    ].join("\n"),
  );
  await mkdir(join(root, "migrations", "next"), { recursive: true });
  await writeFile(join(root, "migrations", "next", "marker-json.mjs"), "\n");
  // 実行
  await buildLegacyMarks("v0.0.1", root);
  // 検証
  const text = await readFile(
    join(root, "migrations", "next", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  expect(text).toContain("legacy-only-pkg");
  expect(text).toContain("Copyright LEGACY holder");
});

// ソースの無いときは何も書き込まない（正常系）
test("test_build_legacy_marks_when_source_removed", async () => {
  // 準備
  const { buildLegacyMarks } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await mkdir(join(root, "migrations", "v0.11.0"), { recursive: true });
  await writeFile(join(root, "migrations", "v0.11.0", "marker-json.mjs"), "\n");
  await writeFile(
    join(root, "migrations", "v0.11.0", "legacy-marks.js"),
    "// 書き込み済み\n",
  );
  await writeFile(
    join(root, "migrations", "v0.11.0", "THIRD_PARTY_LICENSES.txt"),
    "書き込み済みのライセンス\n",
  );
  // 実行
  const written = await buildLegacyMarks("v0.0.1", root);
  // 検証
  expect(written).toEqual([]);
  expect(
    await readFile(
      join(root, "migrations", "v0.11.0", "legacy-marks.js"),
      "utf8",
    ),
  ).toBe("// 書き込み済み\n");
  expect(
    await readFile(
      join(root, "migrations", "v0.11.0", "THIRD_PARTY_LICENSES.txt"),
      "utf8",
    ),
  ).toBe("書き込み済みのライセンス\n");
});

// 書き換えの処理を、廃止した図の移行のスクリプトを持つフォルダにだけまとめる（正常系）
test("test_build_retired_diagrams", async () => {
  // 準備
  const { buildRetiredDiagrams } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  const sources: Record<string, string> = {
    "src/map/convert.ts":
      'export const convertRetiredDiagrams = (options: { markdown: string }) => ({ markdown: options.markdown + "!" });\n',
    "src/cli/check.ts":
      'export const loadExtensionDirectives = async () => ({ directives: new Set(["flow"]), issues: [] });\n',
    "src/cli/config.ts":
      "export const loadConfig = async (file: string) => ({ file, config: {} });\n",
    "migrations/next/retired-diagrams.mjs": "\n",
    "migrations/v0.11.0/marker-json.mjs": "\n",
  };
  for (const [path, text] of Object.entries(sources)) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), text);
  }
  // 実行
  const written = await buildRetiredDiagrams("v0.0.1", root);
  // 検証
  expect(written).toEqual(["migrations/next/retired-diagrams.js"]);
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(root, "migrations", "next", "retired-diagrams.js"),
    ).href
  )) as {
    convertRetiredDiagrams: (options: { markdown: string }) => {
      markdown: string;
    };
    loadExtensionDirectives: () => Promise<{ directives: Set<string> }>;
    loadConfig: (file: string) => Promise<{ file: string }>;
  };
  expect(module.convertRetiredDiagrams({ markdown: "a" }).markdown).toBe("a!");
  expect([...(await module.loadExtensionDirectives()).directives]).toEqual([
    "flow",
  ]);
  expect((await module.loadConfig("x.yaml")).file).toBe("x.yaml");
  expect(
    existsSync(join(root, "migrations", "v0.11.0", "retired-diagrams.js")),
  ).toBe(false);
});

// CLI にまとめたパッケージのライセンスも記載する（正常系）
test("test_build_dist_when_cli_bundles_package", async () => {
  // 準備
  const { buildDist } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await linkTooling(root, { entriesOnly: true });
  await createPackage(root, "cli-only-pkg", {
    version: "2.0.0",
    license: "MIT",
    licenseText: "Copyright CLI holder",
  });
  await writeFile(
    join(root, "node_modules", "cli-only-pkg", "index.js"),
    "export const name = 'cli-only-pkg';\n",
  );
  await mkdir(join(root, "src", "cli"));
  await writeFile(
    join(root, "src", "cli", "main.ts"),
    [
      "// @ts-expect-error 型定義の無い一時のパッケージ",
      'import { name } from "cli-only-pkg";',
      "",
      "export function main(): string {",
      "  return name;",
      "}",
      "",
    ].join("\n"),
  );
  // 実行
  await buildDist("v0.0.1", root);
  // 検証
  const text = await readFile(
    join(root, "dist", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  expect(text).toContain("cli-only-pkg");
  expect(text).toContain("Copyright CLI holder");
});

// まとめたパッケージごとに名前・バージョン・ライセンス・本文を記載する（正常系）
test("test_write_third_party_licenses", async () => {
  // 準備
  const { writeThirdPartyLicenses } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await mkdir(join(root, "dist"));
  await createPackage(root, "b", {
    version: "4.5.6",
    license: "ISC",
    licenseText: "Copyright B holder",
  });
  await createPackage(root, "@s/a", {
    version: "1.2.3",
    license: "MIT",
    licenseText: "Copyright A holder",
  });
  const metafile = createMetafile([
    "node_modules/b/index.js",
    "node_modules/@s/a/lib/x.js",
    "node_modules/@s/a/lib/y.js",
    "src/index.ts",
  ]);
  // 実行
  await writeThirdPartyLicenses({
    metafiles: [metafile],
    root,
    outfile: "dist/THIRD_PARTY_LICENSES.txt",
  });
  // 検証
  const text = await readFile(
    join(root, "dist", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  for (const expected of ["@s/a", "1.2.3", "MIT", "4.5.6", "ISC"]) {
    expect(text).toContain(expected);
  }
  expect(text.split("Copyright A holder")).toHaveLength(2);
  expect(text.split("Copyright B holder")).toHaveLength(2);
  expect(text.indexOf("Copyright A holder")).toBeLessThan(
    text.indexOf("Copyright B holder"),
  );
});

// ライセンスの本文が無いパッケージを拒む（異常系）
test("test_write_third_party_licenses_when_license_missing", async () => {
  // 準備
  const { writeThirdPartyLicenses } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await mkdir(join(root, "dist"));
  await createPackage(root, "b", { version: "4.5.6", license: "ISC" });
  const metafile = createMetafile(["node_modules/b/index.js"]);
  // 実行・検証
  await expect(
    writeThirdPartyLicenses({
      metafiles: [metafile],
      root,
      outfile: "dist/THIRD_PARTY_LICENSES.txt",
    }),
  ).rejects.toThrow("ライセンスの本文が無い: b");
});

// 複数の metafile をまとめ、取り込まれたパッケージの本文も記載する（正常系）
test("test_write_third_party_licenses_when_embedded", async () => {
  // 準備
  const { writeThirdPartyLicenses } = await loadBuild();
  const root = await createRoot("v0.0.0\n");
  await mkdir(join(root, "dist"));
  await createPackage(root, "b", {
    version: "4.5.6",
    license: "ISC",
    licenseText: "Copyright B holder",
  });
  await createPackage(root, "pkg", {
    version: "1.0.0",
    license: "MIT",
    licenseText: "Copyright PKG holder",
  });
  await mkdir(join(root, "node_modules", "pkg", "dist"), { recursive: true });
  await writeFile(
    join(root, "node_modules", "pkg", "dist", "a.mjs"),
    "export {};\n",
  );
  await writeFile(
    join(root, "node_modules", "pkg", "dist", "a.mjs.map"),
    JSON.stringify({
      version: 3,
      sources: ["../../node_modules/.pnpm/ajv@8.18.0/node_modules/ajv/x.js"],
    }),
  );
  await mkdir(join(root, "scripts", "licenses"), { recursive: true });
  await writeFile(
    join(root, "scripts", "licenses", "ajv.txt"),
    "Copyright AJV holder",
  );
  const first = createMetafile(["node_modules/b/index.js"]);
  const second = createMetafile([
    "node_modules/b/index.js",
    "node_modules/pkg/dist/a.mjs",
  ]);
  // 実行
  await writeThirdPartyLicenses({
    metafiles: [first, second],
    root,
    outfile: "dist/THIRD_PARTY_LICENSES.txt",
  });
  // 検証
  const text = await readFile(
    join(root, "dist", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  for (const holder of ["AJV", "B", "PKG"]) {
    expect(text.split(`Copyright ${holder} holder`)).toHaveLength(2);
  }
  expect(text.indexOf("Copyright AJV holder")).toBeLessThan(
    text.indexOf("Copyright B holder"),
  );
  expect(text.indexOf("Copyright B holder")).toBeLessThan(
    text.indexOf("Copyright PKG holder"),
  );
});

// 上限以下なら空を返却する（正常系）
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

// 上限を超えたファイルだけを返却する（正常系）
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

// CLI と起動の処理は上限を超えても返却しない（正常系）
test("test_find_too_large_outputs_when_unsized", async () => {
  // 準備
  const { findTooLargeOutputs } = await loadBuild();
  // 実行
  const tooLarge = findTooLargeOutputs(
    { "dist/cli.js": 300, "dist/index.js": 100 },
    200,
  );
  // 検証
  expect(tooLarge).toEqual([]);
});

const execFileAsync = promisify(execFile);

// 公開の型を利用側のファイル
const CONSUMER = [
  'import { mount, registerExtension, render, version } from "./dist/index.js";',
  'import type { MdmarkExtension, MdmarkMarkArgs, StandardSchemaV1 } from "./dist/index.js";',
  "",
  "const extension: MdmarkExtension = {",
  '  name: "greet",',
  '  directive: "greet",',
  "  load: async () => ({",
  "    draw: (slot: HTMLElement, value: MdmarkMarkArgs) => {",
  '      slot.textContent = String(value.options.target ?? "");',
  "    },",
  "  }),",
  "};",
  "registerExtension(extension);",
  "",
  'const handle = mount(document.body, { markdown: "# 見出し" });',
  'handle.update("# 次の見出し");',
  "handle.destroy();",
  "export const html: string = render(version());",
  "export type Schema = StandardSchemaV1<MdmarkMarkArgs>;",
  "",
].join("\n");

// 公開関数と拡張の型を持つ dist/index.d.ts を書き込み、利用側の型検査が通る（正常系）
test("test_emit_declarations", async () => {
  // 準備
  const { emitDeclarations } = await loadBuild();
  const root = await createToolingRoot();
  await cp(join(process.cwd(), "src"), join(root, "src"), { recursive: true });
  // 描く処理がマーカーの JSON Schema を読み込む
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), {
    recursive: true,
  });
  // 実行
  await emitDeclarations(root);
  // 検証
  const declarations = await readFile(join(root, "dist", "index.d.ts"), "utf8");
  for (const name of [
    "version",
    "mount",
    "render",
    "registerExtension",
    "MdmarkExtension",
    "MdmarkMarkArgs",
    "StandardSchemaV1",
  ]) {
    expect(declarations).toMatch(new RegExp(`export[^;]*\\b${name}\\b`));
  }
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(join(root, "consumer.ts"), CONSUMER);
  for (const [module, moduleResolution] of [
    ["esnext", "bundler"],
    ["nodenext", "nodenext"],
  ]) {
    const config = join(root, `tsconfig.consumer-${moduleResolution}.json`);
    await writeFile(
      config,
      JSON.stringify({
        compilerOptions: {
          target: "es2022",
          module,
          moduleResolution,
          strict: true,
          noEmit: true,
          lib: ["es2022", "dom"],
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    await execFileAsync(join(root, "node_modules", ".bin", "tsc"), [
      "--project",
      config,
    ]);
  }
});

// 型エラーがあれば例外を投げる（異常系）
test("test_emit_declarations_when_type_error", async () => {
  // 準備
  const { emitDeclarations } = await loadBuild();
  const root = await createToolingRoot();
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "src", "index.ts"),
    'export const x: number = "a";\n',
  );
  // 実行・検証
  await expect(emitDeclarations(root)).rejects.toThrow("TS2322");
});
