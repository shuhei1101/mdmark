import { type Engine, expect, test } from "claude-code/testing";
import {
  GLOSSARY_CONFIG,
  GLOSSARY_FILES,
  installWorld,
  nodesOf,
  PLUGIN,
  settingsFile,
  textOf,
} from "./world.ts";

/** 正常系の発言 */
const MESSAGE = "mdmark の WS にエイリアスを登録し、WS と WSL の違いを教えて";

/** 用語集を指定した設定ファイルと用語集のファイル */
const GLOSSARY_WORLD = {
  ...settingsFile(`glossary: ${GLOSSARY_CONFIG}`),
  ...GLOSSARY_FILES,
};

/** 発言の描画を配置する */
const mountMessage = ($: Engine, text: string) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface: "terminal",
    component: "UserMessage",
    requestId: "msg_02",
    viewport: { columns: 88, rows: 40 },
    props: { text, origin: { kind: "composer" } } as never,
  });

/** 下線を付けた Text の文字 */
const underlined = async (ui: Awaited<ReturnType<typeof mountMessage>>) =>
  (await ui.findAll({ type: "Text" }))
    .filter((node) => node.props.underline === true)
    .map((node) => node.text);

// 索引・エイリアス・用語集の表の用語に下線・カード・脚注を付け、背景の帯で描く（正常系）
test("test_normal", async ($, on) => {
  // 準備
  installWorld(on, { files: GLOSSARY_WORLD, theme: "dark" });
  // 実行
  const ui = await mountMessage($, MESSAGE);
  // 検証
  expect(await underlined(ui)).toEqual(["mdmark", "WS", "エイリアス"]);
  const cards = nodesOf(
    await ui.drawn(),
    (node) => node.props?.position === "absolute",
  );
  expect(cards).toEqual(
    Array.from({ length: 3 }, () =>
      expect.objectContaining({
        props: expect.objectContaining({
          display: "none",
          borderStyle: "round",
          backgroundColor: expect.any(String),
        }),
        hover: { display: "flex" },
      }),
    ),
  );
  expect(cards.map((card) => textOf(card))).toEqual([
    "mdmarkMarkdown 文書の表示を各アプリで共通に使用するライブラリ",
    "WS話し合いの記録を配置するフォルダ",
    "エイリアス文書を指す別の名前",
  ]);
  expect(
    (await ui.findAll({ type: "Text", text: /^\[\d\] / })).map((n) => n.text),
  ).toEqual([
    "[1] mdmark: Markdown 文書の表示を各アプリで共通に使用するライブラリ",
    "[2] WS: 話し合いの記録を配置するフォルダ",
    "[3] エイリアス: 文書を指す別の名前",
  ]);
  const band = (await ui.drawn()) as { props?: Record<string, unknown> };
  expect(band.props?.backgroundColor).toBe("#3a3a3a");
  await ui.unmount();
});

// 用語集を指定していない（正常系）
test("test_normal_when_glossary_not_set", async ($, on) => {
  // 準備
  installWorld(on, { files: {} });
  // 実行
  const ui = await mountMessage($, MESSAGE);
  // 検証
  expect(await ui.keepsBeneath()).toBe(true);
  expect(await underlined(ui)).toEqual([]);
  await ui.unmount();
});

// hover のカードをオフにしている（正常系）
test("test_normal_when_hover_card_disabled", async ($, on) => {
  // 準備
  installWorld(on, {
    files: {
      ...settingsFile(
        `glossary: ${GLOSSARY_CONFIG}`,
        "parts:",
        "  hover_card: false",
      ),
      ...GLOSSARY_FILES,
    },
  });
  // 実行
  const ui = await mountMessage($, MESSAGE);
  // 検証
  expect(await underlined(ui)).toEqual(["mdmark", "WS", "エイリアス"]);
  expect(
    await ui.findAll({ type: "Text", text: /^\[\d\] / }),
  ).toHaveLength(3);
  expect(
    (await ui.findAll({ type: "Box" })).filter(
      (node) => node.props.position === "absolute",
    ),
  ).toHaveLength(0);
  await ui.unmount();
});

// 用語が無い発言（正常系）
test("test_normal_when_no_term", async ($, on) => {
  // 準備
  installWorld(on, { files: GLOSSARY_WORLD });
  // 実行
  const ui = await mountMessage($, "README を直して");
  // 検証
  expect(await ui.keepsBeneath()).toBe(true);
  await ui.unmount();
});

// 用語集を読めない（異常系）
test("test_error_when_glossary_unreadable", async ($, on) => {
  // 準備
  const recorded = installWorld(on, {
    files: settingsFile("glossary: missing.yaml"),
  });
  // 実行
  const ui = await mountMessage($, MESSAGE);
  // 検証
  expect(await ui.keepsBeneath()).toBe(true);
  const debug = recorded.logs.filter((log) => log.to === "debug");
  expect(debug).toHaveLength(1);
  expect(debug[0]?.text).toContain("mdmark-style");
  expect(debug[0]?.text).toContain("missing.yaml");
  await ui.unmount();
});
