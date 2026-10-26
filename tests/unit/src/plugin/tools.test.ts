import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { parse } from "yaml";
import type { ToolDefinition } from "../../../../src/plugin/tools.ts";
import { useTempDirs, writeDist, writeFiles } from "../../helpers/cli.ts";
import { BASE_TAG, setUpChangeTogetherRepository } from "../../helpers/git.ts";

/** ツールの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTools = () => import("../../../../src/plugin/tools.ts");

/** find_docs の結果の組み立てを読み込む */
const loadResults = () => import("../../../../src/plugin/results.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const createTempDir = useTempDirs();

/** ツールの結果のテキストを並べる */
function textsOf(result: { content: unknown[] }): string[] {
  return (result.content as { type: string; text: string }[]).map(
    (item) => item.text,
  );
}

/** 引数を持たないツールを作る（`run` はテストごとに渡す。作業のフォルダを使うかは既定で使わない） */
function createTool(
  run: ToolDefinition["run"],
  usesProjectDir = false,
): ToolDefinition {
  return {
    name: "check",
    description: "テスト用のツール",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    run,
    usesProjectDir,
  };
}

/** サーバーの読む場所（使い方集と配布物のフォルダ）を作る。配布物のフォルダの親は `packageDir` */
async function createRoots(): Promise<{
  packageDir: string;
  guideDir: string;
  distDir: string;
}> {
  const packageDir = await createTempDir();
  return {
    packageDir,
    guideDir: join(packageDir, "plugin", "guide"),
    distDir: join(packageDir, "dist"),
  };
}

/** 作業のフォルダと、サーバーの読む場所を一時フォルダに作る */
async function createContext(): Promise<{
  projectDir: string;
  packageDir: string;
  guideDir: string;
  distDir: string;
}> {
  return { projectDir: await createTempDir(), ...(await createRoots()) };
}

/** 文書 `a` だけを載せた索引を、設定の `index` に指して作業のフォルダに置く */
async function writeIndexProject(projectDir: string): Promise<void> {
  await writeFiles(projectDir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
}

/** 文書を並べた索引を、設定の `index` に指して作業のフォルダに置く（文書の本文は `# {題}`） */
async function writeDocsProject(
  projectDir: string,
  options: {
    docs: { id: string; tags?: string[]; file?: boolean }[];
    tags?: string[];
  },
): Promise<void> {
  const lines = ["schema: 1", "docs:"];
  const files: Record<string, string> = {
    "mdmark.config.yaml": "index: index.yaml\n",
  };
  for (const doc of options.docs) {
    lines.push(
      `  - id: ${doc.id}`,
      `    path: ${doc.id}.md`,
      `    title: ${doc.id.toUpperCase()}`,
    );
    if (doc.tags !== undefined) {
      lines.push(`    tags: [${doc.tags.join(", ")}]`);
    }
    if (doc.file !== false) {
      files[`${doc.id}.md`] = `# ${doc.id.toUpperCase()}\n`;
    }
  }
  if (options.tags !== undefined) {
    lines.push("tags:", ...options.tags.map((name) => `  - name: ${name}`));
  }
  files["index.yaml"] = `${lines.join("\n")}\n`;
  await writeFiles(projectDir, files);
}

/** タグの語彙と、別名 `MCP` で付けた文書を持つ作業のフォルダを作る */
async function writeVocabularyProject(projectDir: string): Promise<void> {
  await writeFiles(projectDir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    tags: [MCP]",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "    tags: [topic:mcp]",
      "tags:",
      "  - name: topic:mcp",
      "    aliases: [MCP]",
      "  - name: topic:unused",
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "b.md": "# B\n",
  });
}

// json を 1 つのテキストにする（正常系）
test("test_call_tool", async () => {
  // 準備
  const { callTool } = await loadTools();
  const tool = createTool(async () => ({ json: { out: "/a.html" } }));
  const roots = await createRoots();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    roots,
    stderr: () => {},
  });
  // 検証
  const texts = textsOf(result);
  expect(texts).toHaveLength(1);
  expect(JSON.parse(texts[0] ?? "")).toEqual({ out: "/a.html" });
  expect(result.isError).toBeFalsy();
});

