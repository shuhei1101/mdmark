import { execFile, execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
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
  expect(args).toContain("MDMARK_LAUNCHER=tmux");
  expect(args[args.indexOf("MDMARK_LAUNCHER=tmux") - 1]).toBe("-e");
  expect(args.slice(-3)).toEqual([
    "sh",
    "-c",
    "serve 2>&1 | tee -a '/l/serve.log'",
  ]);
});

// 起動して待ち受けを待つ（正常系）
test.skipIf(!hasTmux)(
  "test_start_with_tmux",
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
      launcher: undefined,
      run,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      writeFile,
    });
    // 検証
    expect(result.result).toBe("started");
    expect(result.launcher).toBe("tmux");
    expect(result.changes).toEqual([]);
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

// systemd も tmux も使えなければ 2（異常系）
test("test_start_server_when_launcher_missing", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env } = await createTerminal();
  const { run } = createFakeRun(() => ({ code: 127 }));
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 2 });
  await expect(result).rejects.toThrow(`MDMARK_PORT=${env.MDMARK_PORT}`);
  await expect(result).rejects.toThrow("serve");
});

// 上限を超えたら 3（異常系）
test("test_start_with_tmux_when_timed_out", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env } = await createTerminal({ MDMARK_START_TIMEOUT_SEC: "0" });
  const { run, calls } = createFakeRun(() => ({ code: 0 }));
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile,
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
test("test_start_with_tmux_when_session_closed", async () => {
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
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile,
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
test("test_start_with_tmux_when_port_taken", async () => {
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
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  await expect(result).rejects.toThrow("MDMARK_PORT");
  expect(calls.some((args) => args[0] === "new-session")).toBe(false);
});

/** 常駐サーバー（MCP）を空いたポートで起動し、止める関数を返却する */
async function serveMcp(port: number): Promise<() => Promise<void>> {
  const { runServe } = await loadHttp();
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
  await expect.poll(() => lines.length).toBeGreaterThan(0);
  return async () => {
    controller.abort();
    await serving;
  };
}

/** 呼ばれたコマンドと引数を貯め、応答を関数で決める RunCommand */
function createFakeCommands(
  respond: (
    command: string,
    args: string[],
  ) =>
    | Promise<{ code: number; stdout?: string }>
    | { code: number; stdout?: string },
) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const run = async (command: string, args: string[]) => {
    calls.push({ command, args });
    const { code, stdout = "" } = await respond(command, args);
    return { code, stdout };
  };
  const has = (command: string, ...args: string[]) =>
    calls.some(
      (call) =>
        call.command === command &&
        args.every((arg, index) => call.args[index] === arg),
    );
  const indexOf = (command: string, ...args: string[]) =>
    calls.findIndex(
      (call) =>
        call.command === command &&
        args.every((arg, index) => call.args[index] === arg),
    );
  return { run, calls, has, indexOf };
}

/** systemctl --user show の Key=Value の行 */
const showLines = (state: {
  active: string;
  sub?: string;
  restarts?: number;
  enabled?: boolean;
}) =>
  `ActiveState=${state.active}\nSubState=${state.sub ?? "running"}\nNRestarts=${state.restarts ?? 0}\nMainPID=${state.active === "active" ? 100 : 0}\nUnitFileState=${state.enabled ? "enabled" : "disabled"}\n`;

/** 書き込みを数える writeFile */
function countingWriteFile() {
  const written: string[] = [];
  const write = async (path: string, data: string) => {
    written.push(path);
    await writeFile(path, data);
  };
  return { write, written };
}

// auto は systemd が使えれば systemd、引数は移し替えをしない（正常系）
test("test_resolve_launcher", async () => {
  // 準備
  const { resolveLauncher } = await loadServer();
  const base = { command: "serve", port: 18782 };
  // 実行・検証
  expect(
    resolveLauncher({
      ...base,
      argument: undefined,
      setting: "auto",
      systemdAvailable: true,
      tmuxAvailable: true,
    }),
  ).toEqual({ launcher: "systemd", migrate: true });
  expect(
    resolveLauncher({
      ...base,
      argument: undefined,
      setting: "auto",
      systemdAvailable: false,
      tmuxAvailable: true,
    }),
  ).toEqual({ launcher: "tmux", migrate: true });
  expect(
    resolveLauncher({
      ...base,
      argument: "tmux",
      setting: "systemd",
      systemdAvailable: true,
      tmuxAvailable: true,
    }),
  ).toEqual({ launcher: "tmux", migrate: false });
  expect(
    resolveLauncher({
      ...base,
      argument: undefined,
      setting: "tmux",
      systemdAvailable: true,
      tmuxAvailable: true,
    }),
  ).toEqual({ launcher: "tmux", migrate: true });
});

// 使える方法が無ければ 2（異常系）
test("test_resolve_launcher_when_missing", async () => {
  // 準備
  const { resolveLauncher } = await loadServer();
  const base = { command: "npx serve", port: 18782 };
  // 実行・検証
  for (const options of [
    {
      ...base,
      argument: undefined,
      setting: "auto" as const,
      systemdAvailable: false,
      tmuxAvailable: false,
    },
    {
      ...base,
      argument: undefined,
      setting: "systemd" as const,
      systemdAvailable: false,
      tmuxAvailable: true,
    },
  ]) {
    expect(() => resolveLauncher(options)).toThrow(
      expect.objectContaining({ exitCode: 2 }),
    );
    expect(() => resolveLauncher(options)).toThrow("MDMARK_PORT=18782");
    expect(() => resolveLauncher(options)).toThrow("npx serve");
  }
});

// 終わったことを待ち受けより先に確かめる（正常系）
test("test_wait_for_listening", async () => {
  // 準備
  const { waitForListening } = await loadServer();
  const port = await findFreePort();
  let checked = 0;
  // 実行
  const result = await waitForListening({
    port,
    timeoutSec: 60,
    hasExited: async () => {
      checked += 1;
      return checked >= 2;
    },
    sleep: noSleep,
  });
  // 検証
  expect(result).toBe("exited");
});

/** systemd --user が使える端末の環境変数と、unit の名前 */
async function createSystemdTerminal(extra: NodeJS.ProcessEnv = {}) {
  const { home, env } = await createTerminal(extra);
  env.XDG_CONFIG_HOME = join(home, "config");
  await writeFiles(home, {
    "settings.yaml": "serve:\n  systemdUnit: mdmark-test-u\n",
  });
  return { home, env, unit: "mdmark-test-u" };
}

// unit が無ければ記載して enable --now する（正常系）
test("test_start_with_systemd", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env, unit } = await createSystemdTerminal();
  const port = Number(env.MDMARK_PORT);
  let active = false;
  const { run, indexOf } = createFakeCommands(async (command, args) => {
    if (command === "systemctl" && args[1] === "is-system-running") {
      return { code: 0, stdout: "running\n" };
    }
    if (command === "systemctl" && args[1] === "show") {
      return {
        code: 0,
        stdout: showLines({
          active: active ? "active" : "inactive",
          enabled: active,
        }),
      };
    }
    if (command === "systemctl" && args[1] === "enable") {
      active = true;
      cleanups.push(await serveMcp(port));
      return { code: 0 };
    }
    return { code: command === "tmux" && args[0] === "has-session" ? 1 : 0 };
  });
  const { write } = countingWriteFile();
  // 実行
  const result = await startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile: write,
  });
  // 検証
  expect(result.result).toBe("started");
  expect(result.launcher).toBe("systemd");
  expect(result.changes).toEqual(["unit_written"]);
  expect(result.unit).toBe(unit);
  expect(result.stop).toBe(`systemctl --user disable --now ${unit}`);
  const reload = indexOf("systemctl", "--user", "daemon-reload");
  const enable = indexOf("systemctl", "--user", "enable", "--now", unit);
  expect(reload).toBeGreaterThanOrEqual(0);
  expect(enable).toBeGreaterThan(reload);
  const unitFile = await readFile(
    join(env.XDG_CONFIG_HOME ?? "", "systemd", "user", `${unit}.service`),
    "utf8",
  );
  expect(unitFile).toContain(`Environment="MDMARK_PORT=${port}"`);
}, 60_000);

