import { expect, test } from "vitest";
import type { MdmarkIndex } from "../../../../../src/knowledge/index-shape.ts";
import { innerHtml, matches, outerHtml } from "../../../helpers/html.ts";
import { glossaryDocument } from "../../../helpers/index-fixtures.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 描く文書 `cur` と、用語 `印` を持つ索引 */
const MARK_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
  terms: [{ id: "mark", term: "印", meaning: "HTML コメントで書く指定" }],
};

/** 文書 `api`・`guide` が別名 `公開関数` を持つ索引 */
const ALIAS_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "api", path: "api.md", title: "API", aliases: ["公開関数"] },
    {
      id: "guide",
      path: "使い方/guide.md",
      title: "使い方",
      aliases: ["公開関数"],
    },
  ],
};

// 節ごとに最初の 1 回だけ下線を付ける（正常系）
test("test_terms_rule", () => {
  // 準備
  const markdown = [
    "## 一つ目",
    "",
    "印と印を書く。",
    "",
    "## 二つ目",
    "",
    "印と印を書く。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, {}, { index: MARK_INDEX, docId: "cur" });
  // 検証
  expect(matches(html, /class="mdmark-term-wrap"/g)).toHaveLength(2);
  const sections = html.split(/<h2\b/).slice(1);
  expect(sections).toHaveLength(2);
  for (const section of sections) {
    // 節の最初の語の位置に、語とその直後のツールチップの組があり、2 回目の語は文字のまま
    expect(matches(section, /class="mdmark-term-wrap"/g)).toHaveLength(1);
    const wrap = outerHtml(section, "mdmark-term-wrap");
    expect(innerHtml(section, "mdmark-term-wrap")).toMatch(
      /^<span class="mdmark-term"[^>]*>印<\/span><span class="mdmark-term-tip"/,
    );
    expect(section).toContain(`${wrap}と印を書く。`);
  }
});

// コード・リンク・見出し・用語集の表の中の語には付けない（正常系）
test("test_terms_rule_skips_code_and_links", () => {
  // 準備
  const markdown = [
    "# 印",
    "",
    "`印`",
    "",
    "[印](https://example.com/)",
    "",
    glossaryDocument([["印", "表の意味"]]),
    // 下線が付く場所を 1 つ置き、照合が働いている中で上の場所を外すことを確かめる
    "本文の印。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, {}, { index: MARK_INDEX, docId: "cur" });
  // 検証
  expect(matches(html, /class="mdmark-term-wrap"/g)).toHaveLength(1);
  expect(html).toContain("本文の");
  expect(html.indexOf("mdmark-term-wrap")).toBeGreaterThan(
    html.indexOf("本文の"),
  );
});

// 重なる語は長い方に付ける（正常系）
test("test_terms_rule_prefers_longer", () => {
  // 準備
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
    terms: [
      { id: "feature", term: "機能", meaning: "働き" },
      { id: "toggle", term: "機能のオン・オフ", meaning: "切り替え" },
    ],
  };
  // 実行
  const { html } = renderDoc(
    "機能のオン・オフを切り替える\n",
    {},
    { index, docId: "cur" },
  );
  // 検証
  expect(matches(html, /class="mdmark-term-wrap"/g)).toHaveLength(1);
  expect(outerHtml(html, "mdmark-term-wrap")).toContain(
    ">機能のオン・オフ</span>",
  );
});

// 文書の別名に当たった語に関連文書を付け、描く文書自身は除く（正常系）
test("test_terms_rule_doc_aliases", () => {
  // 準備
  const markdown = "公開関数を使う。\n";
  // 実行
  const { html } = renderDoc(
    markdown,
    {},
    { index: ALIAS_INDEX, docId: "guide" },
  );
  // 検証
  const links = matches(html, /<a href="[^"]*"/g);
  expect(links).toEqual(['<a href="../api.md"']);
  expect(html).toContain("API");
  expect(html).not.toContain(">使い方</a>");
});

// backlinks がオフなら文書の別名では照合しない（正常系）
test("test_terms_rule_when_backlinks_off", () => {
  // 準備
  const body = "公開関数を使う。\n";
  const indexOptions = { index: ALIAS_INDEX, docId: "guide" };
  // 実行
  const on = renderDoc(body, {}, indexOptions);
  const off = renderDoc(
    `<!-- features: -backlinks -->\n\n${body}`,
    {},
    indexOptions,
  );
  // 検証
  // 印が無ければ下線が付く同じ入力で、印があると付かない
  expect(on.html).toContain("mdmark-term-wrap");
  expect(off.html).not.toContain("mdmark-term-wrap");
});