// texts をそのままの文字で並べる（正常系）
test("test_call_tool_when_texts", async () => {
  // 準備
  const { callTool } = await loadTools();
  const expected = ["# a\n\n本文", "# b\n\n本文"];
  const tool = createTool(async () => ({ texts: expected }));
  const roots = await createRoots();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    roots,
    stderr: () => {},
  });
  // 検証
  expect(textsOf(result)).toEqual(expected);
});

// 合わない引数は処理を呼ばない（正常系）
test("test_call_tool_when_arguments_invalid", async () => {
  // 準備
  const { callTool } = await loadTools();
  const run = vi.fn(async () => ({ json: {} }));
  const tool: ToolDefinition = {
    ...createTool(run),
    inputSchema: {
      type: "object",
      properties: { names: { type: "array", items: { type: "string" } } },
      required: ["names"],
      additionalProperties: false,
    },
  };
  const roots = await createRoots();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    roots,
    stderr: () => {},
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(run).not.toHaveBeenCalled();
});

// CliError はその文を返し、ログを書かない（正常系）
test("test_call_tool_when_cli_error", async () => {
  // 準備
  const { callTool } = await loadTools();
  const { CliError } = await loadErrors();
  const tool = createTool(async () => {
    throw new CliError("直し方の文");
  });
  const roots = await createRoots();
  const stderr: string[] = [];
  // 実行
  const result = await callTool({
    tool,
    args: {},
    roots,
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(textsOf(result)).toEqual(["直し方の文"]);
  expect(stderr).toEqual([]);
});

// structured を structuredContent と同じ JSON のテキストにする（正常系）
test("test_call_tool_when_structured", async () => {
  // 準備
  const { callTool } = await loadTools();
  const tool = createTool(async () => ({ structured: { tags: [] } }));
  const roots = await createRoots();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    roots,
    stderr: () => {},
  });
  // 検証
  expect(result.structuredContent).toEqual({ tags: [] });
  const texts = textsOf(result);
  expect(texts).toHaveLength(1);
  expect(JSON.parse(texts[0] ?? "")).toEqual({ tags: [] });
});

