import { beforeEach, expect, test, vi } from "vitest";
import {
  createFakeEngine,
  FAKE_ELEMENTS,
  findNodes,
  installH,
  textOf,
} from "./fake-engine.ts";
import { GLOSSARY_CONFIG, GLOSSARY_FILES } from "./glossary-fixture.ts";

/** 発言を描くモジュール（実装が無い間は各テストが個別に失敗する） */
const loadUser = () => import("../../../../src/mdmark-style/user-message.tsx");

/** 共通スタイルの色のモジュール */
const loadTokens = () => import("../../../../src/shared/style-tokens.logic.ts");

/** 設定ファイルの既定のパス */
const CONFIG = "/home/u/.config/mdmark-style/settings.yaml";

/** `next(e)` の代わりに返却する、元の描画の参照 */
const ENGINE_NODE = { type: "engine", ref: 1 };

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

/** 用語集を指定した設定と用語集のファイル */
const FILES = {
  ...GLOSSARY_FILES,
  [CONFIG]: `global:\n  glossary: ${GLOSSARY_CONFIG}\n`,
};

/** 発言の描画の入力を作る */
const userEvent = (text: string, origin = "composer") => ({
  component: "UserMessage" as const,
  props: { text, origin: { kind: origin } },
  surface: "terminal" as const,
  viewport: { columns: 80 },
  requestId: "u1",
});

beforeEach(() => {
  installH();
});

// 用語に下線・カード・脚注を付ける（正常系）
test("test_render_user_message", async () => {
  // 準備
  const { renderUserMessage } = await loadUser();
  const { styleColor } = await loadTokens();
  const $ = createFakeEngine({ files: FILES });
  const next = vi.fn(async () => ENGINE_NODE);
  // 実行
  const node = await renderUserMessage($, userEvent("WS を作る"), next);
  // 検証
  const band = findNodes(
    node,
    (n) =>
      n.type === "Box" &&
      n.props.backgroundColor === styleColor({ name: "userBand", theme: "dark" }),
  );
  expect(band).toHaveLength(1);
  expect(textOf(node)).toContain("❯");
  expect(
    findNodes(node, (n) => n.type === "Text" && n.props.underline === true).map(
      textOf,
    ),
  ).toEqual(["WS"]);
  expect(textOf(node)).toContain("[1]");
  const cards = findNodes(
    node,
    (n) =>
      n.type === "Box" &&
      n.props.display === "none" &&
      JSON.stringify(n.props.hover) === JSON.stringify({ display: "flex" }),
  );
  expect(cards).toHaveLength(1);
  expect(textOf(node)).toContain("[1] WS: 話し合いの記録を配置するフォルダ");
});

// 用語が無ければ元の描画（正常系）
test("test_render_user_message_when_no_term", async () => {
  // 準備
  const { renderUserMessage } = await loadUser();
  const $ = createFakeEngine({ files: FILES });
  const next = vi.fn(async () => ENGINE_NODE);
  // 実行
  const node = await renderUserMessage($, userEvent("用語の無い文"), next);
  // 検証
  expect(node).toBe(ENGINE_NODE);
});

// 利用者が入力した発言でなければ元の描画（正常系）
test("test_render_user_message_when_not_composer", async () => {
  // 準備
  const { renderUserMessage } = await loadUser();
  const $ = createFakeEngine({ files: FILES });
  const next = vi.fn(async () => ENGINE_NODE);
  // 実行
  const node = await renderUserMessage($, userEvent("WS を作る", "hook"), next);
  // 検証
  expect(node).toBe(ENGINE_NODE);
});

// 用語集を読めない（異常系）
test("test_render_user_message_when_glossary_unreadable", async () => {
  // 準備
  const { renderUserMessage } = await loadUser();
  const $ = createFakeEngine({
    files: { [CONFIG]: `global:\n  glossary: ${GLOSSARY_CONFIG}\n` },
  });
  const next = vi.fn(async () => ENGINE_NODE);
  // 実行
  const node = await renderUserMessage($, userEvent("WS を作る"), next);
  // 検証
  expect(node).toBe(ENGINE_NODE);
  expect($.ui.log).toHaveBeenCalledTimes(1);
  expect($.ui.log).toHaveBeenCalledWith(expect.any(String), { to: "debug" });
});

// 行の用語ごとにカードを分ける（正常系）
test("test_render_term_text", async () => {
  // 準備
  const { renderTermText } = await loadUser();
  const marks = [
    { line: 1, start: 0, end: 2, title: "WS", description: "a", footnote: 1 },
    { line: 1, start: 5, end: 11, title: "mdmark", description: "b", footnote: 2 },
  ];
  // 実行
  const node = renderTermText({
    elements: FAKE_ELEMENTS,
    line: "WS と mdmark",
    marks,
    parts: ALL_PARTS,
    theme: "dark",
    width: 80,
  });
  // 検証
  const keyed = findNodes(node, (n) => n.type === "Box" && "key" in n.props);
  expect(new Set(keyed.map((n) => n.props.key)).size).toBe(2);
  for (const box of keyed) {
    const cards = findNodes(box, (n) => n.props.position === "absolute");
    expect(cards).toHaveLength(1);
  }
});

// カードをオフにした（正常系）
test("test_render_term_text_when_card_off", async () => {
  // 準備
  const { renderTermText } = await loadUser();
  const marks = [
    { line: 1, start: 0, end: 2, title: "WS", description: "a", footnote: 1 },
  ];
  // 実行
  const node = renderTermText({
    elements: FAKE_ELEMENTS,
    line: "WS を作る",
    marks,
    parts: { ...ALL_PARTS, hover_card: false },
    theme: "dark",
    width: 80,
  });
  // 検証
  expect(
    findNodes(node, (n) => n.type === "Text" && n.props.underline === true),
  ).toHaveLength(1);
  expect(textOf(node)).toContain("[1]");
  expect(findNodes(node, (n) => n.props.position === "absolute")).toEqual([]);
});
