import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { LoadedConfig } from "../../../../src/cli/config.ts";
import {
  CLEAN_INDEX,
  createIo,
  useTempDirs,
  writeFiles,
} from "../../helpers/cli.ts";
import { INQUIRY_TEXT, wrapDirective } from "../../helpers/diagrams.ts";
import { BASE_TAG, setUpChangeTogetherRepository } from "../../helpers/git.ts";

/** 点検の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/cli/check.ts");

const createTempDir = useTempDirs();

/** build の設定を `lines` で書き換えられる、ずれの無いフォルダを作る */
async function createCleanDir(options?: {
  buildLines?: string[];
  extraDocs?: string;
}): Promise<string> {
  const dir = await createTempDir();
  const buildLines = options?.buildLines ?? [
    '  include: ["docs/*.md"]',
    "  out: dist/docs.html",
  ];
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: docs/index.yaml",
      "build:",
      ...buildLines,
      "",
    ].join("\n"),
    "docs/index.yaml": options?.extraDocs
      ? `${CLEAN_INDEX}${options.extraDocs}`
      : CLEAN_INDEX,
    "docs/a.md": "# A\n",
    "docs/b.md": "# B\n",
  });
  return dir;
}

// ずれの無いフォルダで 0 件（正常系）
test("test_run_check", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir();
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual(["ずれ 0 件"]);
});

// 設定の schema と索引の missing_doc をこの順に出す（正常系）
test("test_run_check_when_drift", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: ['  include: ["docs/*.md"]'],
    extraDocs: "  - id: old\n    path: old.md\n    title: Old\n",
  });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(1);
  expect(stdout).toHaveLength(3);
  expect(stdout[0]).toMatch(/^mdmark\.config\.yaml:build: schema: /);
  expect(stdout[0]).toContain("build.out");
  expect(stdout[1]).toMatch(
    /^docs\/index\.yaml:docs\[2\]\.path: missing_doc: /,
  );
  expect(stdout[1]).toContain("old.md");
  expect(stdout[2]).toBe("ずれ 2 件");
});

// build の対象が 0 件なら no_documents（正常系）
test("test_run_check_when_no_documents", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: ['  include: ["nothing/**/*.md"]', "  out: dist/docs.html"],
  });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(1);
  expect(
    stdout.some((line) =>
      line.startsWith("mdmark.config.yaml:build.include: no_documents:"),
    ),
  ).toBe(true);
});

// まとめる文書に当たらない build.entry を schema のずれにする（正常系）
test("test_run_check_when_entry_outside", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: [
      '  include: ["docs/*.md"]',
      "  entry: missing.md",
      "  out: dist/docs.html",
    ],
  });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(1);
  expect(
    stdout.some((line) =>
      line.startsWith("mdmark.config.yaml:build.entry: schema:"),
    ),
  ).toBe(true);
});

// 設定の schema と索引の missing_doc をこの順に返す（正常系）
test("test_collect_check_issues", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: ['  include: ["docs/*.md"]'],
    extraDocs: "  - id: old\n    path: old.md\n    title: Old\n",
  });
  // 実行
  const issues = await collectCheckIssues(join(dir, "mdmark.config.yaml"));
  // 検証
  expect(issues.map((issue) => issue.kind)).toEqual(["schema", "missing_doc"]);
});

/** 設定ファイルのフォルダの直下に索引（`index.yaml`）と文書 `a.md`・`b.md` を置いたフォルダを作る */
async function createRootDir(options?: {
  configLines?: string[];
  aMarkdown?: string;
  extraDocs?: string;
  files?: Record<string, string>;
}): Promise<string> {
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: index.yaml",
      ...(options?.configLines ?? []),
      "",
    ].join("\n"),
    "index.yaml": options?.extraDocs
      ? `${CLEAN_INDEX}${options.extraDocs}`
      : CLEAN_INDEX,
    "a.md": options?.aMarkdown ?? "# A\n",
    "b.md": "# B\n",
    ...options?.files,
  });
  return dir;
}

