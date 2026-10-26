import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** 索引の文書の行を YAML にする（`tags` の要素は YAML の書き方のまま渡す） */
function docYaml(doc: {
  id: string;
  title: string;
  aliases?: string[];
  tags?: string[];
  related?: string[];
}): string[] {
  return [
    `  - id: ${doc.id}`,
    `    path: ${doc.id}.md`,
    `    title: ${doc.title}`,
    ...(doc.aliases ? [`    aliases: [${doc.aliases.join(", ")}]`] : []),
    ...(doc.tags ? [`    tags: [${doc.tags.join(", ")}]`] : []),
    ...(doc.related ? [`    related: [${doc.related.join(", ")}]`] : []),
  ];
}

/** 設定の `index` が指す索引と文書を、作業のフォルダに置く。`vocabulary` は索引の `tags`（タグの語彙）の行 */
async function writeProject(
  dir: string,
  docs: Parameters<typeof docYaml>[0][],
  options: { bodies?: Record<string, string>; vocabulary?: string[] } = {},
): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      ...docs.flatMap(docYaml),
      ...(options.vocabulary ? ["tags:", ...options.vocabulary] : []),
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "b.md": "# B\n",
    "c.md": "# C\n",
    "d.md": "# D\n",
    ...options.bodies,
  });
}

/** タグを AND と OR で絞るフローが使う、語彙とタグを持つ作業のフォルダを置く（`docs` の並びは `c`・`a`・`b`） */
async function writeTaggedProject(dir: string): Promise<void> {
  await writeProject(
    dir,
    [
      { id: "c", title: "C", tags: ["topic:yaml"] },
      { id: "a", title: "A", tags: ["{name: topic:mcp, main: true}"] },
      {
        id: "b",
        title: "B",
        tags: ["topic:mcp", "{name: topic:yaml, main: true}"],
      },
    ],
    {
      vocabulary: [
        "  - name: topic:mcp",
        "    aliases: [MCP]",
        "  - name: topic:yaml",
      ],
    },
  );
}

/** 文書 25 個を全て載せ、全ての文書がタグ `設計` を持つ作業のフォルダを置く */
async function writeManyDocsProject(dir: string): Promise<string[]> {
  const ids = Array.from(
    { length: 25 },
    (_, index) => `d${String(index + 1).padStart(2, "0")}`,
  );
  await writeProject(
    dir,
    ids.map((id) => ({ id, title: `文書 ${id}`, tags: ["設計"] })),
    {
      bodies: Object.fromEntries(
        ids.map((id) => [`${id}.md`, `# 文書 ${id}\n\n本文 ${id}\n`]),
      ),
    },
  );
  return ids;
}

/** 文書のファイルの文字数（コードポイントの数）を引く */
async function charsOf(dir: string, id: string): Promise<number> {
  return [...(await readFile(join(dir, `${id}.md`), "utf8"))].length;
}

/** json 形式の結果の `docs` を並べて ID にする */
function idsOf(structured: Record<string, unknown> | undefined): string[] {
  const docs = (structured?.docs ?? []) as { id: string }[];
  return docs.map((doc) => doc.id);
}

// 題の一部で索引にある文書だけを、既定の項目の Markdown の表で返す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir, [{ id: "a", title: "文書 A", tags: ["設計"] }]);
  await writeFiles(dir, { "extra.md": "# 索引に無い文書 A\n" });
  const before = await readFile(join(dir, "index.yaml"), "utf8");
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "find_docs", { text: "文書 A" });
  const { tools } = await client.listTools();
  // 検証
  expect(result.isError).toBe(false);
  expect(result.structured).toBeUndefined();
  expect(result.texts).toHaveLength(1);
  const lines = (result.texts[0] ?? "").split("\n");
  const chars = await charsOf(dir, "a");
  expect(lines[0]).toContain("総件数 1 件・返した件数 1 件");
  expect(lines[0]).toContain(`合計文字数 ${chars}`);
  const tableLines = lines.filter((line) => line.startsWith("|"));
  expect(tableLines[0]).toBe("| ID | 題 | 概要 | タグ | 文字数 |");
  // 見出しと区切りの行を除いた行が、a の 1 行だけ
  expect(tableLines.slice(2)).toHaveLength(1);
  expect(tableLines[2]).toContain("| a |");
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(before);
  const tool = tools.find((candidate) => candidate.name === "find_docs");
  expect(tool?.annotations?.readOnlyHint).toBe(true);
});

