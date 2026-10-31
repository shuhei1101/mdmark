import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  BASE_TAG,
  createChangeTogetherDir,
  git,
  linesOf,
  runCli,
  useTempDirs,
  writeFiles,
} from "../cli.ts";

const createTempDir = useTempDirs();

// 雛形が置く設定の build.out の行
const OUT_LINE = "  out: dist/docs.html\n";

/** ずれの無いフォルダを作る: `mdmark init` の雛形に文書 2 つを足し、索引に 2 つとも載せる */
async function createCleanDir(options?: { js?: boolean }): Promise<string> {
  const dir = await createTempDir();
  await runCli(["init", dir, ...(options?.js ? ["--js"] : [])], dir);
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

/** 設定ファイルの末尾に、キーを足す */
async function appendConfig(dir: string, lines: string[]): Promise<void> {
  const path = join(dir, "mdmark.config.yaml");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${await readFile(path, "utf8")}\n${lines.join("\n")}\n`,
  });
}

// 文書の本文の知らない印を、文書と行を指す unknown_mark の行にして終了コード 1 で終わる（正常系（知らない印がある））
test("test_normal_when_unknown_mark", async () => {
  // 準備
  const dir = await createCleanDir();
  await writeFiles(dir, {
    "a.md": "# A\n\n<!-- tabz -->\n\n```markdown\n<!-- tabz -->\n```\n",
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const marks = lines.filter((line) => line.includes("unknown_mark"));
  expect(marks).toHaveLength(1);
  expect(marks[0]).toMatch(/^a\.md:3: unknown_mark: .*tabz/);
  expect(lines.at(-1)).toBe("ずれ 1 件");
  expect(await snapshot(dir)).toEqual(before);
});

// 拡張が登録した印と check.ignore に書いた名前の印は、ずれにしない（正常系（拡張と check.ignore の印））
test("test_normal_when_known_extension_and_ignored_mark", async () => {
  // 準備
  const dir = await createCleanDir({ js: true });
  await appendConfig(dir, [
    "extensions: [extensions/example.js]",
    "check:",
    "  ignore: [prettier-ignore]",
  ]);
  await writeFiles(dir, {
    "a.md": "# A\n\n<!-- greet: 太郎 -->\n\n<!-- prettier-ignore -->\n",
  });
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["ずれ 0 件"]);
});

// 読み込めない拡張を schema のずれにし、その拡張の印を知らない印として出す（正常系（拡張を読み込めない））
test("test_normal_when_extension_unloadable", async () => {
  // 準備
  const dir = await createCleanDir();
  await appendConfig(dir, ["extensions: [extensions/broken.js]"]);
  await writeFiles(dir, {
    "extensions/broken.js": [
      "class Broken extends HTMLElement {}",
      'customElements.define("x-broken", Broken);',
      'export default { name: "broken", directive: "broken", load: async () => ({}) };',
      "",
    ].join("\n"),
    "a.md": "# A\n\n<!-- broken -->\n",
  });
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(
    lines.some(
      (line) =>
        line.startsWith("mdmark.config.yaml:extensions[0]: schema:") &&
        line.includes("HTMLElement") &&
        line.includes("load"),
    ),
  ).toBe(true);
  expect(
    lines.some(
      (line) =>
        line.startsWith("a.md:3: unknown_mark:") && line.includes("broken"),
    ),
  ).toBe(true);
});

// --base との merge-base から片方だけが変わった change_together の組を出し、終了コード 1 で終わる（正常系（比べる基準を渡す））
test("test_normal_when_base_given", async () => {
  // 準備
  const dir = await createChangeTogetherDir(createTempDir);
  const before = await snapshot(dir);
  const head = await git(dir, "rev-parse", "HEAD");
  // 実行
  const result = await runCli(["check", "--base", BASE_TAG], dir);
  const withoutBase = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(
    lines.some(
      (line) =>
        line.startsWith("b.md: missed_change_together:") &&
        line.includes("a.md"),
    ),
  ).toBe(true);
  expect(lines.at(-1)).toBe("ずれ 1 件");
  expect(withoutBase.code).toBe(0);
  expect(linesOf(withoutBase.stdout)).toEqual(["ずれ 0 件"]);
  expect(await snapshot(dir)).toEqual(before);
  expect(await git(dir, "rev-parse", "HEAD")).toBe(head);
});

// merge-base を引けない --base は、引けないことと直し方を示して終わる（異常系（比べる基準を引けない））
test("test_error_when_base_unknown", async () => {
  // 準備
  const dir = await createChangeTogetherDir(createTempDir);
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(["check", "--base", "no-such-ref"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("no-such-ref");
  expect(result.stderr).toContain("fetch-depth");
  expect(await snapshot(dir)).toEqual(before);
});

// エイリアスの行とレコードのずれを出し、終了コード 1 で終わる（正常系（エイリアスにずれがある））
test("test_normal_when_alias_drift", async () => {
  // 準備
  const dir = await createCleanDir();
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}${[
      "aliases:",
      "  - id: records",
      "    paths: [aliases/*.yaml]",
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
      "  - id: missing",
      "    paths: [missing/*.yaml]",
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
      "",
    ].join("\n")}`,
    "aliases/term.yaml": [
      "alias_type: term",
      "id: empty-term",
      "name: 空の用語",
      "description: ''",
      "",
    ].join("\n"),
    "aliases/env.yaml": [
      "alias_type: env",
      "id: dev-server",
      "name: 開発サーバー",
      "url: http://127.0.0.1:8767/",
      "",
    ].join("\n"),
  });
  const before = [
    ...(await snapshot(dir)),
    await readFile(join(dir, "aliases/term.yaml"), "utf8"),
    await readFile(join(dir, "aliases/env.yaml"), "utf8"),
  ];
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(
    lines.some(
      (line) =>
        line.includes("alias_no_files") && line.includes("missing/*.yaml"),
    ),
  ).toBe(true);
  expect(
    lines.some((line) =>
      line.startsWith("aliases/term.yaml:description: alias_required_empty"),
    ),
  ).toBe(true);
  expect(lines.some((line) => line.includes("aliases/env.yaml"))).toBe(false);
  expect(lines.at(-1)).toBe("ずれ 2 件");
  expect([
    ...(await snapshot(dir)),
    await readFile(join(dir, "aliases/term.yaml"), "utf8"),
    await readFile(join(dir, "aliases/env.yaml"), "utf8"),
  ]).toEqual(before);
});

// 設定の colorTheme の知らない名前を unknown_color_theme のずれで出し、選べる名前では出さない（正常系（知らないテーマの名前がある））
test("test_normal_when_unknown_color_theme", async () => {
  // 準備
  const unknownDir = await createCleanDir();
  const knownDir = await createCleanDir();
  for (const [dir, name] of [
    [unknownDir, "sepia"],
    [knownDir, "theme-slate"],
  ] as const) {
    const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
    await writeFiles(dir, {
      "mdmark.config.yaml": `${config}colorTheme: ${name}\n`,
    });
  }
  const unknownBefore = await snapshot(unknownDir);
  // 実行
  const unknown = await runCli(["check"], unknownDir);
  const known = await runCli(["check"], knownDir);
  // 検証
  expect(unknown.code).toBe(1);
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
  expect(lines.at(-1)).toBe("ずれ 1 件");
  expect(known.code).toBe(0);
  expect(known.stdout).not.toContain("unknown_color_theme");
  expect(await snapshot(unknownDir)).toEqual(unknownBefore);
});
