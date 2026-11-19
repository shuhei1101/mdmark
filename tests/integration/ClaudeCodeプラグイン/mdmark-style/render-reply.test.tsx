import { type Engine, expect, test } from "claude-code/testing";
import { CONFIG_PATH, installWorld, PLUGIN, settingsFile } from "./world.ts";

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

/** 部品の木の全ての文字（Text の子・Markdown の `text`・Code の `source`） */
const allTexts = (node: unknown): string[] => {
  if (typeof node === "string") {
    return [node];
  }
  if (typeof node !== "object" || node === null) {
    return [];
  }
  const { props = {}, children = [] } = node as {
    props?: Record<string, unknown>;
    children?: unknown[];
  };
  const own = [props.text, props.source, props.label].filter(
    (value): value is string => typeof value === "string",
  );
  return [...own, ...children.flatMap(allTexts)];
};

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