// 呼んだ側の PATH の関係の無いフォルダが変わっても起動し直さない（正常系）
test("test_start_with_systemd_when_path_differs", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env, unit } = await createSystemdTerminal();
  const port = Number(env.MDMARK_PORT);
  let active = false;
  const { run, has } = createFakeCommands(async (command, args) => {
    if (command === "systemctl" && args[1] === "is-system-running") {
      return { code: 0, stdout: "running\n" };
    }
    if (command === "systemctl" && args[1] === "show") {
      return {
        code: 0,
        stdout: showLines({
          active: active ? "active" : "inactive",
          enabled: active,
        }),
      };
    }
    if (command === "systemctl" && args[1] === "enable") {
      active = true;
      cleanups.push(await serveMcp(port));
      return { code: 0 };
    }
    return { code: command === "tmux" && args[0] === "has-session" ? 1 : 0 };
  });
  const options = {
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
  };
  await startServer({ ...options, env, writeFile });
  const { write, written } = countingWriteFile();
  // 実行
  const result = await startServer({
    ...options,
    env: { ...env, PATH: `/extra/bin:${env.PATH}` },
    writeFile: write,
  });
  // 検証
  expect(result.result).toBe("already_running");
  expect(written).toEqual([]);
  expect(has("systemctl", "--user", "restart", unit)).toBe(false);
}, 60_000);

