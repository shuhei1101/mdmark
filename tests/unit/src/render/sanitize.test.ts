import { expect, test } from "vitest";

/** 落とす処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSanitize = async () => {
  const { sanitize } = await import("../../../../src/render/sanitize.ts");
  return {
    /** この描画の印の値を決めて落とす */
    sanitize: (html: string) => sanitize(html, "test-nonce"),
  };
};

// スクリプトと style を落とし、折り畳みを残す（正常系）
test("test_sanitize", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html = [
    "<script>alert(1)</script>",
    '<a onclick="x" href="javascript:x">l</a>',
    '<p style="position:fixed">p</p>',
    "<details><summary>s</summary>b</details>",
  ].join("");
  // 実行
  const sanitized = sanitize(html);
  // 検証
  expect(sanitized).not.toContain("<script");
  expect(sanitized).not.toContain("onclick");
  expect(sanitized).not.toContain("javascript:");
  expect(sanitized).not.toContain("style");
  expect(sanitized).toContain("<details>");
  expect(sanitized).toContain("<summary>");
});

// 列の揃えを class に移す（正常系）
test("test_sanitize_when_align", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html =
    '<td style="text-align:right">a</td><td style="text-align:justify;color:red">b</td>';
  // 実行
  const sanitized = sanitize(html);
  // 検証
  expect(sanitized).toBe('<td class="mdmark-align-right">a</td><td>b</td>');
});

// 入力欄を無効のチェックボックスに付け直す（正常系）
test("test_sanitize_when_input", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html = '<input type="text" value="x"><input type="checkbox" checked>';
  // 実行
  const sanitized = sanitize(html);
  // 検証
  expect(sanitized).toBe(
    '<input type="checkbox" disabled /><input type="checkbox" disabled checked />',
  );
});

// 許した要素の許した class だけを残し、role は status だけを残す（正常系）
test("test_sanitize_when_classes", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html = [
    '<code class="language-ts evil">c</code>',
    '<div class="mdmark-embed other" data-mdmark-slot="x" role="status">e</div>',
    '<p class="x">p</p>',
    '<div class="mdmark-embed" role="alert">f</div>',
  ].join("");
  // 実行
  const sanitized = sanitize(html);
  // 検証
  expect(sanitized).toContain('<code class="language-ts">');
  expect(sanitized).toContain('class="mdmark-embed"');
  expect(sanitized).toContain('data-mdmark-slot="x"');
  expect(sanitized).toContain('role="status"');
  expect(sanitized).toContain("<p>p</p>");
  expect(sanitized).not.toContain("evil");
  expect(sanitized).not.toContain("other");
  expect(sanitized).not.toContain('role="alert"');
});

// 文書に書いた tabindex を 0 にする（正常系）
test("test_sanitize_when_tabindex", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  // 実行
  const sanitized = sanitize('<table tabindex="5"></table>');
  // 検証
  expect(sanitized).toContain('<table tabindex="0">');
});

// 画像の種類と base64 の形の data: URL だけを画像の src に残す（正常系）
test("test_sanitize_when_data_image", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html = [
    '<img src="data:image/png;base64,iVBORw0KGgo=">',
    '<img src="data:text/html;base64,PHNjcmlwdD4=">',
    '<img src="data:image/svg+xml,<svg/>">',
    '<a href="data:image/png;base64,iVBORw0KGgo=">l</a>',
  ].join("");
  // 実行
  const sanitized = sanitize(html);
  // 検証
  const images = sanitized.match(/<img[^>]*>/g) ?? [];
  expect(images).toHaveLength(3);
  expect(images[0]).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  expect(images[1]).not.toContain("src=");
  expect(images[2]).not.toContain("src=");
  expect(sanitized).not.toContain("href=");
});

// 図の部品の属性は、文書に書いた生の HTML から落とす（異常系）
test("test_sanitize_when_raw_html_has_diagram_attributes", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html = [
    '<p><img src="https://example.com/a.png" alt="a" width="9999" height="9999"></p>',
    '<div transform="x" fill="red" value="1" disabled for="a" min="0" x="1" d="M0" viewBox="0 0 1 1">raw</div>',
  ].join("");
  // 実行
  const sanitized = sanitize(html);
  // 検証
  expect(sanitized).toContain('src="https://example.com/a.png"');
  expect(sanitized).toContain('alt="a"');
  for (const name of [
    "width",
    "height",
    "transform",
    "fill",
    "value",
    "disabled",
    "for",
    "min",
    "x=",
    "d=",
    "viewbox",
  ]) {
    expect(sanitized, name).not.toContain(name);
  }
  expect(sanitized).toContain("raw");
});

// 図の部品の要素は、文書に書いたものを中身ごと落とす（異常系）
test("test_sanitize_when_raw_html_has_diagram_elements", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html = [
    "<p>前</p>",
    '<svg width="10"><text>svgの文字</text></svg>',
    "<button>押す</button>",
    "<output>出力</output>",
    "<label>ラベル</label>",
    "<p>後</p>",
  ].join("");
  // 実行
  const sanitized = sanitize(html);
  // 検証
  for (const word of [
    "<svg",
    "<button",
    "<output",
    "<label",
    "svgの文字",
    "押す",
    "出力",
    "ラベル",
  ]) {
    expect(sanitized, word).not.toContain(word);
  }
  expect(sanitized).toContain("<p>前</p>");
  expect(sanitized).toContain("<p>後</p>");
});

