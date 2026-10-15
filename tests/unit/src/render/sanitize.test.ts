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
