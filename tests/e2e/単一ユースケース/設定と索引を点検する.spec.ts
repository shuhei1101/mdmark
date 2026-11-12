import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { greetSource, writeSettings } from "../cascade.ts";
import {
  BROKEN_FLOW,
  CLEAN_FLOW,
  createChangeTogetherDir,
  expect,
  flowLines,
  git,
  INCLUDE_MISSING_FILES,
  linesOf,
  runCli,
  test,
  writeFiles,
} from "../cli.ts";
import { groupFlowText, JUDGEMENT_AUTO_TEXT } from "../diagram.ts";

// 雛形が配置する設定の build.out の行
const OUT_LINE = "  out: dist/docs.html\n";

/** ずれの無いフォルダを作る: `mdmark init` の後に文書 2 つを記載し、索引に 2 つとも記載する */
async function createCleanDir(
  builtRoot: string,
  tempDir: () => Promise<string>,
): Promise<string> {
  const dir = await tempDir();
  await runCli(builtRoot, ["init"], dir);
  await writeFiles(dir, {
    "a.md": "# A\n",
    "b.md": "# B\n",
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "",
    ].join("\n"),
  });
  return dir;
}

/** 設定・索引・文書の中身を返却する（変わっていないことを確認する） */
async function snapshot(dir: string): Promise<string[]> {
  return Promise.all(
    ["mdmark.config.yaml", "index.yaml", "a.md", "b.md"].map((path) =>
      readFile(join(dir, path), "utf8"),
    ),
  );
}

// ずれの無いフォルダで、ずれ 0 件を出して終了コード 0 で終わる（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["ずれ 0 件"]);
  expect(await snapshot(dir)).toEqual(before);
});

// 索引と文書のずれと設定の Schema のずれを、ファイル・場所・種類・内容で出す（正常シナリオ（ずれがある））
test("test_normal_when_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": config.replace(OUT_LINE, ""),
    "index.yaml": `${await readFile(join(dir, "index.yaml"), "utf8")}  - id: old\n    path: old.md\n    title: Old\n`,
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  const schema = lines.find((line) =>
    line.startsWith("mdmark.config.yaml:build: schema:"),
  );
  expect(schema).toContain("build.out");
  const missing = lines.find(
    (line) => line.includes("missing_doc") && line.includes("old.md"),
  );
  expect(missing).toMatch(/^index\.yaml:docs\[\d+\]\.path: missing_doc: /);
  // 内容に修正方法が記載されている
  expect(schema).toContain("書いてください");
  expect(missing).toContain("ください");
  expect(await snapshot(dir)).toEqual(before);
});

// 設定ファイルが無いと、mdmark init で配置できることを示して終わる（異常シナリオ（設定ファイルが無い））
test("test_error_when_config_missing", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, { "a.md": "# A\n" });
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("mdmark.config.yaml");
  expect(result.stderr).toContain("mdmark init");
});

