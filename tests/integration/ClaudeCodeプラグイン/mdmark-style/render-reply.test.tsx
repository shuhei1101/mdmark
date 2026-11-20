import { type Engine, expect, test } from "claude-code/testing";
import {
  allTexts,
  CONFIG_PATH,
  DOCUMENT_PARTS_REPLY,
  type DrawnNode,
  installWorld,
  nodesOf,
  PLUGIN,
  settingsFile,
  textOf,
  textProps,
} from "./world.ts";

/** 正常系の固定の返答 */
const REPLY = [
  "## WS の違い",
  "",
  "**太字** と `code` の段落 <!-- note: x --> の続き",
  "",
  "- 箇条書きの 1 行目",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 名前 | 種類 |",
  "| --- | --- |",
  "| WS | 用語 |",
  "",
  "<!-- /table -->",
  "",
  "| 列 | 値 |",
  "| --- | --- |",
  "| a | b |",
  "",
  "> [!NOTE]",
  "> 用語は mdmark.config.yaml から取ります",
  "",
  "```ts",
  "const a = 1;",
  "```",
].join("\n");

/** 返答の描画を `surface` に配置する */
const mountReply = (
  $: Engine,
  options: { text: string; surface?: "terminal" | "desktop"; columns?: number },
) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface: options.surface ?? "terminal",
    component: "AssistantMessage",
    requestId: "msg_01",
    viewport: { columns: options.columns ?? 88, rows: 40 },
    props: { text: options.text, isFirstOfReply: true },
  });

/** Button の押下の参照（描くたびに変わる `press`）を除いた部品の木 */
const withoutHandles = (node: unknown): unknown =>
  JSON.parse(
    JSON.stringify(node, (key, value) => (key === "press" ? undefined : value)),
  );

/** 表の Box の見出しの行（2 行目）のセルの Text */
const headerCells = async (
  ui: Awaited<ReturnType<typeof mountReply>>,
  key: string,
) => {
  const table = await ui.find({ type: "Box", key });
  const header = table?.children[1] as { children?: unknown[] } | undefined;
  return (header?.children ?? []) as {
    props?: Record<string, unknown>;
    children: unknown[];
  }[];
};

// 表・注意書き・見出し・コードブロックを共通スタイルで描き、マーカーを削除する（正常系）
test("test_normal", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  // 実行
  const ui = await mountReply($, { text: REPLY });
  // 検証
  const dataHeader = await headerCells(ui, "table-9");
  expect(
    dataHeader
      .filter((cell) => cell.props?.bold === true)
      .map((c) => c.children),
  ).toEqual([["名前"], ["種類"]]);
  const plainHeader = await headerCells(ui, "table-15");
  expect(plainHeader.some((cell) => cell.props?.bold === true)).toBe(false);
  expect((await ui.find({ type: "Text", text: "┌" }))?.text).toContain("┬");
  const callout = await ui.find({ type: "Box", key: "callout-19" });
  expect(callout?.text).toContain("┃");
  expect(await ui.find({ type: "Text", text: "NOTE" })).toMatchObject({
    props: { bold: true },
  });
  const heading = await ui.find({ type: "Text", text: "WS の違い" });
  expect(heading?.props.bold).toBe(true);
  expect(heading?.text).not.toContain("#");
  const code = await ui.find({ type: "Box", key: "code-22" });
  expect(code?.props.backgroundColor).toBeDefined();
  expect(await ui.find({ type: "Code", text: "const a = 1;" })).toMatchObject({
    props: { language: "ts" },
  });
  expect((await ui.find({ type: "Text", text: "ts" }))?.props.dimColor).toBe(
    true,
  );
  expect(await ui.find({ type: "Button", text: "コピー" })).toBeDefined();
  expect(
    (await ui.findAll({ type: "Markdown" })).map((node) => node.text),
  ).toEqual(
    expect.arrayContaining([
      "**太字** と `code` の段落 の続き",
      "- 箇条書きの 1 行目",
    ]),
  );
  expect(allTexts(await ui.drawn()).join("\n")).not.toContain("<!--");
  await ui.unmount();
});