/** 3 行目に知らない印 `<!-- tabz -->` を持つ文書 */
const TABZ_MARKDOWN = "# A\n\n<!-- tabz -->\n";

/** 読み込みの時点でブラウザの API を使う拡張 */
const BROKEN_EXTENSION = [
  "class Broken extends HTMLElement {}",
  'customElements.define("x-broken", Broken);',
  'export default { name: "broken", directive: "broken", load: async () => ({}) };',
  "",
].join("\n");

/** 設定ファイルのフォルダを `dir` にした読み込み済みの設定を作る */
function createLoaded(
  dir: string,
  config: Record<string, unknown>,
): LoadedConfig {
  return { path: join(dir, "mdmark.config.yaml"), dir, config };
}

// 知っている印に当たらない印だけをずれにする（正常系）
test("test_check_unknown_marks", async () => {
  // 準備
  const { checkUnknownMarks } = await loadCheck();
  const documents = [
    {
      path: "a.md",
      markdown: [
        "<!-- features: toc -->",
        "<!-- table: data -->",
        "<!-- tabz -->",
        "<!-- /table -->",
        "",
      ].join("\n"),
    },
  ];
  // 実行
  const issues = checkUnknownMarks(documents, {}, new Set());
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    file: "a.md",
    where: "3",
    kind: "unknown_mark",
  });
  expect(issues[0]?.message).toContain("tabz");
});

// 対応表・拡張・check.ignore の名前の印はずれにしない（正常系）
test("test_check_unknown_marks_when_known_by_config", async () => {
  // 準備
  const { checkUnknownMarks } = await loadCheck();
  const documents = [
    {
      path: "a.md",
      markdown: [
        "<!-- mermaid -->",
        "<!-- greet: x -->",
        "<!-- prettier-ignore -->",
        "",
      ].join("\n"),
    },
  ];
  const config = {
    libraries: { mermaid: "/mermaid.js" },
    check: { ignore: ["prettier-ignore"] },
  };
  // 実行
  const issues = checkUnknownMarks(documents, config, new Set(["greet"]));
  // 検証
  expect(issues).toEqual([]);
});

// 拡張の既定の書き出しの directive を集める（正常系）
test("test_load_extension_directives", async () => {
  // 準備
  const { loadExtensionDirectives } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "extensions/example.js": await readFile(
      join(import.meta.dirname, "../../../../templates/extensions/example.js"),
      "utf8",
    ),
  });
  const loaded = createLoaded(dir, { extensions: ["extensions/example.js"] });
  // 実行
  const result = await loadExtensionDirectives(loaded, "mdmark.config.yaml");
  // 検証
  expect(result.directives).toEqual(new Set(["greet"]));
  expect(result.issues).toEqual([]);
});

// 読み込みの時点でブラウザの API を使う拡張を schema のずれにする（異常系）
test("test_load_extension_directives_when_browser_api", async () => {
  // 準備
  const { loadExtensionDirectives } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, { "extensions/broken.js": BROKEN_EXTENSION });
  const loaded = createLoaded(dir, { extensions: ["extensions/broken.js"] });
  // 実行
  const result = await loadExtensionDirectives(loaded, "mdmark.config.yaml");
  // 検証
  expect(result.directives.size).toBe(0);
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toMatchObject({
    where: "extensions[0]",
    kind: "schema",
  });
  expect(result.issues[0]?.message).toContain("HTMLElement");
  expect(result.issues[0]?.message).toContain("load");
});

// 既定の書き出しが directive を持たない拡張を schema のずれにする（異常系）
test("test_load_extension_directives_when_no_directive", async () => {
  // 準備
  const { loadExtensionDirectives } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "extensions/x.js": 'export default { name: "x" };\n',
  });
  const loaded = createLoaded(dir, { extensions: ["extensions/x.js"] });
  // 実行
  const result = await loadExtensionDirectives(loaded, "mdmark.config.yaml");
  // 検証
  expect(result.directives.size).toBe(0);
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toMatchObject({
    where: "extensions[0]",
    kind: "schema",
  });
});

