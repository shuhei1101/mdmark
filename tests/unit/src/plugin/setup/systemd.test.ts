import { expect, test } from "vitest";

/** systemd --user の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSystemd = () => import("../../../../../src/plugin/setup/systemd.ts");

/** 決めた終了コードと標準出力を返却する RunCommand */
const fixedRun = (code: number, stdout: string) => async () => ({
  code,
  stdout,
});

// degraded でも使える（正常系）
test("test_has_systemd", async () => {
  // 準備
  const { hasSystemd } = await loadSystemd();
  // 実行・検証
  expect(await hasSystemd(fixedRun(1, "degraded\n"))).toBe(true);
});

// offline・コマンドが無いときは使えない（正常系）
test("test_has_systemd_when_offline", async () => {
  // 準備
  const { hasSystemd } = await loadSystemd();
  // 実行・検証
  expect(await hasSystemd(fixedRun(1, "offline\n"))).toBe(false);
  expect(await hasSystemd(fixedRun(127, ""))).toBe(false);
});

// 指定子と引用符を打ち消す（正常系）
test("test_escape_unit_value", async () => {
  // 準備
  const { escapeUnitValue } = await loadSystemd();
  // 実行・検証
  expect(escapeUnitValue('a "b" 50% \\c')).toBe('a \\"b\\" 50%% \\\\c');
});

// 環境変数と起動のコマンドを記載する（正常系）
test("test_build_unit_file", async () => {
  // 準備
  const { buildUnitFile } = await loadSystemd();
  // 実行
  const unit = buildUnitFile({
    port: 18782,
    settingsPath: "/c/settings.yaml",
    stateDir: "/s",
    path: "/a b:/c",
    command: "npx -y x serve --v 100%",
  });
  // 検証
  const lines = unit.split("\n");
  expect(lines).toContain('Environment="MDMARK_PORT=18782"');
  expect(lines).toContain('Environment="MDMARK_CONFIG=/c/settings.yaml"');
  expect(lines).toContain('Environment="MDMARK_STATE_DIR=/s"');
  expect(lines).toContain('Environment="MDMARK_LAUNCHER=systemd"');
  expect(lines).toContain('Environment="PATH=/a b:/c"');
  expect(lines).toContain("ExecStart=/bin/sh -c 'npx -y x serve --v 100%%'");
  expect(lines).toContain("Restart=on-failure");
  expect(lines).toContain("WantedBy=default.target");
  expect(unit.endsWith("\n")).toBe(true);
});

/** /n/v24/bin の node と npx だけが実行できる */
const onlyNodeDir = (file: string) =>
  file === "/n/v24/bin/node" || file === "/n/v24/bin/npx";

// node と npx のフォルダだけを取り、重なりと関係の無いフォルダを除く（正常系）
test("test_build_unit_path_env", async () => {
  // 準備
  const { buildUnitPathEnv } = await loadSystemd();
  // 実行
  const path = buildUnitPathEnv({
    path: "/h/.local/bin:/h/.local/bin:/w/.venv/bin:/n/v24/bin:/usr/bin",
    isExecutable: onlyNodeDir,
  });
  // 検証
  expect(path).toBe("/n/v24/bin:/usr/local/bin:/usr/bin:/bin");
});

// 関係の無いフォルダの並びが変わっても同じ値（正常系）
test("test_build_unit_path_env_when_same_input", async () => {
  // 準備
  const { buildUnitPathEnv } = await loadSystemd();
  // 実行
  const first = buildUnitPathEnv({
    path: "/h/.local/bin:/h/.local/bin:/w/.venv/bin:/n/v24/bin:/usr/bin",
    isExecutable: onlyNodeDir,
  });
  const second = buildUnitPathEnv({
    path: "/x/bin:/h/.local/bin:/h/.local/bin:/n/v24/bin:/usr/bin",
    isExecutable: onlyNodeDir,
  });
  // 検証
  expect(second).toBe(first);
});

// Key=Value の行を順によらず読む（正常系）
test("test_read_unit_state", async () => {
  // 準備
  const { readUnitState } = await loadSystemd();
  const calls: string[][] = [];
  const run = async (_command: string, args: string[]) => {
    calls.push(args);
    return {
      code: 0,
      stdout:
        "NRestarts=2\nActiveState=activating\nMainPID=0\nSubState=auto-restart\nUnitFileState=enabled\n",
    };
  };
  // 実行
  const state = await readUnitState({ run, unit: "u" });
  // 検証
  expect(state).toEqual({
    activeState: "activating",
    subState: "auto-restart",
    nRestarts: 2,
    mainPid: 0,
    enabled: true,
  });
  expect(calls[0]).toContain("show");
  expect(calls[0]).toContain("u.service");
  expect(calls[0]).not.toContain("--value");
});

// 起動し直した・起動し直す前・failed を終わったとする（正常系）
test("test_has_unit_exited", async () => {
  // 準備
  const { hasUnitExited } = await loadSystemd();
  const running = {
    activeState: "active",
    subState: "running",
    nRestarts: 0,
    mainPid: 10,
    enabled: true,
  };
  // 実行・検証
  expect(hasUnitExited({ ...running, nRestarts: 1 })).toBe(true);
  expect(
    hasUnitExited({
      ...running,
      activeState: "activating",
      subState: "auto-restart",
    }),
  ).toBe(true);
  expect(
    hasUnitExited({ ...running, activeState: "failed", subState: "failed" }),
  ).toBe(true);
  expect(hasUnitExited(running)).toBe(false);
});
