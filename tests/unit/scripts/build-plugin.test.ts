import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metafile } from "esbuild";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** プラグインのビルドを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBuildPlugin = () => import("../../../scripts/build-plugin.ts");

const createTempDir = useTempDirs();

/** 使い方集の索引の行を作る（`page` は `docs/{名前}.md`） */
function createEntry(name: string, page = `docs/${name}.md`) {
  return {
    name,
    when: `${name} を書くとき`,
    summary: `${name} の概要`,
    page,
  };
}

/** 行を `guide/index.yaml` の中身にする */
function guideYaml(entries: ReturnType<typeof createEntry>[]): string {
  return [
    "schema: 1",
    "guides:",
    ...entries.flatMap((entry) => [
      `  - name: ${entry.name}`,
      `    when: ${entry.when}`,
      `    summary: ${entry.summary}`,
      `    page: ${entry.page}`,
    ]),
    "",
  ].join("\n");
}

/** 入力のパスだけを持つ esbuild の出力を作る */
function createMetafile(inputs: string[]): Metafile {
  return {
    inputs: Object.fromEntries(
      inputs.map((path) => [path, { bytes: 1, imports: [] }]),
    ),
    outputs: {},
  };
}

// 合う索引は問題が無い（正常系）
test("test_check_guide_source", async () => {
  // 準備
  const { checkGuideSource } = await loadBuildPlugin();
  const root = await createTempDir();
  const entries = [createEntry("a"), createEntry("b")];
  await writeFiles(root, {
    "guide/index.yaml": guideYaml(entries),
    "docs/a.md": "# A\n",
    "docs/b.md": "# B\n",
  });
  // 実行
  const result = await checkGuideSource({ root, contextLimit: 10_000 });
  // 検証
  expect(result.entries).toEqual(entries);
  expect(result.problems).toEqual([]);
});

// 無いページを指す（正常系）
test("test_check_guide_source_when_page_missing", async () => {
  // 準備
  const { checkGuideSource } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "guide/index.yaml": guideYaml([createEntry("a"), createEntry("b")]),
    "docs/a.md": "# A\n",
  });
  // 実行
  const result = await checkGuideSource({ root, contextLimit: 10_000 });
  // 検証
  expect(result.problems.some((line) => line.includes("guides[1].page"))).toBe(
    true,
  );
});

// 索引の文が上限を超える（正常系）
test("test_check_guide_source_when_too_long", async () => {
  // 準備
  const { checkGuideSource } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "guide/index.yaml": guideYaml([createEntry("a")]),
    "docs/a.md": "# A\n",
  });
  // 実行
  const result = await checkGuideSource({ root, contextLimit: 1 });
  // 検証
  expect(result.problems.some((line) => line.includes("上限 1 文字"))).toBe(
    true,
  );
});

// 形に合わない索引（正常系）
test("test_check_guide_source_when_invalid", async () => {
  // 準備
  const { checkGuideSource } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "guide/index.yaml": [
      "schema: 1",
      "guides:",
      "  - name: a",
      "    summary: a の概要",
      "    page: docs/a.md",
      "",
    ].join("\n"),
    "docs/a.md": "# A\n",
  });
  // 実行
  const result = await checkGuideSource({ root, contextLimit: 10_000 });
  // 検証
  expect(
    result.problems.some((line) =>
      line.startsWith("guide/index.yaml:guides[0].when"),
    ),
  ).toBe(true);
});

// 索引が無い（正常系）
test("test_check_guide_source_when_unreadable", async () => {
  // 準備
  const { checkGuideSource } = await loadBuildPlugin();
  const root = await createTempDir();
  // 実行
  const result = await checkGuideSource({ root, contextLimit: 10_000 });
  // 検証
  expect(
    result.problems.some((line) => line.includes("guide/index.yaml")),
  ).toBe(true);
});

// バージョンが同じで lockfile がある（正常系）
test("test_check_plugin_dependencies", async () => {
  // 準備
  const { checkPluginDependencies } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "package.json": JSON.stringify({ dependencies: { esbuild: "0.28.2" } }),
    "plugin/package.json": JSON.stringify({
      dependencies: { esbuild: "0.28.2" },
    }),
    "plugin/package-lock.json": "{}",
  });
  // 実行
  const result = await checkPluginDependencies(root);
  // 検証
  expect(result).toEqual([]);
});

// バージョンが違う（正常系）
test("test_check_plugin_dependencies_when_version_differs", async () => {
  // 準備
  const { checkPluginDependencies } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "package.json": JSON.stringify({ dependencies: { esbuild: "0.28.2" } }),
    "plugin/package.json": JSON.stringify({
      dependencies: { esbuild: "0.27.0" },
    }),
    "plugin/package-lock.json": "{}",
  });
  // 実行
  const result = await checkPluginDependencies(root);
  // 検証
  expect(
    result.some(
      (line) =>
        line.includes("esbuild") &&
        line.includes("0.27.0") &&
        line.includes("0.28.2"),
    ),
  ).toBe(true);
});