// 無いファイルの拡張は束ねずにずれにしない（正常系）
test("test_load_extension_directives_when_file_missing", async () => {
  // 準備
  const { loadExtensionDirectives } = await loadCheck();
  const dir = await createTempDir();
  const loaded = createLoaded(dir, { extensions: ["missing.js"] });
  const failingImport = async (): Promise<unknown> => {
    throw new Error("無いファイルの拡張は読み込まないはずです");
  };
  // 実行
  const result = await loadExtensionDirectives(
    loaded,
    "mdmark.config.yaml",
    failingImport,
  );
  // 検証
  expect(result.directives.size).toBe(0);
  expect(result.issues).toEqual([]);
});

// 索引の文書と build の文書を重なりを除いてパスの順に返す（正常系）
test("test_collect_check_documents", async () => {
  // 準備
  const { collectCheckDocuments } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "docs/index.yaml": CLEAN_INDEX,
    "docs/a.md": "# A\n",
    "docs/b.md": "# B\n",
    "notes/c.md": "# C\n",
  });
  const loaded = createLoaded(dir, {
    index: "docs/index.yaml",
    build: { include: ["docs/b.md", "notes/c.md"], out: "dist/docs.html" },
  });
  // 実行
  const documents = await collectCheckDocuments(loaded);
  // 検証
  expect(documents).toEqual([
    { path: "docs/a.md", markdown: "# A\n" },
    { path: "docs/b.md", markdown: "# B\n" },
    { path: "notes/c.md", markdown: "# C\n" },
  ]);
});

// index も build も無い設定では空（正常系）
test("test_collect_check_documents_when_no_index_and_build", async () => {
  // 準備
  const { collectCheckDocuments } = await loadCheck();
  const dir = await createTempDir();
  const loaded = createLoaded(dir, { version: "v0.3.0" });
  // 実行
  const documents = await collectCheckDocuments(loaded);
  // 検証
  expect(documents).toEqual([]);
});

// 知らない印を checkIndex のずれの後ろに返す（正常系）
test("test_collect_check_issues_when_unknown_mark", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createRootDir({
    aMarkdown: TABZ_MARKDOWN,
    extraDocs: "  - id: old\n    path: old.md\n    title: Old\n",
  });
  // 実行
  const issues = await collectCheckIssues(join(dir, "mdmark.config.yaml"));
  // 検証
  expect(issues.map((issue) => issue.kind)).toEqual([
    "missing_doc",
    "unknown_mark",
  ]);
  expect(issues[1]).toMatchObject({ file: "a.md", where: "3" });
});

// 知らないテーマの名前を schema の後・no_documents の前に返す（正常系）
test("test_collect_check_issues_when_unknown_color_theme", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  // build.out が無いと build ごと落ちて no_documents が出ないため、schema は存在しない拡張で作る
  const buildLines = [
    "extensions: [missing.js]",
    "build:",
    '  include: ["nothing/**/*.md"]',
    "  out: dist/docs.html",
  ];
  const unknownDir = await createRootDir({
    configLines: ["colorTheme: sepia", ...buildLines],
  });
  const knownDir = await createRootDir({
    configLines: ["colorTheme: theme-slate", ...buildLines],
  });
  // 実行
  const unknownIssues = await collectCheckIssues(
    join(unknownDir, "mdmark.config.yaml"),
  );
  const knownIssues = await collectCheckIssues(
    join(knownDir, "mdmark.config.yaml"),
  );
  // 検証
  expect(unknownIssues.map((issue) => issue.kind)).toEqual([
    "schema",
    "unknown_color_theme",
    "no_documents",
  ]);
  expect(unknownIssues[1]).toMatchObject({ where: "colorTheme" });
  for (const text of [
    "sepia",
    "dev-swiss",
    "theme-paper",
    "theme-slate",
    "theme-contrast",
  ]) {
    expect(unknownIssues[1]?.message).toContain(text);
  }
  expect(knownIssues.map((issue) => issue.kind)).toEqual([
    "schema",
    "no_documents",
  ]);
});

