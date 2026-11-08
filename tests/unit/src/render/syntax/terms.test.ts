import { expect, test } from "vitest";
import type { MdmarkAlias } from "../../../../../src/knowledge/aliases.ts";
import type { MdmarkIndex } from "../../../../../src/knowledge/index-shape.ts";
import {
  innerHtml,
  matches,
  outerHtml,
  plainText,
} from "../../../helpers/html.ts";
import { glossaryDocument } from "../../../helpers/index-fixtures.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 描く文書 `cur` と、用語 `マーカー` を持つ索引 */
const MARK_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
  terms: [
    { id: "mark", term: "マーカー", meaning: "HTML コメントで記載する指定" },
  ],
};

/** 文書 `api`・`guide` が別名 `公開関数` を持つ索引 */
const ALIAS_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [
    { id: "api", path: "api.md", title: "API", aliases: ["公開関数"] },
    {
      id: "guide",
      path: "使い方/guide.md",
      title: "使用方法",
      aliases: ["公開関数"],
    },
  ],
};

// セクションごとに最初の 1 回だけ下線を付ける（正常系）
test("test_terms_rule", () => {
  // 準備
  const markdown = [
    "## 一つ目",
    "",
    "マーカーとマーカーを記載する。",
    "",
    "## 二つ目",
    "",
    "マーカーとマーカーを記載する。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, {}, { index: MARK_INDEX, docId: "cur" });
  // 検証
  expect(matches(html, /class="mdmark-term-wrap"/g)).toHaveLength(2);
  const sections = html.split(/<h2\b/).slice(1);
  expect(sections).toHaveLength(2);
  for (const section of sections) {
    // セクションの最初の単語の位置に、単語とその直後のツールチップの組があり、2 回目の単語は文字のまま
    expect(matches(section, /class="mdmark-term-wrap"/g)).toHaveLength(1);
    const wrap = outerHtml(section, "mdmark-term-wrap");
    expect(innerHtml(section, "mdmark-term-wrap")).toMatch(
      /^<span class="mdmark-term"[^>]*>マーカー<\/span><span class="mdmark-term-tip"/,
    );
    expect(section).toContain(`${wrap}とマーカーを記載する。`);
  }
});

// 全角と半角・英字の大文字と小文字だけが違う単語にも下線を付け、下線の単語は本文の表記のままにする（正常系）
test("test_terms_rule_when_notation_differs", () => {
  // 準備
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
    terms: [
      { id: "ws", term: "ワークスペース", meaning: "作業の配置場所" },
      { id: "mcp", term: "MCP", meaning: "Model Context Protocol" },
    ],
  };
  // 実行
  const { html } = renderDoc(
    "ﾜｰｸｽﾍﾟｰｽとｍｃｐを使用する。\n",
    {},
    { index, docId: "cur" },
  );
  // 検証
  expect(matches(html, /class="mdmark-term-wrap"/g)).toHaveLength(2);
  // 下線の単語は辞書の単語でなく、本文に記載したままの文字
  expect(
    matches(html, /<span class="mdmark-term"[^>]*>[^<]*<\/span>/g).map(
      plainText,
    ),
  ).toEqual(["ﾜｰｸｽﾍﾟｰｽ", "ｍｃｐ"]);
  const [, first, second] = html.split('class="mdmark-term-wrap"');
  expect(first).toContain("作業の配置場所");
  expect(second).toContain("Model Context Protocol");
});

