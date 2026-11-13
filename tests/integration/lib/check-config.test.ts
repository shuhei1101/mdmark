import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test } from "vitest";
import {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  REPLY_TIME_TEXT,
  WARNINGS_MARKDOWN,
} from "../../unit/helpers/diagrams.ts";
import { shopEr } from "../../unit/helpers/er.ts";
import { plainText } from "../../unit/helpers/html.ts";
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

// 雛形が配置する設定の build.out の行
const OUT_LINE = "  out: dist/docs.html\n";

/** ずれの無いフォルダを作る: `mdmark init` の雛形に文書 2 つを追加し、索引に 2 つとも記載する */
async function createCleanDir(options?: { js?: boolean }): Promise<string> {
  const dir = await createTempDir();
  await runCli(["init", dir, ...(options?.js ? ["--js"] : [])], dir);
  await writeFiles(dir, {
    "a.mark.md": "# A\n",
    "b.mark.md": "# B\n",
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: a.mark.md",
      "    title: A",
      "  - id: b",
      "    path: b.mark.md",
      "    title: B",
      "",
    ].join("\n"),
  });
  return dir;
}

/** フォルダの設定・索引・文書の中身を返却する（変わっていないことを確認する） */
async function snapshot(dir: string): Promise<string[]> {
  return Promise.all(
    ["mdmark.config.yaml", "index.yaml", "a.mark.md", "b.mark.md"].map((path) =>
      readFile(join(dir, path), "utf8"),
    ),
  );
}

// ずれの無いフォルダで 0 件を返却する（正常系）
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

// build.include がどの文書にも該当しないと no_documents を出す（正常系（build の対象が 0 件））
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

// 設定ファイルが見つからないと、mdmark init で配置できることを示して終わる（異常系（設定ファイルが無い））
test("test_error_when_config_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, { "a.mark.md": "# A\n" });
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("mdmark.config.yaml");
  expect(result.stderr).toContain("mdmark init");
});

// YAML として読み込めない設定ファイルは、読み込めない行を示して終わる（異常系（設定ファイルを読み込めない））
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

/** 設定ファイルの末尾に、キーを追加する */
async function appendConfig(dir: string, lines: string[]): Promise<void> {
  const path = join(dir, "mdmark.config.yaml");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${await readFile(path, "utf8")}\n${lines.join("\n")}\n`,
  });
}

// 文書の本文の知らないマーカーを、文書と行を指す unknown_mark の行にして終了コード 1 で終わる（正常系（知らないマーカーがある））
test("test_normal_when_unknown_mark", async () => {
  // 準備
  const dir = await createCleanDir();
  await writeFiles(dir, {
    "a.mark.md": "# A\n\n<!-- tabz -->\n\n```markdown\n<!-- tabz -->\n```\n",
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const marks = lines.filter((line) => line.includes("unknown_mark"));
  expect(marks).toHaveLength(1);
  expect(marks[0]).toMatch(/^a\.mark\.md:3: unknown_mark: .*tabz/);
  expect(lines.at(-1)).toBe("ずれ 1 件");
  expect(await snapshot(dir)).toEqual(before);
});

/** 記法を含む純粋な .md・.mark.md・GFM と Mermaid だけの .md を持ち、check.ignore に prettier-ignore を記載したフォルダを作る */
async function createPlainMarkdownDir(): Promise<string> {
  const dir = await createCleanDir();
  const table = '<!-- table: {"kind": "data"} -->';
  await appendConfig(dir, ["check:", "  ignore: [prettier-ignore]"]);
  await writeFiles(dir, {
    "a.md": [
      "# A",
      "",
      "",
      "",
      table,
      "| a |",
      "| - |",
      "<!-- /table -->",
      table,
      "| b |",
      "| - |",
      "<!-- /table -->",
      "",
    ].join("\n"),
    "b.mark.md": `# B\n\n${table}\n\n| a |\n| - |\n\n<!-- /table -->\n`,
    "c.md": [
      "# C",
      "",
      "<!-- prettier-ignore -->",
      "| a |",
      "| - |",
      "",
      "```mermaid",
      "flowchart TD",
      "  A --> B",
      "```",
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "  - id: b",
      "    path: b.mark.md",
      "    title: B",
      "  - id: c",
      "    path: c.md",
      "    title: C",
      "  - id: a2",
      "    path: a.mark.md",
      "    title: A2",
      "",
    ].join("\n"),
  });
  return dir;
}

