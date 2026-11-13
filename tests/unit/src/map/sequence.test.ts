import { expect, test } from "vitest";
import { SEQUENCE } from "../../helpers/map.ts";

/** sequenceDiagram の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSequence = () => import("../../../../src/map/sequence.ts");

// 全ての記法（正常系）
test("test_parse_sequence", async () => {
  // 準備
  const { parseSequence } = await loadSequence();
  // 実行
  const sequence = parseSequence(SEQUENCE);
  // 検証
  expect(sequence.participants.map((item) => item.id)).toEqual([
    "user",
    "mount",
    "marker",
    "mermaid",
    "layout",
  ]);
  expect(sequence.messages).toHaveLength(7);
  expect(sequence.fragments.map((item) => [item.kind, item.label])).toEqual([
    ["rect", "描く前の準備"],
    ["loop", "map の範囲ごと"],
    ["alt", "mermaid のブロックがある"],
  ]);
  expect(sequence.notes).toHaveLength(1);
  expect(sequence.activations).toHaveLength(1);
  expect(sequence.autonumber).toBe(true);
  expect(sequence.problems).toEqual([]);
});

// 矢印の種類（正常系）
test("test_parse_sequence_when_arrows", async () => {
  // 準備
  const { parseSequence } = await loadSequence();
  const arrows = [
    "->",
    "-->",
    "->>",
    "-->>",
    "-x",
    "--x",
    "-)",
    "--)",
    "<<->>",
    "<<-->>",
  ];
  const source = `sequenceDiagram\n${arrows.map((arrow) => `  A${arrow}B: ${arrow}`).join("\n")}\n`;
  // 実行
  const sequence = parseSequence(source);
  // 検証
  expect(sequence.messages.map((message) => message.arrow)).toEqual(arrows);
  expect(sequence.problems).toEqual([]);
});

// alt の区切り（正常系）
test("test_parse_sequence_when_sections", async () => {
  // 準備
  const { parseSequence } = await loadSequence();
  // 実行
  const sequence = parseSequence(
    "sequenceDiagram\n  alt a\n    A->>B: x\n  else b\n    A->>B: y\n  end\n",
  );
  // 検証
  expect(
    sequence.fragments[0]?.sections.map((section) => section.label),
  ).toEqual(["a", "b"]);
});

// 閉じの無いブロック（異常系）
test("test_parse_sequence_when_unclosed_block", async () => {
  // 準備
  const { parseSequence } = await loadSequence();
  // 実行
  const sequence = parseSequence(
    "sequenceDiagram\n  loop ずっと\n    A->>B: x\n    B->>A: y\n",
  );
  // 検証
  expect(sequence.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid",
  ]);
  expect(sequence.fragments[0]).toMatchObject({
    kind: "loop",
    start: 0,
    end: 2,
  });
});

// 読めない行（異常系）
test("test_parse_sequence_when_unreadable_line", async () => {
  // 準備
  const { parseSequence } = await loadSequence();
  // 実行
  const sequence = parseSequence("sequenceDiagram\n  A => B: x\n");
  // 検証
  expect(sequence.problems).toHaveLength(1);
  expect(sequence.problems[0]?.kind).toBe("map_invalid");
});

// 名前とラベルの文字の参照を文字に戻す（正常系）
test("test_parse_sequence_when_entity", async () => {
  // 準備
  const { parseSequence } = await loadSequence();
  // 実行
  const sequence = parseSequence(
    [
      "sequenceDiagram",
      "  participant A as #35;1#59; 受付",
      "  loop #quot;x#quot;",
      "    A->>A: a#59; b",
      "  end",
    ].join("\n"),
  );
  // 検証
  expect(sequence.problems).toEqual([]);
  expect(sequence.participants[0]?.label).toBe("#1; 受付");
  expect(sequence.messages[0]?.text).toBe("a; b");
  expect(sequence.fragments[0]?.label).toBe('"x"');
});
