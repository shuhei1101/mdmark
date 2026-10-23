import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";
import { builtPluginDir, callTool, useMcpClients } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectInMemory } = useMcpClients();

/** 索引の文書の行を YAML にする */
function docYaml(doc: {
  id: string;
  title: string;
  tags?: string[];
  related?: string[];
}): string[] {
  return [
    `  - id: ${doc.id}`,
    `    path: ${doc.id}.md`,
    `    title: ${doc.title}`,
    ...(doc.tags ? [`    tags: [${doc.tags.join(", ")}]`] : []),
    ...(doc.related ? [`    related: [${doc.related.join(", ")}]`] : []),
  ];
}

/** 設定の `index` が指す索引と文書を、作業のフォルダに置く */
async function writeProject(
  dir: string,
  docs: Parameters<typeof docYaml>[0][],
  bodies: Record<string, string> = {},
): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": ["schema: 1", "docs:", ...docs.flatMap(docYaml), ""].join(
      "\n",
    ),
    "a.md": "# A\n",
    "b.md": "# B\n",
    "c.md": "# C\n",
    "d.md": "# D\n",
    ...bodies,
  });
}

// 題の一部で索引にある文書だけを返す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir, [{ id: "a", title: "文書 A", tags: ["設計"] }]);
  await writeFiles(dir, { "extra.md": "# 索引に無い文書 A\n" });
  const before = await readFile(join(dir, "index.yaml"), "utf8");
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "find_docs", { text: "文書 A" });
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "")).toEqual({
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "文書 A",
        description: null,
        tags: ["設計"],
      },
    ],
  });
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(before);
});

// どの文書にも無い語では空の一覧を返す（正常系）
test("test_normal_when_no_match", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(dir, [{ id: "a", title: "文書 A" }]);
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "find_docs", {
    text: "どの文書にも無い語",
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "")).toEqual({ docs: [] });
});

// related_to で参照先と被参照の文書を返す（正常系）
test("test_normal_when_related_to", async () => {
  // 準備
  const dir = await createTempDir();
  await writeProject(
    dir,
    [
      { id: "a", title: "A", related: ["b"] },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
      { id: "d", title: "D" },
    ],
    { "c.md": "# C\n\n[A](a.md)\n" },
  );
  const client = await connectInMemory({
    projectDir: dir,
    pluginDir: builtPluginDir(),
  });
  // 実行
  const result = await callTool(client, "find_docs", { related_to: "a" });
  // 検証
  expect(result.isError).toBe(false);
  const docs = JSON.parse(result.texts[0] ?? "").docs as { id: string }[];
  expect(docs.map((doc) => doc.id)).toEqual(["b", "c"]);
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
  const result = await callTool(client, "find_docs", {});
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("index がありません");
  expect(result.texts[0]).toContain("索引のファイル");
});
