import { type Engine, expect, test } from "claude-code/testing";
import {
  allTexts,
  DOCUMENT_PARTS_REPLY,
  GLOSSARY_CONFIG,
  GLOSSARY_FILES,
  installWorld,
  nodesOf,
  PLUGIN,
  settingsFile,
  textOf,
  textProps,
} from "./world.ts";

/** 返答の画面の要素を全て持つ返答 */
const REPLY = [
  "## 見出し",
  "",
  "| 名前 | 種類 |",
  "| --- | --- |",
  "| a | b |",
  "",
  "> [!WARNING]",
  "> 注意の文",
  "",
  "```ts",
  "const a = 1;",
  "```",
  "",
  "<!-- details: 詳細 -->",
  "",
  "中身",
  "",
  "<!-- /details -->",
].join("\n");

/** 用語を持つ返答 */
const TERM_REPLY = ["WS を作る", "", "> [!NOTE]", "> mdmark で描く"].join("\n");

/** 描き換えを確認する画面の種類 */
const SURFACES = ["terminal", "desktop"] as const;

/** 部品を全てオフにする設定の行 */
const PARTS_OFF = [
  "parts:",
  "  table: false",
  "  heading: false",
  "  callout: false",
  "  code: false",
  "  fold: false",
];

/** 返答か発言の描画を配置する */
const mount = (
  $: Engine,
  options: {
    component: "AssistantMessage" | "UserMessage";
    text: string;
    surface: (typeof SURFACES)[number];
  },
) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface: options.surface,
    component: options.component,
    viewport: { columns: 88, rows: 40 },
    props: (options.component === "UserMessage"
      ? { text: options.text, origin: { kind: "composer" } }
      : { text: options.text, isFirstOfReply: true }) as never,
  });

/** 用語集を指定した設定ファイルと用語集のファイル */
const glossaryWorld = (...lines: string[]) => ({
  ...settingsFile(`glossary: ${GLOSSARY_CONFIG}`, ...lines),
  ...GLOSSARY_FILES,
});

// 返答の表・見出し・注意書き・コードブロック・コピーボタン・開閉のボタン（正常系）
test("test_reply_elements", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  for (const surface of SURFACES) {
    // 実行
    const ui = await mount($, {
      component: "AssistantMessage",
      text: REPLY,
      surface,
    });
    // 検証
    expect(await ui.find({ type: "Box", key: "table-3" })).toBeDefined();
    expect((await ui.find({ type: "Text", text: "見出し" }))?.props.bold).toBe(
      true,
    );
    expect(await ui.find({ type: "Text", text: "WARNING" })).toBeDefined();
    expect(await ui.find({ type: "Code", text: "const a = 1;" })).toBeDefined();
    expect(await ui.find({ type: "Button", text: "コピー" })).toBeDefined();
    expect((await ui.find({ type: "Button", text: /詳細/ }))?.props.label).toBe(
      "▸ 詳細",
    );
    expect(await ui.find({ type: "Markdown", text: "中身" })).toBeUndefined();
    await ui.unmount();
  }
});

// 部品をオフにした返答（正常系）
test("test_reply_elements_when_parts_disabled", async ($, on) => {
  // 準備
  installWorld(on, { files: settingsFile(...PARTS_OFF) });
  for (const surface of SURFACES) {
    // 実行
    const ui = await mount($, {
      component: "AssistantMessage",
      text: REPLY,
      surface,
    });
    // 検証
    expect(await ui.find({ type: "Box", key: "table-3" })).toBeUndefined();
    expect(await ui.find({ type: "Text", text: "WARNING" })).toBeUndefined();
    expect(await ui.find({ type: "Code" })).toBeUndefined();
    expect(await ui.find({ type: "Button" })).toBeUndefined();
    const markdowns = (await ui.findAll({ type: "Markdown" })).map(
      (n) => n.text,
    );
    expect(markdowns).toEqual(expect.arrayContaining(["## 見出し", "中身"]));
    await ui.unmount();
  }
});

// 発言と返答の用語の下線・カード・脚注の番号・脚注の一覧と、発言の背景の帯（正常系）
test("test_term_elements", async ($, on) => {
  // 準備
  installWorld(on, { files: glossaryWorld(), theme: "dark" });
  for (const surface of SURFACES) {
    // 実行
    const reply = await mount($, {
      component: "AssistantMessage",
      text: TERM_REPLY,
      surface,
    });
    const message = await mount($, {
      component: "UserMessage",
      text: "WS を作る",
      surface,
    });
    // 検証
    for (const ui of [reply, message]) {
      const tree = await ui.drawn();
      expect(
        nodesOf(tree, (node) => node.props?.underline === true).map(textOf),
      ).toEqual(ui === reply ? ["WS", "mdmark"] : ["WS"]);
      const cards = nodesOf(
        tree,
        (node) => node.props?.position === "absolute",
      );
      expect(cards.map((card) => card.hover)).toEqual(
        cards.map(() => ({ display: "flex" })),
      );
      expect(textOf(cards[0])).toBe("WS話し合いの記録を配置するフォルダ");
      expect(await ui.find({ type: "Text", text: "[1]" })).toBeDefined();
      expect(
        (await ui.find({ type: "Text", text: /^\[1\] WS: / }))?.props.dimColor,
      ).toBe(true);
    }
    const band = (await message.drawn()) as { props?: Record<string, unknown> };
    expect(band.props?.backgroundColor).toBe("#3a3a3a");
    expect(await message.find({ type: "Text", text: "❯" })).toBeDefined();
    await reply.unmount();
    await message.unmount();
  }
});

