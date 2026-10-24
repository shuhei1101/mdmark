import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, writeFiles } from "../cli.ts";
import { CONFIG_WITH_INDEX, callTool, withMcpClient } from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** `topic:mcp` の説明 */
const MCP_DESCRIPTION =
  "含める: MCP のツール。含めない: Claude Code の設定。例: find_docs";

/** 語彙に `topic:mcp`・`topic:yaml`・`topic:old`・`topic:unused` を持つ索引と文書 2 つを置く。`a` のタグは主題の `topic:mcp`、`b` のタグは `topic:mcp` と `topic:yaml` */
async function writeVocabularyProject(dir: string): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_INDEX,
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
      "    tags: [topic:mcp, topic:yaml]",
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

/** Markdown の結果から、タグの表の行を並べる（見出しと区切りの行は除く） */
function rowsOf(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2);
}

// 語彙の全てのタグが、付いている文書の数つきで語彙の並びに返る（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeVocabularyProject(dir);
  const files = ["index.yaml", "a.md", "b.md"];
  const before = await Promise.all(
    files.map((file) => readFile(join(dir, file), "utf8")),
  );
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "list_tags"),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(rowsOf(result.texts[0] ?? "")).toEqual([
    `| topic:mcp | topic | ${MCP_DESCRIPTION} | MCP | - | 2 |`,
    "| topic:yaml | - | - | - | - | 1 |",
    "| topic:old | - | - | - | topic:mcp | 0 |",
    "| topic:unused | - | - | - | - | 0 |",
  ]);
  expect(
    await Promise.all(files.map((file) => readFile(join(dir, file), "utf8"))),
  ).toEqual(before);
});

// 別名で語を絞ると、当たるタグだけが返る（正常シナリオ（語で絞る））
test("test_normal_when_query", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeVocabularyProject(dir);
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "list_tags", { query: "MCP" }),
  );
  // 検証
  const rows = rowsOf(result.texts[0] ?? "");
  expect(rows[0]).toMatch(/^\| topic:mcp \|/);
  expect(result.texts[0]).not.toContain("topic:unused");
});

// 語彙を持たない索引では、エラーにならず空の一覧を返す（正常シナリオ（語彙が無い））
test("test_normal_when_no_vocabulary", async ({ builtRoot, tempDir }) => {
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
      "    tags: [設計]",
      "",
    ].join("\n"),
    "a.md": "# A\n",
  });
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "list_tags"),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(rowsOf(result.texts[0] ?? "")).toEqual([]);
});

// 全角の語でも、半角の別名を持つタグだけが返る（正常シナリオ（全角と半角だけが違う語））
test("test_normal_when_query_width_differs", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeVocabularyProject(dir);
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "list_tags", { query: "ＭＣＰ" }),
  );
  // 検証
  const rows = rowsOf(result.texts[0] ?? "");
  expect(rows[0]).toMatch(/^\| topic:mcp \|/);
  expect(result.texts[0]).not.toContain("topic:unused");
});
