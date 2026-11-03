import { expect, test } from "vitest";
import type { MdmarkIndex } from "../../../../../src/knowledge/index-shape.ts";
import {
  findTag,
  findTags,
  innerHtml,
  matches,
  outerHtml,
  plainText,
} from "../../../helpers/html.ts";
import { ARCH_INDEX } from "../../../helpers/index-fixtures.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 用語 `ワークスペース` を持つ索引 */
const TERM_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
  terms: [
    {
      id: "workspace",
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

/** 1 つ目の段落に参照、2 つ目の段落に行内の脚注を持ち、途中に 2 段落の定義を置いた文書 */
const FOOTNOTES_MARKDOWN = [
  "出典がある[^src]。",
  "",
  "[^src]: 出典の説明",
  "",
  "    [詳しく](https://example.com)",
  "",
  "行内にも書ける^[行内の補足]。",
  "",
].join("\n");

/** `id` の要素の中身を返す */
function byId(html: string, id: string): string {
  return innerHtml(html, `id="${id}"`);
}

// 参照・定義・行内の脚注を番号とツールチップにする（正常系）
test("test_use_footnotes", () => {
  // 準備・実行
  const { html } = renderDoc(FOOTNOTES_MARKDOWN);
  // 検証
  const [first = "", second = ""] = html.split("</p>");
  const firstLink = findTag(first, "mdmark-fn-link");
  expect(firstLink).toContain('id="mdmark-fnref-1-0"');
  expect(firstLink).toContain('href="#mdmark-fn-1"');
  expect(firstLink).toContain('aria-details="mdmark-fn-tip-1-0"');
  expect(plainText(innerHtml(first, "mdmark-fn-link"))).toBe("脚注 1");
  const secondLink = findTag(second, "mdmark-fn-link");
  expect(secondLink).toContain('id="mdmark-fnref-2-0"');
  expect(secondLink).toContain('aria-describedby="mdmark-fn-tip-2-0"');
  const firstTip = findTag(html, 'id="mdmark-fn-tip-1-0"');
  expect(firstTip).toContain('role="group"');
  expect(firstTip).toContain('aria-label="脚注 1"');
  const firstBodies = findTags(
    byId(html, "mdmark-fn-tip-1-0"),
    "mdmark-fn-tip-body",
  );
  expect(firstBodies).toHaveLength(2);
  expect(byId(html, "mdmark-fn-tip-1-0")).toContain(
    '<a href="https://example.com">詳しく</a>',
  );
  expect(findTag(html, 'id="mdmark-fn-tip-2-0"')).toContain('role="tooltip"');
  expect(plainText(byId(html, "mdmark-fn-tip-2-0"))).toBe("脚注 2行内の補足");
  expect(html).not.toContain("[^");
  expect(html).not.toContain("^[");
  expect(html).not.toContain("[^src]:");
});

// リンクと重なる参照はリンクを優先する（正常系）
test("test_use_footnotes_when_link_label", () => {
  // 準備（リンクだけの段落はカードになるため、前後に文字を置く）
  const markdown = "前 [^x](https://example.com) 後\n\n[^x]: 補足\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<a href="https://example.com">^x</a>');
  expect(html).not.toContain("mdmark-fn-");
  expect(html).not.toContain("mdmark-footnotes");
});

// 字下げ 4 で続く段落を定義に含める（正常系）
test("test_read_footnote_definition", () => {
  // 準備
  const markdown = [
    "本文[^long]。",
    "",
    "[^long]: 1 段落目",
    "",
    "    2 段落目",
    "",
    "終わり",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const tip = byId(html, "mdmark-fn-tip-1-0");
  expect(findTags(tip, "mdmark-fn-tip-body").length).toBe(2);
  expect(plainText(tip)).toBe("脚注 11 段落目2 段落目");
  const item = byId(html, "mdmark-fn-1");
  expect(matches(item, /<p>/g)).toHaveLength(2);
  // 終わりは本文の段落で、一覧の前にある
  const listAt = html.indexOf("mdmark-footnotes");
  expect(html.indexOf("<p>終わり</p>")).toBeGreaterThan(-1);
  expect(html.indexOf("<p>終わり</p>")).toBeLessThan(listAt);
});

// 大文字小文字を区別せず、最初の定義を採る（正常系）
test("test_read_footnote_definition_when_case_and_duplicate", () => {
  // 準備
  const markdown = [
    "[^Note] と [^note] と [^missing] と [^x](https://example.com)",
    "",
    "[^note]: 1 つ目",
    "",
    "[^NOTE]: 2 つ目",
    "",
    "[^unused]: 使わない",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('id="mdmark-fnref-1-0"');
  expect(html).toContain('id="mdmark-fnref-1-1"');
  expect(html).not.toContain('id="mdmark-fnref-2-0"');
  expect(plainText(byId(html, "mdmark-fn-tip-1-0"))).toBe("脚注 11 つ目");
  // 戻るリンクの読み上げの名前（`2 つ目の参照`）は文字に含めず、画面に出る文字で確かめる
  expect(plainText(html)).not.toContain("2 つ目");
  expect(html).not.toContain("使わない");
  expect(html).toContain("[^missing]");
  expect(html).toContain('<a href="https://example.com">^x</a>');
  expect(findTags(html, "mdmark-fn-item")).toHaveLength(1);
  const backs = findTags(byId(html, "mdmark-fn-1"), "mdmark-fn-back");
  expect(backs).toHaveLength(2);
});

// 字下げ 4 以上の [^x]: は定義にしない（正常系）
test("test_read_footnote_definition_when_indented_code", () => {
  // 準備・実行
  const { html } = renderDoc("    [^x]: コード\n");
  // 検証
  expect(html).toContain("<pre");
  expect(html).toContain("[^x]: コード");
  expect(html).not.toContain("mdmark-footnotes");
});

// 定義の無い参照は文字のまま（正常系）
test("test_read_footnote_reference_when_missing", () => {
  // 準備・実行
  const { html } = renderDoc("定義の無い参照[^missing]。\n");
  // 検証
  expect(html).toContain("<p>定義の無い参照[^missing]。</p>");
  expect(html).not.toContain("mdmark-footnotes");
});

// 同じラベルの 2 回目は同じ番号で通し番号を増やす（正常系）
test("test_read_footnote_reference_when_twice", () => {
  // 準備
  const markdown = [
    "一つ目[^note]。",
    "",
    "二つ目[^note]。",
    "",
    "[^note]: 共通の補足",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('id="mdmark-fnref-1-0"');
  expect(html).toContain('id="mdmark-fnref-1-1"');
  expect(findTags(html, "mdmark-fn-item")).toHaveLength(1);
  const backs = findTags(byId(html, "mdmark-fn-1"), "mdmark-fn-back");
  expect(backs.map((tag) => /href="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "#mdmark-fnref-1-0",
    "#mdmark-fnref-1-1",
  ]);
});

// 行内の脚注に参照の順で番号を振る（正常系）
test("test_read_inline_footnote", () => {
  // 準備
  const markdown = "先[^a] と ^[行内の *補足*]\n\n[^a]: A\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(plainText(byId(html, "mdmark-fn-tip-1-0"))).toBe("脚注 1A");
  expect(innerHtml(byId(html, "mdmark-fn-tip-2-0"), "mdmark-fn-tip-body")).toBe(
    "行内の <em>補足</em>",
  );
});

// 文書の印で外すと書いた文字のまま書いた位置に残す（正常系）
test("test_collect_footnotes_when_disabled_by_mark", () => {
  // 準備
  const markdown = [
    "<!-- features: -footnotes -->",
    "",
    "出典がある[^src] と ^[補足]。",
    "",
    "[^src]: 出典の説明",
    "",
    "終わり",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("<p>出典がある[^src] と ^[補足]。</p>");
  const definitionAt = html.indexOf("<p>[^src]: 出典の説明</p>");
  expect(definitionAt).toBeGreaterThan(-1);
  expect(definitionAt).toBeLessThan(html.indexOf("<p>終わり</p>"));
  expect(html).not.toContain("<a ");
  expect(html).not.toContain("mdmark-fn-");
  expect(html).not.toContain("mdmark-footnotes");
});

// 設定で外した脚注も文字のままにする（正常系）
test("test_collect_footnotes_when_disabled_by_config", () => {
  // 準備
  const markdown = "本文[^1]。\n\n[^1]: 補足\n";
  // 実行
  const { html } = renderDoc(markdown, { footnotes: false });
  // 検証
  expect(html).toContain("<p>本文[^1]。</p>");
  expect(html).toContain("<p>[^1]: 補足</p>");
  expect(html).not.toContain("mdmark-fn-");
});

// コードブロックの中の印は数えない（正常系）
test("test_collect_footnotes_when_mark_in_code", () => {
  // 準備
  const markdown = [
    "```md",
    "<!-- features: -footnotes -->",
    "```",
    "",
    "本文[^1]。",
    "",
    "[^1]: 補足",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('id="mdmark-fnref-1-0"');
  expect(html).toContain("mdmark-footnotes");
});

// 脚注の中身には用語の下線を引かない（正常系）
test("test_collect_footnotes_when_terms", () => {
  // 準備
  const markdown = "本文[^1]。\n\n[^1]: ワークスペースの説明\n";
  // 実行
  const { html } = renderDoc(markdown, {}, { index: TERM_INDEX, docId: "cur" });
  // 検証
  expect(byId(html, "mdmark-fn-tip-1-0")).toContain("ワークスペースの説明");
  expect(byId(html, "mdmark-fn-tip-1-0")).not.toContain("mdmark-term");
  expect(byId(html, "mdmark-fn-1")).toContain("ワークスペースの説明");
  expect(byId(html, "mdmark-fn-1")).not.toContain("mdmark-term");
});

// 段落でないブロックは文字の段落にする（正常系）
test("test_footnote_bodies_when_list", () => {
  // 準備
  const markdown = [
    "本文[^1]。",
    "",
    "[^1]: 1 段落目",
    "",
    "    - a",
    "    - b",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const tip = byId(html, "mdmark-fn-tip-1-0");
  const bodies = tip
    .split('<span class="mdmark-fn-tip-body">')
    .slice(1)
    .map((part) => part.slice(0, part.lastIndexOf("</span>")));
  expect(bodies).toHaveLength(2);
  for (const body of bodies) {
    expect(body).not.toContain("<p>");
    expect(body).not.toContain("<ul>");
  }
  expect(bodies[1]).toContain("a");
  expect(bodies[1]).toContain("b");
  const item = byId(html, "mdmark-fn-1");
  expect(item).toMatch(/^<p>1 段落目 <a class="mdmark-fn-back"/);
  expect(item).toContain("<ul>");
});

// 本文の節の後ろ・関連文書の一覧の前に閉じた一覧を置く（正常系）
test("test_build_footnote_list", () => {
  // 準備
  const markdown = "## 節\n\n本文[^1]。\n\n[^1]: 補足\n";
  const references = { backlinks: { arch: ["api"] }, glossary: [] };
  // 実行
  const { html } = renderDoc(
    markdown,
    {},
    { index: ARCH_INDEX, docId: "arch", references },
  );
  // 検証
  const list = outerHtml(html, "mdmark-footnotes");
  expect(list.startsWith('<details class="mdmark-footnotes">')).toBe(true);
  expect(innerHtml(list, "<summary")).toBe("脚注（1 件）");
  const listAt = html.indexOf(list);
  expect(html.lastIndexOf("</section>")).toBeLessThan(listAt);
  expect(html.indexOf("mdmark-backlinks")).toBeGreaterThan(listAt);
  expect(html).not.toContain("data-mdmark-own");
  expect(list).toContain('id="mdmark-fn-1"');
  expect(list).toContain('href="#mdmark-fnref-1-0"');
});

// 定義と行内の脚注の中身にも、本文と同じ記法とリンクの扱いを当てる（正常系）
test("test_take_footnote_definitions_when_syntax", () => {
  // 準備
  const markdown = [
    "本文で README.md と example.com と `badge:新規` を書く[^a]。行内も `badge:新規` ^[行内で README.md と `badge:新規`]。",
    "",
    "[^a]: 脚注で README.md と example.com と `badge:新規` を書く。",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const [body = ""] = html.split("</p>");
  for (const part of [
    body,
    byId(html, "mdmark-fn-tip-1-0"),
    byId(html, "mdmark-fn-tip-2-0"),
    byId(html, "mdmark-fn-1"),
    byId(html, "mdmark-fn-2"),
  ]) {
    expect(part).toContain("README.md");
    expect(part).not.toContain("http://README.md");
    expect(part).toContain('class="mdmark-badge"');
  }
  expect(byId(html, "mdmark-fn-1")).not.toContain("http://example.com");
});

// 定義の中の見出しで節を作らず、一覧は節の外に置く（正常系）
test("test_take_footnote_definitions_when_heading", () => {
  // 準備
  const markdown = "## 節\n\n本文[^a]。\n\n[^a]: ## 定義の見出し\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /<section\b/g)).toHaveLength(1);
  expect(matches(html, /<\/section>/g)).toHaveLength(1);
  const listAt = html.indexOf('<details class="mdmark-footnotes"');
  expect(html.lastIndexOf("</section>")).toBeLessThan(listAt);
  expect(byId(html, "mdmark-fn-1")).toContain("定義の見出し");
});
