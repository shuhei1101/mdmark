import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
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

/** 設定・索引・文書を置く */
async function writeProject(
  dir: string,
  ids: string[],
  documents: Record<string, string>,
): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_INDEX,
    "index.yaml": indexYaml(ids),
    ...documents,
  });
}

/** 索引のファイルの `docs` を読む */
async function readDocs(dir: string): Promise<{ id: string }[]> {
  return parse(await readFile(join(dir, "index.yaml"), "utf8")).docs;
}

// 索引に無い文書を足し、1 つ目の文書の行は変わらない（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir, ["a"], DOCUMENTS);
  const before = await readDocs(dir);
  // 実行
  const result = await withMcpClient({ builtRoot, projectDir: dir }, (client) =>
    callTool(client, "update_index", {
      kind: "doc",
      id: "b",
      item: { path: "b.md", title: "B" },
    }),
  );
  // 検証
  expect(result.isError).toBe(false);
  const docs = await readDocs(dir);
  expect(docs.map((doc) => doc.id)).toEqual(["a", "b"]);
  expect(docs[0]).toEqual(before[0]);
});

// item が null のとき、渡した ID の行だけがなくなる（正常シナリオ）
test("test_normal_when_removed", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir, ["a", "old"], { "a.md": "# A\n" });
  const before = await readDocs(dir);
  // 実行
  const result = await withMcpClient({ builtRoot, projectDir: dir }, (client) =>
    callTool(client, "update_index", { kind: "doc", id: "old", item: null }),
  );
  // 検証
  expect(result.isError).toBe(false);
  const docs = await readDocs(dir);
  expect(docs.map((doc) => doc.id)).toEqual(["a"]);
  expect(docs[0]).toEqual(before[0]);
});

// パスの無い項目は書かずにエラーにし、索引のファイルは変わらない（異常シナリオ）
test("test_error_when_schema_invalid", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir, ["a"], DOCUMENTS);
  const before = await readFile(join(dir, "index.yaml"), "utf8");
  // 実行
  const result = await withMcpClient({ builtRoot, projectDir: dir }, (client) =>
    callTool(client, "update_index", {
      kind: "doc",
      id: "b",
      item: { title: "B" },
    }),
  );
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("docs[1].path");
  expect(result.texts[0]).toContain("path");
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(before);
});

// 2 つ目の文書の related に to・type・when・paths のオブジェクトを書き、書き換えた索引が Schema に合う（正常シナリオ（関連を書く））
test("test_normal_when_related", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir, ["a"], DOCUMENTS);
  const before = await readDocs(dir);
  const related = {
    to: "a",
    type: "requires",
    when: "前提を確かめるとき",
    paths: ["src/**"],
  };
  // 実行
  const { result, check } = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      result: await callTool(client, "update_index", {
        kind: "doc",
        id: "b",
        item: { path: "b.md", title: "B", related: [related] },
      }),
      check: await callTool(client, "check"),
    }),
  );
  // 検証
  expect(result.isError).toBe(false);
  const docs = (await readDocs(dir)) as { id: string; related?: unknown }[];
  expect(docs.map((doc) => doc.id)).toEqual(["a", "b"]);
  expect(docs[1]?.related).toEqual([related]);
  expect(docs[0]).toEqual(before[0]);
  // 書き換えた後の索引が Schema に合う
  expect(JSON.parse(check.texts[0] ?? "")).toEqual({ issues: [] });
});

// 語彙を持たない索引に、語彙のタグを name でグループ・説明・別名つきで足す（正常シナリオ（タグの語彙を書き換える））
test("test_normal_when_tag", async ({ builtRoot, tempDir }) => {
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
      "    tags: [topic:mcp]",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
  const before = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  const item = {
    group: "topic",
    description:
      "含める: MCP のツール。含めない: Claude Code の設定。例: find_docs",
    aliases: ["MCP"],
  };
  // 実行
  const { result, check } = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      result: await callTool(client, "update_index", {
        kind: "tag",
        id: "topic:mcp",
        item,
      }),
      check: await callTool(client, "check"),
    }),
  );
  // 検証
  expect(result.isError).toBe(false);
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  expect(index.tags).toEqual([{ name: "topic:mcp", ...item }]);
  expect(index.docs).toEqual(before.docs);
  expect(index.terms).toEqual(before.terms);
  // 書き換えた後の索引が Schema に合い、タグのずれも無い
  expect(JSON.parse(check.texts[0] ?? "")).toEqual({ issues: [] });
});
