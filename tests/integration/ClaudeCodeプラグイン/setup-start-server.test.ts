import { mkdir, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { runSetupScript } from "../plugin.ts";
import { HAS_TMUX, type Terminal, useTerminals } from "../terminal.ts";

const { createTerminal, tmux } = useTerminals();

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

/** tmux サーバーを別のセッションで先に起動しておく */
const startOtherSession = async (terminal: Terminal) => {
  expect(
    (await tmux(terminal, ["new-session", "-d", "-s", "other", "sleep 600"]))
      .code,
  ).toBe(0);
};

// tmux のセッションで mdmark serve を起動し、待ち受けを待って tools/list を確認する（正常系）
test.skipIf(!HAS_TMUX)(
  "test_normal",
  async () => {
    // 準備
    const terminal = await createTerminal();
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
    expect(output.url).toBe(`http://127.0.0.1:${terminal.port}/mcp`);
    expect(output.tools).toEqual(
      expect.arrayContaining(["export_html", "build_site", "check"]),
    );
    expect(output.stop).toBe("tmux kill-session -t =mdmark-mcp");
    expect(
      (await tmux(terminal, ["has-session", "-t", "=mdmark-mcp"])).code,
    ).toBe(0);
    expect(await readFile(terminal.logPath, "utf8")).toContain(
      `http://127.0.0.1:${terminal.port}/mcp`,
    );
  },
  START_TIMEOUT_MS,
);

// セッションがあり待ち受けていれば、もう一度起動しない（正常系（既に起動している））
test.skipIf(!HAS_TMUX)(
  "test_normal_when_already_running",
  async () => {
    // 準備
    const terminal = await createTerminal();
    expect(
      (await runSetupScript({ args: ["start-server"], env: terminal.env }))
        .code,
    ).toBe(0);
    const before = (
      await tmux(terminal, [
        "list-panes",
        "-t",
        "=mdmark-mcp",
        "-F",
        "#{pane_pid}",
      ])
    ).stdout;
    // 実行
    const result = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    // 検証
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).result).toBe("already_running");
    const after = (
      await tmux(terminal, [
        "list-panes",
        "-t",
        "=mdmark-mcp",
        "-F",
        "#{pane_pid}",
      ])
    ).stdout;
    expect(after).toBe(before);
  },
  START_TIMEOUT_MS,
);

// 応答しないセッションを閉じてからもう一度起動する（正常系（セッションはあるが待ち受けていない））
test.skipIf(!HAS_TMUX)(
  "test_normal_when_session_stale",
  async () => {
    // 準備
    const terminal = await createTerminal();
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

// tmux が無ければ起動せず、端末で動かすコマンドを返却する（異常系（tmux が無い・終了コード 2））
test("test_error_when_tmux_missing", async () => {
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
  expect(result.stderr).toContain(`MDMARK_PORT=${terminal.port}`);
  expect(result.stderr).toContain(
    "npx -y github:shuhei1101/mdmark#v0.0.1 serve",
  );
});

// ほかのプロセスがポートを待ち受けていれば起動せず、修正方法を返却する（異常系（ポートが使用されている・終了コード 1））
test.skipIf(!HAS_TMUX)("test_error_when_port_in_use", async () => {
  // 準備
  const terminal = await createTerminal();
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
  expect(
    (await tmux(terminal, ["has-session", "-t", "=mdmark-mcp"])).code,
  ).not.toBe(0);
  expect(result.stderr).toContain("MDMARK_PORT");
  expect(result.stderr).toContain("/mdmark:global-setup");
  expect(other.listening).toBe(true);
});

// 上限の間に待ち受けなければ、セッションを閉じてログの末尾ともう一度呼ぶことを返却する（異常系（待ちを超えた・終了コード 3））
test.skipIf(!HAS_TMUX)(
  "test_error_when_start_timed_out",
  async () => {
    // 準備
    const terminal = await createTerminal({
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
    expect(
      (await tmux(terminal, ["has-session", "-t", "=mdmark-mcp"])).code,
    ).not.toBe(0);
    expect(result.stderr).toContain("serve.log");
    expect(result.stderr).toContain("/mdmark:global-setup");
  },
  START_TIMEOUT_MS,
);
