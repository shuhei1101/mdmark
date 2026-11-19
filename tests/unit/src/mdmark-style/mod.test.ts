import { expect, test } from "vitest";

/** mod の入口（実装が無い間は各テストが個別に失敗する） */
const loadMod = () => import("../../../../src/mdmark-style/mod.tsx");

// 3 つのフックを登録する（正常系）
test("test_register", async () => {
  // 準備
  const { register } = await loadMod();
  const calls: unknown[][] = [];
  // 実行
  register((...args: unknown[]) => {
    calls.push(args);
  });
  // 検証
  expect(calls).toHaveLength(3);
  const matchers = calls.map(([event, matcher]) => [
    event,
    typeof matcher === "function" ? undefined : matcher,
  ]);
  expect(matchers).toContainEqual([
    "ui.render",
    { component: "AssistantMessage" },
  ]);
  expect(matchers).toContainEqual(["ui.render", { component: "UserMessage" }]);
  expect(matchers).toContainEqual(["classic.SessionStart", undefined]);
});