// 拡張子が純粋な .md で mdmark の記法を含む文書を、最初の記法の行を指す plain_md_with_marks の行にして終了コード 1 で終わる（正常系（記法を含む純粋な .md がある））
test("test_normal_when_plain_md_has_marks", async () => {
  // 準備
  const dir = await createPlainMarkdownDir();
  const files = [
    "mdmark.config.yaml",
    "index.yaml",
    "a.md",
    "b.mark.md",
    "c.md",
  ];
  const before = await Promise.all(
    files.map((path) => readFile(join(dir, path), "utf8")),
  );
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const plain = lines.filter((line) => line.includes("plain_md_with_marks"));
  expect(plain).toHaveLength(1);
  expect(plain[0]).toMatch(/^a\.md:5: plain_md_with_marks: /);
  expect(plain[0]).toContain("a.mark.md");
  expect(plain[0]).toContain("check.suggestMarkExtension");
  expect(
    lines.some(
      (line) => line.startsWith("b.mark.md") || line.startsWith("c.md"),
    ),
  ).toBe(false);
  expect(lines.at(-1)).toBe("ずれ 1 件");
  expect(
    await Promise.all(files.map((path) => readFile(join(dir, path), "utf8"))),
  ).toEqual(before);
});

// check.suggestMarkExtension が false のときは plain_md_with_marks を出さない（正常系（拡張子の提案を止める））
test("test_normal_when_extension_hint_disabled", async () => {
  // 準備
  const dir = await createPlainMarkdownDir();
  await appendConfig(dir, ["  suggestMarkExtension: false"]);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["ずれ 0 件"]);
});

// 拡張が登録したマーカーと check.ignore に記載した名前のマーカーは、ずれにしない（正常系（拡張と check.ignore のマーカー））
test("test_normal_when_known_extension_and_ignored_mark", async () => {
  // 準備
  const dir = await createCleanDir({ js: true });
  await appendConfig(dir, [
    "extensions: [extensions/example.js]",
    "check:",
    "  ignore: [prettier-ignore]",
  ]);
  await writeFiles(dir, {
    "a.mark.md":
      '# A\n\n<!-- greet: {"name": "太郎"} -->\n\n<!-- prettier-ignore -->\n',
  });
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["ずれ 0 件"]);
});

// 読み込めない拡張を schema のずれにし、その拡張のマーカーを知らないマーカーとして出す（正常系（拡張を読み込めない））
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
    "a.mark.md": "# A\n\n<!-- broken -->\n",
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
        line.startsWith("a.mark.md:3: unknown_mark:") &&
        line.includes("broken"),
    ),
  ).toBe(true);
});

// --base との merge-base から片方だけが変わった change_together の組を出し、終了コード 1 で終わる（正常系（比べる基準を指定する））
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
        line.startsWith("b.mark.md: missed_change_together:") &&
        line.includes("a.mark.md"),
    ),
  ).toBe(true);
  expect(lines.at(-1)).toBe("ずれ 1 件");
  expect(withoutBase.code).toBe(0);
  expect(linesOf(withoutBase.stdout)).toEqual(["ずれ 0 件"]);
  expect(await snapshot(dir)).toEqual(before);
  expect(await git(dir, "rev-parse", "HEAD")).toBe(head);
});

