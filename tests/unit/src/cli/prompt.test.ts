import { Readable } from "node:stream";
import { expect, test } from "vitest";

/** 標準入力の質問を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/prompt.ts");

// 質問ごとに 1 行ずつ返却する（正常系）
test("test_create_line_prompter", async () => {
  // 準備
  const { createLinePrompter } = await loadModule();
  const written: string[] = [];
  const ask = createLinePrompter({
    input: Readable.from(["v0.3.0\ny\n"]),
    write: (line) => written.push(line),
  });
  // 実行
  const first = await ask("手元のバージョンを入れてください:");
  const second = await ask("壊す手順を適用してよいですか:");
  // 検証
  expect(first).toBe("v0.3.0");
  expect(second).toBe("y");
  expect(written).toHaveLength(2);
  expect(written[0]).toContain("手元のバージョンを入れてください:");
  expect(written[1]).toContain("壊す手順を適用してよいですか:");
});

// 入力が終わっていれば undefined（異常系）
test("test_create_line_prompter_when_ended", async () => {
  // 準備
  const { createLinePrompter } = await loadModule();
  const ask = createLinePrompter({
    input: Readable.from([]),
    write: () => {},
  });
  // 実行
  const answer = await ask("手元のバージョンを入れてください:");
  // 検証
  expect(answer).toBeUndefined();
});