// エイリアスのずれを checkIndex の後・unknown_mark の前に置く（正常系）
test("test_collect_check_issues_when_alias_drift", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createRootDir({
    configLines: [
      "aliases:",
      "  - id: missing",
      '    paths: ["missing/*.yaml"]',
      "    alias_type: term",
      "  - id: terms",
      '    paths: ["aliases/term.yaml"]',
      "    alias_type: term",
      "  - id: servers",
      '    paths: ["aliases/env.yaml"]',
      "    alias_type: env",
    ],
    aMarkdown: TABZ_MARKDOWN,
    files: {
      "aliases/term.yaml": "id: empty-term\nname: 空の用語\ndescription: ''\n",
      "aliases/env.yaml":
        "id: dev-server\nname: 開発サーバー\nurl: http://127.0.0.1:8767/\n",
    },
  });
  // 実行
  const issues = await collectCheckIssues(join(dir, "mdmark.config.yaml"));
  // 検証
  expect(issues.map((issue) => issue.kind)).toEqual([
    "alias_no_files",
    "alias_required_empty",
    "unknown_mark",
  ]);
  expect(issues[0]?.where).toBe("aliases[0].paths");
  expect(issues[0]?.message).toContain("missing/*.yaml");
  expect(issues[1]).toMatchObject({
    file: "aliases/term.yaml",
    where: "description",
  });
  // env のレコードを指すずれは無い
  expect(issues.some((issue) => issue.file === "aliases/env.yaml")).toBe(false);
});

// unknownMarks: false では知らない印を返さず、拡張を読み込まない（正常系）
test("test_collect_check_issues_when_unknown_marks_off", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createRootDir({
    configLines: ["extensions: [broken.js]"],
    aMarkdown: TABZ_MARKDOWN,
    files: { "broken.js": BROKEN_EXTENSION },
  });
  // 実行
  const issues = await collectCheckIssues(join(dir, "mdmark.config.yaml"), {
    unknownMarks: false,
  });
  // 検証
  expect(issues).toEqual([]);
});

// 知らない印を文書と行を指す unknown_mark の行にする（正常系）
test("test_run_check_when_unknown_mark", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createRootDir({
    aMarkdown: `${TABZ_MARKDOWN}\n\`\`\`markdown\n<!-- tabz -->\n\`\`\`\n`,
  });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(1);
  expect(
    stdout.filter((line) => line.startsWith("a.md:3: unknown_mark:")),
  ).toHaveLength(1);
  expect(stdout).toHaveLength(2);
  expect(stdout[1]).toBe("ずれ 1 件");
});

// `--base` から片方だけが変わった change_together の組を出す（正常系）
test("test_run_check_when_base_given", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createTempDir();
  await setUpChangeTogetherRepository(dir);
  const withBase = createIo(dir);
  const withoutBase = createIo(dir);
  // 実行
  const codeWithBase = await runCheck({ base: BASE_TAG }, withBase.io);
  const codeWithoutBase = await runCheck({}, withoutBase.io);
  // 検証
  expect(codeWithBase).toBe(1);
  expect(withBase.stdout).toHaveLength(2);
  expect(withBase.stdout[0]).toMatch(/^b\.md: missed_change_together: /);
  expect(withBase.stdout[0]).toContain("a.md");
  expect(withBase.stdout[1]).toBe("ずれ 1 件");
  expect(codeWithoutBase).toBe(0);
  expect(withoutBase.stdout).toEqual(["ずれ 0 件"]);
});