// unit が active でなくポートが待ち受けていれば記載しない（異常系）
test("test_start_with_systemd_when_port_taken", async () => {
  // 準備
  const { startServer } = await loadServer();
  const other = createServer();
  await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () => new Promise<void>((resolve) => other.close(() => resolve())),
  );
  const { port } = other.address() as AddressInfo;
  const { env } = await createSystemdTerminal({ MDMARK_PORT: String(port) });
  const { run, has } = createFakeCommands((command, args) => {
    if (command === "systemctl" && args[1] === "is-system-running") {
      return { code: 0, stdout: "running\n" };
    }
    if (command === "systemctl" && args[1] === "show") {
      return { code: 0, stdout: showLines({ active: "inactive" }) };
    }
    return { code: command === "tmux" && args[0] === "has-session" ? 1 : 0 };
  });
  const { write, written } = countingWriteFile();
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile: write,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  expect(written).toEqual([]);
  expect(has("systemctl", "--user", "enable")).toBe(false);
});

// NRestarts が増えたら待たずに 1（異常系）
test("test_start_with_systemd_when_exited", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env, unit } = await createSystemdTerminal();
  let enabled = false;
  const { run, has } = createFakeCommands((command, args) => {
    if (command === "systemctl" && args[1] === "is-system-running") {
      return { code: 0, stdout: "running\n" };
    }
    if (command === "systemctl" && args[1] === "show") {
      return {
        code: 0,
        stdout: showLines(
          enabled
            ? { active: "active", restarts: 1, enabled: true }
            : { active: "inactive" },
        ),
      };
    }
    if (command === "systemctl" && args[1] === "enable") {
      enabled = true;
    }
    if (command === "journalctl") {
      return {
        code: 0,
        stdout: "mdmark-test-u.service: Failed with result 'exit-code'.\n",
      };
    }
    return { code: command === "tmux" && args[0] === "has-session" ? 1 : 0 };
  });
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  await expect(result).rejects.toThrow("Failed");
  expect(has("systemctl", "--user", "disable", "--now", unit)).toBe(true);
});