// merge-base を参照できない --base は、参照できないことと修正方法を示して終わる（異常系（比べる基準を参照できない））
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
      "  - id: terms",
      "    paths: [aliases/terms.yaml]",
      "    alias_type: term",
      "  - id: servers",
      "    paths: [aliases/servers.yaml]",
      "    alias_type: env",
      "  - id: missing",
      "    paths: [missing/*.yaml]",
      "    alias_type: term",
      "",
    ].join("\n")}`,
    "aliases/terms.yaml": [
      "id: empty-term",
      "name: 空の用語",
      "description: ''",
      "",
    ].join("\n"),
    "aliases/servers.yaml": [
      "id: dev-server",
      "name: 開発サーバー",
      "url: http://127.0.0.1:8767/",
      "",
    ].join("\n"),
  });
  const before = [
    ...(await snapshot(dir)),
    await readFile(join(dir, "aliases/terms.yaml"), "utf8"),
    await readFile(join(dir, "aliases/servers.yaml"), "utf8"),
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
      line.startsWith("aliases/terms.yaml:description: alias_required_empty"),
    ),
  ).toBe(true);
  expect(lines.some((line) => line.includes("aliases/servers.yaml"))).toBe(
    false,
  );
  expect(lines.at(-1)).toBe("ずれ 2 件");
  expect([
    ...(await snapshot(dir)),
    await readFile(join(dir, "aliases/terms.yaml"), "utf8"),
    await readFile(join(dir, "aliases/servers.yaml"), "utf8"),
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

// 設定の colorScheme の知らない値を unknown_color_scheme のずれで出し、記載できる値では出さない（正常系（知らない明暗の値がある））
test("test_normal_when_unknown_color_scheme", async () => {
  // 準備
  const unknownDir = await createCleanDir();
  const knownDir = await createCleanDir();
  for (const [dir, value] of [
    [unknownDir, "sepia"],
    [knownDir, "dark"],
  ] as const) {
    const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
    await writeFiles(dir, {
      "mdmark.config.yaml": `${config}colorScheme: ${value}\n`,
    });
  }
  // 実行
  const unknown = await runCli(["check"], unknownDir);
  const known = await runCli(["check"], knownDir);
  // 検証
  expect(unknown.code).toBe(1);
  const schemeLines = linesOf(unknown.stdout).filter((line) =>
    line.startsWith("mdmark.config.yaml:colorScheme: unknown_color_scheme:"),
  );
  expect(schemeLines).toHaveLength(1);
  for (const text of ["sepia", "light", "dark", "auto"]) {
    expect(schemeLines[0]).toContain(text);
  }
  expect(known.code).toBe(0);
  expect(known.stdout).not.toContain("unknown_color_scheme");
});

// 文書からの相対パスにもアセットのルートにも無い画像・動画・音声・添付のファイルを missing_file のずれにする（正常系（見つからないファイルがある））
test("test_normal_when_files_missing", async () => {
  // 準備
  const dir = await createTempDir();
  const config = [
    "assets:",
    "  root: assets",
    "build:",
    '  include: ["docs/**/*.md"]',
    "  out: dist/docs.html",
    "",
  ].join("\n");
  const guide = [
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
    "![外の画像](https://example.com/a.png)",
    "",
  ].join("\n");
  await writeFiles(dir, {
    "mdmark.config.yaml": config,
    "docs/guide.mark.md": guide,
    "assets/images/logo.png": "png",
  });
  // 実行
  const result = await runCli(["check"], dir);
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
      text.startsWith(`docs/guide.mark.md:${line}: missing_file:`),
    );
    expect(found, path).toContain(path);
  }
  expect(lines.some((text) => text.includes("images/logo.png"))).toBe(false);
  expect(lines.some((text) => text.includes("https://example.com/a.png"))).toBe(
    false,
  );
  expect(lines.at(-1)).toBe("ずれ 4 件");
  expect(await readFile(join(dir, "mdmark.config.yaml"), "utf8")).toBe(config);
  expect(await readFile(join(dir, "docs", "guide.mark.md"), "utf8")).toBe(
    guide,
  );
  expect(existsSync(join(dir, "dist"))).toBe(false);
});

/** 図の部品のマーカーの範囲の行にする */
function diagramLines(directive: string, definition: unknown): string[] {
  return [
    `<!-- ${directive} -->`,
    "",
    "```json",
    JSON.stringify(definition),
    "```",
    "",
    `<!-- /${directive} -->`,
  ];
}

// 図の定義の読み込めない箇所を、文書と行を指す行で出し、終了コード 1 で終わる（正常系（図の定義にずれがある））
test("test_normal_when_diagram_drift", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const duplicated = shopEr();
  const orders = duplicated.tables.find((table) => table.id === "orders");
  if (orders === undefined) throw new Error("orders のテーブルが無い");
  duplicated.tables.push({ ...orders, x: orders.x + 300 });
  const chart = JSON.parse(REPLY_TIME_TEXT) as {
    x: { ticks: string[] };
    series: Array<{ points: number[] }>;
  };
  chart.x.ticks = chart.x.ticks.slice(0, 4);
  chart.series = chart.series.map((series) => ({
    ...series,
    points: series.points.slice(0, 3),
  }));
  const missingTable = shopEr();
  missingTable.relations = missingTable.relations.map((relation) =>
    relation.label === "注文する" ? { ...relation, to: "payments" } : relation,
  );
  const head = ["# A", "", ...diagramLines("er", duplicated)];
  const middle = [
    ...head,
    ...Array.from({ length: 19 - head.length }, () => ""),
    ...diagramLines("chart", chart),
  ];
  const a = [
    ...middle,
    ...Array.from({ length: 29 - middle.length }, () => ""),
    ...diagramLines("er", missingTable),
    "",
  ];
  await writeFiles(dir, {
    "docs/a.mark.md": a.join("\n"),
    "docs/b.mark.md": [
      "# B",
      "",
      ...diagramLines("er", shopEr()),
      "",
      ...diagramLines("chart", JSON.parse(REPLY_TIME_TEXT)),
      "",
    ].join("\n"),
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: docs/a.mark.md",
      "    title: A",
      "  - id: b",
      "    path: docs/b.mark.md",
      "    title: B",
      "",
    ].join("\n"),
  });
  const files = [
    "mdmark.config.yaml",
    "index.yaml",
    "docs/a.mark.md",
    "docs/b.mark.md",
  ];
  const read = () =>
    Promise.all(files.map((path) => readFile(join(dir, path), "utf8")));
  const before = await read();
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(a.indexOf("<!-- chart -->") + 1).toBe(20);
  expect(a.indexOf("<!-- er -->", 4) + 1).toBe(30);
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  for (const [line, word] of [
    [3, "orders"],
    [20, "x.ticks"],
    [30, "payments"],
  ] as const) {
    const found = lines.filter((text) =>
      text.startsWith(`docs/a.mark.md:${line}: diagram_invalid:`),
    );
    expect(found, String(line)).toHaveLength(1);
    expect(found[0]).toContain(word);
  }
  expect(lines.some((line) => line.includes("unknown_mark"))).toBe(false);
  expect(lines.some((line) => line.includes("docs/b.mark.md"))).toBe(false);
  expect(lines.at(-1)).toBe("ずれ 3 件");
  expect(await read()).toEqual(before);
});

