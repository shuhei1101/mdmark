import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { writeFiles } from "../cli.ts";
import { findFreePort, runSetupScript } from "../plugin.ts";
import {
  HAS_SYSTEMD,
  HAS_TMUX,
  systemctl,
  type Terminal,
  USER_CONFIG_HOME,
  useTerminals,
  useTestUnits,
} from "../terminal.ts";

const { createTerminal, tmux } = useTerminals();
const { createUnitName, unitPath } = useTestUnits();

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

/** 待ち受けるまで待つ上限（ミリ秒） */
const START_TIMEOUT_MS = 60_000;

/** 端末の設定を書き込む */
const writeSettings = async (terminal: Terminal, yaml: string) => {
  await writeFiles(dirname(terminal.settingsPath), { "settings.yaml": yaml });
};

/** systemd --user で起動する端末。unit の名前はテスト専用にし、unit のファイルは user のマネージャーが読む場所に作らせる */
const createSystemdTerminal = async (extra: Record<string, string> = {}) => {
  const unit = createUnitName();
  const terminal = await createTerminal({
    XDG_CONFIG_HOME: USER_CONFIG_HOME,
    ...extra,
  });
  await writeSettings(terminal, `serve:\n  systemdUnit: ${unit}\n`);
  return { terminal, unit };
};

/** tmux に固定した端末。手元の unit に触れないよう、unit の名前もテスト専用にする */
const createTmuxTerminal = async (extra: Record<string, string> = {}) => {
  const unit = createUnitName();
  const terminal = await createTerminal(extra);
  await writeSettings(
    terminal,
    `serve:\n  launcher: tmux\n  systemdUnit: ${unit}\n`,
  );
  return terminal;
};

/** unit の値を 1 つ取る */
const showValue = async (unit: string, property: string) =>
  (await systemctl(["show", "-p", property, "--value", unit])).stdout.trim();

/** unit の journal の本文 */
const journal = (unit: string) =>
  new Promise<string>((resolve) => {
    execFile(
      "journalctl",
      ["--user", "-u", unit, "--no-pager", "-o", "cat"],
      (_error, stdout) => resolve(String(stdout)),
    );
  });

/** tmux サーバーを別のセッションで先に起動しておく */
const startOtherSession = async (terminal: Terminal) => {
  expect(
    (await tmux(terminal, ["new-session", "-d", "-s", "other", "sleep 600"]))
      .code,
  ).toBe(0);
};

/** ファイルがあるか */
const exists = async (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

// systemd --user が使える端末で、unit を記載して enable して起動し、待ち受けを待って tools/list を確認する（正常系）
test.skipIf(!HAS_SYSTEMD)(
  "test_normal",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal();
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.result).toBe("started");
    expect(output.launcher).toBe("systemd");
    expect(output.changes).toEqual(["unit_written"]);
    const file = await readFile(unitPath(unit), "utf8");
    expect(file).toContain(`Environment="MDMARK_PORT=${terminal.port}"`);
    expect(file).toContain(
      `Environment="MDMARK_CONFIG=${terminal.settingsPath}"`,
    );
    expect(file).toContain(
      `Environment="MDMARK_STATE_DIR=${terminal.stateDir}"`,
    );
    expect(file).toContain('Environment="MDMARK_LAUNCHER=systemd"');
    expect(file).toMatch(/^Environment="PATH=/m);
    expect(file).toContain(
      `ExecStart=/bin/sh -c '${terminal.env.MDMARK_SERVE_COMMAND.replaceAll("'", "'\\''")}'`,
    );
    expect((await systemctl(["is-enabled", unit])).stdout.trim()).toBe(
      "enabled",
    );
    expect((await systemctl(["is-active", unit])).stdout.trim()).toBe("active");
    await expect
      .poll(() => journal(unit))
      .toContain(`http://127.0.0.1:${terminal.port}/mcp`);
    expect(output.tools).toEqual(
      expect.arrayContaining(["export_html", "build_site", "check"]),
    );
    expect(output.log).toBe(`journalctl --user -u ${unit}`);
    expect(output.stop).toBe(`systemctl --user disable --now ${unit}`);
  },
  START_TIMEOUT_MS,
);

