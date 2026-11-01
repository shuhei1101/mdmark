import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import type { ToolDefinition } from "../../../../src/plugin/tools.ts";
import { useTempDirs, writeDist, writeFiles } from "../../helpers/cli.ts";
import { BASE_TAG, setUpChangeTogetherRepository } from "../../helpers/git.ts";

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