// 上限を超えたら 3（異常系）
test("test_start_with_systemd_when_timed_out", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env, unit } = await createSystemdTerminal({
    MDMARK_START_TIMEOUT_SEC: "0",
  });
  let enabled = false;
  const { run, has } = createFakeCommands((command, args) => {
    if (command === "systemctl" && args[1] === "is-system-running") {
      return { code: 0, stdout: "running\n" };
    }
    if (command === "systemctl" && args[1] === "show") {
      return {
        code: 0,
        stdout: showLines(
          enabled
            ? { active: "active", enabled: true }
            : { active: "inactive" },
        ),
      };
    }
    if (command === "systemctl" && args[1] === "enable") {
      enabled = true;
    }
    return { code: command === "tmux" && args[0] === "has-session" ? 1 : 0 };
  });
  // 実行
  const result = startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile,
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 3 });
  expect(has("systemctl", "--user", "disable", "--now", unit)).toBe(true);
});

// 設定で tmux に固定すると active な unit を disable --now する（正常系）
test("test_start_with_tmux_when_migrating", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { home, env } = await createTerminal();
  await writeFiles(home, {
    "settings.yaml": "serve:\n  launcher: tmux\n  systemdUnit: mdmark-test-u\n",
  });
  const port = Number(env.MDMARK_PORT);
  let active = true;
  let session = false;
  const { run, indexOf } = createFakeCommands(async (command, args) => {
    if (command === "systemctl" && args[1] === "is-system-running") {
      return { code: 0, stdout: "running\n" };
    }
    if (command === "systemctl" && args[1] === "show") {
      return {
        code: 0,
        stdout: showLines({
          active: active ? "active" : "inactive",
          enabled: active,
        }),
      };
    }
    if (command === "systemctl" && args[1] === "disable") {
      active = false;
      return { code: 0 };
    }
    if (command === "tmux" && args[0] === "has-session") {
      return { code: session ? 0 : 1 };
    }
    if (command === "tmux" && args[0] === "new-session") {
      session = true;
      cleanups.push(await serveMcp(port));
    }
    return { code: 0 };
  });
  // 実行
  const result = await startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: undefined,
    run,
    sleep: noSleep,
    writeFile,
  });
  // 検証
  expect(result.launcher).toBe("tmux");
  expect(result.changes).toEqual(["unit_disabled"]);
  const disable = indexOf(
    "systemctl",
    "--user",
    "disable",
    "--now",
    "mdmark-test-u",
  );
  const start = indexOf("tmux", "new-session");
  expect(disable).toBeGreaterThanOrEqual(0);
  expect(start).toBeGreaterThan(disable);
}, 60_000);

// 引数の tmux で unit が動いていれば unit に触れずに already_running（正常系）
test("test_start_with_tmux_when_unit_running", async () => {
  // 準備
  const { startServer } = await loadServer();
  const { env } = await createTerminal();
  cleanups.push(await serveMcp(Number(env.MDMARK_PORT)));
  const { run, has } = createFakeCommands((command, args) => {
    if (command === "systemctl" && args[1] === "is-system-running") {
      return { code: 0, stdout: "running\n" };
    }
    if (command === "systemctl" && args[1] === "show") {
      return {
        code: 0,
        stdout: showLines({ active: "active", enabled: true }),
      };
    }
    return { code: command === "tmux" && args[0] === "has-session" ? 1 : 0 };
  });
  // 実行
  const result = await startServer({
    env,
    pluginRoot: "/p",
    version: "v0.0.0",
    launcher: "tmux",
    run,
    sleep: noSleep,
    writeFile,
  });
  // 検証
  expect(result.result).toBe("already_running");
  expect(result.launcher).toBe("systemd");
  expect(has("systemctl", "--user", "disable")).toBe(false);
  expect(has("tmux", "new-session")).toBe(false);
}, 60_000);
