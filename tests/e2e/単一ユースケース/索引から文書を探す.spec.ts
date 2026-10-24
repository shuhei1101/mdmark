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

// 1 つ目の文書の題名の一部で、その文書だけが返る（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir);
  const before = await Promise.all(
    ["index.yaml", "a.md", "b.md"].map((file) =>
      readFile(join(dir, file), "utf8"),
    ),
  );
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "find_docs", { text: "A" }),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "")).toEqual({
    docs: [{ id: "a", path: "a.md", title: "A", description: null, tags: [] }],
  });
  expect(
    await Promise.all(
      ["index.yaml", "a.md", "b.md"].map((file) =>
        readFile(join(dir, file), "utf8"),
      ),
    ),
  ).toEqual(before);
});

// どの文書にも無い語では空の一覧を返し、エラーにしない（正常シナリオ）
test("test_normal_when_no_match", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(dir);
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "find_docs", { text: "どの文書にも無い語" }),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "")).toEqual({ docs: [] });
});
