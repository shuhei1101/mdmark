import { beforeEach, expect, test } from "vitest";
import {
  createFakeEngine,
  FAKE_ELEMENTS,
  type FakeNode,
  fakeH,
  findNodes,
  installH,
  pressButton,
  textOf,
} from "./fake-engine.ts";

/** 本文の部品を描くモジュール（実装が無い間は各テストが個別に失敗する） */
const loadParts = () =>
  import("../../../../src/mdmark-style/document-parts.tsx");

/** 共通スタイルの色のモジュール */
const loadTokens = () => import("../../../../src/shared/style-tokens.logic.ts");

/** 全ての部品がオンの設定 */
const ALL_PARTS = {
  table: true,
  heading: true,
  callout: true,
  code: true,
  fold: true,
  terms: true,
  hover_card: true,
  footnote: true,
  row_detail: true,
  steps: true,
  tree: true,
  inline: true,
  stack: true,
  figure: true,
};

/** ブロックを描く文脈を作る */
const contextOf = ($: ReturnType<typeof createFakeEngine>) => ({
  elements: FAKE_ELEMENTS,
  surface: "terminal" as const,
  columns: 80,
  theme: "dark",
  blockKey: "r1:hash",
  parts: ALL_PARTS,
  marks: [],
  ui: $.ui,
});

/** 段落のブロック */
const paragraph = (markdown: string, line = 1) => ({
  kind: "markdown" as const,
  line,
  markdown,
});

/** 中身のブロックを、本文の文字を持つ `Body` のノードにする */
const renderBody = (blocks: { markdown?: string }[]) =>
  fakeH("Body", null, blocks.map((block) => block.markdown ?? "").join("\n"));

/** 子孫の Text のうち、文字が一致するもの */
const textNodes = (node: unknown, text: string) =>
  findNodes(
    node as FakeNode,
    (n) => n.type === "Text" && textOf(n).trim() === text,
  );

beforeEach(() => {
  installH();
});

// 番号と縦線を描く（正常系）
test("test_render_steps", async () => {
  // 準備
  const { renderSteps } = await loadParts();
  const { styleColor } = await loadTokens();
  const $ = createFakeEngine();
  const block = {
    kind: "steps" as const,
    line: 1,
    steps: { items: [[paragraph("依存を入れる")], [paragraph("ビルドする")]] },
  };
  // 実行
  const node = renderSteps({ block, context: contextOf($), renderBody });
  // 検証
  const heading = styleColor({ name: "heading", theme: "dark" });
  for (const number of ["1", "2"]) {
    expect(textNodes(node, number)[0]?.props).toEqual(
      expect.objectContaining({ bold: true, color: heading }),
    );
  }
  const bars = textNodes(node, "│");
  expect(bars).toHaveLength(1);
  expect(bars[0]?.props.color).toBe(
    styleColor({ name: "border", theme: "dark" }),
  );
});

// 注釈を同じ桁にそろえる（正常系）
test("test_render_tree", async () => {
  // 準備
  const { renderTree } = await loadParts();
  const { displayWidth } = await import(
    "../../../../src/mdmark-style/table-layout.ts"
  );
  const $ = createFakeEngine();
  const block = {
    kind: "tree" as const,
    line: 1,
    tree: {
      lines: [
        { rule: "├── ", name: "src/", note: "ソース" },
        { rule: "└── ", name: "README.md", note: "説明" },
      ],
    },
  };
  // 実行
  const node = renderTree({ block, context: contextOf($) });
  // 検証
  expect(textOf(node)).not.toContain("#");
  const notes = [...textNodes(node, "ソース"), ...textNodes(node, "説明")];
  expect(notes).toHaveLength(2);
  for (const note of notes) {
    expect(note.props.dimColor).toBe(true);
  }
  const rules = findNodes(
    node,
    (n) => n.type === "Text" && /^[├└]── $/.test(textOf(n)),
  );
  expect(rules).toHaveLength(2);
  for (const rule of rules) {
    expect(rule.props.dimColor).toBe(true);
  }
  const lines = findNodes(
    node,
    (n) =>
      n.type === "Box" &&
      n.children.some((child) =>
        ["ソース", "説明"].includes(textOf(child).trim()),
      ),
  );
  expect(lines).toHaveLength(2);
  const before = lines.map((line) => {
    const text = textOf(line);
    const note = ["ソース", "説明"].find((word) => text.endsWith(word)) ?? "";
    return displayWidth(text.slice(0, text.length - note.length));
  });
  expect(before[0]).toBe(before[1]);
});

// タブ名の見出しと字下げ（正常系）
test("test_render_stack_tabs", async () => {
  // 準備
  const { renderStack } = await loadParts();
  const { styleColor } = await loadTokens();
  const $ = createFakeEngine();
  const block = {
    kind: "stack" as const,
    line: 1,
    stack: {
      kind: "tabs" as const,
      sections: [
        { title: "macOS", body: [paragraph("brew で入れる。")] },
        { title: "Windows", body: [paragraph("winget で入れる。")] },
      ],
    },
  };
  // 実行
  const node = renderStack({ block, context: contextOf($), renderBody });
  // 検証
  const heading = styleColor({ name: "heading", theme: "dark" });
  for (const title of ["macOS", "Windows"]) {
    expect(textNodes(node, title)[0]?.props).toEqual(
      expect.objectContaining({ bold: true, color: heading }),
    );
  }
  const indented = findNodes(
    node,
    (n) =>
      n.type === "Box" &&
      n.props.paddingLeft === 2 &&
      n.children.some((child) => (child as FakeNode).type === "Body"),
  );
  expect(indented).toHaveLength(2);
  expect(findNodes(node, (n) => n.type === "Button")).toEqual([]);
});

// 段組みは見出しを付けない（正常系）
test("test_render_stack_columns", async () => {
  // 準備
  const { renderStack } = await loadParts();
  const $ = createFakeEngine();
  const block = {
    kind: "stack" as const,
    line: 1,
    stack: {
      kind: "columns" as const,
      sections: [
        { body: [paragraph("左の列")] },
        { body: [paragraph("右の列")] },
      ],
    },
  };
  // 実行
  const node = renderStack({ block, context: contextOf($), renderBody });
  // 検証
  expect(
    findNodes(node, (n) => n.type === "Text" && n.props.bold === true),
  ).toEqual([]);
  const bodies = findNodes(node, (n) => n.type === "Body").map(textOf);
  expect(bodies).toEqual(["左の列", "右の列"]);
});

// 押すと詳細が開く（正常系）
test("test_render_row_detail", async () => {
  // 準備
  const { renderRowDetail } = await loadParts();
  const $ = createFakeEngine();
  const key = "r1:hash:row-detail:0:0";
  const body = () => fakeH("Body", null, "りんごは青森県から届く。");
  // 実行
  const closed = renderRowDetail({ key, body, context: contextOf($) });
  await pressButton(closed.toggle as FakeNode);
  const opened = renderRowDetail({ key, body, context: contextOf($) });
  // 検証
  expect(textOf(closed.toggle)).toContain("[ ▸ ]");
  expect(closed.detail).toBeUndefined();
  expect(textOf(opened.toggle)).toContain("[ ▾ ]");
  expect(opened.detail).toBeDefined();
  expect(textOf(opened.detail)).toContain("りんごは青森県から届く。");
  expect($.ui.invalidate).toHaveBeenCalledTimes(1);
  expect($.ui.invalidate).toHaveBeenCalledWith("ui.render");
});