// unit が今の内容で active で待ち受けていれば、もう一度起動しない（正常系（既に起動している））
test.skipIf(!HAS_SYSTEMD)(
  "test_normal_when_already_running",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal();
    expect(
      (await runSetupScript({ args: ["start-server"], env: terminal.env }))
        .code,
    ).toBe(0);
    const pid = await showValue(unit, "MainPID");
    const file = await readFile(unitPath(unit), "utf8");
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.result).toBe("already_running");
    expect(output.changes).toEqual([]);
    expect(await showValue(unit, "MainPID")).toBe(pid);
    expect(await readFile(unitPath(unit), "utf8")).toBe(file);
  },
  START_TIMEOUT_MS,
);

// unit が active で待ち受けていなければ、unit を起動し直す（正常系（unit が待ち受けていない））
test.skipIf(!HAS_SYSTEMD)(
  "test_normal_when_unit_not_listening",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal();
    await mkdir(dirname(unitPath(unit)), { recursive: true });
    await writeFile(
      unitPath(unit),
      "[Service]\nExecStart=/bin/sh -c 'sleep 600'\n\n[Install]\nWantedBy=default.target\n",
    );
    await systemctl(["daemon-reload"]);
    await systemctl(["enable", "--now", unit]);
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).result).toBe("restarted");
    expect((await systemctl(["is-active", unit])).stdout.trim()).toBe("active");
  },
  START_TIMEOUT_MS,
);

// unit のファイルが今の内容と違えば、記載し直して起動し直す（正常系（unit の内容が古い））
test.skipIf(!HAS_SYSTEMD)(
  "test_normal_when_unit_outdated",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal();
    expect(
      (await runSetupScript({ args: ["start-server"], env: terminal.env }))
        .code,
    ).toBe(0);
    const pid = await showValue(unit, "MainPID");
    const command = `exec ${terminal.env.MDMARK_SERVE_COMMAND}`;
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: { ...terminal.env, MDMARK_SERVE_COMMAND: command },
    });
    // 検証
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.result).toBe("restarted");
    expect(output.changes).toEqual(["unit_written"]);
    expect(await readFile(unitPath(unit), "utf8")).toContain(
      `ExecStart=/bin/sh -c '${command.replaceAll("'", "'\\''")}'`,
    );
    expect(await showValue(unit, "MainPID")).not.toBe(pid);
  },
  START_TIMEOUT_MS,
);

// tmux のセッションで動いている常駐サーバーを閉じてから unit を起動する（正常系（tmux のセッションから移す））
test.skipIf(!HAS_SYSTEMD || !HAS_TMUX)(
  "test_normal_when_moved_from_tmux",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal();
    expect(
      (
        await tmux(terminal, [
          "new-session",
          "-d",
          "-s",
          "mdmark-mcp",
          "-e",
          `MDMARK_PORT=${terminal.port}`,
          terminal.env.MDMARK_SERVE_COMMAND,
        ])
      ).code,
    ).toBe(0);
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.result).toBe("started");
    expect(output.changes).toEqual(["tmux_session_closed", "unit_written"]);
    expect(
      (await tmux(terminal, ["has-session", "-t", "=mdmark-mcp"])).code,
    ).not.toBe(0);
    expect((await systemctl(["is-active", unit])).stdout.trim()).toBe("active");
  },
  START_TIMEOUT_MS,
);