// 本文の知らないマーカーを、文書と行を指す unknown_mark の行にして終了コード 0 以外で終わる（正常シナリオ（知らないマーカーがある））
test("test_normal_when_unknown_mark", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  await writeFiles(dir, {
    "a.md": "# A\n\n<!-- tabz -->\n\n段落\n\n```markdown\n<!-- tabz -->\n```\n",
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const marks = linesOf(result.stdout).filter((line) =>
    line.includes("unknown_mark"),
  );
  // コードブロックの中（8 行目）のマーカーは取得せず、段落の間（3 行目）のマーカーだけを指す
  expect(marks).toHaveLength(1);
  expect(marks[0]).toMatch(/^a\.md:3: unknown_mark: /);
  // 内容にマーカーの名前と修正方法が記載されている
  expect(marks[0]).toContain("tabz");
  expect(marks[0]).toContain("ください");
  expect(await snapshot(dir)).toEqual(before);
});

// 基準から片方だけが変わった change_together の組を、修正漏れとして出して終了コード 0 以外で終わる（正常シナリオ（比べる基準を指定する））
test("test_normal_when_base_given", async ({ builtRoot, tempDir }) => {
  // 準備
  const { dir, base } = await createChangeTogetherDir(builtRoot, tempDir);
  const before = await snapshot(dir);
  const head = await git(dir, "rev-parse", "HEAD");
  // 実行
  const result = await runCli(builtRoot, ["check", "--base", base], dir);
  const withoutBase = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  // 変わっていない 2 つ目の文書を指す行が 1 件で、組の相手と変わった 1 つ目の文書が記載されている
  const missed = lines.filter((line) =>
    line.includes("missed_change_together"),
  );
  expect(missed).toHaveLength(1);
  expect(missed[0]).toMatch(/^b\.md: missed_change_together: /);
  expect(missed[0]).toContain("a.md");
  expect(lines.at(-1)).toBe("ずれ 1 件");
  // 比べる基準を指定しなければ、ずれ 0 件
  expect(withoutBase.code).toBe(0);
  expect(linesOf(withoutBase.stdout)).toEqual(["ずれ 0 件"]);
  // 設定・索引・文書と git の履歴が変わっていない
  expect(await snapshot(dir)).toEqual(before);
  expect(await git(dir, "rev-parse", "HEAD")).toBe(head);
});

// リポジトリに無い基準は、参照できないことと修正方法を出して終了コード 0 以外で終わる（異常シナリオ（比べる基準を参照できない））
test("test_error_when_base_unknown", async ({ builtRoot, tempDir }) => {
  // 準備
  const { dir } = await createChangeTogetherDir(builtRoot, tempDir);
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(
    builtRoot,
    ["check", "--base", "no-such-ref"],
    dir,
  );
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("no-such-ref");
  expect(result.stderr).toContain("fetch-depth");
  expect(await snapshot(dir)).toEqual(before);
});

// エイリアスの元の行を 1 行ずつ作る設定の行: 種類は行の `alias_type` に記載する
function aliasRow(
  id: string,
  paths: string,
  aliasType = "term",
  extra: string[] = [],
): string[] {
  return [
    `  - id: ${id}`,
    `    paths: [${paths}]`,
    `    alias_type: ${aliasType}`,
    ...extra,
  ];
}

// エイリアスの行とレコードのずれを、ファイル・場所・種類・内容で出し、正しい行は指さず、終了コード 0 以外で終わる（正常シナリオ（エイリアスにずれがある））
test("test_normal_when_alias_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  const aliasFiles: Record<string, string> = {
    "aliases/valid.yaml": [
      "id: valid-term",
      "name: 正しい用語",
      "description: 説明",
      "",
    ].join("\n"),
    "aliases/broken.yaml": "id: [term\n",
    "aliases/list.yaml": "title: 一覧\n",
    "aliases/refcol.yaml": "id: ref-col\nname: 列が無い\n",
    "aliases/cmd.yaml": [
      "id: build-cmd",
      "name: ビルド",
      "command: ''",
      "",
    ].join("\n"),
    "aliases/dup.yaml": [
      "id: valid-term",
      "name: 重なる用語",
      "description: 説明",
      "",
    ].join("\n"),
  };
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}${[
      "aliases:",
      ...aliasRow("valid", "aliases/valid.yaml"),
      // Schema に合わない行: `alias_type` が 9 つの種類に無い
      ...aliasRow("memo-type", "aliases/valid.yaml", "memo"),
      // Schema に合わない行: `metadata` の値が v0.2.0 の構造
      ...aliasRow("old-metadata", "aliases/valid.yaml", "term", [
        "    metadata:",
        "      name: { type: ref, field: term }",
      ]),
      ...aliasRow("no-files", "missing/*.yaml"),
      ...aliasRow("broken", "aliases/broken.yaml"),
      ...aliasRow("no-records", "aliases/list.yaml", "term", [
        "    records: items",
      ]),
      ...aliasRow("no-column", "aliases/refcol.yaml", "term", [
        "    metadata:",
        "      description: summary",
      ]),
      ...aliasRow("empty-command", "aliases/cmd.yaml", "command"),
      ...aliasRow("valid", "aliases/valid.yaml"),
      ...aliasRow("same-alias-id", "aliases/dup.yaml"),
      "",
    ].join("\n")}`,
    ...aliasFiles,
  });
  const read = async (): Promise<string[]> => [
    ...(await snapshot(dir)),
    ...(await Promise.all(
      Object.keys(aliasFiles).map((path) => readFile(join(dir, path), "utf8")),
    )),
  ];
  const before = await read();
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  // 誤った行ごとに、その行か元のファイルを指すずれの行があり、内容に修正方法がある
  const kinds: Array<[string, string]> = [
    ["mdmark.config.yaml:aliases[1].alias_type", "schema"],
    ["mdmark.config.yaml:aliases[2].metadata.name", "schema"],
    ["mdmark.config.yaml", "alias_no_files"],
    ["aliases/broken.yaml", "alias_unreadable"],
    ["aliases/list.yaml", "alias_records_missing"],
    ["aliases/refcol.yaml", "alias_field_missing"],
    ["aliases/cmd.yaml", "alias_required_empty"],
    ["mdmark.config.yaml", "duplicate_alias_row_id"],
    ["aliases/dup.yaml", "duplicate_alias_id"],
  ];
  for (const [place, kind] of kinds) {
    const line = lines.find(
      (candidate) =>
        candidate.startsWith(place) && candidate.includes(`${kind}:`),
    );
    expect(line, `${place} ${kind}`).toBeDefined();
    expect(line, `${place} ${kind}`).toContain("ください");
  }
  // 正しい行は指さない
  expect(lines.some((line) => line.includes("aliases/valid.yaml"))).toBe(false);
  expect(lines.at(-1)).toBe(`ずれ ${kinds.length} 件`);
  // 設定・索引・文書・エイリアスの元が変わっていない（設定は追記した後の中身）
  const after = await read();
  expect(after).toEqual(before);
});

// 設定のテーマの知らない名前を、そのキーを指すずれの行で出し、選べる名前とテーマを選ばない設定では出さない（正常シナリオ（知らないテーマの名前がある））
test("test_normal_when_unknown_theme", async ({ builtRoot, tempDir }) => {
  // 準備
  const unknownDir = await createCleanDir(builtRoot, tempDir);
  const knownDir = await createCleanDir(builtRoot, tempDir);
  const notSelectedDir = await createCleanDir(builtRoot, tempDir);
  for (const [dir, name] of [
    [unknownDir, "sepia"],
    [knownDir, "theme-slate"],
  ] as const) {
    const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
    await writeFiles(dir, {
      "mdmark.config.yaml": `${config}colorTheme: ${name}\n`,
    });
  }
  const before = await snapshot(unknownDir);
  // 実行
  const unknown = await runCli(builtRoot, ["check"], unknownDir);
  const known = await runCli(builtRoot, ["check"], knownDir);
  const notSelected = await runCli(builtRoot, ["check"], notSelectedDir);
  // 検証
  expect(unknown.code).not.toBe(0);
  const lines = linesOf(unknown.stdout);
  const themeLines = lines.filter((line) =>
    line.startsWith("mdmark.config.yaml:colorTheme: unknown_color_theme:"),
  );
  expect(themeLines).toHaveLength(1);
  for (const text of [
    "sepia",
    "dev-swiss",
    "theme-paper",
    "theme-slate",
    "theme-contrast",
  ]) {
    expect(themeLines[0]).toContain(text);
  }
  expect(await snapshot(unknownDir)).toEqual(before);
  for (const result of [known, notSelected]) {
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("unknown_color_theme");
  }
});

// 設定の明暗の知らない値を、記載できる値を添えたずれにして終了コード 0 以外で終わる（正常シナリオ（知らない明暗の値がある））
test("test_normal_when_unknown_color_scheme", async ({
  builtRoot,
  tempDir,
}) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}colorScheme: sepia\n`,
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const schemeLines = linesOf(result.stdout).filter((line) =>
    line.startsWith("mdmark.config.yaml:colorScheme: unknown_color_scheme:"),
  );
  expect(schemeLines).toHaveLength(1);
  for (const text of ["sepia", "light", "dark", "auto"]) {
    expect(schemeLines[0]).toContain(text);
  }
  expect(await snapshot(dir)).toEqual(before);
});

