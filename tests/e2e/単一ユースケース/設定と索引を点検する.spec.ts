import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createChangeTogetherDir,
  expect,
  git,
  linesOf,
  runCli,
  test,
  writeFiles,
} from "../cli.ts";

// 雛形が置く設定の build.out の行
const OUT_LINE = "  out: dist/docs.html\n";

/** ずれの無いフォルダを作る: `mdmark init` の後に文書 2 つを書き、索引に 2 つとも載せる */
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
      "schema: 1",
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

/** 設定・索引・文書の中身を返す（変わっていないことを確かめる） */
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
  // 内容に直し方が書かれている
  expect(schema).toContain("書いてください");
  expect(missing).toContain("ください");
  expect(await snapshot(dir)).toEqual(before);
});

// 設定ファイルが無いと、mdmark init で置けることを示して終わる（異常シナリオ（設定ファイルが無い））
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

// 本文の知らない印を、文書と行を指す unknown_mark の行にして終了コード 0 以外で終わる（正常シナリオ（知らない印がある））
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
  // コードブロックの中（8 行目）の印は拾わず、段落の間（3 行目）の印だけを指す
  expect(marks).toHaveLength(1);
  expect(marks[0]).toMatch(/^a\.md:3: unknown_mark: /);
  // 内容に印の名前と直し方が書かれている
  expect(marks[0]).toContain("tabz");
  expect(marks[0]).toContain("ください");
  expect(await snapshot(dir)).toEqual(before);
});

// 基準から片方だけが変わった change_together の組を、直し忘れとして出して終了コード 0 以外で終わる（正常シナリオ（比べる基準を渡す））
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
  // 変わっていない 2 つ目の文書を指す行が 1 件で、組の相手と変わった 1 つ目の文書が書かれている
  const missed = lines.filter((line) =>
    line.includes("missed_change_together"),
  );
  expect(missed).toHaveLength(1);
  expect(missed[0]).toMatch(/^b\.md: missed_change_together: /);
  expect(missed[0]).toContain("a.md");
  expect(lines.at(-1)).toBe("ずれ 1 件");
  // 比べる基準を渡さなければ、ずれ 0 件
  expect(withoutBase.code).toBe(0);
  expect(linesOf(withoutBase.stdout)).toEqual(["ずれ 0 件"]);
  // 設定・索引・文書と git の履歴が変わっていない
  expect(await snapshot(dir)).toEqual(before);
  expect(await git(dir, "rev-parse", "HEAD")).toBe(head);
});

// リポジトリに無い基準は、引けないことと直し方を出して終了コード 0 以外で終わる（異常シナリオ（比べる基準を引けない））
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

// エイリアスの元の行を 1 行ずつ作る設定の行: `metadata` は `alias_type` を列から取る
function aliasRow(id: string, paths: string, extra: string[] = []): string[] {
  return [
    `  - id: ${id}`,
    `    paths: [${paths}]`,
    ...extra,
    "    metadata:",
    "      alias_type: { type: ref, field: alias_type }",
  ];
}

// エイリアスの行とレコードのずれを、ファイル・場所・種類・内容で出し、正しい行は指さず、終了コード 0 以外で終わる（正常シナリオ（エイリアスにずれがある））
test("test_normal_when_alias_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createCleanDir(builtRoot, tempDir);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  const aliasFiles: Record<string, string> = {
    "aliases/valid.yaml": [
      "alias_type: term",
      "id: valid-term",
      "name: 正しい用語",
      "description: 説明",
      "",
    ].join("\n"),
    "aliases/broken.yaml": "alias_type: [term\n",
    "aliases/list.yaml": "title: 一覧\n",
    "aliases/refcol.yaml": "id: ref-col\nname: 列が無い\n",
    "aliases/cmd.yaml": [
      "alias_type: command",
      "id: build-cmd",
      "name: ビルド",
      "command: ''",
      "",
    ].join("\n"),
    "aliases/types.yaml": [
      "records:",
      "  - alias_type: memo",
      "    id: memo-1",
      "    name: メモ",
      "",
    ].join("\n"),
    "aliases/dup.yaml": [
      "alias_type: term",
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
      // Schema に合わない行: `paths` が無い
      "  - id: no-paths",
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
      ...aliasRow("no-files", "missing/*.yaml"),
      ...aliasRow("broken", "aliases/broken.yaml"),
      ...aliasRow("no-records", "aliases/list.yaml", ["    records: items"]),
      ...aliasRow("no-column", "aliases/refcol.yaml").slice(0, 2),
      "    metadata:",
      "      alias_type: { type: ref, field: kind }",
      ...aliasRow("empty-command", "aliases/cmd.yaml"),
      ...aliasRow("unknown-type", "aliases/types.yaml", [
        "    records: records",
      ]),
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
  // 誤った行ごとに、その行か元のファイルを指すずれの行があり、内容に直し方がある
  const kinds: Array<[string, string]> = [
    ["mdmark.config.yaml", "schema"],
    ["mdmark.config.yaml", "alias_no_files"],
    ["aliases/broken.yaml", "alias_unreadable"],
    ["aliases/list.yaml", "alias_records_missing"],
    ["aliases/refcol.yaml", "alias_field_missing"],
    ["aliases/cmd.yaml", "alias_required_empty"],
    ["aliases/types.yaml", "alias_unknown_type"],
    ["mdmark.config.yaml", "duplicate_alias_row_id"],
    ["aliases/dup.yaml", "duplicate_alias_id"],
  ];
  for (const [file, kind] of kinds) {
    const line = lines.find(
      (candidate) =>
        candidate.startsWith(file) && candidate.includes(`${kind}:`),
    );
    expect(line, `${file} ${kind}`).toBeDefined();
    expect(line, `${file} ${kind}`).toContain("ください");
  }
  // 正しい行は指さない
  expect(lines.some((line) => line.includes("aliases/valid.yaml"))).toBe(false);
  expect(lines.at(-1)).toBe(`ずれ ${kinds.length} 件`);
  // 設定・索引・文書・エイリアスの元が変わっていない（設定は書き足した後の中身）
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
