import { expect, test, vi } from "vitest";
import type { ToolDefinition } from "../../../../src/plugin/tools.ts";
import { useTempDirs, writeDist, writeFiles } from "../../helpers/cli.ts";

/** ツールの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTools = () => import("../../../../src/plugin/tools.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const createTempDir = useTempDirs();

/** ツールの結果のテキストを並べる */
function textsOf(result: { content: unknown[] }): string[] {
  return (result.content as { type: string; text: string }[]).map(
    (item) => item.text,
  );
}

/** 引数を持たないツールを作る（`run` はテストごとに渡す） */
function createTool(run: ToolDefinition["run"]): ToolDefinition {
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
  };
}

/** 作業のフォルダとプラグインのフォルダを一時フォルダに作る */
async function createContext(): Promise<{
  projectDir: string;
  pluginDir: string;
}> {
  return {
    projectDir: await createTempDir(),
    pluginDir: await createTempDir(),
  };
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

// json を 1 つのテキストにする（正常系）
test("test_call_tool", async () => {
  // 準備
  const { callTool } = await loadTools();
  const tool = createTool(async () => ({ json: { out: "/a.html" } }));
  const context = await createContext();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    context,
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
  const context = await createContext();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    context,
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
  const context = await createContext();
  // 実行
  const result = await callTool({
    tool,
    args: {},
    context,
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
  const context = await createContext();
  const stderr: string[] = [];
  // 実行
  const result = await callTool({
    tool,
    args: {},
    context,
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(textsOf(result)).toEqual(["直し方の文"]);
  expect(stderr).toEqual([]);
});

// 想定しない例外は標準エラーに書いて返す（正常系）
test("test_call_tool_when_unexpected_error", async () => {
  // 準備
  const { callTool } = await loadTools();
  const tool = createTool(async () => {
    throw new Error("boom");
  });
  const context = await createContext();
  const stderr: string[] = [];
  // 実行
  const result = await callTool({
    tool,
    args: {},
    context,
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
  await writeFiles(context.pluginDir, {
    "guide/index.json": JSON.stringify({
      schema: 1,
      guides: [entry("a"), entry("b")],
    }),
    "guide/docs/a.md": "# ページ A\n",
    "guide/docs/b.md": "# ページ B\n",
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
  await writeDist(context.pluginDir);
  // 実行
  const result = await runExportHtml({ file: "guide.md" }, context);
  // 検証
  expect(result.json?.out).toBe(`${context.projectDir}/guide.html`);
  expect(result.json?.warnings).toEqual([]);
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
  await writeDist(context.pluginDir);
  // 実行
  const result = await runBuildSite({}, context);
  // 検証
  expect(result.json?.out).toBe(`${context.projectDir}/dist/docs.html`);
  expect(result.json?.docs).toBe(2);
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

// 当たった文書を決めたキーで返す（正常系）
test("test_run_find_docs", async () => {
  // 準備
  const { runFindDocs } = await loadTools();
  const context = await createContext();
  await writeIndexProject(context.projectDir);
  // 実行
  const result = await runFindDocs({}, context);
  // 検証
  expect(result.json?.docs).toEqual([
    { id: "a", path: "a.md", title: "A", description: null, tags: [] },
  ]);
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
  const result = await runFindDocs({ related_to: "a" }, context);
  // 検証
  const docs = (result.json?.docs ?? []) as { id: string }[];
  const ids = docs.map((doc) => doc.id);
  expect(ids).toEqual(["b", "c"]);
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
