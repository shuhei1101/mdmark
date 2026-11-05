import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test } from "vitest";
import {
  JUDGEMENT_AUTO_TEXT,
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
    "docs/guide.md": guide,
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
      text.startsWith(`docs/guide.md:${line}: missing_file:`),
    );
    expect(found, path).toContain(path);
  }
  expect(lines.some((text) => text.includes("images/logo.png"))).toBe(false);
  expect(lines.some((text) => text.includes("https://example.com/a.png"))).toBe(
    false,
  );
  expect(lines.at(-1)).toBe("ずれ 4 件");
  expect(await readFile(join(dir, "mdmark.config.yaml"), "utf8")).toBe(config);
  expect(await readFile(join(dir, "docs", "guide.md"), "utf8")).toBe(guide);
  expect(existsSync(join(dir, "dist"))).toBe(false);
});

/** 座標の重なるノード `web` と `db`、`frame` の右端をまたぐノード `queue`、ノード `cache` の中を通る線 `w1`、名前が長いノード `batch` を持つフロー図の定義 */
const BROKEN_FLOW = {
  title: "配置のずれ",
  scope: "点検",
  updated: "2026-11-03",
  width: 800,
  height: 400,
  frame: { title: "システム", x: 20, y: 20, w: 600, h: 360 },
  nodes: [
    { id: "web", kind: "script", x: 40, y: 40, w: 100, h: 50, name: "Web" },
    { id: "db", kind: "data", x: 80, y: 60, w: 100, h: 50, name: "DB" },
    { id: "cache", kind: "data", x: 300, y: 200, w: 100, h: 50, name: "Cache" },
    {
      id: "queue",
      kind: "script",
      x: 580,
      y: 200,
      w: 100,
      h: 50,
      name: "Queue",
    },
    {
      id: "batch",
      kind: "script",
      x: 40,
      y: 300,
      w: 120,
      h: 48,
      name: "あ".repeat(30),
    },
  ],
  wires: [
    {
      id: "w1",
      from: "web",
      to: "queue",
      line: "flow",
      points: [
        [140, 225],
        [580, 225],
      ],
    },
  ],
};

/** ずれの無いフロー図の定義（ノード 2 つと線 1 本） */
const CLEAN_FLOW = {
  title: "整った図",
  scope: "点検",
  updated: "2026-11-03",
  width: 400,
  height: 200,
  nodes: [
    { id: "a", kind: "script", x: 20, y: 20, w: 100, h: 60, name: "A" },
    { id: "b", kind: "script", x: 220, y: 20, w: 100, h: 60, name: "B" },
  ],
  wires: [
    {
      id: "w",
      from: "a",
      to: "b",
      line: "flow",
      points: [
        [120, 50],
        [220, 50],
      ],
    },
  ],
};

/** フロー図の定義を `<!-- flow -->` の範囲の行にする */
function flowLines(definition: unknown): string[] {
  return [
    "<!-- flow -->",
    "",
    "```json",
    JSON.stringify(definition),
    "```",
    "",
    "<!-- /flow -->",
  ];
}

