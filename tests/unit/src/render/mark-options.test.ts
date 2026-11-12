import { expect, test } from "vitest";

/** マーカーの引数の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMarkOptions = () => import("../../../../src/render/mark-options.ts");

/** `JSON.parse` が投げた値を取得する */
const parseErrorOf = (text: string): unknown => {
  try {
    JSON.parse(text);
  } catch (error) {
    return error;
  }
  throw new Error(`JSON として読めてしまいます: ${text}`);
};

// JSON のオブジェクトを型を保って読む（正常系）
test("test_read_mark_args", async () => {
  // 準備
  const { readMarkArgs } = await loadMarkOptions();
  // 実行
  const args = readMarkArgs(
    '{"kind": "data", "header": {"rows": 2}, "closed": true}',
  );
  // 検証
  expect(args).toEqual({
    kind: "json",
    options: { kind: "data", header: { rows: 2 }, closed: true },
  });
});

// 改行を含む JSON のオブジェクトを 1 つとして読む（正常系）
test("test_read_mark_args_when_multiline", async () => {
  // 準備
  const { readMarkArgs } = await loadMarkOptions();
  // 実行
  const args = readMarkArgs(
    '{\n  "kind": "data",\n  "collapse": {"open": false}\n}',
  );
  // 検証
  expect(args).toEqual({
    kind: "json",
    options: { kind: "data", collapse: { open: false } },
  });
});

// 引数が無ければ none（正常系）
test("test_read_mark_args_when_empty", async () => {
  // 準備
  const { readMarkArgs } = await loadMarkOptions();
  // 実行
  const empty = readMarkArgs("");
  const spaces = readMarkArgs("   \n ");
  // 検証
  expect(empty).toEqual({ kind: "none" });
  expect(spaces).toEqual({ kind: "none" });
});

// `{` で始まらない引数は今の書き方（正常系）
test("test_read_mark_args_when_legacy", async () => {
  // 準備
  const { readMarkArgs } = await loadMarkOptions();
  // 実行
  const args = readMarkArgs("data +total total=数量:sum");
  // 検証
  expect(args).toEqual({ kind: "legacy", text: "data +total total=数量:sum" });
});

// 読めない JSON とオブジェクトでない値は invalid（異常系）
test("test_read_mark_args_when_invalid", async () => {
  // 準備
  const { readMarkArgs } = await loadMarkOptions();
  // 実行
  const unquoted = readMarkArgs('{"title": 補足}');
  const trailingComma = readMarkArgs('{"a": 1,}');
  // 検証
  expect(unquoted).toMatchObject({
    kind: "invalid",
    message: expect.stringMatching(/\d+ 文字目.*`補`/),
  });
  expect(trailingComma).toMatchObject({
    kind: "invalid",
    message: expect.stringMatching(/\d+ 文字目/),
  });
});

// 引用符で囲んでいない文字の位置と直し方を出す（正常系）
test("test_json_error_message", async () => {
  // 準備
  const { jsonErrorMessage } = await loadMarkOptions();
  const text = '{"title": 補足}';
  // 実行
  const message = jsonErrorMessage({ text, error: parseErrorOf(text) });
  // 検証
  expect(message).toContain("11 文字目の `補`");
  expect(message).toContain('`"` で囲んで');
});

// 閉じていない文字の値は、値の `-->` で閉じたことと記載方法を出す（正常系）
test("test_json_error_message_when_comment_end", async () => {
  // 準備
  const { jsonErrorMessage } = await loadMarkOptions();
  const text = '{"title": "a ';
  // 実行
  const message = jsonErrorMessage({ text, error: parseErrorOf(text) });
  // 検証
  expect(message).toContain("`-->` を記載すると、コメントがそこで閉じます");
  expect(message).toContain("`--\\u003e`");
});