// 全角と半角だけが違う語でも、別名に当たる文書を返す（正常系）
test("test_normal_when_width_differs", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir, [
    { id: "a", title: "文書 A", aliases: ["MCP"], tags: ["設計"] },
  ]);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "find_docs", { text: "ＭＣＰ" });
  // 検証
  expect(result.isError).toBe(false);
  const lines = (result.texts[0] ?? "").split("\n");
  expect(lines[0]).toContain("総件数 1 件・返した件数 1 件");
  // 見出しと区切りの行を除いた行が、a の 1 行だけ
  const tableLines = lines.filter((line) => line.startsWith("|"));
  expect(tableLines.slice(2)).toHaveLength(1);
  expect(tableLines[2]).toContain("| a |");
});

// どの文書にも無い語では総件数 0 件の結果を返す（正常系）
test("test_normal_when_no_match", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir, [{ id: "a", title: "文書 A" }]);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "find_docs", {
    text: "どの文書にも無い語",
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(result.texts[0]?.split("\n")[0]).toContain("総件数 0 件");
});

// related_to で参照先と被参照の文書を、関係の種類・向き・when つきで返す（正常系（関係する文書））
test("test_normal_when_related_to", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(
    dir,
    [
      {
        id: "a",
        title: "A",
        related: ["{to: b, type: requires, when: a の前提を確かめるとき}"],
      },
      { id: "b", title: "B" },
      {
        id: "c",
        title: "C",
        related: ["{to: a, type: part_of, when: 全体の中の位置を確かめるとき}"],
      },
      { id: "d", title: "D" },
      { id: "e", title: "E" },
    ],
    {
      bodies: {
        "d.md": "# D\n\n[A](a.md)\n",
        "e.md": "# E\n",
      },
    },
  );
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "find_docs", {
    related_to: "a",
    format: "json",
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(idsOf(result.structured)).toEqual(["b", "c", "d"]);
  const docs = (result.structured?.docs ?? []) as {
    id: string;
    relations: unknown;
  }[];
  const relationsOf = (id: string) =>
    docs.find((doc) => doc.id === id)?.relations;
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
  expect(relationsOf("d")).toEqual([
    { direction: "incoming", type: null, when: null },
  ]);
});

// tags で全てを持つ文書、any_tags でどれかを持つ文書を、主題のタグが当たる文書を上にして返す（正常系）
test("test_normal_when_tags_and_or", async () => {
  // 準備
  const dir = await createTempDir();
  await writeTaggedProject(dir);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const all = await callTool(client, "find_docs", {
    tags: ["topic:mcp", "topic:yaml"],
    format: "json",
  });
  const any = await callTool(client, "find_docs", {
    any_tags: ["topic:mcp", "topic:yaml"],
    format: "json",
  });
  // 検証
  expect(idsOf(all.structured)).toEqual(["b"]);
  expect(idsOf(any.structured)).toEqual(["a", "b", "c"]);
  const docs = (any.structured?.docs ?? []) as {
    id: string;
    tags: unknown;
  }[];
  expect(docs.find((doc) => doc.id === "a")?.tags).toEqual([
    { name: "topic:mcp", main: true },
  ]);
  expect(docs.find((doc) => doc.id === "c")?.tags).toEqual([
    { name: "topic:yaml", main: false },
  ]);
  expect(any.structured?.tag_counts).toEqual([
    { name: "topic:mcp", count: 2 },
    { name: "topic:yaml", count: 2 },
  ]);
});

// 語彙の別名を語彙のタグに直して引き、語彙に無いタグは拒まず警告と近いタグを添える（正常系）
test("test_normal_when_tag_vocabulary", async () => {
  // 準備
  const dir = await createTempDir();
  await writeTaggedProject(dir);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const alias = await callTool(client, "find_docs", {
    tags: ["MCP"],
    format: "json",
  });
  const unknown = await callTool(client, "find_docs", {
    tags: ["topic:mcq"],
    format: "json",
  });
  // 検証
  expect(idsOf(alias.structured)).toEqual(["a", "b"]);
  expect(unknown.isError).toBe(false);
  expect(unknown.structured?.total).toBe(0);
  const warnings = (unknown.structured?.warnings ?? []) as string[];
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("topic:mcq");
  expect(warnings[0]).toContain("topic:mcp");
});

// 引数なしで先頭の 20 件と next_cursor を返し、next_cursor で残りを返す（正常系）
test("test_normal_when_paged", async () => {
  // 準備
  const dir = await createTempDir();
  const ids = await writeManyDocsProject(dir);
  const client = await connectHttp({ projectDir: dir });
  const chars = await Promise.all(ids.map((id) => charsOf(dir, id)));
  // 実行
  const first = await callTool(client, "find_docs", { format: "json" });
  const cursor = first.structured?.next_cursor;
  const second = await callTool(client, "find_docs", {
    cursor,
    format: "json",
  });
  // 検証
  expect(idsOf(first.structured)).toEqual(ids.slice(0, 20));
  expect(first.structured?.total).toBe(25);
  expect(first.structured?.returned).toBe(20);
  expect(first.structured?.total_chars).toBe(
    chars.reduce((sum, count) => sum + count, 0),
  );
  expect(first.structured?.tag_counts).toEqual([{ name: "設計", count: 25 }]);
  expect(typeof cursor).toBe("string");
  const hint = first.structured?.hint as string;
  for (const word of ["tags", "any_tags", "text", "count_only"]) {
    expect(hint).toContain(word);
  }
  expect(idsOf(second.structured)).toEqual(ids.slice(20));
  expect(second.structured?.next_cursor).toBeNull();
  expect(second.structured?.hint).toBeNull();
});