// 引けない `--base` は、ずれを点検せずに止める（異常系）
test("test_run_check_when_base_unknown", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const { CliError } = await import("../../../../src/cli/errors.ts");
  const dir = await createTempDir();
  await setUpChangeTogetherRepository(dir);
  const { io, stdout } = createIo(dir);
  // 実行・検証
  const error = await runCheck({ base: "no-such-ref" }, io).catch(
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("no-such-ref");
  expect(stdout.some((line) => line.startsWith("ずれ"))).toBe(false);
});

// 設定に `index` が無ければ `base` を使わない（正常系）
test("test_collect_check_issues_when_base_without_index", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
  const path = join(dir, "mdmark.config.yaml");
  // 実行
  const withoutBase = await collectCheckIssues(path);
  const withBase = await collectCheckIssues(path, { base: "no-such-ref" });
  // 検証
  expect(withBase).toEqual(withoutBase);
});

// 見つからないファイルを unknown_mark の前に返し、無い assets.root を schema にする（正常系）
test("test_collect_check_issues_when_missing_file", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "assets:",
      "  root: none",
      "build:",
      '  include: ["a.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "a.md": ["# A", "![図](x.png)", "", "<!-- tabz -->", ""].join("\n"),
  });
  // 実行
  const issues = await collectCheckIssues(join(dir, "mdmark.config.yaml"));
  // 検証
  expect(
    issues.map((issue) => ({ kind: issue.kind, where: issue.where })),
  ).toEqual([
    { kind: "schema", where: "assets.root" },
    { kind: "missing_file", where: "2" },
    { kind: "unknown_mark", where: "4" },
  ]);
});

/** 読めないグラフの定義の印（開きが先頭の行） */
const BROKEN_CHART = wrapDirective("chart", '{ "type": "nope" }');

/** 見本の `inquiry` の定義に、題を `受付` にして `chat` のノードに重なるノード `extra` を加えた JSON */
const OVERLAP_FLOW = (() => {
  const definition = JSON.parse(INQUIRY_TEXT) as {
    title: string;
    nodes: Array<Record<string, unknown>>;
  };
  definition.title = "受付";
  definition.nodes.push({
    id: "extra",
    kind: "data",
    x: 1000,
    y: 230,
    w: 80,
    h: 40,
    name: "追加",
  });
  return JSON.stringify(definition, null, 2);
})();

// 図の点検のずれを最後に返し、upgrade の呼び方でも点検する（正常系）
test("test_collect_check_issues_when_diagram", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["docs/*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "docs/a.md": [
      "# A",
      "",
      wrapDirective("flow", "{ broken"),
      "![図](x.png)",
      "",
    ].join("\n"),
  });
  const path = join(dir, "mdmark.config.yaml");
  // 実行
  const checked = await collectCheckIssues(path);
  const upgraded = await collectCheckIssues(path, { unknownMarks: false });
  // 検証
  for (const issues of [checked, upgraded]) {
    const kinds = issues.map((issue) => issue.kind);
    expect(kinds.indexOf("missing_file")).toBeGreaterThanOrEqual(0);
    const diagrams = issues.filter((issue) =>
      issue.kind.startsWith("diagram_"),
    );
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0]).toMatchObject({
      file: "docs/a.md",
      where: "3",
      kind: "diagram_invalid",
    });
    expect(kinds.indexOf("diagram_invalid")).toBeGreaterThan(
      kinds.lastIndexOf("missing_file"),
    );
  }
});