// 想定しない例外は標準エラーに書いて返す（正常系）
test("test_call_tool_when_unexpected_error", async () => {
  // 準備
  const { callTool } = await loadTools();
  const tool = createTool(async () => {
    throw new Error("boom");
  });
  const roots = await createRoots();
  const stderr: string[] = [];
  // 実行
  const result = await callTool({
    tool,
    args: {},
    roots,
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(textsOf(result).join("\n")).toContain("boom");
  const logged = stderr.join("\n");
  expect(logged).toContain("check");
  expect(logged).toContain("boom");
  // スタックには、例外を投げたこのテストのファイルが出る
  expect(logged).toContain("tools.test.ts");
});

/** `config` を受けられ、作業のフォルダを使うツールを作る */
function createProjectDirTool(run: ToolDefinition["run"]): ToolDefinition {
  const base = createTool(run, true);
  return {
    ...base,
    inputSchema: {
      type: "object",
      properties: { config: { type: "string" } },
      required: [],
      additionalProperties: false,
    },
  };
}

// project_dir を前提に入れ、引数から除いて処理を呼ぶ（正常系）
test("test_call_tool_when_project_dir", async () => {
  // 準備
  const { callTool } = await loadTools();
  const run = vi.fn(async () => ({ json: {} }));
  const tool = createProjectDirTool(run);
  const roots = await createRoots();
  const projectDir = await createTempDir();
  // 実行
  const result = await callTool({
    tool,
    args: { project_dir: projectDir, config: "a.yaml" },
    roots,
    stderr: () => {},
  });
  // 検証
  expect(result.isError).toBeFalsy();
  expect(run).toHaveBeenCalledTimes(1);
  const [args, context] = run.mock.calls[0] as unknown as [
    Record<string, unknown>,
    { projectDir: string },
  ];
  expect(args).toEqual({ config: "a.yaml" });
  expect(context.projectDir).toBe(projectDir);
});

// project_dir が無ければ処理を呼ばない（異常系）
test("test_call_tool_when_project_dir_missing", async () => {
  // 準備
  const { callTool, PROJECT_DIR_ERROR_MESSAGE } = await loadTools();
  const run = vi.fn(async () => ({ json: {} }));
  const tool = createProjectDirTool(run);
  const roots = await createRoots();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    roots,
    stderr: () => {},
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(textsOf(result)).toEqual([PROJECT_DIR_ERROR_MESSAGE]);
  expect(run).not.toHaveBeenCalled();
});

// 絶対パスでないか、無いフォルダの project_dir を拒む（異常系）
test("test_call_tool_when_project_dir_invalid", async () => {
  // 準備
  const { callTool, PROJECT_DIR_ERROR_MESSAGE } = await loadTools();
  const run = vi.fn(async () => ({ json: {} }));
  const tool = createProjectDirTool(run);
  const roots = await createRoots();
  const missingDir = join(await createTempDir(), "no-such-dir");
  for (const projectDir of ["docs", missingDir]) {
    // 実行
    const result = await callTool({
      tool,
      args: { project_dir: projectDir },
      roots,
      stderr: () => {},
    });
    // 検証
    expect(result.isError).toBe(true);
    expect(textsOf(result)).toEqual([PROJECT_DIR_ERROR_MESSAGE]);
  }
  expect(run).not.toHaveBeenCalled();
});

// 作業のフォルダを使わないツールは project_dir を知らない引数として拒む（異常系）
test("test_call_tool_when_project_dir_given_to_read_guide", async () => {
  // 準備
  const { callTool } = await loadTools();
  const run = vi.fn(async () => ({ json: {} }));
  const tool = createTool(run, false);
  const roots = await createRoots();
  // 実行
  const result = await callTool({
    tool,
    args: { project_dir: await createTempDir() },
    roots,
    stderr: () => {},
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(textsOf(result).join("\n")).toContain("project_dir");
  expect(run).not.toHaveBeenCalled();
});

// 名前の順に本文を返す（正常系）
test("test_run_read_guide", async () => {
  // 準備
  const { runReadGuide } = await loadTools();
  const context = await createContext();
  const entry = (name: string) => ({
    name,
    when: `${name} を書くとき`,
    summary: `${name} の概要`,
    page: `docs/${name}.md`,
  });
  await writeFiles(context.guideDir, {
    "index.json": JSON.stringify({
      schema: 1,
      guides: [entry("a"), entry("b")],
    }),
    "docs/a.md": "# ページ A\n",
    "docs/b.md": "# ページ B\n",
  });
  // 実行
  const result = await runReadGuide({ names: ["b", "a"] }, context);
  // 検証
  expect(result.texts).toHaveLength(2);
  expect(result.texts?.[0]?.startsWith("# b")).toBe(true);
});

// 作業のフォルダからの相対パスで書き出す（正常系）
test("test_run_export_html", async () => {
  // 準備
  const { runExportHtml } = await loadTools();
  const context = await createContext();
  await writeFiles(context.projectDir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# 題\n",
  });
  await writeDist(context.packageDir);
  // 実行
  const result = await runExportHtml({ file: "guide.md" }, context);
  // 検証
  expect(result.json?.out).toBe(`${context.projectDir}/guide.html`);
  expect(result.json?.warnings).toEqual([]);
});

// サーバーの cwd が作業のフォルダと違っても、相対パスの out と config を作業のフォルダから解く（正常系）
test("test_run_export_html_when_cwd_differs", async () => {
  // 準備
  const { runExportHtml } = await loadTools();
  const context = await createContext();
  await writeFiles(context.projectDir, {
    "conf/mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# 題\n",
  });
  await writeDist(context.packageDir);
  const strayOut = join(process.cwd(), "out", "a.html");
  expect(existsSync(strayOut)).toBe(false);
  // 実行
  const result = await runExportHtml(
    { file: "guide.md", out: "out/a.html", config: "conf/mdmark.config.yaml" },
    context,
  );
  // 検証
  expect(result.json?.out).toBe(`${context.projectDir}/out/a.html`);
  expect(existsSync(`${context.projectDir}/out/a.html`)).toBe(true);
  expect(existsSync(strayOut)).toBe(false);
});

// まとめて絶対パスと文書の数を返す（正常系）
test("test_run_build_site", async () => {
  // 準備
  const { runBuildSite } = await loadTools();
  const context = await createContext();
  await writeFiles(context.projectDir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["**/*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "b.md": "# B\n",
  });
  await writeDist(context.packageDir);
  // 実行
  const result = await runBuildSite({}, context);
  // 検証
  expect(result.json?.out).toBe(`${context.projectDir}/dist/docs.html`);
  expect(result.json?.docs).toBe(2);
});

// サーバーの cwd が作業のフォルダと違っても、作業のフォルダの設定と build.out で書く（正常系）
test("test_run_build_site_when_cwd_differs", async () => {
  // 準備
  const { runBuildSite } = await loadTools();
  const context = await createContext();
  await writeFiles(context.projectDir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["**/*.md"]',
      "  out: site/docs.html",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
  await writeDist(context.packageDir);
  const strayOut = join(process.cwd(), "site", "docs.html");
  expect(existsSync(strayOut)).toBe(false);
  // 実行
  const result = await runBuildSite({}, context);
  // 検証
  expect(result.json?.out).toBe(`${context.projectDir}/site/docs.html`);
  expect(existsSync(`${context.projectDir}/site/docs.html`)).toBe(true);
  expect(existsSync(strayOut)).toBe(false);
});

// ずれを一覧で返す（正常系）
test("test_run_check_tool", async () => {
  // 準備
  const { runCheckTool } = await loadTools();
  const context = await createContext();
  await writeFiles(context.projectDir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: old",
      "    path: old.md",
      "    title: Old",
      "",
    ].join("\n"),
  });
  // 実行
  const result = await runCheckTool({}, context);
  // 検証
  const issues = result.json?.issues as { kind: string }[];
  expect(issues.filter((issue) => issue.kind === "missing_doc")).toHaveLength(
    1,
  );
});

// `base` から片方だけが変わった change_together の組を返す（正常系）
test("test_run_check_tool_when_base_given", async () => {
  // 準備
  const { runCheckTool } = await loadTools();
  const context = await createContext();
  await setUpChangeTogetherRepository(context.projectDir);
  // 実行
  const result = await runCheckTool({ base: BASE_TAG }, context);
  // 検証
  expect(result.json?.issues).toMatchObject([
    { file: "b.md", where: "", kind: "missed_change_together" },
  ]);
  expect(result.json?.issues).toHaveLength(1);
});

// 引けない `base` は CliError にする（異常系）
test("test_run_check_tool_when_base_unknown", async () => {
  // 準備
  const { runCheckTool } = await loadTools();
  const { runCheck } = await import("../../../../src/cli/check.ts");
  const { CliError } = await loadErrors();
  const context = await createContext();
  await setUpChangeTogetherRepository(context.projectDir);
  // `mdmark check --base no-such-ref` が標準エラーに出す文
  const cli = await runCheck(
    { base: "no-such-ref" },
    { cwd: context.projectDir, stdout: () => {}, stderr: () => {} },
  ).catch((caught: unknown) => caught);
  // 実行・検証
  const error = await runCheckTool({ base: "no-such-ref" }, context).catch(
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toBe((cli as Error).message);
});

// 既定では Markdown の表を返す（正常系）
test("test_run_find_docs", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const context = await createContext();
  await writeIndexProject(context.projectDir);
  // 実行
  const result = await runFindDocs({}, context);
  // 検証
  expect(result.texts).toHaveLength(1);
  const firstLine = result.texts?.[0]?.split("\n")[0] ?? "";
  expect(firstLine).toContain("総件数 1 件・返した件数 1 件");
  expect(result.structured).toBeUndefined();
});

// `format: json` で既定の項目の行と省いた項目を返す（正常系）
test("test_run_find_docs_when_json", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const context = await createContext();
  await writeIndexProject(context.projectDir);
  const body = await readFile(join(context.projectDir, "a.md"), "utf8");
  // 実行
  const result = await runFindDocs({ format: "json" }, context);
  // 検証
  expect(result.structured?.docs).toEqual([
    {
      id: "a",
      title: "A",
      description: null,
      tags: [],
      chars: [...body].length,
    },
  ]);
  expect(result.structured?.omitted).toHaveLength(4);
  expect(result.structured?.next_cursor).toBeNull();
  expect(result.structured?.hint).toBeNull();
});

// 参照の表を作って関係する文書を返す（正常系）
test("test_run_find_docs_when_related_to", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const context = await createContext();
  await writeFiles(context.projectDir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    related: [b]",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "  - id: c",
      "    path: c.md",
      "    title: C",
      "  - id: d",
      "    path: d.md",
      "    title: D",
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "b.md": "# B\n",
    "c.md": "# C\n\n[A](a.md)\n",
    "d.md": "# D\n",
  });
  // 実行
  const result = await runFindDocs(
    { related_to: "a", format: "json" },
    context,
  );
  // 検証
  const docs = (result.structured?.docs ?? []) as {
    id: string;
    relations: unknown;
  }[];
  expect(docs.map((doc) => doc.id)).toEqual(["b", "c"]);
  expect(docs[0]?.relations).toEqual([
    { direction: "outgoing", type: null, when: null },
  ]);
  expect(docs[1]?.relations).toEqual([
    { direction: "incoming", type: null, when: null },
  ]);
});

