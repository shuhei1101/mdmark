import { createServer, type Server } from "node:net";
import { afterEach, expect, test } from "vitest";
import {
  builtPluginDir,
  findFreePort,
  runSessionStartHook,
} from "../plugin.ts";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

// 常駐サーバーが待ち受けていれば何も出さない（正常系）
test("test_normal", async () => {
  // 準備
  const server = createServer();
  servers.push(server);
  const port = await findFreePort();
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  // 実行
  const result = await runSessionStartHook({
    pluginDir: builtPluginDir(),
    env: { MDMARK_PORT: String(port) },
  });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
});

// 待ち受けていなければ additionalContext に 1 行を出す（正常系（待ち受けていない））
test("test_normal_when_not_listening", async () => {
  // 準備
  const port = await findFreePort();
  // 実行
  const result = await runSessionStartHook({
    pluginDir: builtPluginDir(),
    env: { MDMARK_PORT: String(port) },
  });
  // 検証
  expect(result.code).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
  const context: string = output.hookSpecificOutput.additionalContext;
  expect(context).not.toContain("\n");
  expect(context).toContain(`127.0.0.1:${port}`);
  expect(context).toContain("/mdmark:global-setup");
});
