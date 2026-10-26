import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { expect, runCli, test, writeFiles } from "../cli.ts";
import {
  callTool,
  DOCUMENTS,
  type Issue,
  indexYaml,
  withMcpClient,
} from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 雛形を置いた後の設定・索引に、文書 2 つを書く。索引に載せるのは `ids` だけ */
async function writeProject(
  builtRoot: string,
  dir: string,
  ids: string[],
  documents: Record<string, string>,
): Promise<void> {
  expect((await runCli(builtRoot, ["init"], dir)).code).toBe(0);
  await writeFiles(dir, { "index.yaml": indexYaml(ids), ...documents });
}

/** 索引のファイルの `docs` の ID を読む */
async function readDocIds(dir: string): Promise<string[]> {
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  return index.docs.map((doc: { id: string }) => doc.id);
}

// 探す・書き換える・点検する・まとめるをつなぎ、索引に 2 つ目の文書が入って 1 枚の HTML が書かれる（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(builtRoot, dir, ["a"], DOCUMENTS);
  // 実行
  const steps = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      found: await callTool(client, "find_docs", {
        text: "A",
        format: "json",
      }),
      updated: await callTool(client, "update_index", {
        kind: "doc",
        id: "b",
        item: { path: "b.md", title: "B" },
      }),
      checked: await callTool(client, "check"),
      built: await callTool(client, "build_site"),
    }),
  );
  // 検証
  expect(JSON.parse(steps.found.texts[0] ?? "").docs).toHaveLength(1);
  expect(steps.updated.isError).toBe(false);
  expect(await readDocIds(dir)).toEqual(["a", "b"]);
  expect(JSON.parse(steps.checked.texts[0] ?? "")).toEqual({ issues: [] });
  const built = JSON.parse(steps.built.texts[0] ?? "");
  expect(built.docs).toBe(2);
  expect(existsSync(built.out)).toBe(true);
});

// 点検でずれが見つかったら、直してから点検し直し、その後に 1 枚にまとめる（異常シナリオ）
test("test_error_when_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(builtRoot, dir, ["a", "b"], DOCUMENTS);
  await rm(join(dir, "a.md"));
  // 実行
  const steps = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => ({
      first: await callTool(client, "check"),
      removed: await callTool(client, "update_index", {
        kind: "doc",
        id: "a",
        item: null,
      }),
      second: await callTool(client, "check"),
      built: await callTool(client, "build_site"),
    }),
  );
  // 検証
  const firstIssues = JSON.parse(steps.first.texts[0] ?? "").issues as Issue[];
  expect(
    firstIssues.filter((issue) => issue.kind === "missing_doc"),
  ).toHaveLength(1);
  expect(steps.removed.isError).toBe(false);
  expect(await readDocIds(dir)).toEqual(["b"]);
  expect(JSON.parse(steps.second.texts[0] ?? "")).toEqual({ issues: [] });
  expect(steps.built.isError).toBe(false);
  expect(existsSync(JSON.parse(steps.built.texts[0] ?? "").out)).toBe(true);
});
