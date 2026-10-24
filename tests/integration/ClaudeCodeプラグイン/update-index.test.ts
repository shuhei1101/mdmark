import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { runCli, useTempDirs, writeFiles } from "../cli.ts";
import { builtPluginDir, callTool, useMcpClients } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectInMemory } = useMcpClients();

/** 文書 `a` だけを載せた索引 */
const INDEX_A = [
  "schema: 1",
  "docs:",
  "  - id: a",
  "    path: a.md",
  "    title: 文書 A",
  "",
].join("\n");

/** 設定・索引・文書 2 つを作業のフォルダに置く */
async function writeProject(dir: string, index = INDEX_A): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": index,
    "a.md": "# A\n",
    "b.md": "# B\n",
  });
}

/** 索引のファイルを読み、`docs` の ID を並べる */
async function readDocIds(dir: string): Promise<string[]> {
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  return index.docs.map((doc: { id: string }) => doc.id);
}

// 索引に無い文書を足す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir);
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "update_index", {
    kind: "doc",
    id: "b",
    item: { path: "b.md", title: "文書 B", tags: ["設計"] },
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "").action).toBe("added");
  expect(await readDocIds(dir)).toEqual(["a", "b"]);
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  expect(index.docs[0]).toEqual({ id: "a", path: "a.md", title: "文書 A" });
  const check = await runCli(["check"], dir);
  expect(check.stdout).toContain("ずれ 0 件");
});

// 索引にある文書の項目を置き換える（正常系）
test("test_normal_when_replaced", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir);
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "update_index", {
    kind: "doc",
    id: "a",
    item: { path: "a.md", title: "題を変えた文書 A" },
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "").action).toBe("replaced");
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  expect(index.docs).toHaveLength(1);
  expect(index.docs[0].title).toBe("題を変えた文書 A");
});

// item が null のとき、その ID の項目を消す（正常系）
test("test_normal_when_removed", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(
    dir,
    `${INDEX_A}  - id: old\n    path: old.md\n    title: Old\n`,
  );
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "update_index", {
    kind: "doc",
    id: "old",
    item: null,
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "").action).toBe("removed");
  expect(await readDocIds(dir)).toEqual(["a"]);
});

// パスの無い項目は書かずにエラーにする（異常系）
test("test_error_when_schema_invalid", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir);
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "update_index", {
    kind: "doc",
    id: "b",
    item: { title: "文書 B" },
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("docs[1].path");
  expect(result.texts[0]).toContain("path");
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(INDEX_A);
  // 一時ファイルとロックも残らない
  expect((await readdir(dir)).sort()).toEqual([
    "a.md",
    "b.md",
    "index.yaml",
    "mdmark.config.yaml",
  ]);
});

// 無い ID を消そうとするとエラーにする（異常系）
test("test_error_when_item_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir);
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "update_index", {
    kind: "doc",
    id: "z",
    item: null,
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("z");
  expect(result.texts[0]).toContain("docs");
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(INDEX_A);
});

// 語彙を持たない索引に、語彙のタグを name で足す（正常系）
test("test_normal_when_tag", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(
    dir,
    [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: 文書 A",
      "    tags: [topic:mcp]",
      "",
    ].join("\n"),
  );
  // 文書は a.md の 1 つだけにする
  await rm(join(dir, "b.md"));
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  const item = {
    group: "topic",
    description:
      "含める: MCP のツール。含めない: Claude Code の設定。例: find_docs",
    aliases: ["MCP"],
  };
  // 実行
  const result = await callTool(client, "update_index", {
    kind: "tag",
    id: "topic:mcp",
    item,
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "").action).toBe("added");
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  expect(index.tags).toHaveLength(1);
  expect(Object.keys(index.tags[0])).toEqual([
    "name",
    "group",
    "description",
    "aliases",
  ]);
  expect(index.tags[0]).toEqual({ name: "topic:mcp", ...item });
  expect(index.docs).toEqual([
    { id: "a", path: "a.md", title: "文書 A", tags: ["topic:mcp"] },
  ]);
  expect(index).not.toHaveProperty("terms");
  const check = await runCli(["check"], dir);
  expect(check.stdout).toContain("ずれ 0 件");
});
