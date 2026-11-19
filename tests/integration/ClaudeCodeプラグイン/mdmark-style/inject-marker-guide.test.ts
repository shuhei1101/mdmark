import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";
import { CONFIG_PATH, installWorld, settingsFile } from "./world.ts";

/** 説明の文の上限の文字数 */
const GUIDE_MAX_CHARS = 600;

/** 別のプラグインが追加した `additionalContext` を返却する、mod の下の SessionStart */
const installOther = (on: On) => {
  on("classic.SessionStart", () => ({ additionalContext: ["other"] }));
};

/** `additionalContext` のうち、mod の説明の文 */
const guidesOf = (result: { additionalContext?: readonly string[] }) =>
  (result.additionalContext ?? []).filter((text) =>
    text.startsWith("mdmark-style:"),
  );

// 起動の SessionStart で説明を 1 つ追加する（正常系）
test("test_normal", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  installOther(on);
  // 実行
  const result = await $.classic.SessionStart({ source: "startup" });
  // 検証
  expect(result.additionalContext?.[0]).toBe("other");
  expect(result.additionalContext).toHaveLength(2);
  const [guide = ""] = guidesOf(result);
  expect(guide).toContain('<!-- table: {"kind": "data"} -->');
  expect(guide.length).toBeLessThanOrEqual(GUIDE_MAX_CHARS);
});

// /clear の後の SessionStart でも説明を 1 つ追加する（正常系）
test("test_normal_when_cleared", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  installOther(on);
  await $.classic.SessionStart({ source: "startup" });
  // 実行
  const result = await $.classic.SessionStart({ source: "clear" });
  // 検証
  expect(guidesOf(result)).toHaveLength(1);
});

// 注入をオフにしている（正常系）
test("test_normal_when_injection_disabled", async ($, on) => {
  // 準備
  installWorld(on, { files: settingsFile("inject_marker_guide: false") });
  installOther(on);
  // 実行
  const result = await $.classic.SessionStart({ source: "startup" });
  // 検証
  expect(result.additionalContext).toEqual(["other"]);
});

// 設定ファイルを読めない（異常系）
test("test_error_when_config_unreadable", async ($, on) => {
  // 準備
  const recorded = installWorld(on, { files: { [CONFIG_PATH]: "global: [" } });
  installOther(on);
  // 実行
  const result = await $.classic.SessionStart({ source: "startup" });
  // 検証
  expect(result.additionalContext).toEqual(["other"]);
  const debug = recorded.logs.filter((log) => log.to === "debug");
  expect(debug).toHaveLength(1);
  expect(debug[0]?.text).toContain("mdmark-style");
  expect(debug[0]?.text).toContain(CONFIG_PATH);
});