// 図の定義の読めない箇所と配置のずれを、文書と行を指す行で出し、終了コード 1 で終わる（正常系（図の定義にずれがある））
test("test_normal_when_diagram_drift", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const duplicated = {
    ...CLEAN_FLOW,
    nodes: [
      { id: "api", kind: "script", x: 20, y: 20, w: 100, h: 60, name: "API" },
      { id: "api", kind: "script", x: 220, y: 20, w: 100, h: 60, name: "API" },
    ],
    wires: [],
  };
  const head = ["# A", "", ...flowLines(duplicated)];
  const missingTable = shopEr();
  missingTable.relations = missingTable.relations.map((relation) =>
    relation.label === "注文する" ? { ...relation, to: "payments" } : relation,
  );
  const a = [
    ...head,
    ...Array.from({ length: 19 - head.length }, () => ""),
    ...flowLines(BROKEN_FLOW),
    "",
    "",
    "",
    ...flowLines(missingTable).map((line) =>
      line.replace("flow -->", "er -->"),
    ),
    "",
  ];
  await writeFiles(dir, {
    "docs/a.md": a.join("\n"),
    "docs/b.md": ["# B", "", ...flowLines(CLEAN_FLOW), ""].join("\n"),
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: docs/a.md",
      "    title: A",
      "  - id: b",
      "    path: docs/b.md",
      "    title: B",
      "",
    ].join("\n"),
  });
  const files = ["mdmark.config.yaml", "index.yaml", "docs/a.md", "docs/b.md"];
  const read = () =>
    Promise.all(files.map((path) => readFile(join(dir, path), "utf8")));
  const before = await read();
  // 実行
  const result = await runCli(["check"], dir);
  // 検証
  expect(a.indexOf("<!-- flow -->", 3) + 1).toBe(20);
  expect(a.indexOf("<!-- er -->") + 1).toBe(30);
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  const invalid = lines.filter((line) =>
    line.startsWith("docs/a.md:3: diagram_invalid:"),
  );
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toContain("api");
  for (const [kind, ids] of [
    ["diagram_node_overlap", ["web", "db"]],
    ["diagram_node_overflow", ["queue"]],
    ["diagram_wire_crosses_node", ["w1", "cache"]],
    ["diagram_label_too_long", ["batch"]],
  ] as const) {
    const found = lines.filter((line) =>
      line.startsWith(`docs/a.md:20: ${kind}:`),
    );
    expect(found).toHaveLength(1);
    for (const id of ids) {
      expect(found[0]).toContain(id);
    }
  }
  const erInvalid = lines.filter((line) =>
    line.startsWith("docs/a.md:30: diagram_invalid:"),
  );
  expect(erInvalid).toHaveLength(1);
  expect(erInvalid[0]).toContain("payments");
  expect(lines.some((line) => line.includes("unknown_mark"))).toBe(false);
  expect(lines.some((line) => line.includes("docs/b.md"))).toBe(false);
  expect(lines.at(-1)).toBe("ずれ 6 件");
  expect(await read()).toEqual(before);
});

/** ビルドした `dist/cli.js` を `cwd` で流し、`input` を標準入力に書く。終了コードと出力を返す */
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

/** フォルダの中のファイルの一覧と中身（変わっていないことを確かめる） */
async function folderSnapshot(dir: string, paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => readFile(join(dir, path), "utf8")));
}

// 書き方の警告を持たない Markdown の文字列で 0 件を返す（正常系（文字列の記法を点検する））
test("test_normal_when_text", async () => {
  // 準備
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  const paths = ["mdmark.config.yaml", "theme.css"];
  const before = await folderSnapshot(dir, paths);
  const markdown = [
    ...flowLines(CLEAN_FLOW),
    "",
    "<!-- table: data -->",
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

// 文字列を描いたときの書き方の警告を、行を指すずれにして終了コード 1 で終わる（正常系（文字列に書き方の警告がある））
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
  expect(lines[0]).toMatch(/^-:1: diagram_invalid: /);
  expect(lines[1]).toMatch(/^-:20: unknown_mark: /);
  expect(lines[2]).toMatch(/^-:22: syntax_warning: /);
  expect(lines.at(-1)).toBe("ずれ 3 件");
  const rendered = plainText(render(WARNINGS_MARKDOWN)).replace(/\s+/g, "");
  for (const line of [lines[0], lines[2]]) {
    const message = (line ?? "").replace(/^-:\d+: \w+: /, "");
    expect(rendered).toContain(message.replace(/\s+/g, ""));
  }
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

// YAML に無いキーは、キーが無いことと直し方を示して終わる（異常系（キーが無い））
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

// 座標を省いた判定フローチャートを配置の後の座標で点検し、座標を省けない定義を diagram_invalid にする（正常系（座標を省いた図の定義））
test("test_normal_when_diagram_auto_layout", async () => {
  // 準備
  const dir = await createCleanDir();
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
  const result = await runCli(["check"], dir);
  // 検証
  expect(result.code).toBe(1);
  const lines = linesOf(result.stdout);
  expect(lines.some((line) => line.startsWith("a.md:3:"))).toBe(false);
  const invalid = lines.filter((line) =>
    line.startsWith("a.md:30: diagram_invalid:"),
  );
  expect(invalid).toHaveLength(1);
  expect(invalid[0]).toContain("llm");
  expect(invalid[0]).toContain("判定フローチャート");
  expect(invalid[0]).toContain("座標を書くか");
  expect(lines.at(-1)).toBe("ずれ 1 件");
  expect(await snapshot(dir)).toEqual(before);
});