// `limit` 件ずつ返し、`next_cursor` で続きを返す（正常系）
test("test_run_find_docs_when_paged", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const { FIND_DOCS_HINT } = await loadResults();
  const context = await createContext();
  await writeDocsProject(context.projectDir, {
    docs: [{ id: "a" }, { id: "b" }, { id: "c" }],
  });
  // 実行
  const first = await runFindDocs({ limit: 2, format: "json" }, context);
  const cursor = first.structured?.next_cursor as string;
  const second = await runFindDocs(
    { limit: 2, cursor, format: "json" },
    context,
  );
  // 検証
  expect(first.structured?.docs).toHaveLength(2);
  expect(first.structured?.total).toBe(3);
  expect(first.structured?.hint).toBe(FIND_DOCS_HINT);
  const secondDocs = (second.structured?.docs ?? []) as { id: string }[];
  expect(secondDocs.map((doc) => doc.id)).toEqual(["c"]);
  expect(second.structured?.next_cursor).toBeNull();
});

// 件数だけを返す（正常系）
test("test_run_find_docs_when_count_only", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const context = await createContext();
  await writeDocsProject(context.projectDir, {
    docs: [
      { id: "a", tags: ["設計"] },
      { id: "b", tags: ["設計", "API"] },
    ],
  });
  // 実行
  const result = await runFindDocs(
    { count_only: true, format: "json" },
    context,
  );
  // 検証
  expect(Object.keys(result.structured ?? {}).sort()).toEqual([
    "tag_counts",
    "total",
    "total_chars",
    "warnings",
  ]);
});

