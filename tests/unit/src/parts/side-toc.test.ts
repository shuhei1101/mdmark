import { expect, test } from "vitest";
import { findTag, findTags, innerHtml } from "../../helpers/html.ts";

/** 右側の目次の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSideToc = () => import("../../../../src/parts/side-toc.ts");

// 見出しの並び（h1 の下に h2、h2 の下に h3 と、もう 1 つの h2）
const HEADINGS = [
  { level: 1, id: "手引き", text: "手引き" },
  { level: 2, id: "導入", text: "導入" },
  { level: 3, id: "前提", text: "前提" },
  { level: 2, id: "使い方", text: "使い方" },
] as const;

/** 属性が値なしの形（`data-open` か `data-open=""`）で付いているかを返す */
function hasBooleanAttribute(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[\\s=>])`).test(tag);
}

// 見出しを入れ子にし、右端の線と読み上げ名を付ける（正常系）
test("test_render_side_toc", async () => {
  // 準備
  const { renderSideToc } = await loadSideToc();
  // 実行
  const html = renderSideToc({ headings: [...HEADINGS] });
  // 検証
  expect(findTag(html, "<aside")).toContain('data-mode="hover"');
  expect(findTag(html, "<nav")).toContain('aria-label="右側の目次"');
  expect(html).toContain(
    '<li><a href="#手引き" data-heading-id="手引き">手引き</a><ul><li><a href="#導入" data-heading-id="導入">導入</a><ul><li><a href="#前提" data-heading-id="前提">前提</a></li></ul></li><li><a href="#使い方" data-heading-id="使い方">使い方</a></li></ul></li>',
  );
  expect(findTags(html, 'class="mdmark-side-toc-bar"')).toHaveLength(4);
  expect(findTag(html, "mdmark-side-toc-rail")).toContain('aria-hidden="true"');
  const toggle = findTag(html, "mdmark-side-toc-toggle");
  expect(toggle).toContain('aria-expanded="false"');
  expect(toggle).toContain('aria-controls="mdmark-side-toc-panel"');
  expect(findTag(html, "mdmark-side-toc-pin")).toContain(
    'aria-pressed="false"',
  );
  expect(html).toContain('data-fold-all="open"');
  expect(html).toContain('data-fold-all="close"');
});

// 出し方と出している状態を属性に写す（正常系）
test("test_render_side_toc_when_fixed_open", async () => {
  // 準備
  const { renderSideToc } = await loadSideToc();
  // 実行
  const html = renderSideToc({
    headings: [...HEADINGS],
    mode: "fixed",
    open: true,
    pinned: true,
  });
  // 検証
  const aside = findTag(html, "<aside");
  expect(aside).toContain('data-mode="fixed"');
  expect(hasBooleanAttribute(aside, "data-open")).toBe(true);
  expect(hasBooleanAttribute(aside, "data-pinned")).toBe(true);
  expect(findTag(html, "mdmark-side-toc-toggle")).toContain(
    'aria-expanded="true"',
  );
  expect(findTag(html, "mdmark-side-toc-pin")).toContain('aria-pressed="true"');
});

// sections が false ならすべて展開・すべて折りたたむを置かない（正常系）
test("test_render_side_toc_when_without_sections", async () => {
  // 準備
  const { renderSideToc } = await loadSideToc();
  // 実行
  const html = renderSideToc({ headings: [...HEADINGS], sections: false });
  // 検証
  expect(html).not.toContain("data-fold-all");
});

// 今いる節の項目・線・狭い幅の帯の文字を付ける（正常系）
test("test_render_side_toc_when_current", async () => {
  // 準備
  const { renderSideToc } = await loadSideToc();
  // 実行
  const html = renderSideToc({ headings: [...HEADINGS], current: "前提" });
  // 検証
  const currentLinks = findTags(html, 'aria-current="location"');
  expect(currentLinks).toHaveLength(1);
  expect(currentLinks[0]).toContain('href="#前提"');
  const bars = findTags(html, 'class="mdmark-side-toc-bar"');
  expect(bars.map((bar) => bar.includes("data-current"))).toEqual([
    false,
    false,
    true,
    false,
  ]);
  expect(innerHtml(html, "mdmark-side-toc-current")).toBe("前提");
});

// 見出しの文字と ID をエスケープする（正常系）
test("test_render_side_toc_when_text_has_html", async () => {
  // 準備
  const { renderSideToc } = await loadSideToc();
  // 実行
  const html = renderSideToc({
    headings: [{ level: 2, id: 'a"b', text: "<b>太字</b>" }],
  });
  // 検証
  expect(html).toContain("&lt;b&gt;太字&lt;/b&gt;");
  expect(html).toContain('href="#a&quot;b"');
  expect(html).toContain('data-heading-id="a&quot;b"');
  expect(html).not.toContain("<b>");
});
