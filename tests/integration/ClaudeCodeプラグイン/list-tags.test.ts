import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";
import { builtPluginDir, callTool, useMcpClients } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectInMemory } = useMcpClients();

/** タグの語彙の `topic:mcp` の説明 */
const MCP_DESCRIPTION =
  "含める: MCP のツール。含めない: Claude Code の設定。例: find_docs";

/** 語彙のタグと、別名 `MCP` で付けた文書を持つ作業のフォルダを置く */
async function writeVocabularyProject(dir: string): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    tags: [{name: topic:mcp, main: true}]",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "    tags: [MCP, topic:yaml]",
      "tags:",
      "  - name: topic:mcp",
      "    group: topic",
      `    description: "${MCP_DESCRIPTION}"`,
      "    aliases: [MCP]",
      "  - name: topic:yaml",
      "  - name: topic:old",
      "    deprecated: topic:mcp",
      "  - name: topic:unused",
      "",
    ].join("\n"),
    "a.md": "# A\n",
    "b.md": "# B\n",
  });
}

/** json 形式の結果の `tags` を取り出す */
function tagsOf(structured: Record<string, unknown> | undefined) {
  return (structured?.tags ?? []) as {
    name: string;
    group: string | null;
    description: string | null;
    aliases: string[];
    deprecated: string | null;
    docs: number;
  }[];
}

// 語彙の全てのタグを、付いている文書の数つきで返す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  await writeVocabularyProject(dir);
  const before = await readFile(join(dir, "index.yaml"), "utf8");
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "list_tags", { format: "json" });
  const { tools } = await client.listTools();
  // 検証
  expect(result.isError).toBe(false);
  const tags = tagsOf(result.structured);
  expect(tags.map((tag) => tag.name)).toEqual([
    "topic:mcp",
    "topic:yaml",
    "topic:old",
    "topic:unused",
  ]);
  expect(tags[0]).toEqual({
    name: "topic:mcp",
    group: "topic",
    description: MCP_DESCRIPTION,
    aliases: ["MCP"],
    deprecated: null,
    docs: 2,
  });
  expect(tags[1]?.docs).toBe(1);
  expect(tags[2]?.deprecated).toBe("topic:mcp");
  expect(tags[2]?.docs).toBe(0);
  expect(tags[3]?.docs).toBe(0);
  expect(JSON.parse(result.texts[0] ?? "")).toEqual(result.structured);
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(before);
  const tool = tools.find((candidate) => candidate.name === "list_tags");
  expect(tool?.annotations?.readOnlyHint).toBe(true);
});

// query が名前・別名・説明に当たるタグだけを返す（正常系）
test("test_normal_when_query", async () => {
  // 準備
  const dir = await createTempDir();
  await writeVocabularyProject(dir);
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "list_tags", {
    query: "mcp",
    format: "json",
  });
  // 検証
  expect(tagsOf(result.structured).map((tag) => tag.name)).toEqual([
    "topic:mcp",
  ]);
});

// 語彙を持たない索引では空の一覧を返す（正常系）
test("test_normal_when_no_vocabulary", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    tags: [設計]",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "list_tags", { format: "json" });
  // 検証
  expect(result.isError).toBe(false);
  expect(tagsOf(result.structured)).toEqual([]);
});

// 設定に index が無いときはエラーにする（異常系）
test("test_error_when_index_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "features:\n  print: true\n" });
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "list_tags", {});
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("index がありません");
  expect(result.texts[0]).toContain("索引のファイル");
});
