import { expect, test } from "vitest";
import { findTag, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 束ねた名前だけ形を入れ、打ち消しと空はコードに残す（正常系）
test("test_build_inline_icons", () => {
  // 準備
  const markdown =
    "`icon:flag` と `icon:sailboat` と `icon\\:check` と `icon:`\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTag(html, 'data-icon="flag"')).toContain(
    'class="mdmark-inline-icon"',
  );
  expect(innerHtml(html, 'data-icon="flag"')).toContain("<svg");
  expect(html).toContain(
    '<span class="mdmark-inline-icon" data-icon="sailboat" aria-hidden="true"></span>',
  );
  expect(html).toContain("<code>icon:check</code>");
  expect(html).toContain("<code>icon:</code>");
});

// 名前の書き方に合わないと警告する（異常系）
test("test_build_inline_icons_when_invalid_name", () => {
  // 準備
  const markdown = "`icon:Rocket!`\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("<code>icon:Rocket!</code>");
  expect(html.indexOf("mdmark-syntax-warning")).toBeGreaterThanOrEqual(0);
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("<code>icon:Rocket!</code>"),
  );
  expect(innerHtml(html, "mdmark-syntax-warning")).toContain("Rocket!");
});

// 渡した形の表を使う（正常系）
test("test_build_inline_icons_when_icon_nodes", () => {
  // 準備
  const markdown = "`icon:sailboat`\n";
  const icons = { sailboat: [["path", { d: "M22 18H2" }]] } as Record<
    string,
    Array<[string, Record<string, string>]>
  >;
  // 実行
  const { html } = renderDoc(markdown, {}, { icons });
  // 検証
  expect(innerHtml(html, 'data-icon="sailboat"')).toContain('d="M22 18H2"');
});