// systemd --user が使えない端末で、tmux のセッションで mdmark serve を起動する（正常系（tmux））
test.skipIf(!HAS_TMUX)(
  "test_normal_when_tmux",
  async () => {
    // 準備
    const terminal = await createTmuxTerminal();
    await startOtherSession(terminal);
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.result).toBe("started");
    expect(output.launcher).toBe("tmux");
    expect(output.url).toBe(`http://127.0.0.1:${terminal.port}/mcp`);
    expect(output.stop).toBe("tmux kill-session -t =mdmark-mcp");
    expect(output.log).toBe(terminal.logPath);
    expect(
      (await tmux(terminal, ["has-session", "-t", "=mdmark-mcp"])).code,
    ).toBe(0);
    expect(await readFile(terminal.logPath, "utf8")).toContain(
      `http://127.0.0.1:${terminal.port}/mcp`,
    );
  },
  START_TIMEOUT_MS,
);

// セッションがあり待ち受けていれば、もう一度起動しない（正常系（tmux で既に起動している））
test.skipIf(!HAS_TMUX)(
  "test_normal_when_tmux_already_running",
  async () => {
    // 準備
    const terminal = await createTmuxTerminal();
    expect(
      (await runSetupScript({ args: ["start-server"], env: terminal.env }))
        .code,
    ).toBe(0);
    const panes = ["list-panes", "-t", "=mdmark-mcp", "-F", "#{pane_pid}"];
    const before = (await tmux(terminal, panes)).stdout;
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).result).toBe("already_running");
    expect((await tmux(terminal, panes)).stdout).toBe(before);
  },
  START_TIMEOUT_MS,
);

// 応答しないセッションを閉じてからもう一度起動する（正常系（tmux のセッションはあるが待ち受けていない））
test.skipIf(!HAS_TMUX)(
  "test_normal_when_session_stale",
  async () => {
    // 準備
    const terminal = await createTmuxTerminal();
    expect(
      (
        await tmux(terminal, [
          "new-session",
          "-d",
          "-s",
          "mdmark-mcp",
          "sleep 600",
        ])
      ).code,
    ).toBe(0);
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).result).toBe("restarted");
    expect(await readFile(terminal.logPath, "utf8")).toContain(
      `http://127.0.0.1:${terminal.port}/mcp`,
    );
  },
  START_TIMEOUT_MS,
);

// serve.launcher が tmux なら、active な unit を disable --now してから tmux で起動する（正常系（tmux に固定する））
test.skipIf(!HAS_SYSTEMD || !HAS_TMUX)(
  "test_normal_when_fixed_to_tmux",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal();
    expect(
      (await runSetupScript({ args: ["start-server"], env: terminal.env }))
        .code,
    ).toBe(0);
    await startOtherSession(terminal);
    await writeSettings(
      terminal,
      `serve:\n  launcher: tmux\n  systemdUnit: ${unit}\n`,
    );
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.result).toBe("started");
    expect(output.launcher).toBe("tmux");
    expect(output.changes).toEqual(["unit_disabled"]);
    expect((await systemctl(["is-enabled", unit])).stdout.trim()).not.toBe(
      "enabled",
    );
    expect((await systemctl(["is-active", unit])).stdout.trim()).not.toBe(
      "active",
    );
    expect(
      (await tmux(terminal, ["has-session", "-t", "=mdmark-mcp"])).code,
    ).toBe(0);
  },
  START_TIMEOUT_MS,
);

// --launcher tmux で呼ぶと、unit に触れずに tmux で起動する（正常系（引数で tmux を指定する））
test.skipIf(!HAS_SYSTEMD || !HAS_TMUX)(
  "test_normal_when_launcher_argument_is_tmux",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal();
    expect(
      (await runSetupScript({ args: ["start-server"], env: terminal.env }))
        .code,
    ).toBe(0);
    const pid = await showValue(unit, "MainPID");
    const file = await readFile(unitPath(unit), "utf8");
    await startOtherSession(terminal);
    const port = await findFreePort();
    // 実行
    const result = await runSetupScript({
      args: ["start-server", "--launcher", "tmux"],
      env: { ...terminal.env, MDMARK_PORT: String(port) },
    });
    // 検証
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.result).toBe("started");
    expect(output.launcher).toBe("tmux");
    expect(output.changes).toEqual([]);
    expect((await systemctl(["is-enabled", unit])).stdout.trim()).toBe(
      "enabled",
    );
    expect((await systemctl(["is-active", unit])).stdout.trim()).toBe("active");
    expect(await showValue(unit, "MainPID")).toBe(pid);
    expect(await readFile(unitPath(unit), "utf8")).toBe(file);
    expect(
      (await tmux(terminal, ["has-session", "-t", "=mdmark-mcp"])).code,
    ).toBe(0);
  },
  START_TIMEOUT_MS,
);

