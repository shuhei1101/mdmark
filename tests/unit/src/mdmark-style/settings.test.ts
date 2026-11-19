import { expect, test } from "vitest";
import { createFakeEngine } from "./fake-engine.ts";

/** 設定を読み込むモジュール（実装が無い間は各テストが個別に失敗する） */
const loadSettings = () => import("../../../../src/mdmark-style/settings.ts");

// 環境変数のパスを使う（正常系）
test("test_settings_path", async () => {
  // 準備
  const { settingsPath } = await loadSettings();
  const $ = createFakeEngine({
    env: { MDMARK_STYLE_CONFIG: "~/x/s.yaml", HOME: "/home/u" },
  });
  // 実行
  const path = await settingsPath($);
  // 検証
  expect(path).toBe("/home/u/x/s.yaml");
  expect($.env.get).toHaveBeenCalledWith("MDMARK_STYLE_CONFIG");
});

// XDG_CONFIG_HOME の下を使う（正常系）
test("test_settings_path_when_xdg", async () => {
  // 準備
  const { settingsPath } = await loadSettings();
  const $ = createFakeEngine({
    env: { XDG_CONFIG_HOME: "/cfg", HOME: "/home/u" },
  });
  // 実行
  const path = await settingsPath($);
  // 検証
  expect(path).toBe("/cfg/mdmark-style/settings.yaml");
});

// どちらも無ければ ~/.config の下（正常系）
test("test_settings_path_when_default", async () => {
  // 準備
  const { settingsPath } = await loadSettings();
  const $ = createFakeEngine({ env: { HOME: "/home/u" } });
  // 実行
  const path = await settingsPath($);
  // 検証
  expect(path).toBe("/home/u/.config/mdmark-style/settings.yaml");
});

// 空なら既定値（正常系）
test("test_merge_settings", async () => {
  // 準備
  const { DEFAULT_SETTINGS, mergeSettings } = await loadSettings();
  // 実行
  const settings = mergeSettings({
    raw: undefined,
    projectRoot: "/r/mdmark",
    configDir: "/c",
    home: "/home/u",
  });
  // 検証
  expect(settings).toEqual(DEFAULT_SETTINGS);
});

// 該当したプロジェクトを重ねる（正常系）
test("test_merge_settings_when_project_matched", async () => {
  // 準備
  const { mergeSettings } = await loadSettings();
  // 実行
  const settings = mergeSettings({
    raw: {
      global: { parts: { table: false } },
      projects: [{ match: "mdmark", parts: { code: false } }],
    },
    projectRoot: "/r/mdmark/.claude/worktrees/w",
    configDir: "/c",
    home: "/home/u",
  });
  // 検証
  expect(settings.parts.table).toBe(false);
  expect(settings.parts.code).toBe(false);
  expect(settings.parts.heading).toBe(true);
  expect(settings.parts.callout).toBe(true);
  expect(settings.parts.fold).toBe(true);
  expect(settings.parts.terms).toBe(true);
  for (const name of [
    "row_detail",
    "steps",
    "tree",
    "inline",
    "stack",
    "figure",
  ] as const) {
    expect(settings.parts[name]).toBe(true);
  }
});

// 相対パスを解決する（正常系）
test("test_merge_settings_when_glossary_relative", async () => {
  // 準備
  const { mergeSettings } = await loadSettings();
  // 実行
  const settings = mergeSettings({
    raw: { global: { glossary: "./docs/mdmark.config.yaml" } },
    projectRoot: "/r/mdmark",
    configDir: "/c",
    home: "/home/u",
  });
  // 検証
  expect(settings.glossary).toBe("/c/docs/mdmark.config.yaml");
});

// 型の合わないキー（異常系）
test("test_merge_settings_when_invalid", async () => {
  // 準備
  const { SettingsError, mergeSettings } = await loadSettings();
  // 実行・検証
  expect(() =>
    mergeSettings({
      raw: { global: { parts: { table: "no" } } },
      projectRoot: "/r/mdmark",
      configDir: "/c",
      home: "/home/u",
    }),
  ).toThrow(SettingsError);
  expect(() =>
    mergeSettings({
      raw: { global: { parts: { table: "no" } } },
      projectRoot: "/r/mdmark",
      configDir: "/c",
      home: "/home/u",
    }),
  ).toThrow("global.parts.table");
});

// ファイルが無ければ既定値（正常系）
test("test_read_settings_when_missing", async () => {
  // 準備
  const { DEFAULT_SETTINGS, readSettings } = await loadSettings();
  const $ = createFakeEngine({ env: { HOME: "/home/u" } });
  // 実行
  const settings = await readSettings($);
  // 検証
  expect(settings).toEqual(DEFAULT_SETTINGS);
});

// YAML として読めない（異常系）
test("test_read_settings_when_broken", async () => {
  // 準備
  const { SettingsError, readSettings } = await loadSettings();
  const $ = createFakeEngine({
    env: { HOME: "/home/u" },
    files: { "/home/u/.config/mdmark-style/settings.yaml": "global: [" },
  });
  // 実行・検証
  await expect(readSettings($)).rejects.toThrow(SettingsError);
  await expect(readSettings($)).rejects.toThrow(
    "/home/u/.config/mdmark-style/settings.yaml",
  );
});
