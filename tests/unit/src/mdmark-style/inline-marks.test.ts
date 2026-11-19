import { expect, test } from "vitest";

/** 行内の記法を分けるモジュール（実装が無い間は各テストが個別に失敗する） */
const loadInline = () =>
  import("../../../../src/mdmark-style/inline-marks.ts");

// 4 種類の記法を分ける（正常系）
test("test_split_inline_marks", async () => {
  // 準備
  const { splitInlineMarks } = await loadInline();
  const line =
    "状態は `badge:green:完了` で、[注意]{color=red} は ==決め手== と `kbd:Ctrl+C`";
  // 実行
  const segments = splitInlineMarks(line);
  // 検証
  const marks = segments.filter((segment) => segment.kind !== "text");
  expect(
    marks.map(({ kind, text, color, keys }) => ({ kind, text, color, keys })),
  ).toEqual([
    { kind: "badge", text: "完了", color: "green", keys: undefined },
    { kind: "color", text: "注意", color: "red", keys: undefined },
    { kind: "highlight", text: "決め手", color: "yellow", keys: undefined },
    { kind: "kbd", text: "", color: undefined, keys: ["Ctrl", "C"] },
  ]);
  expect(segments.map((segment) => segment.kind)).toEqual([
    "text",
    "badge",
    "text",
    "color",
    "text",
    "highlight",
    "text",
    "kbd",
  ]);
  const starts = segments.map((segment) => segment.start);
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
});

// 知らない色の名前は色を付けない（正常系）
test("test_split_inline_marks_when_unknown_color", async () => {
  // 準備
  const { splitInlineMarks } = await loadInline();
  // 実行
  const segments = splitInlineMarks("[注意]{color=pink}");
  // 検証
  expect(segments).toEqual([
    expect.objectContaining({ kind: "text", text: "注意" }),
  ]);
});

// 色の無いバッジ（正常系）
test("test_split_inline_marks_when_badge_without_color", async () => {
  // 準備
  const { splitInlineMarks } = await loadInline();
  // 実行
  const segments = splitInlineMarks("`badge:v1:beta`");
  // 検証
  expect(segments).toHaveLength(1);
  expect(segments[0]).toEqual(
    expect.objectContaining({ kind: "badge", text: "v1:beta" }),
  );
  expect(segments[0]?.color).toBeUndefined();
});

// 打ち消した記法と普通のコードの中はそのまま（正常系）
test("test_split_inline_marks_when_escaped", async () => {
  // 準備
  const { splitInlineMarks } = await loadInline();
  const line = "`badge\\:v1` と `==x==`";
  // 実行
  const segments = splitInlineMarks(line);
  // 検証
  expect(segments).toEqual([
    expect.objectContaining({ kind: "text", text: line }),
  ]);
});

// `+` のキー（正常系）
test("test_split_inline_marks_when_plus_key", async () => {
  // 準備
  const { splitInlineMarks } = await loadInline();
  // 実行
  const segments = splitInlineMarks("`kbd:Ctrl++`");
  // 検証
  expect(segments).toEqual([
    expect.objectContaining({ kind: "kbd", keys: ["Ctrl", "+"] }),
  ]);
});

// 描かれる文字にする（正常系）
test("test_inline_plain_text", async () => {
  // 準備
  const { inlinePlainText } = await loadInline();
  const segments = [
    { kind: "badge" as const, text: "完了", color: "green" as const, start: 0 },
    { kind: "text" as const, text: " と ", start: 10 },
    { kind: "kbd" as const, text: "", keys: ["Ctrl", "C"], start: 13 },
  ];
  // 実行
  const text = inlinePlainText(segments);
  // 検証
  expect(text).toBe(" 完了  と [Ctrl]+[C]");
});
