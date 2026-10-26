import { resolve } from "node:path";
import { expect, runCli, test, writeFiles } from "../cli.ts";
import {
  callTool,
  DEFAULT_PORT,
  DOCUMENTS,
  hookInputs,
  indexYaml,
  isListening,
  lockDefaultPort,
  readMcpUrl,
  withMcpClient,
  withServe,
} from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 雛形を置いた後の設定・索引に、`ids` の文書だけを載せ、`documents` を書く */
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
  const release = await lockDefaultPort();
  try {
    const dirA = await tempDir();
    const dirB = await tempDir();
    await writeProject(builtRoot, dirA, ["a"], { "a.md": DOCUMENTS["a.md"] });
    await writeProject(builtRoot, dirB, ["a"], DOCUMENTS);
    // 実行
    const result = await withServe({ builtRoot, env: {} }, async (serve) => {
      const found = await withMcpClient(
        { builtRoot, projectDir: dirA, serverUrl: serve.url },
        async (client) => ({
          found: await callTool(client, "find_docs", { text: "A" }),
          inputs: hookInputs(client),
        }),
      );
      const checked = await withMcpClient(
        { builtRoot, projectDir: dirB, serverUrl: serve.url },
        async (client) => ({
          checked: await callTool(client, "check"),
          inputs: hookInputs(client),
        }),
      );
      return { found, checked, listening: await isListening(DEFAULT_PORT) };
    });
    // 検証
    // 2 つのセッションは、起動した 1 つの常駐サーバーのプロセスにつないだ
    expect(result.listening).toBe(true);
    expect(result.found.found.isError).toBe(false);
    expect(result.found.found.texts[0]).toContain("| a |");
    const issues = JSON.parse(result.checked.checked.texts[0] ?? "").issues as {
      kind: string;
      file: string;
    }[];
    const orphans = issues.filter((issue) => issue.kind === "orphan_doc");
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.file).toBe("b.md");
    // フックの記録の `tool_input` に、作業のフォルダの引数が無い
    for (const input of [...result.found.inputs, ...result.checked.inputs]) {
      expect(input).not.toHaveProperty("project_dir");
    }
    expect(result.found.inputs).toHaveLength(1);
    expect(result.checked.inputs).toHaveLength(1);
  } finally {
    await release();
  }
});

// 常駐サーバーが起動していなくてもセッションは開け、起動した後は接続し直してツールを呼べる（異常シナリオ（常駐サーバーが起動していない））
test("test_error_when_server_not_running", async ({ builtRoot, tempDir }) => {
  // 準備
  const release = await lockDefaultPort();
  try {
    const dir = await tempDir();
    await writeProject(builtRoot, dir, ["a"], { "a.md": DOCUMENTS["a.md"] });
    const mcp = await readMcpUrl({
      pluginDir: resolve(builtRoot, "plugin"),
      env: {},
    });
    expect(await isListening(DEFAULT_PORT)).toBe(false);
    // 実行
    const before = await withMcpClient(
      { builtRoot, projectDir: dir, serverUrl: mcp.url },
      async () => "connected",
    ).catch((error: unknown) => error);
    const after = await withServe({ builtRoot, env: {} }, () =>
      withMcpClient(
        { builtRoot, projectDir: dir, serverUrl: mcp.url },
        (client) => callTool(client, "find_docs", { text: "A" }),
      ),
    );
    // 検証
    expect(before).toBeInstanceOf(Error);
    expect(after.isError).toBe(false);
    expect(after.texts[0]).toContain("| a |");
  } finally {
    await release();
  }
});