// 廃止した flow・sequence の範囲を retired_diagram のずれにし、範囲の中の定義は点検しない（正常系（廃止した図の範囲がある））
test("test_normal_when_retired_diagram", async () => {
  // 準備
  const dir = await createCleanDir();
  await writeFiles(dir, {
    "a.md": [
      "# A",
      "",
      ...diagramLines("flow", JSON.parse(INQUIRY_TEXT)),
      "",
    ].join("\n"),
    "b.md": [
      "# B",
      "",
      "本文",
      "",
      ...diagramLines("sequence", JSON.parse(INQUIRY_SEQ_TEXT)),
      "",
    ].join("\n"),
  });
  const before = await snapshot(dir);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  for (const prefix of [
    "a.md:3: retired_diagram:",
    "b.md:5: retired_diagram:",
  ]) {
    const found = lines.filter((line) => line.startsWith(prefix));
    expect(found, prefix).toHaveLength(1);
    expect(found[0]).toContain("map の範囲");
    expect(found[0]).toContain("mdmark upgrade");
  }
  expect(lines.some((line) => line.includes("diagram_invalid"))).toBe(false);
  expect(lines.at(-1)).toBe("ずれ 2 件");
  expect(await snapshot(dir)).toEqual(before);
});

/** ビルドした `dist/cli.js` を `cwd` で実行し、`input` を標準入力に記載する。終了コードと出力を返却する */
function runCliWithInput(
  args: string[],
  cwd: string,
  input: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cli = join(inject("builtRoot"), "dist", "cli.js");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.stdin.end(input);
  });
}

/** `items[0].body` が 5 行目の `|` で始まり、値の 3 行目（ファイルの 8 行目）に `<!-- tabz -->` を持ち、`items[1].body` に正しい Markdown を持つ YAML */
const RECORDS_YAML = [
  "title: 記録",
  "items:",
  "  - id: a",
  "    name: 1 つ目",
  "    body: |",
  "      # 見出し",
  "      本文",
  "      <!-- tabz -->",
  "  - id: b",
  "    body: |",
  "      正しい本文",
  "",
].join("\n");

/** フォルダの中のファイルの一覧と中身（変わっていないことを確認する） */
async function folderSnapshot(dir: string, paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => readFile(join(dir, path), "utf8")));
}

/** `docs/*.md` を build の対象にした設定 */
const DOCS_CONFIG = [
  "build:",
  '  include: ["docs/*.md"]',
  "  out: dist/docs.html",
  "",
].join("\n");

/** フォルダの中のファイルの中身を、名前の順に返却する（変わっていないことを確認する） */
async function snapshotFiles(dir: string, paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => readFile(join(dir, path), "utf8")));
}

/** map の範囲の行（3 行目から始まるよう `# A` と空行を前に置く） */
const mapLines = (options: {
  args?: string;
  mermaid: string[];
  data?: string;
}): string[] => [
  options.args === undefined ? "<!-- map -->" : `<!-- map: ${options.args} -->`,
  "",
  "```mermaid",
  ...options.mermaid,
  "```",
  "",
  ...(options.data === undefined
    ? []
    : [`<!-- map-data: ${options.data} -->`, ""]),
  "<!-- /map -->",
];