// 語彙に無いタグでも拒まず警告を添える（正常系）
test("test_run_find_docs_when_unknown_tag", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const context = await createContext();
  await writeDocsProject(context.projectDir, {
    docs: [{ id: "a", tags: ["topic:mcp"] }],
    tags: ["topic:mcp"],
  });
  // 実行
  const result = await runFindDocs(
    { tags: ["topic:mcq"], format: "json" },
    context,
  );
  // 検証
  expect(result.structured?.total).toBe(0);
  const warnings = (result.structured?.warnings ?? []) as string[];
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("topic:mcq");
  expect(warnings[0]).toContain("topic:mcp");
});

// ファイルの無い文書は文字数を null にして合計に足さない（正常系）
test("test_run_find_docs_when_document_missing", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const context = await createContext();
  await writeDocsProject(context.projectDir, {
    docs: [{ id: "a" }, { id: "b", file: false }],
  });
  // 実行
  const result = await runFindDocs({ format: "json" }, context);
  // 検証
  const docs = (result.structured?.docs ?? []) as {
    id: string;
    chars: number | null;
  }[];
  const a = docs.find((doc) => doc.id === "a");
  const b = docs.find((doc) => doc.id === "b");
  expect(b?.chars).toBeNull();
  expect(result.structured?.total_chars).toBe(a?.chars);
});

