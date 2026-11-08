import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, runCli, test, writeFiles } from "../cli.ts";
import {
  callTool,
  DOCUMENTS,
  findFreePort,
  hookInputs,
  indexYaml,
  isListening,
  readMcpUrl,
  withMcpClient,
  withServe,
} from "../plugin.ts";

// ブラウザを使用しないため、1 つのブラウザのプロジェクトだけで実行する
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 雛形を配置した後の設定・索引に、`ids` の文書だけを記載し、`documents` を記載する */
async function writeProject(
  builtRoot: string,
  dir: string,
  ids: string[],
  documents: Record<string, string>,
): Promise<void> {
  expect((await runCli(builtRoot, ["init"], dir)).code).toBe(0);
  await writeFiles(dir, { "index.yaml": indexYaml(ids), ...documents });
}

// 常駐サーバーを 1 つ起動し、作業のフォルダが違う 2 つのセッションが同じプロセスのツールを呼ぶ（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dirA = await tempDir();
  const dirB = await tempDir();
  await writeProject(builtRoot, dirA, ["a"], { "a.md": DOCUMENTS["a.md"] });
  await writeProject(builtRoot, dirB, ["a"], DOCUMENTS);
  // 実行
  const result = await withServe({ builtRoot, env: {} }, async (serve) => {
    const sessionA = await withMcpClient(
      { builtRoot, projectDir: dirA, serverUrl: serve.url },
      async (client) => ({
        checked: await callTool(client, "check"),
        built: await callTool(client, "build_site"),
        inputs: hookInputs(client),
      }),
    );
    const sessionB = await withMcpClient(
      { builtRoot, projectDir: dirB, serverUrl: serve.url },
      async (client) => ({
        checked: await callTool(client, "check"),
        inputs: hookInputs(client),
      }),
    );
    return {
      sessionA,
      sessionB,
      listening: await isListening(serve.port),
    };
  });
  // 検証
  // 2 つのセッションは、起動した 1 つの常駐サーバーのプロセスにつないだ
  expect(result.listening).toBe(true);
  expect(result.sessionA.checked.isError).toBe(false);
  expect(JSON.parse(result.sessionA.checked.texts[0] ?? "")).toEqual({
    issues: [],
  });
  expect(result.sessionA.built.isError).toBe(false);
  const built = JSON.parse(result.sessionA.built.texts[0] ?? "");
  expect(built.out).toBe(join(dirA, "dist", "docs.html"));
  expect(existsSync(built.out)).toBe(true);
  expect(built.docs).toBe(1);
  const issues = JSON.parse(result.sessionB.checked.texts[0] ?? "").issues as {
    kind: string;
    file: string;
  }[];
  const orphans = issues.filter((issue) => issue.kind === "orphan_doc");
  expect(orphans).toHaveLength(1);
  expect(orphans[0]?.file).toBe("b.md");
  // フックの記録の `tool_input` に、作業のフォルダの引数が無い
  for (const input of [...result.sessionA.inputs, ...result.sessionB.inputs]) {
    expect(input).not.toHaveProperty("project_dir");
  }
  expect(result.sessionA.inputs).toHaveLength(2);
  expect(result.sessionB.inputs).toHaveLength(1);
});

// 常駐サーバーが起動していなくてもセッションは開け、起動した後はもう一度接続してツールを呼べる（異常シナリオ（常駐サーバーが起動していない））
test("test_error_when_server_not_running", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeProject(builtRoot, dir, ["a"], { "a.md": DOCUMENTS["a.md"] });
  const port = await findFreePort();
  const mcp = await readMcpUrl({
    pluginDir: resolve(builtRoot, "plugin"),
    env: { MDMARK_PORT: String(port) },
  });
  expect(await isListening(port)).toBe(false);
  // 実行
  const before = await withMcpClient(
    { builtRoot, projectDir: dir, serverUrl: mcp.url },
    async () => "connected",
  ).catch((error: unknown) => error);
  const after = await withServe(
    { builtRoot, env: { MDMARK_PORT: String(port) } },
    () =>
      withMcpClient(
        { builtRoot, projectDir: dir, serverUrl: mcp.url },
        async (client) => ({
          checked: await callTool(client, "check"),
          built: await callTool(client, "build_site"),
        }),
      ),
  );
  // 検証
  expect(before).toBeInstanceOf(Error);
  expect(after.checked.isError).toBe(false);
  expect(JSON.parse(after.checked.texts[0] ?? "")).toEqual({ issues: [] });
  expect(after.built.isError).toBe(false);
  const built = JSON.parse(after.built.texts[0] ?? "");
  expect(built.out).toBe(join(dir, "dist", "docs.html"));
  expect(existsSync(built.out)).toBe(true);
  expect(built.docs).toBe(1);
});