/** `docs/a.md` だけを索引に持つフォルダを作る */
async function createMapDir(a: string[], config = ""): Promise<string> {
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const base = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${base}${config}`,
    "docs/a.md": a.join("\n"),
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: a",
      "    path: docs/a.md",
      "    title: A",
      "",
    ].join("\n"),
  });
  return dir;
}

const MAP_FILES = ["mdmark.config.yaml", "index.yaml", "docs/a.md"];

// 記載の警告を持たない Markdown の文字列で 0 件を返却する（正常系（文字列の記法を点検する））
test("test_normal_when_text", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const paths = ["mdmark.config.yaml", "theme.css"];
  const before = await folderSnapshot(dir, paths);
  const markdown = [
    ...diagramLines("chart", JSON.parse(REPLY_TIME_TEXT)),
    "",
    '<!-- table: {"kind": "data"} -->',
    "",
    "| 列 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const result = await runCliWithInput(["check", "--text", "-"], dir, markdown);
  // 検証
  expect(result.code).toBe(0);
  expect(linesOf(result.stdout)).toEqual(["ずれ 0 件"]);
  expect(await folderSnapshot(dir, paths)).toEqual(before);
});

// 文字列を描いたときの記載の警告を、行を指すずれにして終了コード 1 で終わる（正常系（文字列に記載の警告がある））
test("test_normal_when_text_warnings", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const { render } = (await import(
    pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href
  )) as { render: (markdown: string) => string };
  // 実行
  const result = await runCli(["check", "--text", WARNINGS_MARKDOWN], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(lines).toHaveLength(4);
  expect(lines[0]).toMatch(/^-:1: retired_diagram: /);
  expect(lines[1]).toMatch(/^-:20: unknown_mark: /);
  expect(lines[2]).toMatch(/^-:22: syntax_warning: /);
  expect(lines.at(-1)).toBe("ずれ 3 件");
  const rendered = plainText(render(WARNINGS_MARKDOWN)).replace(/\s+/g, "");
  for (const line of [lines[0], lines[2]]) {
    const message = (line ?? "").replace(/^-:\d+: \w+: /, "");
    expect(rendered).toContain(message.replace(/\s+/g, ""));
  }
});

// 描くときに無視する記法のマーカーの知らないキー（知らない機能名を含む）を、行を指す unknown_mark_arg のずれにして終了コード 1 で終わる（正常系（文字列の記法のマーカーに知らない引数がある））
test("test_normal_when_text_unknown_mark_args", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const markdown = [
    '<!-- table: {"kind": "data", "features": {"unknown": {}}, "widht": {"説明": {}}} -->',
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    '<!-- tabs: {"grop": "os"} -->',
    "",
    "### macOS",
    "",
    "本文",
    "",
    "### Windows",
    "",
    "本文",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const result = await runCli(["check", "--text", markdown], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(lines).toHaveLength(4);
  const first = lines.filter((line) =>
    line.startsWith("-:1: unknown_mark_arg: "),
  );
  expect(first).toHaveLength(2);
  expect(first.join("\n")).toContain("features.unknown");
  expect(first.join("\n")).toContain("sort");
  expect(first.join("\n")).toContain("widht");
  expect(first.join("\n")).toContain("columns");
  const eighth = lines.filter((line) =>
    line.startsWith("-:8: unknown_mark_arg: "),
  );
  expect(eighth).toHaveLength(1);
  expect(eighth[0]).toContain("grop");
  expect(lines.some((line) => line.includes("syntax_warning"))).toBe(false);
  expect(lines.at(-1)).toBe("ずれ 3 件");
});

// YAML のキーの値の Markdown を点検し、YAML のファイルの行を指すずれにする（正常系（ファイルと YAML のキー））
test("test_normal_when_yaml_key", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  await writeFiles(dir, { "records.yaml": RECORDS_YAML });
  // 実行
  const first = await runCli(
    ["check", "--file", "records.yaml", "--key", "items[0].body"],
    dir,
  );
  const second = await runCli(
    ["check", "--file", "records.yaml", "--key", "items[1].body"],
    dir,
  );
  // 検証
  expect(first.code).toBe(1);
  const marks = linesOf(first.stdout).filter((line) =>
    line.startsWith("records.yaml:"),
  );
  expect(marks).toHaveLength(1);
  expect(marks[0]).toMatch(/^records\.yaml:8: unknown_mark: .*tabz/);
  expect(second.code).toBe(0);
  expect(linesOf(second.stdout)).toEqual(["ずれ 0 件"]);
  expect(await readFile(join(dir, "records.yaml"), "utf8")).toBe(RECORDS_YAML);
});

// 設定の extensions が追加するマーカーを知っているマーカーとして点検する（正常系（拡張のマーカーを持つ文字列））
test("test_normal_when_text_extension_mark", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  await appendConfig(dir, ["extensions: [extensions/note-card.js]"]);
  await writeFiles(dir, {
    "extensions/note-card.js": [
      "export default {",
      '  name: "note-card",',
      '  directive: "note-card",',
      "  load: async () => ({ draw() {} }),",
      "};",
      "",
    ].join("\n"),
  });
  // 実行
  const result = await runCli(
    ["check", "--text", "<!-- note-card -->\n\n<!-- tabz -->\n"],
    dir,
  );
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(
    lines.filter((line) => line.startsWith("-:3: unknown_mark:")),
  ).toHaveLength(1);
  expect(lines.some((line) => line.startsWith("-:1:"))).toBe(false);
});

// YAML に無いキーは、キーが無いことと修正方法を示して終わる（異常系（キーが無い））
test("test_error_when_key_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  await writeFiles(dir, { "records.yaml": RECORDS_YAML });
  // 実行
  const result = await runCli(
    ["check", "--file", "records.yaml", "--key", "items[5].body"],
    dir,
  );
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("records.yaml");
  expect(result.stderr).toContain("items[5].body");
  expect(result.stderr).toContain("2 要素");
  expect(await readFile(join(dir, "records.yaml"), "utf8")).toBe(RECORDS_YAML);
});

// include のマーカーが指すファイル・見出し・行の範囲が無いものを include_target_missing にする（正常系（取り込み先が無い））
test("test_normal_when_include_targets_missing", async () => {
  // 準備
  const dir = await createTempDir();
  const files = {
    "mdmark.config.yaml": DOCS_CONFIG,
    "docs/a.mark.md": [
      "# A",
      "",
      '<!-- include: {"path": "missing.md"} -->',
      "",
      '<!-- include: {"path": "共通/手順.md", "heading": "実行"} -->',
      "",
    ].join("\n"),
    "docs/b.mark.md": [
      "# B",
      '<!-- include: {"path": "共通/手順.md", "heading": "無い見出し"} -->',
      "",
      '<!-- include: {"path": "../src/app.ts", "lines": {"from": 8, "to": 10}} -->',
      "",
    ].join("\n"),
    "docs/共通/手順.md": "## 実行\n\n実行の段落\n",
    "src/app.ts": "1\n2\n3\n4\n5\n",
  };
  await writeFiles(dir, files);
  const before = await snapshotFiles(dir, Object.keys(files));
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const lineOf = (prefix: string) =>
    lines.find((line) => line.startsWith(prefix)) ?? "";
  expect(lineOf("docs/a.mark.md:3: include_target_missing:")).toContain(
    "missing.md",
  );
  expect(lineOf("docs/b.mark.md:2: include_target_missing:")).toContain(
    "無い見出し",
  );
  const range = lineOf("docs/b.mark.md:4: include_target_missing:");
  expect(range).toContain("L8-L10");
  expect(range).toContain("5 行");
  for (const line of [
    lineOf("docs/a.mark.md:3:"),
    lineOf("docs/b.mark.md:2:"),
    range,
  ]) {
    expect(line).toContain("修正してください");
  }
  expect(lines.some((line) => line.startsWith("docs/a.mark.md:5"))).toBe(false);
  expect(lines.at(-1)).toBe("ずれ 3 件");
  expect(await snapshotFiles(dir, Object.keys(files))).toEqual(before);
});

// 循環する取り込みを include_circular、設定ファイルのフォルダの外を指す取り込みを include_target_missing にする（正常系（取り込みが循環する・フォルダの外を指す））
test("test_normal_when_include_circular_or_outside", async () => {
  // 準備
  const parent = await createTempDir();
  const dir = join(parent, "root");
  const files = {
    "root/mdmark.config.yaml": [
      "build:",
      '  include: ["docs/a.mark.md"]',
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "root/docs/a.mark.md": [
      "# A",
      "",
      '<!-- include: {"path": "b.mark.md"} -->',
      "",
      '<!-- include: {"path": "../../outside.md"} -->',
      "",
    ].join("\n"),
    "root/docs/b.mark.md": '# B\n<!-- include: {"path": "a.mark.md"} -->\n',
    "outside.md": '<!-- include: {"path": "nowhere.md"} -->\n',
  };
  await writeFiles(parent, files);
  const before = await snapshotFiles(parent, Object.keys(files));
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const circular = lines.find((line) =>
    line.startsWith("docs/b.mark.md:2: include_circular:"),
  );
  expect(circular).toContain("a.mark.md → b.mark.md → a.mark.md");
  expect(circular).toContain("修正してください");
  const outside = lines.find((line) =>
    line.startsWith("docs/a.mark.md:5: include_target_missing:"),
  );
  expect(outside).toContain("../../outside.md");
  expect(outside).toContain("設定ファイルのフォルダの外");
  expect(lines.some((line) => line.includes("nowhere.md"))).toBe(false);
  expect(await snapshotFiles(parent, Object.keys(files))).toEqual(before);
});

// 設定の tooltips.diagramPlacement が top・bottom でないとき、schema のずれにする（正常系（図のツールチップの位置に誤った値がある））
test("test_normal_when_diagram_placement_invalid", async () => {
  // 準備
  const invalidDir = await createCleanDir();
  const topDir = await createCleanDir();
  const bottomDir = await createCleanDir();
  const omittedDir = await createCleanDir();
  for (const [dir, value] of [
    [invalidDir, "left"],
    [topDir, "top"],
    [bottomDir, "bottom"],
  ] as const) {
    await appendConfig(dir, ["tooltips:", `  diagramPlacement: ${value}`]);
  }
  const before = await snapshot(invalidDir);
  // 実行
  const invalid = await runCli(["check"], invalidDir);
  const valid = await Promise.all(
    [topDir, bottomDir, omittedDir].map((dir) => runCli(["check"], dir)),
  );
  // 検証
  expect(invalid.code).toBe(1);
  const lines = linesOf(invalid.stdout).filter((line) =>
    line.startsWith("mdmark.config.yaml:tooltips.diagramPlacement: schema:"),
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("top");
  expect(lines[0]).toContain("bottom");
  for (const result of valid) {
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("diagramPlacement");
  }
  expect(await snapshot(invalidDir)).toEqual(before);
});

// 文書の map の補足が指す無い ID・知らないキー・-- を含む値を、範囲の場所を指すずれにする（正常系（map の補足にずれがある））
test("test_normal_when_map_data_drift", async () => {
  // 準備
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
  expect(a.indexOf("<!-- map -->") + 1).toBe(20);
  const dir = await createMapDir(a);
  const before = await snapshotFiles(dir, MAP_FILES);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const at = (line: number, kind: string) =>
    lines.filter((item) => item.startsWith(`docs/a.mark.md:${line}: ${kind}:`));
  expect(
    a.indexOf(drift.find((item) => item.startsWith("<!-- map-data")) ?? "") + 1,
  ).toBe(10);
  expect(at(10, "map_unknown_ref")).toHaveLength(1);
  expect(at(10, "map_unknown_ref")[0]).toContain("notes.ghost");
  expect(at(10, "map_unknown_key")).toHaveLength(1);
  expect(at(10, "map_unknown_key")[0]).toContain("layuot");
  expect(at(10, "map_invalid_value")).toHaveLength(1);
  expect(at(10, "map_invalid_value")[0]).toContain("walkthroughs[0].text");
  expect(at(10, "map_invalid_value")[0]).toContain("--");
  const mark = lines.filter((item) => item.startsWith("docs/a.mark.md:3:"));
  expect(mark).toHaveLength(1);
  expect(mark[0]).toMatch(/^docs\/a\.mark\.md:3: map_unknown_key: .*mdoe/);
  for (const key of ["title", "focus", "play", "interval", "collapse"])
    expect(mark[0]).toContain(key);
  expect(lines.some((line) => line.startsWith("docs/a.mark.md:20:"))).toBe(
    false,
  );
  expect(lines.at(-1)).toBe("ずれ 4 件");
  expect(await snapshotFiles(dir, MAP_FILES)).toEqual(before);
});

// --text の Markdown の map の範囲の書き方の警告を、警告の項目ごとのずれにする（正常系（文字列の map の書き方の警告））
test("test_normal_when_text_map_warnings", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const markdown = [
    "<!-- map -->",
    "```mermaid",
    "flowchart LR",
    "  A -> B",
    "```",
    "<!-- map-data: {",
    '  "version": 1,',
    '  "layuot": {}',
    "} -->",
    "<!-- /map -->",
    "",
  ].join("\n");
  // 実行
  const result = await runCli(["check", "--text", markdown], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const invalid = lines.filter((line) => line.startsWith("-:4: map_invalid:"));
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toContain("A -> B");
  expect(invalid[0]).toContain("-->");
  const key = lines.filter((line) => line.startsWith("-:8: map_unknown_key:"));
  expect(key).toHaveLength(1);
  expect(key[0]).toContain("layuot");
  expect(lines.at(-1)).toBe("ずれ 2 件");
});