// mdmark が出した要素の図の部品の属性は残す（正常系）
test("test_sanitize_when_own_diagram_attributes", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const html =
    '<svg data-mdmark-own="test-nonce" viewBox="0 0 1 1" width="5"><path data-mdmark-own="test-nonce" d="M0,0"></path></svg>';
  // 実行
  const sanitized = sanitize(html);
  // 検証
  expect(sanitized).toContain("<svg");
  expect(sanitized).toContain('viewbox="0 0 1 1"');
  expect(sanitized).toContain('width="5"');
  expect(sanitized).toContain('d="M0,0"');
});

// 自分が出した要素の style は図の部品と埋め込んだ HTML の許した宣言だけ残し、書いた要素の style は落とす（正常系）
test("test_sanitize_when_own_style", async () => {
  // 準備
  const { sanitize } = await loadSanitize();
  const own = 'data-mdmark-own="test-nonce"';
  const html = [
    `<div class="mdmark-diagram-node" ${own} style="left:10px;top:20px">図の箱</div>`,
    `<div class="mdmark-html" ${own}><div ${own} style="display:flex;position:fixed">埋め込み</div></div>`,
    '<div style="display:flex">書いた要素</div>',
  ].join("");
  // 実行
  const sanitized = sanitize(html);
  // 検証
  expect(sanitized).toContain('style="left:10px;top:20px"');
  expect(sanitized).toContain('style="display:flex"');
  expect(sanitized).not.toContain("position");
  expect(sanitized.match(/style=/g) ?? []).toHaveLength(2);
  expect(sanitized).toContain("<div>書いた要素</div>");
});

/** 埋め込んだ HTML を落とす処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEmbedded = async () => {
  const { sanitizeEmbedded, filterEmbeddedStyle } = await import(
    "../../../../src/render/sanitize.ts"
  );
  return {
    /** 文字をそのまま返す `onText` で落とす */
    sanitizeEmbedded: (html: string) =>
      sanitizeEmbedded(html, (text: string) => text),
    sanitizeEmbeddedWith: sanitizeEmbedded,
    filterEmbeddedStyle,
  };
};

// スクリプトを落とし、ボタンと data-hint を残す（正常系）
test("test_sanitize_embedded", async () => {
  // 準備
  const { sanitizeEmbedded } = await loadEmbedded();
  const html = [
    "<script>alert(1)</script>",
    '<button onclick="x" type="submit" formaction="/x">b</button>',
    '<div data-hint="説明" data-x="1" class="evil">d</div>',
  ].join("");
  // 実行
  const sanitized = sanitizeEmbedded(html);
  // 検証
  for (const word of ["<script", "onclick", "formaction", "data-x", "class"]) {
    expect(sanitized, word).not.toContain(word);
  }
  expect(sanitized).toContain('<button type="button">');
  expect(sanitized).toContain('data-hint="説明"');
});

// style を filterEmbeddedStyle で絞る（正常系）
test("test_sanitize_embedded_when_style", async () => {
  // 準備
  const { sanitizeEmbedded } = await loadEmbedded();
  const html = [
    '<div style="display: flex; position: fixed">a</div>',
    '<div style="position: fixed">b</div>',
  ].join("");
  // 実行
  const sanitized = sanitizeEmbedded(html);
  // 検証
  expect(sanitized).toBe('<div style="display:flex">a</div><div>b</div>');
});

// 本文の文字だけを onText に渡す（正常系）
test("test_sanitize_embedded_when_text", async () => {
  // 準備
  const { sanitizeEmbeddedWith } = await loadEmbedded();
  const html = '<p>索引</p><a href="#">索引</a><code>索引</code>';
  const onText = (text: string) =>
    text.replaceAll("索引", '<span class="t">索引</span>');
  // 実行
  const sanitized = sanitizeEmbeddedWith(html, onText);
  // 検証
  expect(sanitized).toContain('<p><span class="t">索引</span></p>');
  expect(sanitized).toContain('<a href="#">索引</a>');
  expect(sanitized).toContain("<code>索引</code>");
});

// 許した宣言だけを残す（正常系）
test("test_filter_embedded_style", async () => {
  // 準備
  const { filterEmbeddedStyle } = await loadEmbedded();
  const style = [
    "display: flex",
    "gap: 12px",
    "position: fixed",
    "background-image: url(https://example.com/a.png)",
    "width: 100vw",
    "color: var(--mdmark-color-accent)",
    "margin-top: -9999px",
    "padding: 4px",
  ].join("; ");
  // 実行
  const filtered = filterEmbeddedStyle(style);
  // 検証
  expect(filtered).toBe(
    "display:flex;gap:12px;color:var(--mdmark-color-accent);padding:4px",
  );
});

// コメントと引用符を含む宣言を落とす（異常系）
test("test_filter_embedded_style_when_tricky", async () => {
  // 準備
  const { filterEmbeddedStyle } = await loadEmbedded();
  const style = 'color: red /* x */; font-size: "12px"; padding: 4px';
  // 実行
  const filtered = filterEmbeddedStyle(style);
  // 検証
  expect(filtered).toBe("padding:4px");
});