// 文書からの相対パスにもアセットのルートにも無い画像・動画・音声・添付のファイルを、見つからないファイルのずれにする（正常シナリオ（見つからないファイルがある））
test("test_normal_when_files_missing", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "assets:",
      "  root: assets",
      "build:",
      '  include: ["docs/**/*.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "docs/guide.md": [
      "# ガイド",
      "",
      "![無い画像](images/missing.png)",
      "",
      "![無い動画](media/missing.mp4)",
      "",
      "![無い音声](media/missing.mp3)",
      "",
      "[仕様書](files/missing.pdf)",
      "",
      "![ロゴ](images/logo.png)",
      "",
    ].join("\n"),
    "assets/images/logo.png": "png",
  });
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  for (const [line, path] of [
    [3, "images/missing.png"],
    [5, "media/missing.mp4"],
    [7, "media/missing.mp3"],
    [9, "files/missing.pdf"],
  ] as const) {
    const found = lines.find((text) =>
      text.startsWith(`docs/guide.md:${line}: missing_file:`),
    );
    expect(found, path).toContain(path);
  }
  expect(lines.filter((text) => text.includes(": missing_file:"))).toHaveLength(
    4,
  );
  expect(lines.some((text) => text.includes("images/logo.png"))).toBe(false);
  expect(existsSync(join(dir, "dist"))).toBe(false);
});