// 設定の map の Schema に合わない値と無いアイコン、文書の map の範囲の設定に無いクラスと線の名前をずれにする（正常系（map の設定にずれがある））
test("test_normal_when_map_config_drift", async () => {
  // 準備
  const a = [
    "# A",
    "",
    ...mapLines({
      mermaid: ["flowchart LR", "  A[A]:::queue --> B[B]"],
      data: '{"version": 1, "layout": {"A->B": {"line": "back"}}}',
    }),
    "",
  ];
  const dir = await createMapDir(
    a,
    [
      "map:",
      "  node_fit: tall",
      "  kinds:",
      "    store:",
      "      shape: hexagon",
      "      icon: no-such-icon",
      "",
    ].join("\n"),
  );
  const before = await snapshotFiles(dir, MAP_FILES);
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const config = lines.filter((line) => line.startsWith("mdmark.config.yaml"));
  const schema = config.filter((line) => line.includes(" schema:"));
  expect(schema).toHaveLength(2);
  expect(schema.some((line) => line.includes("map.node_fit"))).toBe(true);
  expect(schema.some((line) => line.includes("map.kinds.store.shape"))).toBe(
    true,
  );
  const icon = config.filter((line) => line.includes(" map_unknown_icon:"));
  expect(icon).toHaveLength(1);
  expect(icon[0]).toContain("no-such-icon");
  const doc = (kind: string) =>
    lines.filter(
      (line) => line.startsWith("docs/a.mark.md") && line.includes(` ${kind}:`),
    );
  expect(doc("map_unknown_class")).toHaveLength(1);
  expect(doc("map_unknown_class")[0]).toContain("queue");
  expect(doc("map_unknown_class")[0]).toContain("map.kinds");
  expect(doc("map_unknown_line")).toHaveLength(1);
  expect(doc("map_unknown_line")[0]).toContain("back");
  expect(doc("map_unknown_line")[0]).toContain("map.lines");
  expect(lines.at(-1)).toBe("ずれ 5 件");
  expect(await snapshotFiles(dir, MAP_FILES)).toEqual(before);
});

