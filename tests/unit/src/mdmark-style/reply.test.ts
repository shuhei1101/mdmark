import { beforeEach, expect, test, vi } from "vitest";
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

/** 返答を描くモジュール（実装が無い間は各テストが個別に失敗する） */
const loadReply = () => import("../../../../src/mdmark-style/reply.tsx");

/** 共通スタイルの色のモジュール */
const loadTokens = () => import("../../../../src/shared/style-tokens.logic.ts");

/** 設定ファイルの既定のパス */
const CONFIG = "/home/u/.config/mdmark-style/settings.yaml";

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
};

/** `next(e)` の代わりに返却する、元の描画の参照 */
const ENGINE_NODE = { type: "engine", ref: 1 };

/** 返答の描画の入力を作る */
const replyEvent = (text: string, requestId = "r1") => ({
  component: "AssistantMessage" as const,
  props: { text, isFirstOfReply: true },
  surface: "terminal" as const,
  viewport: { columns: 80 },
  requestId,
});

/** ブロックを描く文脈を作る */
const contextOf = (
  $: ReturnType<typeof createFakeEngine>,
  overrides: Record<string, unknown> = {},
) => ({
  elements: FAKE_ELEMENTS,
  surface: "terminal" as const,
  columns: 80,
  theme: "dark",
  blockKey: "r1:hash",
  parts: ALL_PARTS,
  marks: [],
  ui: $.ui,
  ...overrides,
});

/** 3 列で 1 行の幅が 60 の表のブロック */
const WIDE_TABLE = {
  kind: "table" as const,
  line: 1,
  table: {
    kind: "default" as const,
    header: ["名前", "説明", "備考"],
    rows: [
      ["a".repeat(10), "word ".repeat(6).trim(), "note ".repeat(4).trim()],
    ],
    align: ["left" as const, "left" as const, "left" as const],
  },
};

beforeEach(() => {
  installH();
});

// 返答を対象にしない設定（正常系）
test("test_render_reply_when_disabled", async () => {
  // 準備
  const { renderReply } = await loadReply();
  const $ = createFakeEngine({
    files: { [CONFIG]: "global:\n  targets: [user]\n" },
  });
  const next = vi.fn(async () => ENGINE_NODE);
  // 実行
  const node = await renderReply($, replyEvent("## 見出し"), next);
  // 検証
  expect(node).toBe(ENGINE_NODE);
});

// 上限を超える木は元の描画に任せる（正常系）
test("test_render_reply_when_over_limit", async () => {
  // 準備
  const { renderReply } = await loadReply();
  const $ = createFakeEngine();
  const next = vi.fn(async () => ENGINE_NODE);
  const rows = Array.from({ length: 10_000 }, (_, i) => `| ${i} | x |`);
  const text = ["| a | b |", "| --- | --- |", ...rows].join("\n");
  // 実行
  const node = await renderReply($, replyEvent(text), next);
  // 検証
  expect(node).toBe(ENGINE_NODE);
});

// 設定ファイルを読めない（異常系）
test("test_render_reply_when_settings_broken", async () => {
  // 準備
  const { renderReply } = await loadReply();
  const { SettingsError } = await import(
    "../../../../src/mdmark-style/settings.ts"
  );
  const $ = createFakeEngine({ files: { [CONFIG]: "global: [" } });
  const next = vi.fn(async () => ENGINE_NODE);
  // 実行・検証
  await expect(renderReply($, replyEvent("## a"), next)).rejects.toThrow(
    SettingsError,
  );
});

// 狭い端末ではセルを折り返す（正常系）
test("test_render_block_table", async () => {
  // 準備
  const { renderBlock } = await loadReply();
  const { displayWidth } = await import(
    "../../../../src/mdmark-style/table-layout.ts"
  );
  const $ = createFakeEngine();
  // 実行
  const node = renderBlock({
    block: WIDE_TABLE,
    context: contextOf($, { columns: 40 }),
  });
  // 検証
  const lines = findNodes(node, (n) => n.type === "Text").map(textOf);
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(displayWidth(line)).toBeLessThanOrEqual(40);
  }
  expect(findNodes(node, (n) => "overflowX" in n.props)).toEqual([]);
});

// デスクトップ版は横にスクロールする（正常系）
test("test_render_block_table_when_desktop", async () => {
  // 準備
  const { renderBlock } = await loadReply();
  const $ = createFakeEngine();
  // 実行
  const node = renderBlock({
    block: WIDE_TABLE,
    context: contextOf($, { columns: 40, surface: "desktop" }),
  });
  // 検証
  const scrolled = findNodes(node, (n) => n.props.overflowX === "scroll");
  expect(scrolled).toHaveLength(1);
  const rowLine = findNodes(node, (n) => n.type === "Text")
    .map(textOf)
    .filter((line) => line.includes("aaaaaaaaaa"))
    .sort((a, b) => b.length - a.length)[0];
  expect(rowLine).toContain("word word word word word word");
  expect(rowLine).toContain("note note note note");
});

