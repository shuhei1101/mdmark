import { expect, test } from "vitest";
import { renderDoc } from "../../../helpers/render.ts";

/** 見出しの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHeadings = () =>
  import("../../../../../src/render/syntax/headings.ts");

// 小文字にし、記号を落とし、空白を - にする（正常系）
test("test_slugify", async () => {
  // 準備
  const { slugify } = await loadHeadings();
  const used = new Map<string, number>();
  // 実行
  const english = slugify("Hello, World!", used);
  const japanese = slugify("使い方", used);
  // 検証
  expect(english).toBe("hello-world");
  expect(japanese).toBe("使い方");
});

// 同じ ID の 2 つ目から番号を付ける（正常系）
test("test_slugify_when_duplicated", async () => {
  // 準備
  const { slugify } = await loadHeadings();
  const used = new Map<string, number>();
  // 実行
  const ids = [
    slugify("使い方", used),
    slugify("使い方", used),
    slugify("使い方", used),
  ];
  // 検証
  expect(ids).toEqual(["使い方", "使い方-1", "使い方-2"]);
});

// 見出しに ID とアンカーを付ける（正常系）
test("test_assign_heading_ids", () => {
  // 準備
  const markdown = "# Hello, World!\n\n## 使い方\n\n## 使い方\n";
  // 実行
  const { html } = renderDoc(markdown, { sections: false });
  // 検証
  for (const [id, text] of [
    ["hello-world", "Hello, World!"],
    ["使い方", "使い方"],
    ["使い方-1", "使い方"],
  ]) {
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain(
      `<a class="mdmark-anchor" href="#${id}" aria-label="「${text}」へのリンク">`,
    );
  }
});

// anchors がオフでも ID は付け、アンカーは付けない（正常系）
test("test_assign_heading_ids_when_anchors_off", () => {
  // 準備
  const markdown = "## 使い方\n";
  // 実行
  const { html } = renderDoc(markdown, { sections: false, anchors: false });
  // 検証
  expect(html).toContain('id="使い方"');
  expect(html).not.toContain("mdmark-anchor");
});
