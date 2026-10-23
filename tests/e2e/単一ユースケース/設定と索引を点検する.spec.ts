import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, linesOf, runCli, test, writeFiles } from "../cli.ts";

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