// 文書の今の書き方のマーカーを、文書と行を指す legacy_mark の行にして終了コード 1 で終わる（正常系（今の書き方のマーカーがある））
test("test_normal_when_legacy_mark", async () => {
  // 準備
  const dir = await createCleanDir({ js: true });
  await appendConfig(dir, ["extensions: [extensions/example.js]"]);
  await writeFiles(dir, {
    "a.mark.md": [
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
    "b.mark.md": [
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
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  for (const head of [
    "a.mark.md:3: legacy_mark:",
    "b.mark.md:1: legacy_mark:",
    "b.mark.md:5: legacy_mark:",
  ]) {
    const found = lines.filter((line) => line.startsWith(head));
    expect(found, head).toHaveLength(1);
    expect(found[0]).toContain("mdmark upgrade");
  }
  expect(lines.find((line) => line.startsWith("b.mark.md:5:"))).toContain(
    "描くときに描きません",
  );
  expect(lines.at(-1)).toBe("ずれ 3 件");
  expect(await snapshot(dir)).toEqual(before);
});

// 文書のマーカーの知らないキー・型の誤り・削除した機能の列の設定を、文書と行を指す行にして終了コード 1 で終わる（正常系（マーカーの設定にずれがある））
test("test_normal_when_mark_options_drift", async () => {
  // 準備
  const dir = await createCleanDir();
  await writeFiles(dir, {
    "a.mark.md": [
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
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const unknown = lines.filter((line) =>
    line.startsWith("a.mark.md:1: unknown_mark_arg:"),
  );
  expect(unknown).toHaveLength(1);
  expect(unknown[0]).toContain("color");
  const invalid = lines.filter((line) =>
    line.startsWith("a.mark.md:5: mark_option_invalid:"),
  );
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toContain("open");
  const unapplied = lines.filter((line) =>
    line.startsWith("a.mark.md:9: mark_option_unapplied:"),
  );
  expect(unapplied).toHaveLength(1);
  expect(unapplied[0]).toContain("columns.数量.total");
  expect(lines.at(-1)).toBe("ずれ 3 件");
});

// 文字列の今の書き方のマーカーを、行を指す legacy_mark のずれにして終了コード 1 で終わる（正常系（文字列に今の書き方のマーカーがある））
test("test_normal_when_text_legacy_mark", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const markdown = [
    "<!-- table: data +total total=数量:sum -->",
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "<!-- /table -->",
    "",
    "<!-- details: 補足 open -->",
    "",
    "段落",
    "",
    "<!-- /details -->",
    "",
  ].join("\n");
  // 実行
  const result = await runCli(["check", "--text", markdown], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  for (const head of ["-:1: legacy_mark:", "-:7: legacy_mark:"]) {
    const found = lines.filter((line) => line.startsWith(head));
    expect(found, head).toHaveLength(1);
    expect(found[0]).toContain("mdmark upgrade");
  }
  expect(lines.some((line) => line.includes("syntax_warning"))).toBe(false);
});

// 文字列の JSON として読めない引数と値の --> で閉じた引数を、syntax_warning のずれにして終了コード 1 で終わる（正常系（文字列に JSON として読めない引数がある））
test("test_normal_when_text_mark_args_not_json", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const markdown = [
    '<!-- code: {"title": "app.ts",} -->',
    "```ts",
    "const a = 1;",
    "```",
    "",
    "",
    '<!-- details: {"title": "a --\\u003e b"} -->',
    "",
    "段落",
    "<!-- /details -->",
    '<!-- details: {"title": "a --> b"} -->',
    "",
    "段落",
    "",
    "<!-- /details -->",
    "",
  ].join("\n");
  // 実行
  const result = await runCli(["check", "--text", markdown], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const first = lines.find((line) => line.startsWith("-:1: syntax_warning:"));
  expect(first).toContain("JSON として読めません");
  expect(first).toContain("文字目");
  const closed = lines.find((line) => line.startsWith("-:11: syntax_warning:"));
  expect(closed).toContain("コメントがそこで閉じます");
  expect(closed).toContain("--\\u003e");
  expect(lines.some((line) => line.startsWith("-:7:"))).toBe(false);
});