// 読めない定義と配置のずれを返す（正常系）
test("test_check_diagrams", async () => {
  // 準備
  const { checkDiagrams } = await loadCheck();
  const chart = BROKEN_CHART.split("\n").slice(0, -1);
  const markdown = [
    "# A",
    "",
    ...chart,
    wrapDirective("flow", OVERLAP_FLOW),
  ].join("\n");
  const flowLine = markdown.split("\n").indexOf("<!-- flow -->") + 1;
  // 実行
  const issues = checkDiagrams([{ path: "a.md", markdown }]);
  // 検証
  expect(flowLine).toBe(10);
  expect(issues).toHaveLength(2);
  expect(issues[0]).toMatchObject({
    file: "a.md",
    where: "3",
    kind: "diagram_invalid",
  });
  expect(issues[1]).toMatchObject({
    file: "a.md",
    where: "10",
    kind: "diagram_node_overlap",
  });
  for (const word of ["受付", "chat", "extra"]) {
    expect(issues[1]?.message).toContain(word);
  }
});

// 整った図と図の無い文書はずれを返さない（正常系）
test("test_check_diagrams_when_clean", async () => {
  // 準備
  const { checkDiagrams } = await loadCheck();
  const documents = [
    { path: "a.md", markdown: `# A\n\n${wrapDirective("flow", INQUIRY_TEXT)}` },
    { path: "b.md", markdown: "# B\n\n本文\n" },
  ];
  // 実行
  const issues = checkDiagrams(documents);
  // 検証
  expect(issues).toEqual([]);
});

// 問題を種類ごとのずれにする（正常系）
test("test_check_includes", async () => {
  // 準備
  const { checkIncludes } = await loadCheck();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "",
    "共通/手順.md": "## 実行\n\nB\n",
    "app.ts": "1\n2\n3\n",
    "a.md": "<!-- include: b.md -->\n",
    "b.md": "<!-- include: a.md -->\n",
  });
  const markdown = [
    "<!-- include: missing.md -->",
    "",
    "<!-- include: 共通/手順.md#無い見出し -->",
    "",
    "<!-- include: app.ts#L8-L10 -->",
    "",
    "<!-- include: a.md -->",
    "",
    "<!-- include: 共通/手順.md#実行 -->",
    "",
  ].join("\n");
  // 実行
  const issues = await checkIncludes({
    documents: [{ path: "guide.md", markdown }],
    root: dir,
  });
  // 検証
  // 循環は、循環を閉じるマーカーを書いたファイル（`b.md` の 1 行目）で報告する
  expect(issues.map((issue) => [issue.kind, issue.file, issue.where])).toEqual([
    ["include_circular", "b.md", "1"],
    ["include_target_missing", "guide.md", "1"],
    ["include_target_missing", "guide.md", "3"],
    ["include_target_missing", "guide.md", "5"],
  ]);
});

// 文字列の書き方の警告を - の行にして出す（正常系）
test("test_run_check_when_text", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const { WARNINGS_MARKDOWN } = await import("../../helpers/diagrams.ts");
  const dir = await createCleanDir();
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({ text: WARNINGS_MARKDOWN }, io);
  // 検証
  expect(code).toBe(1);
  expect(stdout.map((line) => line.split(": ")[0])).toEqual([
    "-:1",
    "-:20",
    "-:22",
    "ずれ 3 件",
  ]);
  expect(stdout[0]).toMatch(/^-:1: diagram_invalid: /);
  expect(stdout[1]).toMatch(/^-:20: unknown_mark: /);
  expect(stdout[2]).toMatch(/^-:22: syntax_warning: /);
});

// 一緒に渡せない引数を点検せずに止める（異常系）
test("test_run_check_when_arguments_conflict", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const { CliError } = await import("../../../../src/cli/errors.ts");
  const dir = await createCleanDir();
  const { io, stdout } = createIo(dir);
  // 実行
  const withBase = runCheck({ text: "a", base: "main" }, io);
  const withoutKey = runCheck({ file: "records.yaml" }, io);
  // 検証
  await expect(withBase).rejects.toBeInstanceOf(CliError);
  await expect(withBase).rejects.toThrow(/--text[\s\S]*--base/);
  await expect(withoutKey).rejects.toBeInstanceOf(CliError);
  await expect(withoutKey).rejects.toThrow(/--key/);
  expect(stdout).toEqual([]);
});