// 表だけ Markdown 部品に任せる（正常系）
test("test_normal_when_part_disabled", async ($, on) => {
  // 準備
  installWorld(on, { files: settingsFile("parts:", "  table: false") });
  // 実行
  const ui = await mountReply($, { text: REPLY });
  // 検証
  const markdowns = (await ui.findAll({ type: "Markdown" })).map(
    (node) => node.text,
  );
  expect(markdowns).toContain("| 名前 | 種類 |\n| --- | --- |\n| WS | 用語 |");
  expect(markdowns.join("\n")).not.toContain("<!--");
  expect(await ui.find({ type: "Box", key: "table-9" })).toBeUndefined();
  expect(await ui.find({ type: "Box", key: "callout-19" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: "WS の違い" })).toBeDefined();
  expect(await ui.find({ type: "Box", key: "code-22" })).toBeDefined();
  await ui.unmount();
});

// 返答を描き換えない設定（正常系）
test("test_normal_when_assistant_not_targeted", async ($, on) => {
  // 準備
  installWorld(on, { files: settingsFile("targets: [user]") });
  // 実行
  const ui = await mountReply($, { text: REPLY });
  // 検証
  expect(await ui.keepsBeneath()).toBe(true);
  expect(await ui.find({ type: "Box", key: "table-9" })).toBeUndefined();
  await ui.unmount();
});

// 狭い画面の表（正常系）
test("test_normal_when_table_wider_than_viewport", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  const wide = [
    "| 名前 | 種類 | 説明 |",
    "| --- | --- | --- |",
    `| a | b | ${"word ".repeat(12).trim()} |`,
  ].join("\n");
  // 実行
  const terminal = await mountReply($, { text: wide, columns: 40 });
  const desktop = await mountReply($, {
    text: wide,
    columns: 40,
    surface: "desktop",
  });
  // 検証
  const table = await terminal.find({ type: "Box", key: "table-1" });
  const rows = (table?.children ?? []).map((row) => allTexts(row).join(""));
  expect(Math.max(...rows.map((row) => row.length))).toBeLessThanOrEqual(40);
  expect(rows.filter((row) => row.includes("word")).length).toBeGreaterThan(1);
  expect(table?.props.overflowX).toBeUndefined();
  const scroll = await desktop.find({ type: "Box", key: "table-1" });
  expect(scroll?.props.overflowX).toBe("scroll");
  const desktopRows = (scroll?.children ?? []).map((row) =>
    allTexts(row).join(""),
  );
  expect(desktopRows.filter((row) => row.includes("word"))).toHaveLength(1);
  await terminal.unmount();
  await desktop.unmount();
});

// コードブロックの飾り（正常系）
test("test_normal_when_code_decorated", async ($, on) => {
  // 準備
  const recorded = installWorld(on, { files: {} });
  const text = [
    "<!-- code: title=a.ts lines -->",
    "",
    "```ts",
    "const a = 1; // [!code ++]",
    "const b = 2;",
    "```",
  ].join("\n");
  // 実行
  const ui = await mountReply($, { text });
  const copy = await ui.find({ type: "Button", text: "コピー" });
  await ui.press({ key: String(copy?.key) });
  // 検証
  expect(await ui.find({ type: "Text", text: "a.ts" })).toBeDefined();
  expect((await ui.find({ type: "Text", text: "1 " }))?.text).toBe("1 ");
  expect((await ui.find({ type: "Text", text: "2 " }))?.text).toBe("2 ");
  const added = await ui.find({ type: "Box", key: "line-0" });
  expect(added?.text).toContain("+ ");
  const removedMark = await ui.find({ type: "Box", key: "line-1" });
  expect(removedMark?.text).not.toContain("+ ");
  expect(allTexts(await ui.drawn()).join("\n")).not.toContain("[!code");
  expect(recorded.copies).toEqual(["const a = 1;\nconst b = 2;"]);
  await ui.unmount();
});

// 開閉の範囲を押す（正常系）
test("test_normal_when_fold_pressed", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  const text = [
    "<!-- details: 用語を読み込む場所 -->",
    "",
    "中身の段落",
    "",
    "<!-- /details -->",
  ].join("\n");
  // 実行
  const ui = await mountReply($, { text });
  const closed = await ui.drawn();
  const button = await ui.find({ type: "Button" });
  await ui.press({ key: String(button?.key) });
  const opened = await ui.find({ type: "Button" });
  const body = await ui.find({ type: "Markdown", text: "中身の段落" });
  await ui.press({ key: String(button?.key) });
  // 検証
  expect(button?.props.label).toBe("▸ 用語を読み込む場所");
  expect(allTexts(closed)).not.toContain("中身の段落");
  expect(opened?.props.label).toBe("▾ 用語を読み込む場所");
  expect(body).toBeDefined();
  expect(withoutHandles(await ui.drawn())).toEqual(withoutHandles(closed));
  await ui.unmount();
});