// コード・リンク・見出し・用語集の表の中の単語には付けない（正常系）
test("test_terms_rule_skips_code_and_links", () => {
  // 準備
  const markdown = [
    "# マーカー",
    "",
    "`マーカー`",
    "",
    "[マーカー](https://example.com/)",
    "",
    glossaryDocument([["マーカー", "表の意味"]]),
    // 下線が付く場所を 1 つ配置し、照合が働いている中で上の場所を削除することを確認する
    "本文のマーカー。",
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

// 重なる単語は長い方に付ける（正常系）
test("test_terms_rule_prefers_longer", () => {
  // 準備
  const index: MdmarkIndex = {
    schema: 2,
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

// 文書の別名に該当した単語に関連文書を付け、描く文書自身は除く（正常系）
test("test_terms_rule_doc_aliases", () => {
  // 準備
  const markdown = "公開関数を使用する。\n";
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
  expect(html).not.toContain(">使用方法</a>");
});

// backlinks がオフなら文書の別名では照合しない（正常系）
test("test_terms_rule_when_backlinks_off", () => {
  // 準備
  const body = "公開関数を使用する。\n";
  const indexOptions = { index: ALIAS_INDEX, docId: "guide" };
  // 実行
  const on = renderDoc(body, {}, indexOptions);
  const off = renderDoc(
    `<!-- features: -backlinks -->\n\n${body}`,
    {},
    indexOptions,
  );
  // 検証
  // マーカーが無ければ下線が付く同じ入力で、マーカーがあると付かない
  expect(on.html).toContain("mdmark-term-wrap");
  expect(off.html).not.toContain("mdmark-term-wrap");
});

/** 描く文書 `guide` と、やめた言い方 `作業場` を持つ用語 `ワークスペース` の索引 */
const AVOID_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [{ id: "guide", path: "guide.md", title: "使用方法" }],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      meaning: "話し合いの記録を配置するフォルダ",
      avoid: ["作業場"],
    },
  ],
};

/** やめた言い方のマーカーの要素の開始タグ */
const AVOIDED_TERM = /<span class="mdmark-term mdmark-term-avoided"[^>]*>/g;

// やめた言い方にセクションごとに最初の 1 回だけマーカーを付け、用語の下線とは別に数える（正常系）
test("test_terms_rule_avoided", () => {
  // 準備
  const markdown = [
    "## 一つ目",
    "",
    "ワークスペースと作業場と作業場を記載する。",
    "",
    "## 二つ目",
    "",
    "作業場を記載する。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(
    markdown,
    {},
    { index: AVOID_INDEX, docId: "guide" },
  );
  // 検証
  expect(matches(html, AVOIDED_TERM)).toHaveLength(2);
  const [first, second] = html.split(/<h2\b/).slice(1);
  // 各節の最初の `作業場` の位置にマーカーがあり、2 回目の `作業場` は文字のまま
  expect(matches(first ?? "", AVOIDED_TERM)).toHaveLength(1);
  expect(first).toMatch(
    /<span class="mdmark-term mdmark-term-avoided"[^>]*>作業場<\/span>/,
  );
  expect(
    (first ?? "").slice(0, (first ?? "").indexOf("mdmark-term-avoided")),
  ).not.toContain("作業場");
  expect(first).toMatch(/<\/span>と作業場を記載する。/);
  expect(matches(second ?? "", AVOIDED_TERM)).toHaveLength(1);
  expect(second).toMatch(/<\/span>を記載する。/);
  // ツールチップに見出し「代わりの用語」と代わりの用語の単語がある
  expect(first).toContain("代わりの用語");
  expect(first).toContain("ワークスペース");
  // 1 つ目のセクションの `ワークスペース` には、マーカーでない用語の下線がある
  expect(matches(first ?? "", /<span class="mdmark-term"[^>]*>/g)).toHaveLength(
    1,
  );
  expect(first).toMatch(
    /<span class="mdmark-term"[^>]*>ワークスペース<\/span>/,
  );
});

// やめた言い方が用語の単語の一部として出たところにはマーカーを付けない（正常系）
test("test_terms_rule_avoided_prefers_term_words", () => {
  // 準備
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "guide", path: "guide.md", title: "使用方法" }],
    terms: [
      {
        id: "ws",
        term: "ワークスペース",
        meaning: "話し合いの記録を配置するフォルダ",
      },
      { id: "job", term: "仕事", meaning: "やること", avoid: ["ワーク"] },
    ],
  };
  const markdown = [
    "## 一つ目",
    "",
    "ワークスペースを開く。",
    "",
    "## 二つ目",
    "",
    "ワークを始める。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, {}, { index, docId: "guide" });
  // 検証
  const [first, second] = html.split(/<h2\b/).slice(1);
  expect(first).toMatch(
    /<span class="mdmark-term"[^>]*>ワークスペース<\/span>/,
  );
  expect(matches(first ?? "", AVOIDED_TERM)).toHaveLength(0);
  expect(matches(html, AVOIDED_TERM)).toHaveLength(1);
  expect(second).toMatch(
    /<span class="mdmark-term mdmark-term-avoided"[^>]*>ワーク<\/span>/,
  );
});

// 文書の別名と同じやめた言い方は、関連文書を出さずにやめた言い方にする（正常系）
test("test_terms_rule_avoided_over_doc_alias", () => {
  // 準備
  const index: MdmarkIndex = {
    ...AVOID_INDEX,
    docs: [
      ...AVOID_INDEX.docs,
      { id: "old", path: "old.md", title: "旧文書", aliases: ["作業場"] },
    ],
  };
  // 実行
  const { html } = renderDoc(
    "作業場を使用する。\n",
    {},
    { index, docId: "guide" },
  );
  // 検証
  expect(matches(html, AVOIDED_TERM)).toHaveLength(1);
  expect(html).not.toContain("関連文書");
  expect(html).not.toContain("旧文書");
});

// glossary がオフならやめた言い方を照合しない（正常系）
test("test_terms_rule_avoided_when_glossary_off", () => {
  // 準備
  const body = "作業場を使用する。\n";
  const indexOptions = { index: AVOID_INDEX, docId: "guide" };
  // 実行
  const on = renderDoc(body, {}, indexOptions);
  const off = renderDoc(
    `<!-- features: -glossary -->\n\n${body}`,
    {},
    indexOptions,
  );
  // 検証
  // マーカーが無ければマーカーが付く同じ入力で、マーカーがあると付かない
  expect(on.html).toContain("mdmark-term-avoided");
  expect(off.html).not.toContain("mdmark-term-avoided");
});

/** `command` の `単体テスト`（別名 `ユニットテスト`、コマンド `npm run test:unit`） */
const UNIT_TEST_ALIAS: MdmarkAlias = {
  alias_type: "command",
  id: "unit-test",
  name: "単体テスト",
  aliases: ["ユニットテスト"],
  description: "ライブラリ本体の単体テストを実行する",
  command: "npm run test:unit",
};

/** エイリアスの `単体テスト` と `ユニットテスト` を、1 つ目のセクションに 2 つ・2 つ目のセクションに 1 つ記載した Markdown */
const ALIAS_MARKDOWN = [
  "## 一つ目",
  "",
  "単体テストとユニットテストを実行する。",
  "",
  "## 二つ目",
  "",
  "ユニットテストを実行する。",
  "",
].join("\n");

// エイリアスにセクションごとに最初の 1 回だけ下線を付け、種類のツールチップを配置する（正常系）
test("test_terms_rule_aliases", () => {
  // 実行
  const { html } = renderDoc(
    ALIAS_MARKDOWN,
    {},
    { aliases: [UNIT_TEST_ALIAS] },
  );
  // 検証
  expect(matches(html, /class="mdmark-term-wrap"/g)).toHaveLength(2);
  const sections = html.split(/<h2\b/).slice(1);
  expect(sections).toHaveLength(2);
  for (const section of sections) {
    // セクションの最初の単語の位置に、単語とその直後のツールチップの組がある
    expect(matches(section, /class="mdmark-term-wrap"/g)).toHaveLength(1);
    expect(innerHtml(section, "mdmark-term-wrap")).toMatch(
      /^<span class="mdmark-term"[^>]*>(?:単体テスト|ユニットテスト)<\/span><span class="mdmark-term-tip"/,
    );
    const tip = outerHtml(section, "mdmark-term-tip");
    expect(tip).toContain(">コマンド<");
    expect(tip).toMatch(/<code[^>]*>npm run test:unit<\/code>/);
  }
  // 1 つ目のセクションの 2 つ目の単語は文字のまま
  expect(sections[0]).toContain("</span></span>とユニットテストを実行する。");
});

// 索引の用語と同じ単語のエイリアスは、索引の用語のツールチップにする（正常系）
test("test_terms_rule_aliases_prefer_index_term", () => {
  // 準備
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "term",
      id: "mark",
      name: "マーカー",
      aliases: [],
      description: "別の意味",
    },
    {
      alias_type: "term",
      id: "sign",
      name: "目印",
      aliases: [],
      description: "エイリアスだけの意味",
    },
  ];
  // 実行
  const { html } = renderDoc(
    "マーカーと目印を記載する。\n",
    {},
    { index: MARK_INDEX, docId: "cur", aliases },
  );
  // 検証
  // 索引の用語の `マーカー` は索引の意味で、エイリアスだけの `目印` はエイリアスの意味
  const [, mark, sign] = html.split('class="mdmark-term-wrap"');
  expect(mark).toContain("HTML コメントで記載する指定");
  expect(mark).not.toContain("別の意味");
  expect(sign).toContain("エイリアスだけの意味");
});