// コードブロックを背景の面で描き、コピーボタンを付ける（正常系）
test("test_render_block_code", async () => {
  // 準備
  const { renderBlock } = await loadReply();
  const $ = createFakeEngine();
  const block = {
    kind: "code" as const,
    line: 1,
    code: {
      lang: "ts",
      title: "a.ts",
      lineNumbers: false,
      lines: [
        { text: "const a = 1", mark: "++" as const },
        { text: "const b = 2" },
      ],
    },
  };
  // 実行
  const node = renderBlock({ block, context: contextOf($) });
  // 検証
  expect(
    findNodes(node, (n) => n.type === "Box" && "backgroundColor" in n.props),
  ).not.toEqual([]);
  expect(textOf(node)).toContain("a.ts");
  expect(textOf(node)).toContain("ts");
  const [button] = findNodes(
    node,
    (n) => n.type === "Button" && n.props.label === "コピー",
  );
  expect(button).toBeDefined();
  await pressButton(button);
  expect($.ui.copy).toHaveBeenCalledWith(
    expect.objectContaining({ text: "const a = 1\nconst b = 2" }),
  );
});

// 注意書きを縦線とラベルで描く（正常系）
test("test_render_block_callout", async () => {
  // 準備
  const { renderBlock } = await loadReply();
  const { styleColor } = await loadTokens();
  const $ = createFakeEngine();
  const block = {
    kind: "callout" as const,
    line: 1,
    callout: {
      type: "WARNING",
      closed: false,
      body: [{ kind: "markdown" as const, line: 2, markdown: "注意の文" }],
    },
  };
  // 実行
  const node = renderBlock({ block, context: contextOf($) });
  // 検証
  const color = styleColor({ name: "calloutWarning", theme: "dark" });
  const bar = findNodes(
    node,
    (n) => n.type === "Text" && textOf(n).includes("┃"),
  );
  expect(bar[0]?.props.color).toBe(color);
  const label = findNodes(
    node,
    (n) => n.type === "Text" && textOf(n) === "WARNING",
  );
  expect(label[0]?.props).toEqual(
    expect.objectContaining({ bold: true, color }),
  );
});

// 閉じた範囲を押すと開く（正常系）
test("test_render_fold", async () => {
  // 準備
  const { renderFold } = await loadReply();
  const $ = createFakeEngine();
  const context = contextOf($);
  const body = () => fakeH("Text", null, "中身");
  const draw = () =>
    renderFold({ key: "fold-test-1", title: "用語", body, context });
  // 実行
  const closed = draw() as FakeNode;
  const [button] = findNodes(closed, (n) => n.type === "Button");
  await pressButton(button);
  const opened = draw() as FakeNode;
  // 検証
  expect(button?.props.label).toBe("▸ 用語");
  expect(textOf(closed)).not.toContain("中身");
  expect(findNodes(opened, (n) => n.type === "Button")[0]?.props.label).toBe(
    "▾ 用語",
  );
  expect(textOf(opened)).toContain("中身");
  expect($.ui.invalidate).toHaveBeenCalledTimes(1);
  expect($.ui.invalidate).toHaveBeenCalledWith("ui.render");
});

// 同じ返答の別のブロックの範囲は状態を共有しない（正常系）
test("test_render_fold_when_other_block", async () => {
  // 準備
  const { renderReply } = await loadReply();
  const $ = createFakeEngine();
  const next = vi.fn(async () => ENGINE_NODE);
  const blockOf = (word: string) =>
    [
      `<!-- details: ${word} -->`,
      "",
      `${word}の中身`,
      "",
      "<!-- /details -->",
    ].join("\n");
  const first = replyEvent(blockOf("一つ目"), "same");
  const second = replyEvent(blockOf("二つ目"), "same");
  // 実行
  const drawnFirst = await renderReply($, first, next);
  const [button] = findNodes(drawnFirst, (n) => n.type === "Button");
  await pressButton(button);
  const againFirst = await renderReply($, first, next);
  const againSecond = await renderReply($, second, next);
  // 検証
  expect(textOf(againFirst)).toContain("一つ目の中身");
  expect(textOf(againSecond)).not.toContain("二つ目の中身");
});

// 大きさを数える（正常系）
test("test_count_tree", async () => {
  // 準備
  const { countTree } = await loadReply();
  const node = fakeH(
    "Box",
    null,
    fakeH("Text", null, "ab"),
    fakeH("Text", null, "c"),
  );
  // 実行・検証
  expect(countTree(node)).toEqual({
    nodes: 3,
    depth: 2,
    chars: 3,
    over: false,
  });
});

// 深さの上限を超える（正常系）
test("test_count_tree_when_deep", async () => {
  // 準備
  const { countTree } = await loadReply();
  let node: FakeNode = fakeH("Text", null, "x");
  for (let i = 0; i < 33; i += 1) {
    node = fakeH("Box", null, node);
  }
  // 実行・検証
  expect(countTree(node).over).toBe(true);
});
