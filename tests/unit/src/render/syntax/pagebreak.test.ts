import { expect, test } from "vitest";
import { renderDoc } from "../../../helpers/render.ts";

// オンなら要素、オフなら取り除く（正常系）
test("test_build_pagebreaks", () => {
  // 準備
  const markdown = "前\n\n<!-- pagebreak -->\n\n後\n";
  // 実行
  const on = renderDoc(markdown).html;
  const off = renderDoc(markdown, { pagebreak: false }).html;
  // 検証
  expect(on).toContain(
    '<div class="mdmark-pagebreak" aria-hidden="true"></div>',
  );
  expect(off).not.toContain("mdmark-pagebreak");
  expect(on).not.toContain("<!--");
  expect(off).not.toContain("<!--");
});