// systemd --user も tmux も使えなければ起動せず、端末で動かすコマンドを返却する（異常系（起動の方法が無い・終了コード 2））
test("test_error_when_launcher_missing", async () => {
  // 準備
  const terminal = await createTerminal({ MDMARK_SERVE_COMMAND: "" });
  const emptyPath = join(terminal.home, "empty-path");
  await mkdir(emptyPath);
  // 実行
  const result = await runSetupScript({
    args: ["start-server"],
    env: { ...terminal.env, PATH: emptyPath },
  });
  // 検証
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("systemd --user も tmux も");
  expect(result.stderr).toContain(`MDMARK_PORT=${terminal.port}`);
  expect(result.stderr).toContain(
    "npx -y github:shuhei1101/mdmark#v0.0.1 serve",
  );
});

// unit もセッションも動いていないのにポートが待ち受けていれば、unit を記載せずに修正方法を返却する（異常系（ポートが使用されている・終了コード 1））
test.skipIf(!HAS_SYSTEMD)("test_error_when_port_in_use", async () => {
  // 準備
  const { terminal, unit } = await createSystemdTerminal();
  const other = createServer();
  servers.push(other);
  await new Promise<void>((resolve) =>
    other.listen(terminal.port, "127.0.0.1", resolve),
  );
  // 実行
  const result = await runSetupScript({
    args: ["start-server"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(1);
  expect(await exists(unitPath(unit))).toBe(false);
  expect((await systemctl(["is-enabled", unit])).stdout.trim()).not.toBe(
    "enabled",
  );
  expect(result.stderr).toContain("MDMARK_PORT");
  expect(result.stderr).toContain("/mdmark:global-setup");
  expect(other.listening).toBe(true);
});

// unit で起動した mdmark serve が終わると、起動し直しを待たずに unit を disable --now して journal の末尾を返却する（異常系（mdmark serve が終わった・終了コード 1））
test.skipIf(!HAS_SYSTEMD)(
  "test_error_when_server_exited",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal({
      MDMARK_SERVE_COMMAND: "echo failed; exit 1",
    });
    const started = Date.now();
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(1);
    expect(Date.now() - started).toBeLessThan(120_000);
    expect((await systemctl(["is-enabled", unit])).stdout.trim()).not.toBe(
      "enabled",
    );
    expect((await systemctl(["is-active", unit])).stdout.trim()).not.toBe(
      "active",
    );
    expect(result.stderr).toContain("mdmark serve が終わった");
    expect(result.stderr).toContain(`journalctl --user -u ${unit}`);
  },
  START_TIMEOUT_MS,
);

// 上限の間に待ち受けなければ、unit を disable --now してログの末尾ともう一度呼ぶことを返却する（異常系（待ちを超えた・終了コード 3））
test.skipIf(!HAS_SYSTEMD)(
  "test_error_when_start_timed_out",
  async () => {
    // 準備
    const { terminal, unit } = await createSystemdTerminal({
      MDMARK_SERVE_COMMAND: "sleep 600",
      MDMARK_START_TIMEOUT_SEC: "2",
    });
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(3);
    expect((await systemctl(["is-enabled", unit])).stdout.trim()).not.toBe(
      "enabled",
    );
    expect((await systemctl(["is-active", unit])).stdout.trim()).not.toBe(
      "active",
    );
    expect(result.stderr).toContain(`journalctl --user -u ${unit}`);
    expect(result.stderr).toContain("/mdmark:global-setup");
  },
  START_TIMEOUT_MS,
);