// avoid の種類のエイリアスにやめた言い方のマーカーを付け、置き換え先だけを出す（正常系）
test("test_terms_rule_alias_avoid", () => {
  // 準備
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "avoid",
      id: "workplace",
      name: "作業場",
      aliases: [],
      replacement: "ワークスペース",
    },
  ];
  // 実行
  const { html } = renderDoc("作業場を使用する。\n", {}, { aliases });
  // 検証
  expect(html).toMatch(
    /<span class="mdmark-term mdmark-term-avoided"[^>]*>作業場<\/span>/,
  );
  const tip = outerHtml(html, "mdmark-term-tip");
  expect(tip).toContain(">代わりの用語<");
  expect(tip).toContain("ワークスペース");
  expect(tip).not.toContain("mdmark-term-tip-meaning");
});

// glossary がオフならエイリアスを照合しない（正常系）
test("test_terms_rule_aliases_when_glossary_off", () => {
  // 実行
  const on = renderDoc(ALIAS_MARKDOWN, {}, { aliases: [UNIT_TEST_ALIAS] });
  const off = renderDoc(
    `<!-- features: -glossary -->\n\n${ALIAS_MARKDOWN}`,
    {},
    { aliases: [UNIT_TEST_ALIAS] },
  );
  // 検証
  // マーカーが無ければ付く同じ入力で、マーカーがあると付かない
  expect(on.html).toContain("mdmark-term-wrap");
  expect(off.html).not.toContain("mdmark-term-wrap");
});
