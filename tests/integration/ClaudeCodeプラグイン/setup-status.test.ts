import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { writeFiles } from "../cli.ts";
import { runSetupScript } from "../plugin.ts";
import { HAS_SYSTEMD, HAS_TMUX, useTerminals } from "../terminal.ts";

const { createTerminal, tmux } = useTerminals();

// 空の端末で、端末の設定が無いこと・既定のセッション名・待ち受けていないことを返却する（正常系）
test.skipIf(!HAS_TMUX)("test_normal", async () => {
  // 準備
  const terminal = await createTerminal();
  // 実行
  const result = await runSetupScript({ args: ["status"], env: terminal.env });
  // 検証
  expect(result.code).toBe(0);
  const status = JSON.parse(result.stdout);
  expect(status.settings.path).toBe(terminal.settingsPath);
  expect(status.settings.exists).toBe(false);
  expect(status.settings.default_path).toBe(false);
  expect(status.server.session).toBe("mdmark-mcp");
  expect(status.server.listening).toBe(false);
  expect(status.tmux.available).toBe(true);
  expect(status.state.log).toBe(terminal.logPath);
  expect(status.launcher.setting).toBe("auto");
  expect(status.server.unit).toBe("mdmark-mcp");
  expect(status.server.unit_path).toBe(
    join(terminal.home, ".config", "systemd", "user", "mdmark-mcp.service"),
  );
  expect(status.systemd.available).toBe(HAS_SYSTEMD);
  expect(status.launcher.resolved).toBe(HAS_SYSTEMD ? "systemd" : "tmux");
});

// 端末の設定のバージョン・セッション名・待ち受けていることを返却する（正常系（セットアップ済み））
test.skipIf(!HAS_TMUX)(
  "test_normal_when_already_set_up",
  async () => {
    // 準備
    const terminal = await createTerminal();
    await writeFiles(join(terminal.home, "config"), {
      "settings.yaml":
        "version: v0.0.1\nserve:\n  launcher: tmux\n  systemdUnit: mdmark-test-status\n  tmuxSession: mdmark-test\n",
    });
    const started = await runSetupScript({
      args: ["start-server"],
      env: terminal.env,
    });
    expect(started.code).toBe(0);
    // 実行
    const result = await runSetupScript({
      args: ["status"],
      env: terminal.env,
    });
    // 検証
    const status = JSON.parse(result.stdout);
    expect(status.settings.exists).toBe(true);
    expect(status.settings.version).toBe("v0.0.1");
    expect(status.settings.target_version).toBe("v0.0.1");
    expect(status.server.session).toBe("mdmark-test");
    expect(status.server.session_exists).toBe(true);
    expect(status.server.listening).toBe(true);
    expect(
      (await tmux(terminal, ["has-session", "-t", "=mdmark-test"])).code,
    ).toBe(0);
  },
  60_000,
);

// PATH に systemctl が無いことと、auto が tmux になることを返却する（正常系（systemd --user が使えない））
test("test_normal_when_systemd_unavailable", async () => {
  // 準備
  const terminal = await createTerminal();
  const emptyPath = join(terminal.home, "empty-path");
  await mkdir(emptyPath);
  // 実行
  const result = await runSetupScript({
    args: ["status"],
    env: { ...terminal.env, PATH: emptyPath },
  });
  // 検証
  expect(result.code).toBe(0);
  const status = JSON.parse(result.stdout);
  expect(status.systemd.available).toBe(false);
  expect(status.launcher.resolved).toBe("tmux");
  expect(status.server.unit_active).toBe(false);
  expect(status.server.unit_enabled).toBe(false);
});

// PATH に tmux が無いことを返却する（正常系（tmux が無い））
test("test_normal_when_tmux_missing", async () => {
  // 準備
  const terminal = await createTerminal();
  const emptyPath = join(terminal.home, "empty-path");
  await mkdir(emptyPath);
  // 実行
  const result = await runSetupScript({
    args: ["status"],
    env: { ...terminal.env, PATH: emptyPath },
  });
  // 検証
  expect(result.code).toBe(0);
  const status = JSON.parse(result.stdout);
  expect(status.tmux.available).toBe(false);
  expect(status.server.session_exists).toBe(false);
});

// 端末の設定が YAML として読み込めないとき、パスと行を出して終わる（異常系（端末の設定を読み込めない・終了コード 1））
test("test_error_when_settings_unreadable", async () => {
  // 準備
  const terminal = await createTerminal();
  await writeFiles(join(terminal.home, "config"), {
    "settings.yaml": "version: v0.0.1\nfeatures:\n  table: a: b\n",
  });
  // 実行
  const result = await runSetupScript({ args: ["status"], env: terminal.env });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain(terminal.settingsPath);
  expect(result.stderr).toContain("3 行目");
});