// 図の定義の誤りと配置のずれを、図の定義の場所を指す行で出し、終了コード 0 以外で終わる（正常シナリオ（図の定義にずれがある））
test("test_normal_when_diagram_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const duplicated = {
    ...CLEAN_FLOW,
    nodes: [
      { id: "api", kind: "script", x: 20, y: 20, w: 100, h: 60, name: "API" },
      { id: "api", kind: "script", x: 220, y: 20, w: 100, h: 60, name: "API" },
    ],
    wires: [],
  };
  const head = ["# A", "", ...flowLines(duplicated)];
  const a = [
    ...head,
    ...Array.from({ length: 19 - head.length }, () => ""),
    ...flowLines(BROKEN_FLOW),
    "",
  ];
  await writeFiles(dir, {
    "a.md": a.join("\n"),
    "b.md": ["# B", "", ...flowLines(CLEAN_FLOW), ""].join("\n"),
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  // 定義の誤りは 1 行で、重なった id と修正の方法がある
  const invalid = lines.filter((line) => line.startsWith("a.md:3: "));
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toMatch(/^a\.md:3: diagram_invalid: /);
  expect(invalid[0]).toContain("api");
  // 配置のずれは 4 つの種類で 1 行ずつあり、対象の id と修正の方法がある
  const layout = lines.filter((line) => line.startsWith("a.md:20: "));
  expect(layout).toHaveLength(4);
  for (const [kind, ids] of [
    ["diagram_node_overlap", ["web", "db"]],
    ["diagram_node_overflow", ["queue"]],
    ["diagram_wire_crosses_node", ["w1", "cache"]],
    ["diagram_label_too_long", ["batch"]],
  ] as const) {
    const found = layout.filter((line) =>
      line.startsWith(`a.md:20: ${kind}: `),
    );
    expect(found, kind).toHaveLength(1);
    for (const id of ids) {
      expect(found[0]).toContain(id);
    }
    expect(found[0]).toContain("ください");
  }
  // ずれの無い図の文書を指す行が無い
  expect(lines.some((line) => line.startsWith("b.md"))).toBe(false);
  expect(await snapshot(dir)).toEqual(before);
});