// count_only で文書の行を返さず、総件数・合計文字数・タグごとの件数だけを返す（正常系）
test("test_normal_when_count_only", async () => {
  // 準備
  const dir = await createTempDir();
  await writeTaggedProject(dir);
  const client = await connectHttp({ projectDir: dir });
  const anyTags = ["topic:mcp", "topic:yaml"];
  // 実行
  const counted = await callTool(client, "find_docs", {
    any_tags: anyTags,
    count_only: true,
    format: "json",
  });
  const listed = await callTool(client, "find_docs", {
    any_tags: anyTags,
    format: "json",
  });
  // 検証
  for (const key of ["docs", "returned", "next_cursor", "omitted"]) {
    expect(counted.structured).not.toHaveProperty(key);
  }
  expect(counted.structured?.total).toBe(3);
  const docs = (listed.structured?.docs ?? []) as { chars: number }[];
  expect(counted.structured?.total_chars).toBe(
    docs.reduce((sum, doc) => sum + doc.chars, 0),
  );
});

// 既定では省いた項目と取り方を返し、include で項目を加え、json で structuredContent と text に同じ JSON を返す（正常系）
test("test_normal_when_view_and_format", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir, [{ id: "a", title: "文書 A", tags: ["設計"] }]);
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const brief = await callTool(client, "find_docs", {
    text: "文書 A",
    format: "json",
  });
  const withPath = await callTool(client, "find_docs", {
    text: "文書 A",
    include: ["path"],
    format: "json",
  });
  // 検証
  const omitted = (brief.structured?.omitted ?? []) as {
    field: string;
    how: string;
  }[];
  expect(omitted.map((item) => item.field)).toEqual([
    "path",
    "aliases",
    "related",
    "referenced_by",
  ]);
  expect(omitted[0]?.how).toBe('include: ["path"]');
  const briefDocs = (brief.structured?.docs ?? []) as object[];
  expect(briefDocs[0]).not.toHaveProperty("path");
  const pathDocs = (withPath.structured?.docs ?? []) as { path: string }[];
  expect(pathDocs[0]?.path).toBe("a.md");
  const pathOmitted = (withPath.structured?.omitted ?? []) as {
    field: string;
  }[];
  expect(pathOmitted.map((item) => item.field)).not.toContain("path");
  for (const result of [brief, withPath]) {
    expect(result.texts).toHaveLength(1);
    expect(JSON.parse(result.texts[0] ?? "")).toEqual(result.structured);
  }
});

// 設定に index が無いときはエラーにする（異常系）
test("test_error_when_index_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "features:\n  print: true\n" });
  const client = await connectHttp({ projectDir: dir });
  // 実行
  const result = await callTool(client, "find_docs", {});
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("index がありません");
  expect(result.texts[0]).toContain("索引のファイル");
});

// 読めない cursor と、条件を変えた cursor はエラーにする（異常系）
test("test_error_when_cursor_invalid", async () => {
  // 準備
  const dir = await createTempDir();
  await writeManyDocsProject(dir);
  const client = await connectHttp({ projectDir: dir });
  const first = await callTool(client, "find_docs", {
    tags: ["設計"],
    format: "json",
  });
  // 実行
  const unreadable = await callTool(client, "find_docs", {
    cursor: "not-a-cursor",
  });
  const changed = await callTool(client, "find_docs", {
    tags: ["設計"],
    text: "文書",
    cursor: first.structured?.next_cursor,
  });
  // 検証
  for (const result of [unreadable, changed]) {
    expect(result.isError).toBe(true);
    expect(result.texts[0]).toContain("cursor");
    expect(result.texts[0]).toContain("省いて先頭から引き直して");
  }
});

// project_dir を持たない呼び出しを、作業のフォルダを読まずにエラーにする（異常系）
test("test_error_when_project_dir_missing", async () => {
  // 準備
  const client = await connectHttp();
  // 実行
  const result = await callTool(client, "find_docs", { text: "文書 A" });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("project_dir");
  expect(result.texts[0]).toContain("プラグインを入れた");
});
