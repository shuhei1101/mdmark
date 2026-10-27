import { expect, test } from "vitest";
import { findTag, innerHtml } from "../../helpers/html.ts";

/** 節の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSection = () => import("../../../../src/parts/section.ts");

// 閉じた節はボタンを aria-expanded=false にし、中身を hidden=until-found にする（正常系）
test("test_render_section", async () => {
  // 準備
  const { renderSection } = await loadSection();
  // 実行
  const html = renderSection({
    level: 2,
    id: "補足",
    title: "補足",
    open: false,
    toggle: true,
    body: "<p>中身</p>",
  });
  // 検証
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('data-section="closed" hidden="until-found"');
});

// toggle が false なら中身を隠さず data-section だけに写す（正常系）
test("test_render_section_when_unmounted", async () => {
  // 準備
  const { renderSection } = await loadSection();
  // 実行
  const html = renderSection({
    level: 2,
    id: "補足",
    title: "補足",
    open: false,
    toggle: false,
    body: "<p>中身</p>",
  });
  // 検証
  expect(html).not.toContain("<button");
  expect(html).toContain('data-section="closed"');
  expect(html).not.toMatch(/\shidden\b/);
});

// h1 の節も見出しと開閉のボタンを描く（正常系）
test("test_render_section_when_h1", async () => {
  // 準備
  const { renderSection } = await loadSection();
  // 実行
  const html = renderSection({
    level: 1,
    id: "手引き",
    title: "手引き",
    open: true,
    toggle: true,
    body: "<p>中身</p>",
  });
  // 検証
  expect(findTag(html, "<h1")).toContain('id="手引き"');
  const heading = innerHtml(html, "<h1");
  expect(heading).toContain("mdmark-section-toggle");
  expect(findTag(heading, "mdmark-section-toggle")).toContain(
    'aria-expanded="true"',
  );
  expect(findTag(html, 'id="section-手引き"')).toContain('data-section="open"');
});