// 座標を省いた判定フローチャートを配置の後の座標で点検し、座標を省けない定義だけを定義の誤りにする（正常シナリオ（座標を省いた図の定義））
test("test_normal_when_diagram_auto_layout", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const auto = JSON.parse(JUDGEMENT_AUTO_TEXT) as {
    nodes: Array<Record<string, unknown>>;
  };
  const notJudgement = structuredClone(auto);
  Object.assign(notJudgement.nodes[2] ?? {}, { kind: "llm" });
  const head = ["# A", "", ...flowLines(auto)];
  const a = [
    ...head,
    ...Array.from({ length: 29 - head.length }, () => ""),
    ...flowLines(notJudgement),
    "",
  ];
  await writeFiles(dir, { "a.md": a.join("\n") });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  expect(lines.some((line) => line.startsWith("a.md:3:"))).toBe(false);
  const invalid = lines.filter((line) => line.startsWith("a.md:30: "));
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toMatch(/^a\.md:30: diagram_invalid: /);
  expect(invalid[0]).toContain("llm");
  expect(invalid[0]).toContain("判定フローチャート");
  expect(invalid[0]).toContain("座標を記載するか");
  expect(await snapshot(dir)).toEqual(before);
});

// include のマーカーの取り込み先が無いものを、文書とマーカーの行のずれにする（正常シナリオ（取り込み先が無い））
test("test_normal_when_include_missing", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, INCLUDE_MISSING_FILES);
  const paths = Object.keys(INCLUDE_MISSING_FILES);
  const before = await Promise.all(
    paths.map((path) => readFile(join(dir, path), "utf8")),
  );
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  const issues = lines.filter((line) =>
    line.includes(": include_target_missing: "),
  );
  expect(issues.map((line) => line.split(": ")[0])).toEqual([
    "docs/a.md:3",
    "docs/b.md:2",
    "docs/b.md:4",
  ]);
  expect(issues[0]).toContain("missing.md");
  expect(issues[1]).toContain("無い見出し");
  expect(issues[2]).toContain("5 行");
  for (const issue of issues) {
    expect(issue).toContain("修正してください");
  }
  expect(lines.some((line) => line.startsWith("docs/a.md:5"))).toBe(false);
  expect(
    await Promise.all(paths.map((path) => readFile(join(dir, path), "utf8"))),
  ).toEqual(before);
});