// lockfile が無い（正常系）
test("test_check_plugin_dependencies_when_lockfile_missing", async () => {
  // 準備
  const { checkPluginDependencies } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "package.json": JSON.stringify({ dependencies: { esbuild: "0.28.2" } }),
    "plugin/package.json": JSON.stringify({
      dependencies: { esbuild: "0.28.2" },
    }),
  });
  // 実行
  const result = await checkPluginDependencies(root);
  // 検証
  expect(result.some((line) => line.includes("plugin/package-lock.json"))).toBe(
    true,
  );
});

// ソースマップの sources から取り込まれたパッケージの名前を引く（正常系）
test("test_list_embedded_packages", async () => {
  // 準備
  const { listEmbeddedPackages } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "node_modules/pkg/dist/a.mjs": "export {};\n",
    "node_modules/pkg/dist/a.mjs.map": JSON.stringify({
      version: 3,
      sources: [
        "../../node_modules/.pnpm/ajv@8.18.0/node_modules/ajv/dist/x.js",
        "../src/y.ts",
      ],
    }),
  });
  const metafile = createMetafile(["node_modules/pkg/dist/a.mjs"]);
  // 実行
  const result = listEmbeddedPackages({ metafile, root });
  // 検証
  expect(result).toEqual(["ajv"]);
});

// ソースマップが無い入力は飛ばす（正常系）
test("test_list_embedded_packages_when_no_map", async () => {
  // 準備
  const { listEmbeddedPackages } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, { "node_modules/pkg/dist/a.mjs": "export {};\n" });
  const metafile = createMetafile(["node_modules/pkg/dist/a.mjs"]);
  // 実行
  const result = listEmbeddedPackages({ metafile, root });
  // 検証
  expect(result).toEqual([]);
});

/** 束ねたパッケージ `pkg`（ソースマップが `ajv` を指す）を一時フォルダに置く */
async function writeBundledPackage(root: string): Promise<Metafile> {
  await writeFiles(root, {
    "node_modules/pkg/package.json": JSON.stringify({
      name: "pkg",
      version: "1.2.3",
      license: "MIT",
    }),
    "node_modules/pkg/LICENSE": "PKG LICENSE TEXT",
    "node_modules/pkg/dist/a.mjs": "export {};\n",
    "node_modules/pkg/dist/a.mjs.map": JSON.stringify({
      version: 3,
      sources: ["../../node_modules/.pnpm/ajv@8.18.0/node_modules/ajv/x.js"],
    }),
  });
  await mkdir(join(root, "plugin"), { recursive: true });
  return createMetafile(["node_modules/pkg/dist/a.mjs"]);
}

// 束ねたパッケージと取り込まれたパッケージの本文を書く（正常系）
test("test_write_plugin_licenses", async () => {
  // 準備
  const { writePluginLicenses } = await loadBuildPlugin();
  const root = await createTempDir();
  const metafile = await writeBundledPackage(root);
  await writeFiles(root, { "scripts/licenses/ajv.txt": "AJV LICENSE TEXT" });
  // 実行
  await writePluginLicenses({ metafile, root });
  // 検証
  const text = await readFile(
    join(root, "plugin", "THIRD_PARTY_LICENSES.txt"),
    "utf8",
  );
  for (const expected of [
    "pkg",
    "1.2.3",
    "PKG LICENSE TEXT",
    "AJV LICENSE TEXT",
  ]) {
    expect(text).toContain(expected);
  }
});

// 取り込まれたパッケージの本文が無ければ拒む（異常系）
test("test_write_plugin_licenses_when_embedded_license_missing", async () => {
  // 準備
  const { writePluginLicenses } = await loadBuildPlugin();
  const root = await createTempDir();
  const metafile = await writeBundledPackage(root);
  // 実行
  const error = await writePluginLicenses({ metafile, root }).catch(
    (e: unknown) => e,
  );
  // 検証
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain("ajv");
  expect((error as Error).message).toContain("scripts/licenses/ajv.txt");
});

// version だけを書き換える（正常系）
test("test_write_plugin_manifest", async () => {
  // 準備
  const { writePluginManifest } = await loadBuildPlugin();
  const root = await createTempDir();
  const before = { name: "mdmark", version: "v0.0.0", description: "説明" };
  await writeFiles(root, {
    "plugin/.claude-plugin/plugin.json": `${JSON.stringify(before, null, 2)}\n`,
  });
  // 実行
  await writePluginManifest({ root, version: "v0.0.1" });
  // 検証
  const text = await readFile(
    join(root, "plugin", ".claude-plugin", "plugin.json"),
    "utf8",
  );
  expect(text).toBe(
    `${JSON.stringify({ ...before, version: "v0.0.1" }, null, 2)}\n`,
  );
  expect(Object.keys(JSON.parse(text))).toEqual(Object.keys(before));
});

