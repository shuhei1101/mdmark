import { execFile, execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../../helpers/cli.ts";

/** start-server の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadServer = () => import("../../../../../src/plugin/setup/server.ts");

/** 常駐サーバーの処理を読み込む */
const loadHttp = () => import("../../../../../src/plugin/http.ts");

const createTempDir = useTempDirs();

const REPO = join(import.meta.dirname, "../../../../..");

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
});

/** tmux が使用できるか */
const hasTmux = (() => {
  try {
    execFileSync("tmux", ["-V"]);
    return true;
  } catch {
    return false;
  }
})();

/** 空いたポートを取って閉じ、その番号を返却する */
async function findFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/** 実際のコマンドを実行する RunCommand */
const runReal = (env: NodeJS.ProcessEnv) => (command: string, args: string[]) =>
  new Promise<{ code: number; stdout: string }>((resolve) => {
    execFile(command, args, { env }, (error, stdout) => {
      resolve({
        code: error ? Number(error.code ?? 1) : 0,
        stdout: String(stdout),
      });
    });
  });

/** 呼ばれた引数を貯め、応答を関数で決める RunCommand */
function createFakeRun(
  respond: (
    args: string[],
    calls: string[][],
  ) => { code: number; stdout?: string },
) {
  const calls: string[][] = [];
  const run = async (_command: string, args: string[]) => {
    calls.push(args);
    const { code, stdout = "" } = respond(args, calls);
    return { code, stdout };
  };
  return { run, calls };
}

/** 一時の端末の環境変数 */
async function createTerminal(extra: NodeJS.ProcessEnv = {}) {
  const home = await createTempDir();
  const env: NodeJS.ProcessEnv = {
    HOME: home,
    PATH: process.env.PATH,
    MDMARK_CONFIG: join(home, "settings.yaml"),
    MDMARK_STATE_DIR: join(home, "state"),
    MDMARK_PORT: String(await findFreePort()),
    ...extra,
  };
  return { home, env };
}

const noSleep = async () => {};

// 環境変数を -e で指定し sh -c で包む（正常系）
test("test_build_tmux_args", async () => {
  // 準備
  const { buildTmuxArgs } = await loadServer();
  // 実行
  const args = buildTmuxArgs({
    session: "s",
    port: 18782,
    settingsPath: "/c/settings.yaml",
    stateDir: "/l",
    logPath: "/l/serve.log",
    command: "serve",
  });
  // 検証
  expect(args.slice(0, 4)).toEqual(["new-session", "-d", "-s", "s"]);
  expect(args).toContain("MDMARK_PORT=18782");
  expect(args[args.indexOf("MDMARK_PORT=18782") - 1]).toBe("-e");
  expect(args).toContain("MDMARK_CONFIG=/c/settings.yaml");
  expect(args).toContain("MDMARK_STATE_DIR=/l");
  expect(args.slice(-3)).toEqual([
    "sh",
    "-c",
    "serve 2>&1 | tee -a '/l/serve.log'",
  ]);
});

// 起動して待ち受けを待つ（正常系）
test.skipIf(!hasTmux)(
  "test_start_server",
  async () => {
    // 準備
    const { startServer } = await loadServer();
    const tmuxDir = await createTempDir();
    const { env } = await createTerminal({
      TMUX_TMPDIR: tmuxDir,
      MDMARK_SERVE_COMMAND: `'${process.execPath}' '${join(REPO, "dist", "cli.js")}' serve`,
    });
    const run = runReal(env);
    cleanups.push(async () => {
      await run("tmux", ["kill-session", "-t", "=mdmark-mcp"]);
    });
    // 実行
    const result = await startServer({
      env,
      pluginRoot: join(REPO, "plugin"),
      version: "v0.0.0",
      run,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
    // 検証
    expect(result.result).toBe("started");
    expect(result.session).toBe("mdmark-mcp");
    expect(result.url).toBe(`http://127.0.0.1:${env.MDMARK_PORT}/mcp`);
    // 起動するのはコミット済みの dist/cli.js で、ビルドした時点のツールを返却するため、3 つを含むことを確認する
    expect(result.tools).toEqual(
      expect.arrayContaining(["build_site", "check", "export_html"]),
    );
    expect(result.stop).toBe("tmux kill-session -t =mdmark-mcp");
  },
  60_000,
);

// tmux が無ければ 2（異常系）
test("test_start_server_when_tmux_missing", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env } = await createTerminal();
  const { run } = createFakeRun(() => ({ code: 127 }));
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    run,
    sleep: noSleep,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 2 });
  await expect(result).rejects.toThrow(`MDMARK_PORT=${env.MDMARK_PORT}`);
  await expect(result).rejects.toThrow("serve");
});

// 上限を超えたら 3（異常系）
test("test_start_server_when_timed_out", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env } = await createTerminal({ MDMARK_START_TIMEOUT_SEC: "0" });
  const { run, calls } = createFakeRun(() => ({ code: 0 }));
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    run,
    sleep: noSleep,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 3 });
  const started = calls.findIndex((args) => args[0] === "new-session");
  expect(started).toBeGreaterThanOrEqual(0);
  expect(calls.slice(started).some((args) => args[0] === "kill-session")).toBe(
    true,
  );
});

// セッションが閉じたら 1（異常系）
test("test_start_server_when_session_closed", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { home, env } = await createTerminal();
  await writeFiles(home, {
    "state/serve.log": "Error: listen EADDRINUSE: address already in use\n",
  });
  const { run } = createFakeRun((args) =>
    args[0] === "has-session" ? { code: 1 } : { code: 0 },
  );
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    run,
    sleep: noSleep,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  await expect(result).rejects.toThrow("EADDRINUSE");
  await expect(result).rejects.toThrow("MDMARK_PORT");
});

// 起動した常駐サーバーのツール（正常系）
test("test_list_tool_names", async () => {
  // 準備
  const { listToolNames } = await loadServer();
  const { runServe } = await loadHttp();
  const port = await findFreePort();
  const controller = new AbortController();
  const lines: string[] = [];
  const serving = runServe({
    env: { MDMARK_PORT: String(port) },
    packageDir: REPO,
    version: "v0.0.0",
    signal: controller.signal,
    stdout: (line) => lines.push(line),
    stderr: () => {},
  });
  cleanups.push(async () => {
    controller.abort();
    await serving;
  });
  await expect.poll(() => lines.length).toBeGreaterThan(0);
  // 実行
  const names = await listToolNames({ port });
  // 検証
  expect(names).toEqual(
    expect.arrayContaining(["build_site", "check", "export_html"]),
  );
});

// ほかのプロセスがポートを待ち受けていれば起動しない（異常系）
test("test_start_server_when_port_taken", async () => {
  // 準備
  const { startServer } = await loadServer();
  const other = createServer();
  await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () => new Promise<void>((resolve) => other.close(() => resolve())),
  );
  const { port } = other.address() as AddressInfo;
  const { env } = await createTerminal({ MDMARK_PORT: String(port) });
  const { run, calls } = createFakeRun((args) =>
    args[0] === "has-session" ? { code: 1 } : { code: 0 },
  );
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    run,
    sleep: noSleep,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  await expect(result).rejects.toThrow("MDMARK_PORT");
  expect(calls.some((args) => args[0] === "new-session")).toBe(false);
});