/** 設定ファイルの末尾に行を追記する */
async function appendConfig(dir: string, lines: string[]): Promise<void> {
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}\n${lines.join("\n")}\n`,
  });
}

// 設定の tooltips.diagramPlacement が top・bottom でないとき、その値を指す schema のずれを 1 行出す（正常シナリオ（図のツールチップの位置に誤った値がある））
test("test_normal_when_diagram_placement_invalid", async ({
  builtRoot,
  tempDir,
}) => {
  // 準備
  const invalidDir = await createCleanDir(builtRoot, tempDir);
  await appendConfig(invalidDir, ["tooltips:", "  diagramPlacement: left"]);
  const validDirs = [];
  for (const value of ["top", "bottom", undefined]) {
    const dir = await createCleanDir(builtRoot, tempDir);
    if (value !== undefined) {
      await appendConfig(dir, ["tooltips:", `  diagramPlacement: ${value}`]);
    }
    validDirs.push(dir);
  }
  const before = await snapshot(invalidDir);
  // 実行
  const result = await runCli(builtRoot, ["check"], invalidDir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout).filter((line) =>
    line.startsWith("mdmark.config.yaml:tooltips.diagramPlacement: schema:"),
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("top");
  expect(lines[0]).toContain("bottom");
  expect(await snapshot(invalidDir)).toEqual(before);
  // 実行・検証: top・bottom を記載した設定と、記載しない設定では、このずれの行が出ない
  for (const dir of validDirs) {
    const valid = await runCli(builtRoot, ["check"], dir);
    expect(valid.stdout).not.toContain("tooltips.diagramPlacement");
  }
});

// フロー図の frame.hint が数で stickyTitles が文字のとき、その図を指す定義の誤りの行を 1 つだけ出す（正常シナリオ（グループの項目に誤った値がある））
test("test_normal_when_group_options_invalid", async ({
  builtRoot,
  tempDir,
}) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const definition = JSON.parse(await groupFlowText()) as {
    frame: Record<string, unknown>;
    stickyTitles?: unknown;
  };
  definition.frame = { ...definition.frame, hint: 1 };
  definition.stickyTitles = "no";
  const a = ["# A", "", ...flowLines(definition), ""];
  await writeFiles(dir, { "a.md": a.join("\n") });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const invalid = linesOf(result.stdout).filter((line) =>
    line.startsWith("a.md:3: "),
  );
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toMatch(/^a\.md:3: diagram_invalid: /);
  expect(invalid[0]).toContain("frame.hint");
  expect(invalid[0]).toContain("stickyTitles");
  expect(await snapshot(dir)).toEqual(before);
});

// 端末の設定と上のフォルダの設定のずれを、それぞれのファイルを指して返却する（正常シナリオ（重ねた設定ファイルにずれがある））
test("test_normal_when_cascaded_config_drift", async ({
  builtRoot,
  tempDir,
}) => {
  // 準備
  const dir = await tempDir();
  const files = {
    "mdmark.config.yaml": "side-toc:\n  mode: wide\n",
    "docs/mdmark.config.yaml": "features:\n  table: false\n",
    "docs/guide.md": "# ガイド\n",
  };
  await writeFiles(dir, files);
  const settingsDir = await tempDir();
  const settings = await writeSettings(
    settingsDir,
    "config:\n  cascade: true\nfeatures:\n  callout: maybe\n",
  );
  const before = await Promise.all(
    [settings, ...Object.keys(files).map((file) => join(dir, file))].map(
      (path) => readFile(path, "utf8"),
    ),
  );
  // 実行
  const result = await runCli(builtRoot, ["check"], join(dir, "docs"), "", {
    MDMARK_CONFIG: settings,
  });
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const callout = lines.filter((line) =>
    line.includes("features.callout: schema:"),
  );
  const sideToc = lines.filter((line) =>
    line.includes("side-toc.mode: schema:"),
  );
  expect(callout).toHaveLength(1);
  expect(callout[0]).toContain("settings.yaml");
  expect(sideToc).toHaveLength(1);
  expect(sideToc[0]).toMatch(/^\.\.\/mdmark\.config\.yaml:/);
  const after = await Promise.all(
    [settings, ...Object.keys(files).map((file) => join(dir, file))].map(
      (path) => readFile(path, "utf8"),
    ),
  );
  expect(after).toEqual(before);
});

/** map の範囲の行（印・mermaid のブロック・補足） */
function mapLines(options: {
  args?: string;
  mermaid: string[];
  data?: string;
}): string[] {
  return [
    options.args === undefined
      ? "<!-- map -->"
      : `<!-- map: ${options.args} -->`,
    "",
    "```mermaid",
    ...options.mermaid,
    "```",
    ...(options.data === undefined
      ? []
      : ["", `<!-- map-data: ${options.data} -->`]),
    "",
    "<!-- /map -->",
  ];
}

