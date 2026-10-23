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
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) =>
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
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) =>
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
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) =>
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
