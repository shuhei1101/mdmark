import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { linesOf, runCli, useTempDirs, writeFiles } from "../cli.ts";

const createTempDir = useTempDirs();

// 雛形が置く設定の build.out の行
const OUT_LINE = "  out: dist/docs.html\n";

/** ずれの無いフォルダを作る: `mdmark init` の雛形に文書 2 つを足し、索引に 2 つとも載せる */
async function createCleanDir(): Promise<string> {
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
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

/** フォルダの設定・索引・文書の中身を返す（変わっていないことを確かめる） */
async function snapshot(dir: string): Promise<string[]> {
  return Promise.all(
    ["mdmark.config.yaml", "index.yaml", "a.md", "b.md"].map((path) =>
      readFile(join(dir, path), "utf8"),
    ),
  );
}

// ずれの無いフォルダで 0 件を返す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createCleanDir();
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["ずれ 0 件"]);
  expect(await snapshot(dir)).toEqual(before);
});

// 索引と文書のずれと設定の Schema のずれを出し、終了コード 1 で終わる（正常系（ずれがある））
test("test_normal_when_drift", async () => {
  // 準備
  const dir = await createCleanDir();
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": config.replace(OUT_LINE, ""),
    "index.yaml": `${await readFile(join(dir, "index.yaml"), "utf8")}  - id: old\n    path: old.md\n    title: Old\n`,
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(
    lines.some(
      (line) =>
        line.startsWith("mdmark.config.yaml:build: schema:") &&
        line.includes("build.out"),
    ),
  ).toBe(true);
  expect(
    lines.some(
      (line) => line.includes("missing_doc") && line.includes("old.md"),
    ),
  ).toBe(true);
  expect(lines.at(-1)).toBe("ずれ 2 件");
  expect(await snapshot(dir)).toEqual(before);
});

// build.include がどの文書にも当たらないと no_documents を出す（正常系（build の対象が 0 件））
test("test_normal_when_no_documents", async () => {
  // 準備
  const dir = await createCleanDir();
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": config.replace(
      'include: ["**/*.md"]',
      'include: ["nothing/**/*.md"]',
    ),
  });
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(
    linesOf(result.stdout).some((line) =>
      line.startsWith("mdmark.config.yaml:build.include: no_documents:"),
    ),
  ).toBe(true);
});

// 設定ファイルが見つからないと、mdmark init で置けることを示して終わる（異常系（設定ファイルが無い））
test("test_error_when_config_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, { "a.md": "# A\n" });
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("mdmark.config.yaml");
  expect(result.stderr).toContain("mdmark init");
});

// YAML として読めない設定ファイルは、読めない行を示して終わる（異常系（設定ファイルを読めない））
test("test_error_when_config_unreadable", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n table: false\n",
  });
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("mdmark.config.yaml");
  expect(result.stderr).toContain("3 行目");
});
