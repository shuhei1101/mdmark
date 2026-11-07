import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { installPlugin } from "../claude-plugin.ts";
import { expect, test } from "../cli.ts";
import {
  describeError,
  findFreePort,
  isListening,
  readMcpUrl,
  withMcpClient,
  withServe,
} from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 今の HEAD のブランチをマーケットプレイスとして足し、プラグインを入れ、起動した常駐サーバーにつながる（正常シナリオ）
// ブランチは push 済みであること。tester が release ブランチで `dist/` と `plugin/` の生成物を commit して push した後に流す
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 実行
  const { installPath } = await installPlugin(await tempDir());
  const { mcp, port, tools } = await withServe(
    { builtRoot, env: {} },
    async (serve) => {
      const mcp = await readMcpUrl({
        pluginDir: installPath,
        env: { MDMARK_PORT: String(serve.port) },
      });
      const tools = await withMcpClient(
        { builtRoot, serverUrl: mcp.url },
        async (client) =>
          (await client.listTools()).tools.map((tool) => tool.name),
      );
      return { mcp, port: serve.port, tools };
    },
  );
  // 検証
  for (const path of [
    join("hooks", "hooks.json"),
    ".mcp.json",
    join("scripts", "pre-tool-use.js"),
    join("scripts", "session-start.js"),
    join("skills", "global-setup", "SKILL.md"),
    join("skills", "setup", "SKILL.md"),
  ]) {
    expect(existsSync(join(installPath, path)), path).toBe(true);
  }
  for (const path of ["guide", "node_modules"]) {
    expect(existsSync(join(installPath, path)), path).toBe(false);
  }
  expect(mcp.type).toBe("http");
  expect(mcp.url).toBe(`http://127.0.0.1:${port}/mcp`);
  expect(mcp.hasCommand).toBe(false);
  expect(tools).toEqual(
    expect.arrayContaining(["build_site", "check", "export_html"]),
  );
  expect(tools).not.toContain("read_guide");
  const hooks = JSON.parse(
    await readFile(join(installPath, "hooks", "hooks.json"), "utf8"),
  );
  expect(hooks.hooks.SessionStart).toHaveLength(1);
});

// 常駐サーバーが起動していなくてもプラグインは入り、接続だけが拒否される（異常シナリオ（常駐サーバーが起動していない））
test("test_error_when_server_not_running", async ({ builtRoot, tempDir }) => {
  // 準備
  const port = await findFreePort();
  expect(await isListening(port)).toBe(false);
  // 実行
  const { installPath } = await installPlugin(await tempDir());
  const mcp = await readMcpUrl({
    pluginDir: installPath,
    env: { MDMARK_PORT: String(port) },
  });
  const connecting = await withMcpClient(
    { builtRoot, serverUrl: mcp.url },
    async () => undefined,
  ).catch((error: unknown) => error);
  // 検証
  expect(connecting).toBeInstanceOf(Error);
  expect(describeError(connecting)).toContain("ECONNREFUSED");
});
