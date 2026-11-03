import type { StateCore } from "markdown-it";
import { expect, test } from "vitest";
import { parseWithRules } from "../../../helpers/core-rules.ts";
import { innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 注意書きの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCallouts = () =>
  import("../../../../../src/render/syntax/callouts.ts");

/** Markdown を解析した状態と、引用の開きのトークンの位置 */
function quoteStates(markdown: string): { state: StateCore; opens: number[] } {
  let captured: StateCore | undefined;
  parseWithRules(markdown, [
    (state) => {
      captured = state;
    },
  ]);
  if (captured === undefined) {
    throw new Error("状態を取れない");
  }
  const opens = captured.tokens.flatMap((token, index) =>
    token.type === "blockquote_open" ? [index] : [],
  );
  return { state: captured, opens };
}

// 5 種を種類ごとの枠にする（正常系）
test("test_build_callouts", () => {
  // 準備
  const kinds = [
    ["NOTE", "note", "補足"],
    ["TIP", "tip", "ヒント"],
    ["IMPORTANT", "important", "重要"],
    ["WARNING", "warning", "警告"],
    ["CAUTION", "caution", "注意"],
  ];
  const markdown = kinds
    .map(([kind]) => `> [!${kind}]\n> ${kind} の本文\n`)
    .join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  for (const [, lower, title] of kinds) {
    expect(html).toContain(`markdown-alert-${lower}`);
    expect(html).toContain(`<p class="markdown-alert-title">${title}</p>`);
  }
  expect(html).not.toContain("[!");
});

// 末尾の - は折り畳み、知らない種類は note にする（正常系）
test("test_build_callouts_when_collapsed_or_unknown", () => {
  // 準備
  const markdown = "> [!WARNING]-\n> 折り畳み\n\n> [!FAQ]\n> 知らない種類\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<details class="markdown-alert markdown-alert-warning">',
  );
  expect(html).toContain("markdown-alert-note");
  expect(html).not.toContain("markdown-alert-faq");
});

// タイトル・+・入れ子の注意書きにする（正常系）
test("test_build_callouts_when_titled_and_nested", () => {
  // 準備
  const markdown = [
    "> [!TIP] 設定を先に確認する",
    "> ヒントの本文",
    "",
    "> [!NOTE]+ 詳細",
    "> 補足の本文",
    "",
    "> [!WARNING]",
    "> 警告の本文",
    ">",
    "> > [!TIP]",
    "> > 中のヒントの本文",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<p class="markdown-alert-title"><span class="mdmark-visually-hidden">ヒント: </span>設定を先に確認する</p>',
  );
  expect(html).toContain(
    '<details class="markdown-alert markdown-alert-note" open>',
  );
  expect(innerHtml(html, "markdown-alert-note")).toMatch(
    /<summary[^>]*>.*詳細.*<\/summary>/,
  );
  const warning = innerHtml(html, "markdown-alert-warning");
  expect(warning).toContain("警告の本文");
  expect(warning).toContain("markdown-alert-tip");
  expect(warning).toContain("中のヒントの本文");
  for (const kind of ["[!TIP]", "[!NOTE]", "[!WARNING]", "[!"]) {
    expect(html).not.toContain(kind);
  }
});

// 種類と開閉とタイトルを読み取る（正常系）
test("test_read_callout", async () => {
  // 準備
  const { readCallout } = await loadCallouts();
  const markdown = [
    "> [!TIP] 設定を **先に** 確認する",
    "> 本文",
    "",
    "> [!NOTE]+ 詳細",
    "> 本文",
    "",
    "> [!WARNING]-",
    "> 本文",
    "",
    "> [!FAQ]",
    "> 本文",
    "",
  ].join("\n");
  const { state, opens } = quoteStates(markdown);
  // 実行
  const read = opens.map((openIndex) =>
    readCallout({ state, tokens: state.tokens, openIndex }),
  );
  // 検証
  expect(read[0]).toMatchObject({
    kind: "tip",
    collapsed: false,
    title: "設定を <strong>先に</strong> 確認する",
  });
  expect(read[1]).toMatchObject({
    kind: "note",
    collapsed: true,
    open: true,
    title: "詳細",
  });
  expect(read[2]).toMatchObject({
    kind: "warning",
    collapsed: true,
    open: false,
  });
  expect(read[2]?.title).toBeUndefined();
  expect(read[3]).toMatchObject({ kind: "note" });
});

// 1 行目が種類で始まらない引用は注意書きにしない（正常系）
test("test_read_callout_when_not_callout", async () => {
  // 準備
  const { readCallout } = await loadCallouts();
  const markdown = "> メモ [!TIP]\n> 本文\n\n> [!TIP]x\n> 本文\n";
  const { state, opens } = quoteStates(markdown);
  // 実行
  const read = opens.map((openIndex) =>
    readCallout({ state, tokens: state.tokens, openIndex }),
  );
  // 検証
  expect(read).toEqual([undefined, undefined]);
});