// 文書の map の補足のずれを、範囲の場所・種類・対象のキーで 1 つずつ出す（正常シナリオ（map の補足にずれがある））
test("test_normal_when_map_data_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const drift = mapLines({
    args: '{"title": "全体", "mdoe": 1}',
    mermaid: ["flowchart LR", "  A[A] --> B[B]"],
    data: '{"version": 1, "notes": {"ghost": {"text": "無い"}}, "layuot": {}, "walkthroughs": [{"text": "a -- b", "nodes": ["A"]}]}',
  });
  const head = ["# A", "", ...drift];
  const a = [
    ...head,
    ...Array.from({ length: 19 - head.length }, () => ""),
    ...mapLines({ mermaid: ["flowchart LR", "  C[C] --> D[D]"] }),
    "",
  ];
  await writeFiles(dir, { "a.md": a.join("\n") });
  const dataLine = a.findIndex((line) => line.startsWith("<!-- map-data")) + 1;
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  const at = (line: number, kind: string) =>
    lines.filter((item) => item.startsWith(`a.md:${line}: ${kind}: `));
  expect(at(dataLine, "map_unknown_ref")).toHaveLength(1);
  expect(at(dataLine, "map_unknown_ref")[0]).toContain("notes.ghost");
  expect(at(dataLine, "map_unknown_key")).toHaveLength(1);
  expect(at(dataLine, "map_unknown_key")[0]).toContain("layuot");
  expect(at(dataLine, "map_invalid_value")).toHaveLength(1);
  expect(at(dataLine, "map_invalid_value")[0]).toContain(
    "walkthroughs[0].text",
  );
  const mark = at(3, "map_unknown_key");
  expect(mark).toHaveLength(1);
  expect(mark[0]).toContain("mdoe");
  expect(lines.some((line) => line.startsWith("a.md:20:"))).toBe(false);
  expect(await snapshot(dir)).toEqual(before);
});

// 文書の今の書き方のマーカーを、ファイルと行を指す今の書き方のマーカーの種類の行にする（正常シナリオ（今の書き方のマーカーがある））
test("test_normal_when_legacy_mark", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  await appendConfig(dir, ["extensions: [extensions/greet.js]"]);
  await writeFiles(dir, {
    "extensions/greet.js": greetSource(),
    "a.md": [
      "# A",
      "",
      "<!-- table: data filter=名前 -->",
      "",
      "| 名前 |",
      "| --- |",
      "| a |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
    "b.md": [
      "<!-- section: closed -->",
      "",
      "# B",
      "",
      "<!-- greet: 太郎 -->",
      "",
    ].join("\n"),
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  for (const head of [
    "a.md:3: legacy_mark:",
    "b.md:1: legacy_mark:",
    "b.md:5: legacy_mark:",
  ]) {
    const found = lines.filter((line) => line.startsWith(head));
    expect(found, head).toHaveLength(1);
    expect(found[0]).toContain("JSON のオブジェクト");
    expect(found[0]).toContain("mdmark upgrade");
  }
  expect(lines.find((line) => line.startsWith("b.md:5:"))).toContain(
    "描くときに描きません",
  );
  expect(await snapshot(dir)).toEqual(before);
});

// 文書のマーカーの知らないキー・型の誤り・削除した機能の列の設定を、ファイルと行を指す行にする（正常シナリオ（マーカーの設定にずれがある））
test("test_normal_when_mark_options_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  await writeFiles(dir, {
    "a.md": [
      '<!-- code: {"title": "app.ts", "color": "red"} -->',
      "```ts",
      "const a = 1;",
      "```",
      '<!-- section: {"open": "no"} -->',
      "",
      "# A",
      "",
      '<!-- table: {"features": {"total": {"enabled": false}}, "columns": {"数量": {"total": [{"calc": "sum"}]}}} -->',
      "",
      "| 名前 | 数量 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(builtRoot, ["check"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  const lines = linesOf(result.stdout);
  const unknown = lines.filter((line) =>
    line.startsWith("a.md:1: unknown_mark_arg:"),
  );
  expect(unknown).toHaveLength(1);
  expect(unknown[0]).toContain("color");
  expect(unknown[0]).toContain("title");
  const invalid = lines.filter((line) =>
    line.startsWith("a.md:5: mark_option_invalid:"),
  );
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toContain("open");
  expect(invalid[0]).toContain("true");
  const unapplied = lines.filter((line) =>
    line.startsWith("a.md:9: mark_option_unapplied:"),
  );
  expect(unapplied).toHaveLength(1);
  expect(unapplied[0]).toContain("columns.数量.total");
  expect(await snapshot(dir)).toEqual(before);
});
