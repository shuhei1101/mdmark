import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, writeFiles } from "../cli.ts";
import {
  CONFIG_WITH_INDEX,
  callTool,
  DOCUMENTS,
  indexYaml,
  withMcpClient,
} from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 設定・索引（文書 `a` だけを載せる）と文書 2 つを置く */
async function writeProject(dir: string): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_INDEX,
    "index.yaml": indexYaml(["a"]),
    ...DOCUMENTS,
  });
}

/** 語彙に `topic:mcp`（別名 `MCP`）・`topic:yaml` を持ち、`docs` の並びが `c`・`a`・`b` の索引と文書 3 つを置く */
async function writeTaggedProject(dir: string): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_INDEX,
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: c",
      "    path: c.md",
      "    title: C",
      "    tags: [topic:yaml]",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    tags: [{name: topic:mcp, main: true}]",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "    tags: [topic:mcp, {name: topic:yaml, main: true}]",
      "tags:",
      "  - name: topic:mcp",
      "    aliases: [MCP]",
      "  - name: topic:yaml",
      "",
    ].join("\n"),
    "a.md": "# A\n\n本文 A\n",
    "b.md": "# B\n\n本文 B\n",
    "c.md": "# C\n\n本文 C\n",
  });
}

/** 文書 25 個を全て載せ、全ての文書がタグ `設計` を持つ索引と文書を置く。文書の ID を返す */
async function writeManyDocsProject(dir: string): Promise<string[]> {
  const ids = Array.from(
    { length: 25 },
    (_, index) => `d${String(index + 1).padStart(2, "0")}`,
  );
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_INDEX,
    "index.yaml": [
      "schema: 1",
      "docs:",
      ...ids.flatMap((id) => [
        `  - id: ${id}`,
        `    path: ${id}.md`,
        `    title: 文書 ${id}`,
        "    tags: [設計]",
      ]),
      "",
    ].join("\n"),
    ...Object.fromEntries(ids.map((id) => [`${id}.md`, `# ${id}\n\n本文\n`])),
  });
  return ids;
}

/** Markdown の結果から、文書の表の行のセルを並べる（見出しと区切りの行は除く） */
function rowsOf(markdown: string): string[][] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) => line.slice(2, -2).split(" | "));
}

/** Markdown の結果から、文書の表の行の ID を並べる */
function idsOf(markdown: string): string[] {
  return rowsOf(markdown).map((cells) => cells[0] ?? "");
}

/** 文書のファイルの文字数（コードポイントの数）を引く */
async function charsOf(dir: string, id: string): Promise<number> {
  return [...(await readFile(join(dir, `${id}.md`), "utf8"))].length;
}

// 1 つ目の文書の題名の一部で、その文書だけが Markdown の表で返る（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir);
  const files = ["index.yaml", "a.md", "b.md"];
  const before = await Promise.all(
    files.map((file) => readFile(join(dir, file), "utf8")),
  );
  // 実行
  const result = await withMcpClient({ builtRoot, projectDir: dir }, (client) =>
    callTool(client, "find_docs", { text: "A" }),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(result.structured).toBeUndefined();
  const markdown = result.texts[0] ?? "";
  const lines = markdown.split("\n");
  expect(lines[0]).toContain("総件数 1 件・返した件数 1 件");
  expect(lines[0]).toContain(`合計文字数 ${await charsOf(dir, "a")}`);
  const header = lines.find((line) => line.startsWith("|"));
  expect(header).toBe("| ID | 題 | 概要 | タグ | 文字数 |");
  expect(idsOf(markdown)).toEqual(["a"]);
  expect(
    await Promise.all(files.map((file) => readFile(join(dir, file), "utf8"))),
  ).toEqual(before);
});

// どの文書にも無い語では総件数 0 件の結果を返し、エラーにしない（正常シナリオ（当たらない））
test("test_normal_when_no_match", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir);
  // 実行
  const result = await withMcpClient({ builtRoot, projectDir: dir }, (client) =>
    callTool(client, "find_docs", { text: "どの文書にも無い語" }),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(result.texts[0]?.split("\n")[0]).toContain("総件数 0 件");
});