// 部品の木の上限を超える（正常系）
test("test_normal_when_tree_over_limit", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  const rows = Array.from(
    { length: 2000 },
    (_, index) => `| ${index} | ${"x".repeat(60)} |`,
  );
  const text = ["| 番号 | 値 |", "| --- | --- |", ...rows].join("\n");
  // 実行
  const ui = await mountReply($, { text });
  // 検証
  expect(await ui.keepsBeneath()).toBe(true);
  expect(await ui.find({ type: "Box", key: "table-1" })).toBeUndefined();
  await ui.unmount();
});

// 用語集を読めない（異常系）
test("test_error_when_glossary_unreadable", async ($, on) => {
  // 準備
  const recorded = installWorld(on, {
    files: settingsFile("glossary: missing.yaml"),
  });
  // 実行
  const ui = await mountReply($, { text: REPLY });
  // 検証
  expect(await ui.findAll({ type: "Text", text: /^\[\d+\]/ })).toHaveLength(0);
  expect(
    (await ui.findAll({ type: "Text" })).some(
      (node) => node.props.underline === true,
    ),
  ).toBe(false);
  expect(await ui.find({ type: "Box", key: "table-9" })).toBeDefined();
  expect(await ui.find({ type: "Box", key: "callout-19" })).toBeDefined();
  expect(await ui.find({ type: "Box", key: "code-22" })).toBeDefined();
  const debug = recorded.logs.filter((log) => log.to === "debug");
  expect(debug).toHaveLength(1);
  expect(debug[0]?.text).toContain("mdmark-style");
  expect(debug[0]?.text).toContain("missing.yaml");
  await ui.unmount();
});

// 設定ファイルを読めない（異常系）
test("test_error_when_config_unreadable", async ($, on) => {
  // 準備
  const recorded = installWorld(on, { files: { [CONFIG_PATH]: "global: [" } });
  // 実行
  const ui = await mountReply($, { text: REPLY });
  // 検証
  expect(await ui.keepsBeneath()).toBe(true);
  expect(await ui.find({ type: "Box", key: "table-9" })).toBeUndefined();
  const debug = recorded.logs.filter((log) => log.to === "debug");
  expect(debug).toHaveLength(1);
  expect(debug[0]?.text).toContain("mdmark-style");
  expect(debug[0]?.text).toContain(CONFIG_PATH);
  await ui.unmount();
});

/** 暗い配色の共通スタイルの色 */
const DARK = {
  heading: "#ededef",
  border: "#b4b4bc",
  greenBg: "#1a3821",
  greenText: "#4ade80",
  redText: "#f87171",
  yellowBg: "#40380e",
};

/** 文字が一致する Text */
const textNodes = (tree: unknown, text: string): DrawnNode[] =>
  nodesOf(tree, (node) => node.type === "Text" && textOf(node) === text);

// 行の詳細・ステップ・ファイルツリー・行内の記法・縦に並べる範囲・図と表の番号を描く（正常系）
test("test_normal_when_document_parts", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  // 実行
  const ui = await mountReply($, { text: DOCUMENT_PARTS_REPLY });
  const tree = await ui.drawn();
  // 検証
  const buttons = nodesOf(tree, (node) => node.type === "Button");
  expect(buttons.map((node) => node.props?.label)).toEqual(["[ ▸ ]"]);
  expect(allTexts(tree).join("\n")).not.toContain("りんごは青森県から届く。");
  for (const number of ["1", "2"]) {
    expect(textProps(tree, number)).toMatchObject({
      bold: true,
      color: DARK.heading,
    });
  }
  expect(textNodes(tree, "│").map((node) => node.props?.color)).toEqual([
    DARK.border,
  ]);
  expect(textProps(tree, "ソース").dimColor).toBe(true);
  expect(textProps(tree, " 完了 ")).toMatchObject({
    backgroundColor: DARK.greenBg,
    color: DARK.greenText,
  });
  expect(textProps(tree, "注意")).toMatchObject({
    bold: true,
    color: DARK.redText,
  });
  expect(textProps(tree, "決め手").backgroundColor).toBe(DARK.yellowBg);
  expect(textProps(tree, "[Ctrl]").bold).toBe(true);
  expect(textProps(tree, "+").dimColor).toBe(true);
  expect(textProps(tree, "[C]").bold).toBe(true);
  for (const title of ["macOS", "Windows"]) {
    expect(textProps(tree, title)).toMatchObject({
      bold: true,
      color: DARK.heading,
    });
  }
  const indented = nodesOf(
    tree,
    (node) => node.type === "Box" && node.props?.paddingLeft === 2,
  ).map((node) => allTexts(node).join(""));
  expect(indented).toEqual(
    expect.arrayContaining([
      expect.stringContaining("brew で入れる。"),
      expect.stringContaining("winget で入れる。"),
    ]),
  );
  const texts = allTexts(tree).join("\n");
  const order = [
    "左の列",
    "右の列",
    "使用方法 — 導入の手順",
    "リファレンス — 名前の一覧",
  ];
  const positions = order.map((text) => texts.indexOf(text));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  const tables = nodesOf(
    tree,
    (node) =>
      node.type === "Box" && String(node.props?.key ?? "").startsWith("table-"),
  );
  expect(tables).toHaveLength(4);
  expect(allTexts(tables[3]).join("")).toContain("東京, 本社");
  expect(textNodes(tree, "表 1")).toHaveLength(1);
  expect(texts.indexOf("表 1")).toBeLessThan(texts.indexOf("名前"));
  for (const raw of ["<!--", "badge:", "{color=", "==", "kbd:"]) {
    expect(texts).not.toContain(raw);
  }
  await ui.unmount();
});