// 索引の JSON とリンクを書き換えたページを書く（正常系）
test("test_write_plugin_guide", async () => {
  // 準備
  const { writePluginGuide } = await loadBuildPlugin();
  const root = await createTempDir();
  const entries = [createEntry("a")];
  await writeFiles(root, { "docs/a.md": "[C](./c.md)\n" });
  // 実行
  await writePluginGuide({ root, entries, version: "v0.0.0" });
  // 検証
  const index = JSON.parse(
    await readFile(join(root, "plugin", "guide", "index.json"), "utf8"),
  );
  expect(index.guides).toHaveLength(1);
  const page = await readFile(
    join(root, "plugin", "guide", "docs", "a.md"),
    "utf8",
  );
  expect(page).toContain(
    "https://github.com/shuhei1101/mdmark/blob/v0.0.0/docs/c.md",
  );
});

// 生成物だけを消す（正常系）
test("test_remove_plugin_outputs", async () => {
  // 準備
  const { removePluginOutputs } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "plugin/server/mcp.js": "export {};\n",
    "plugin/.mcp.json": "{}\n",
  });
  // 実行
  removePluginOutputs(root);
  // 検証
  expect(existsSync(join(root, "plugin", "server"))).toBe(false);
  expect(existsSync(join(root, "plugin", ".mcp.json"))).toBe(true);
});

// プラグインのソースが無ければ何も書かない（正常系）
test("test_build_plugin_when_source_missing", async () => {
  // 準備
  const { buildPlugin } = await loadBuildPlugin();
  const root = await createTempDir();
  // 実行
  const problems = await buildPlugin({
    version: "v0.0.0",
    root,
    contextLimit: 10_000,
  });
  // 検証
  expect(problems).toEqual([]);
  expect(existsSync(join(root, "plugin", "server"))).toBe(false);
});

// 索引に問題があれば書かずに問題を返す（正常系）
test("test_build_plugin_when_guide_invalid", async () => {
  // 準備
  const { buildPlugin } = await loadBuildPlugin();
  const root = await createTempDir();
  await writeFiles(root, {
    "src/plugin/mcp.ts": "export {};\n",
    "guide/index.yaml": guideYaml([createEntry("a")]),
  });
  // 実行
  const problems = await buildPlugin({
    version: "v0.0.0",
    root,
    contextLimit: 10_000,
  });
  // 検証
  expect(problems.some((line) => line.includes("guides[0].page"))).toBe(true);
  expect(existsSync(join(root, "plugin", "server"))).toBe(false);
});

// 索引にあるページへのリンクを名前にする（正常系）
test("test_rewrite_guide_links", async () => {
  // 準備
  const { rewriteGuideLinks } = await loadBuildPlugin();
  const entries = [createEntry("tables", "docs/使い方/b.md")];
  // 実行
  const result = rewriteGuideLinks({
    markdown: "[表](./b.md)",
    page: "docs/使い方/a.md",
    entries,
    version: "v0.7.0",
  });
  // 検証
  expect(result).toBe("表（read_guide の tables）");
});

// 索引に無いページへのリンクをタグの URL にする（正常系）
test("test_rewrite_guide_links_when_outside_index", async () => {
  // 準備
  const { rewriteGuideLinks } = await loadBuildPlugin();
  // 実行
  const result = rewriteGuideLinks({
    markdown: "[設定](../リファレンス/設定.md#features)",
    page: "docs/使い方/a.md",
    entries: [],
    version: "v0.7.0",
  });
  // 検証
  expect(result).toContain(
    "(https://github.com/shuhei1101/mdmark/blob/v0.7.0/docs/リファレンス/設定.md#features)",
  );
});

// コードの中と絶対 URL・ページ内のリンクはそのまま（正常系）
test("test_rewrite_guide_links_when_in_code", async () => {
  // 準備
  const { rewriteGuideLinks } = await loadBuildPlugin();
  const markdown = [
    "```md",
    "[a](./b.md)",
    "```",
    "",
    "`[a](./b.md)`",
    "",
    "[x](https://example.com)",
    "",
    "[y](#一覧)",
    "",
  ].join("\n");
  // 実行
  const result = rewriteGuideLinks({
    markdown,
    page: "docs/使い方/a.md",
    entries: [createEntry("tables", "docs/使い方/b.md")],
    version: "v0.7.0",
  });
  // 検証
  expect(result).toBe(markdown);
});