// 全てを持つタグと、どれかを持つタグで絞り、主題のタグが当たる文書を上にする（正常シナリオ（タグを AND と OR で絞る））
test("test_normal_when_tags_and_or", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeTaggedProject(dir);
  // 実行
  const { all, any } = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      all: await callTool(client, "find_docs", {
        tags: ["topic:mcp", "topic:yaml"],
      }),
      any: await callTool(client, "find_docs", {
        any_tags: ["topic:mcp", "topic:yaml"],
      }),
    }),
  );
  // 検証
  expect(idsOf(all.texts[0] ?? "")).toEqual(["b"]);
  const anyMarkdown = any.texts[0] ?? "";
  expect(idsOf(anyMarkdown)).toEqual(["a", "b", "c"]);
  // 主題のタグには `（主題）` が付く
  const cellsById = new Map(
    rowsOf(anyMarkdown).map((cells) => [cells[0], cells]),
  );
  expect(cellsById.get("a")?.[3]).toBe("topic:mcp（主題）");
  expect(cellsById.get("c")?.[3]).toBe("topic:yaml");
  expect(anyMarkdown).toContain("タグごとの件数: topic:mcp 2・topic:yaml 2");
});

// 語彙の別名を語彙のタグに直して引き、語彙に無いタグは拒まず警告と近いタグを添える（正常シナリオ（語彙で引くタグ））
test("test_normal_when_tag_vocabulary", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeTaggedProject(dir);
  // 実行
  const { alias, unknown } = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      alias: await callTool(client, "find_docs", { tags: ["MCP"] }),
      unknown: await callTool(client, "find_docs", { tags: ["topic:mcq"] }),
    }),
  );
  // 検証
  expect(idsOf(alias.texts[0] ?? "")).toEqual(["a", "b"]);
  expect(unknown.isError).toBe(false);
  const markdown = unknown.texts[0] ?? "";
  expect(markdown.split("\n")[0]).toContain("総件数 0 件");
  const warning = markdown
    .split("\n")
    .find((line) => line.includes("topic:mcq"));
  expect(warning).toContain("語彙にありません");
  expect(warning).toContain("topic:mcp");
});

// 既定の件数で先頭を返し、続きの位置で残りを返す（正常シナリオ（既定の件数で続きを引く））
test("test_normal_when_paged", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  const ids = await writeManyDocsProject(dir);
  const total = (await Promise.all(ids.map((id) => charsOf(dir, id)))).reduce(
    (sum, count) => sum + count,
    0,
  );
  // 実行
  const { first, second } = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => {
      const first = await callTool(client, "find_docs");
      const cursor = /next_cursor: (\S+)/.exec(first.texts[0] ?? "")?.[1];
      const second = await callTool(client, "find_docs", { cursor });
      return { first, second };
    },
  );
  // 検証
  const firstMarkdown = first.texts[0] ?? "";
  expect(idsOf(firstMarkdown)).toEqual(ids.slice(0, 20));
  const head = firstMarkdown.split("\n")[0] ?? "";
  expect(head).toContain("総件数 25 件・返した件数 20 件");
  expect(head).toContain(`合計文字数 ${total}`);
  expect(head).not.toContain("next_cursor: なし");
  expect(firstMarkdown).toContain("タグごとの件数: 設計 25");
  for (const word of ["tags", "any_tags", "text", "count_only"]) {
    expect(firstMarkdown).toContain(word);
  }
  const secondMarkdown = second.texts[0] ?? "";
  expect(idsOf(secondMarkdown)).toEqual(ids.slice(20));
  expect(secondMarkdown.split("\n")[0]).toContain("next_cursor: なし");
});

// 件数だけを返し、文書の行を持たない（正常シナリオ（件数だけ））
test("test_normal_when_count_only", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeTaggedProject(dir);
  const anyTags = ["topic:mcp", "topic:yaml"];
  // 実行
  const { counted, listed } = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      counted: await callTool(client, "find_docs", {
        any_tags: anyTags,
        count_only: true,
      }),
      listed: await callTool(client, "find_docs", { any_tags: anyTags }),
    }),
  );
  // 検証
  const countedMarkdown = counted.texts[0] ?? "";
  expect(countedMarkdown).not.toContain("|");
  expect(countedMarkdown).toContain("タグごとの件数: ");
  const chars = rowsOf(listed.texts[0] ?? "").map((cells) => Number(cells[4]));
  const sum = chars.reduce((total, count) => total + count, 0);
  expect(countedMarkdown.split("\n")[0]).toBe(`総件数 3 件・合計文字数 ${sum}`);
});