// 行の詳細の Button を押す（正常系）
test("test_normal_when_row_detail_pressed", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  const text = [
    "| 名前 | 値 |",
    "| --- | --- |",
    "| りんご | 10 |",
    "| みかん | 2 |",
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    "りんごは青森県から届く。",
    "",
    "<!-- /row-detail -->",
  ].join("\n");
  // 実行
  const ui = await mountReply($, { text });
  const closed = await ui.drawn();
  const button = await ui.find({ type: "Button" });
  await ui.press({ key: String(button?.key) });
  const opened = await ui.drawn();
  await ui.press({ key: String(button?.key) });
  // 検証
  expect(button?.props.label).toBe("[ ▸ ]");
  expect(allTexts(closed).join("")).not.toContain("りんごは青森県から届く。");
  expect(
    nodesOf(opened, (node) => node.type === "Button").map(
      (node) => node.props?.label,
    ),
  ).toEqual(["[ ▾ ]"]);
  const openedText = allTexts(opened).join("");
  const detailAt = openedText.indexOf("りんごは青森県から届く。");
  expect(detailAt).toBeGreaterThan(openedText.indexOf("りんご"));
  expect(detailAt).toBeLessThan(openedText.indexOf("みかん"));
  expect(withoutHandles(await ui.drawn())).toEqual(withoutHandles(closed));
  await ui.unmount();
});

// ステップと表の番号をオフにした（正常系）
test("test_normal_when_document_part_disabled", async ($, on) => {
  // 準備
  installWorld(on, {
    files: settingsFile("parts:", "  steps: false", "  figure: false"),
  });
  // 実行
  const ui = await mountReply($, { text: DOCUMENT_PARTS_REPLY });
  const tree = await ui.drawn();
  // 検証
  expect(
    (await ui.findAll({ type: "Markdown" })).map((node) => node.text),
  ).toContain("1. 依存を入れる\n2. ビルドする");
  expect(textNodes(tree, "表 1")).toEqual([]);
  expect(await ui.find({ type: "Box", key: "table-2" })).toBeDefined();
  expect(textProps(tree, "ソース").dimColor).toBe(true);
  expect(textProps(tree, " 完了 ").backgroundColor).toBe(DARK.greenBg);
  expect(textProps(tree, "macOS").bold).toBe(true);
  expect(allTexts(tree).join("\n")).not.toContain("<!--");
  await ui.unmount();
});

// 罫線を解釈できないファイルツリー（正常系）
test("test_normal_when_tree_unreadable", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  const text = [
    "```tree",
    "mdmark/",
    "├── src/ # ソース",
    "│   │   └── index.ts",
    "```",
  ].join("\n");
  // 実行
  const ui = await mountReply($, { text });
  // 検証
  const code = await ui.find({ type: "Box", key: "code-1" });
  expect(code?.props.backgroundColor).toBeDefined();
  expect((await ui.find({ type: "Text", text: "tree" }))?.props.dimColor).toBe(
    true,
  );
  expect(
    (await ui.findAll({ type: "Code" })).map((node) => node.props.source),
  ).toEqual(["mdmark/", "├── src/ # ソース", "│   │   └── index.ts"]);
  await ui.unmount();
});