// 書き換えて action と索引のパスを返す（正常系）
test("test_run_update_index", async () => {
  // 準備
  const { runUpdateIndex } = await loadTools();
  const context = await createContext();
  await writeIndexProject(context.projectDir);
  // 実行
  const result = await runUpdateIndex(
    { kind: "doc", id: "b", item: { path: "b.md", title: "B" } },
    context,
  );
  // 検証
  expect(result.json).toEqual({ action: "added", index: "index.yaml" });
});

// Schema に合わない関連の項目は書かずに誤りにする（異常系）
test("test_run_update_index_when_related_invalid", async () => {
  // 準備
  const { runUpdateIndex } = await loadTools();
  const { CliError } = await loadErrors();
  const context = await createContext();
  await writeIndexProject(context.projectDir);
  const before = await readFile(join(context.projectDir, "index.yaml"), "utf8");
  // 実行
  const error = await runUpdateIndex(
    {
      kind: "doc",
      id: "b",
      item: {
        path: "b.md",
        title: "B",
        related: [{ to: "a", type: "depends_on", when: "前提を確かめるとき" }],
      },
    },
    context,
  ).catch((caught: unknown) => caught);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("docs[1].related[0].type");
  expect((error as Error).message).toContain("change_together");
  expect(await readFile(join(context.projectDir, "index.yaml"), "utf8")).toBe(
    before,
  );
});

// タグの語彙にタグを追加する（正常系）
test("test_run_update_index_when_tag", async () => {
  // 準備
  const { runUpdateIndex } = await loadTools();
  const context = await createContext();
  await writeIndexProject(context.projectDir);
  // 実行
  const result = await runUpdateIndex(
    { kind: "tag", id: "topic:mcp", item: { group: "topic" } },
    context,
  );
  // 検証
  expect(result.json).toEqual({ action: "added", index: "index.yaml" });
  const written = parse(
    await readFile(join(context.projectDir, "index.yaml"), "utf8"),
  ) as { tags: unknown };
  expect(written.tags).toEqual([{ name: "topic:mcp", group: "topic" }]);
});

// 語彙を文書の数つきで返す（正常系）
test("test_run_list_tags", async () => {
  // 準備
  const { runListTags } = await loadTools();
  const context = await createContext();
  await writeVocabularyProject(context.projectDir);
  // 実行
  const result = await runListTags({ format: "json" }, context);
  // 検証
  const tags = (result.structured?.tags ?? []) as {
    name: string;
    docs: number;
  }[];
  expect(tags.map(({ name, docs }) => ({ name, docs }))).toEqual([
    { name: "topic:mcp", docs: 2 },
    { name: "topic:unused", docs: 0 },
  ]);
});

// 既定では Markdown の表を返す（正常系）
test("test_run_list_tags_when_markdown", async () => {
  // 準備
  const { runListTags } = await loadTools();
  const context = await createContext();
  await writeVocabularyProject(context.projectDir);
  // 実行
  const result = await runListTags({}, context);
  // 検証
  expect(result.texts).toHaveLength(1);
  const firstLine = result.texts?.[0]?.split("\n")[0] ?? "";
  expect(firstLine).toBe(
    "| 名前 | グループ | 説明 | 別名 | 振り替え先 | 文書の数 |",
  );
  expect(result.structured).toBeUndefined();
});