// 脚注とカードをオフにした用語（正常系）
test("test_term_elements_when_footnote_and_card_disabled", async ($, on) => {
  // 準備
  installWorld(on, {
    files: glossaryWorld("parts:", "  footnote: false", "  hover_card: false"),
  });
  for (const surface of SURFACES) {
    // 実行
    const ui = await mount($, {
      component: "UserMessage",
      text: "WS を作る",
      surface,
    });
    // 検証
    const tree = await ui.drawn();
    expect(
      nodesOf(tree, (node) => node.props?.underline === true).map(textOf),
    ).toEqual(["WS"]);
    expect(
      nodesOf(tree, (node) => node.props?.position === "absolute"),
    ).toEqual([]);
    expect(await ui.find({ type: "Text", text: /\[1\]/ })).toBeUndefined();
    await ui.unmount();
  }
});

// 明るい配色の発言の背景の帯（正常系）
test("test_user_band_when_light_theme", async ($, on) => {
  // 準備
  installWorld(on, { files: glossaryWorld(), theme: "light" });
  // 実行
  const ui = await mount($, {
    component: "UserMessage",
    text: "WS を作る",
    surface: "terminal",
  });
  // 検証
  const band = (await ui.drawn()) as { props?: Record<string, unknown> };
  expect(band.props?.backgroundColor).toBe("#f0f0f0");
  await ui.unmount();
});

/** 本文の部品を全てオフにする設定の行 */
const DOCUMENT_PARTS_OFF = [
  "parts:",
  "  row_detail: false",
  "  steps: false",
  "  tree: false",
  "  inline: false",
  "  stack: false",
  "  figure: false",
];

// 返答の行の詳細のボタン・ステップ・ファイルツリー・バッジ・文字の色・キー・タブ名の見出し・表の番号（正常系）
test("test_document_part_elements", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  for (const surface of SURFACES) {
    // 実行
    const ui = await mount($, {
      component: "AssistantMessage",
      text: DOCUMENT_PARTS_REPLY,
      surface,
    });
    // 検証
    const tree = await ui.drawn();
    const texts = (text: string) =>
      nodesOf(tree, (node) => node.type === "Text" && textOf(node) === text);
    expect((await ui.find({ type: "Button" }))?.props.label).toBe("[ ▸ ]");
    expect(textProps(tree, "1").bold).toBe(true);
    expect(texts("│")).toHaveLength(1);
    expect(textProps(tree, "ソース").dimColor).toBe(true);
    expect(textProps(tree, " 完了 ").backgroundColor).toBeDefined();
    expect(textProps(tree, "注意").bold).toBe(true);
    expect(textProps(tree, "決め手").backgroundColor).toBeDefined();
    expect(texts("[Ctrl]")).toHaveLength(1);
    expect(textProps(tree, "macOS").bold).toBe(true);
    expect(textProps(tree, "表 1").dimColor).toBe(true);
    await ui.unmount();
  }
});

// 本文の部品をオフにした返答（正常系）
test("test_document_part_elements_when_parts_disabled", async ($, on) => {
  // 準備
  installWorld(on, { files: settingsFile(...DOCUMENT_PARTS_OFF) });
  for (const surface of SURFACES) {
    // 実行
    const ui = await mount($, {
      component: "AssistantMessage",
      text: DOCUMENT_PARTS_REPLY,
      surface,
    });
    // 検証
    const tree = await ui.drawn();
    const texts = (text: string) =>
      nodesOf(tree, (node) => node.type === "Text" && textOf(node) === text);
    expect(
      (await ui.findAll({ type: "Button" })).map((node) => node.props.label),
    ).not.toContain("[ ▸ ]");
    expect(texts("│")).toEqual([]);
    expect(texts("表 1")).toEqual([]);
    expect(texts(" 完了 ")).toEqual([]);
    expect(
      await ui.find({ type: "Code", text: "├── src/ # ソース" }),
    ).toBeDefined();
    expect(allTexts(tree).join("\n")).toContain("badge:green:完了");
    expect(
      nodesOf(
        tree,
        (node) => node.type === "Box" && node.props?.paddingLeft === 2,
      ).filter((node) => allTexts(node).join("").includes("brew")),
    ).toEqual([]);
    await ui.unmount();
  }
});
