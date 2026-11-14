import { expect, test } from "vitest";
import { findTag, findTags, innerHtml, plainText } from "../../helpers/html.ts";

/** 脚注の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFootnote = () => import("../../../../src/parts/footnote.ts");

// 番号のリンクと role tooltip のツールチップを組む（正常系）
test("test_render_footnote_ref", async () => {
  // 準備
  const { renderFootnoteRef } = await loadFootnote();
  // 実行
  const html = renderFootnoteRef({
    number: 1,
    bodies: ["CSS 変数と層の外の CSS で上書きする。"],
  });
  // 検証
  expect(html.startsWith('<sup class="mdmark-fn-ref">')).toBe(true);
  const link = findTag(html, "mdmark-fn-link");
  expect(link).toContain('id="mdmark-fnref-1-0"');
  expect(link).toContain('href="#mdmark-fn-1"');
  expect(link).toContain('aria-describedby="mdmark-fn-tip-1-0"');
  expect(innerHtml(html, "mdmark-fn-link")).toBe(
    '<span class="mdmark-visually-hidden">脚注 </span>1',
  );
  const tip = findTag(html, 'class="mdmark-fn-tip"');
  expect(tip).toContain('id="mdmark-fn-tip-1-0"');
  expect(tip).toContain('role="tooltip"');
  expect(plainText(innerHtml(html, "mdmark-fn-tip-title"))).toBe("脚注 1");
  expect(findTags(html, "mdmark-fn-tip-body")).toHaveLength(1);
  expect(innerHtml(html, "mdmark-fn-tip-body")).toBe(
    "CSS 変数と層の外の CSS で上書きする。",
  );
});

// 中身がリンクを持つと role group にする（正常系）
test("test_render_footnote_ref_when_link", async () => {
  // 準備
  const { renderFootnoteRef } = await loadFootnote();
  // 実行
  const html = renderFootnoteRef({
    number: 1,
    bodies: [
      '明暗は OS の配色に合わせ、<a href="../使い方/カスタマイズ/テーマを上書きする.md">テーマを選ぶ</a> の手順で固定できる。',
    ],
  });
  // 検証
  const tip = findTag(html, 'class="mdmark-fn-tip"');
  expect(tip).toContain('role="group"');
  expect(tip).toContain('aria-label="脚注 1"');
  const link = findTag(html, "mdmark-fn-link");
  expect(link).toContain('aria-details="mdmark-fn-tip-1-0"');
  expect(link).not.toContain("aria-describedby");
});

// below で is-below を付け、refIndex を id に使用する（正常系）
test("test_render_footnote_ref_when_below", async () => {
  // 準備
  const { renderFootnoteRef } = await loadFootnote();
  // 実行
  const html = renderFootnoteRef({
    number: 12,
    refIndex: 1,
    bodies: ["同じ脚注の 2 回目の参照。"],
    below: true,
  });
  // 検証
  expect(findTag(html, "mdmark-fn-ref")).toBe(
    '<sup class="mdmark-fn-ref is-below">',
  );
  expect(html).toContain('id="mdmark-fnref-12-1"');
  expect(html).toContain('id="mdmark-fn-tip-12-1"');
});

// 件数の見出しで閉じた一覧を組む（正常系）
test("test_render_footnotes", async () => {
  // 準備
  const { renderFootnotes } = await loadFootnote();
  // 実行
  const html = renderFootnotes({
    items: [
      {
        number: 1,
        html: "<p>CSS 変数と層の外の CSS で上書きする。</p>",
        refCount: 1,
      },
      {
        number: 2,
        html: "<p>file:// で開き、外への要求は 0 件。</p>",
        refCount: 1,
      },
    ],
  });
  // 検証
  expect(findTag(html, "<details")).toBe('<details class="mdmark-footnotes">');
  expect(innerHtml(html, "<summary")).toBe("脚注（2 件）");
  expect(findTag(html, "<ol")).toBe('<ol class="mdmark-footnotes-list">');
  const items = findTags(html, "mdmark-fn-item");
  expect(items).toHaveLength(2);
  expect(items[0]).toContain('id="mdmark-fn-1"');
  expect(items[1]).toContain('id="mdmark-fn-2"');
  for (const number of [1, 2]) {
    const item = innerHtml(html, `id="mdmark-fn-${number}"`);
    const backs = findTags(item, "mdmark-fn-back");
    expect(backs).toHaveLength(1);
    expect(backs[0]).toContain(`href="#mdmark-fnref-${number}-0"`);
    expect(backs[0]).toContain(`aria-label="本文の脚注 ${number} へ戻る"`);
    // 戻るリンクは最後の段落の末尾に配置する
    expect(item).toMatch(/<a class="mdmark-fn-back"[^>]*>.*<\/a><\/p>$/);
  }
});

// 2 回参照した脚注に a・b の戻るリンクを配置する（正常系）
test("test_render_footnotes_when_referenced_twice", async () => {
  // 準備
  const { renderFootnotes } = await loadFootnote();
  // 実行
  const html = renderFootnotes({
    items: [
      {
        number: 1,
        html: "<p>閉じのマーカーの記載を忘れると、範囲の上に警告が出る。</p>",
        refCount: 2,
      },
    ],
    open: true,
  });
  // 検証
  expect(findTag(html, "<details")).toBe(
    '<details class="mdmark-footnotes" open>',
  );
  const backs = findTags(html, "mdmark-fn-back");
  expect(backs).toHaveLength(2);
  expect(backs[0]).toContain('href="#mdmark-fnref-1-0"');
  expect(backs[0]).toContain('aria-label="本文の脚注 1 の 1 つ目の参照へ戻る"');
  expect(backs[1]).toContain('href="#mdmark-fnref-1-1"');
  expect(backs[1]).toContain('aria-label="本文の脚注 1 の 2 つ目の参照へ戻る"');
  const texts = html
    .split('<a class="mdmark-fn-back"')
    .slice(1)
    .map((part) =>
      plainText(part.slice(part.indexOf(">") + 1).split("</a>")[0] ?? ""),
    );
  expect(texts).toEqual(["a", "b"]);
});

// 項目が無ければ一覧を配置しない（正常系）
test("test_render_footnotes_when_empty", async () => {
  // 準備
  const { renderFootnotes } = await loadFootnote();
  // 実行
  const html = renderFootnotes({ items: [] });
  // 検証
  expect(html).toBe("");
});

// kind annotation で注記のマーカーにする（正常系）
test("test_render_footnote_ref_when_annotation", async () => {
  // 準備
  const { renderFootnoteRef } = await loadFootnote();
  // 実行
  const html = renderFootnoteRef({
    kind: "annotation",
    number: 1,
    bodies: ["条件を満たさないときは次の工程へ進む。"],
  });
  // 検証
  expect(findTag(html, "<sup")).toBe(
    '<sup class="mdmark-fn-ref mdmark-note-ref">',
  );
  const link = findTag(html, "mdmark-fn-link");
  expect(link).toContain('id="mdmark-noteref-1-0"');
  expect(link).toContain('href="#mdmark-note-1"');
  expect(link).toContain('aria-describedby="mdmark-note-tip-1-0"');
  expect(innerHtml(html, "mdmark-fn-link")).toBe(
    '<span class="mdmark-visually-hidden">注記 </span>1',
  );
  expect(findTag(html, 'class="mdmark-fn-tip"')).toContain(
    'id="mdmark-note-tip-1-0"',
  );
  expect(plainText(innerHtml(html, "mdmark-fn-tip-title"))).toBe("注記 1");
});

// afterRef で is-after-ref を付ける（正常系）
test("test_render_footnote_ref_when_after_ref", async () => {
  // 準備
  const { renderFootnoteRef } = await loadFootnote();
  // 実行
  const html = renderFootnoteRef({
    kind: "annotation",
    number: 1,
    afterRef: true,
    bodies: ["古い記録は 30 日で消える。"],
  });
  // 検証
  expect(findTag(html, "<sup")).toBe(
    '<sup class="mdmark-fn-ref mdmark-note-ref is-after-ref">',
  );
});

// kind annotation と refs で注記の一覧を組む（正常系）
test("test_render_footnotes_when_annotation", async () => {
  // 準備
  const { renderFootnotes } = await loadFootnote();
  // 実行
  const html = renderFootnotes({
    kind: "annotation",
    items: [
      {
        number: 1,
        html: "<p>条件を満たさないときは次の工程へ進む。</p>",
        refCount: 2,
        refs: [
          { href: "#mdmark-noteref-1-0" },
          {
            href: "#mdmark-note-owner-1-judge",
            owner: "mdmark-note-owner-1-judge",
          },
        ],
      },
      {
        number: 2,
        html: "<p>画像は data URL で埋める。</p>",
        refCount: 1,
        refs: [{ href: "#mdmark-noteref-2-0" }],
      },
    ],
    open: true,
  });
  // 検証
  expect(findTag(html, "<details")).toBe(
    '<details class="mdmark-footnotes mdmark-notes" open>',
  );
  expect(innerHtml(html, "<summary")).toBe("注記（2 件）");
  expect(findTags(html, "mdmark-fn-item")).toHaveLength(2);
  const backs = findTags(
    innerHtml(html, 'id="mdmark-note-1"'),
    "mdmark-fn-back",
  );
  expect(backs).toHaveLength(2);
  expect(backs[0]).toContain('href="#mdmark-noteref-1-0"');
  expect(backs[0]).not.toContain("data-note-owner");
  expect(backs[1]).toContain('href="#mdmark-note-owner-1-judge"');
  expect(backs[1]).toContain('data-note-owner="mdmark-note-owner-1-judge"');
  const texts = innerHtml(html, 'id="mdmark-note-1"')
    .split('<a class="mdmark-fn-back"')
    .slice(1)
    .map((part) =>
      plainText(part.slice(part.indexOf(">") + 1).split("</a>")[0] ?? ""),
    );
  expect(texts).toEqual(["a", "b"]);
});