// 既定では省いた項目と取り方を示し、パスを加え、JSON の形式でテキストと構造化した結果に同じ JSON を返す（正常シナリオ（返す量と形式を変える））
test("test_normal_when_view_and_format", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir);
  // 実行
  const { plain, withPath, json } = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      plain: await callTool(client, "find_docs", { text: "A" }),
      withPath: await callTool(client, "find_docs", {
        text: "A",
        include: ["path"],
      }),
      json: await callTool(client, "find_docs", {
        text: "A",
        format: "json",
      }),
    }),
  );
  // 検証
  expect(plain.texts[0]).toContain('省いた項目: path（include: ["path"]）');
  const pathRows = rowsOf(withPath.texts[0] ?? "");
  expect(pathRows[0]).toContain("a.md");
  expect(json.structured).toBeDefined();
  expect(JSON.parse(json.texts[0] ?? "")).toEqual(json.structured);
  const docs = (json.structured?.docs ?? []) as { id: string }[];
  expect(docs.map((doc) => doc.id)).toEqual(["a"]);
});

// 関係する文書を、種類・向き・when つきで引く。本文のリンクだけの参照は種類と when を持たない（正常シナリオ（関係する文書を種類と向きつきで引く））
test("test_normal_when_related_to", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_INDEX,
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    related:",
      "      - to: b",
      "        type: requires",
      "        when: a の前提を確かめるとき",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "  - id: c",
      "    path: c.md",
      "    title: C",
      "    related:",
      "      - to: a",
      "        type: part_of",
      "        when: 全体の中の位置を確かめるとき",
      "  - id: d",
      "    path: d.md",
      "    title: D",
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "b.md": "# B\n",
    "c.md": "# C\n",
    "d.md": "# D\n\n[A](a.md)\n",
  });
  const files = ["index.yaml", "a.md", "b.md", "c.md", "d.md"];
  const before = await Promise.all(
    files.map((file) => readFile(join(dir, file), "utf8")),
  );
  // 実行
  const result = await withMcpClient({ builtRoot, projectDir: dir }, (client) =>
    callTool(client, "find_docs", { related_to: "a", format: "json" }),
  );
  // 検証
  expect(result.isError).toBe(false);
  const docs = (result.structured?.docs ?? []) as {
    id: string;
    relations: unknown;
  }[];
  // a 自身は返らない
  expect(docs.map((doc) => doc.id)).toEqual(["b", "c", "d"]);
  const relationsOf = (id: string) =>
    docs.find((doc) => doc.id === id)?.relations;
  // a から相手への関連は記載した種類、相手から a への関連は逆向きの名前で返る
  expect(relationsOf("b")).toEqual([
    {
      direction: "outgoing",
      type: "requires",
      when: "a の前提を確かめるとき",
    },
  ]);
  expect(relationsOf("c")).toEqual([
    {
      direction: "incoming",
      type: "has_part",
      when: "全体の中の位置を確かめるとき",
    },
  ]);
  // 本文のリンクだけの参照は、種類と when を持たない
  expect(relationsOf("d")).toEqual([
    { direction: "incoming", type: null, when: null },
  ]);
  expect(
    await Promise.all(files.map((file) => readFile(join(dir, file), "utf8"))),
  ).toEqual(before);
});

// 全角の大文字の語でも、別名に半角の語を持つ 1 つ目の文書だけが返る（正常シナリオ（全角と半角だけが違う語））
test("test_normal_when_width_differs", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_INDEX,
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    aliases: [MCP]",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "",
    ].join("\n"),
    ...DOCUMENTS,
  });
  // 実行
  const result = await withMcpClient({ builtRoot, projectDir: dir }, (client) =>
    callTool(client, "find_docs", { text: "ＭＣＰ" }),
  );
  // 検証
  expect(result.isError).toBe(false);
  const markdown = result.texts[0] ?? "";
  expect(markdown.split("\n")[0]).toContain("総件数 1 件・返した件数 1 件");
  expect(idsOf(markdown)).toEqual(["a"]);
});
