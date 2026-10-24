import { expect, test } from "vitest";

/** 設定の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSettings = () => import("../../../../vscode/src/settings.ts");

/** キーごとの値を返す `get` の代役を作る（無いキーは `undefined`） */
function createGet(values: Record<string, unknown>) {
  return (key: string) => values[key];
}

// 書いた値をそのまま読む（正常系）
test("test_read_settings", async () => {
  // 準備
  const { readSettings, SETTING_DEFAULTS } = await loadSettings();
  const get = createGet({
    version: "v0.6.0",
    "preview.updateDelayMs": 1000,
    "preview.theme": "dark",
  });
  // 実行
  const settings = readSettings(get);
  // 検証
  expect(settings).toEqual({
    ...SETTING_DEFAULTS,
    version: "v0.6.0",
    updateDelayMs: 1000,
    theme: "dark",
  });
});

// 範囲の外・整数でない待ちと知らない配色は既定に戻す（正常系）
test("test_read_settings_when_out_of_range", async () => {
  // 準備
  const { readSettings, SETTING_DEFAULTS } = await loadSettings();
  const invalidDelays = [-1, 5001, 12.5, "300"];
  // 実行
  const results = invalidDelays.map((delay) =>
    readSettings(
      createGet({ "preview.updateDelayMs": delay, "preview.theme": "sepia" }),
    ),
  );
  const edges = [0, 5000].map((delay) =>
    readSettings(createGet({ "preview.updateDelayMs": delay })),
  );
  // 検証
  for (const settings of results) {
    expect(settings.updateDelayMs).toBe(300);
    expect(settings.theme).toBe("auto");
  }
  expect(SETTING_DEFAULTS.updateDelayMs).toBe(300);
  expect(edges.map((settings) => settings.updateDelayMs)).toEqual([0, 5000]);
});
