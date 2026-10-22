import { expect, test } from "vitest";
import { findTag, innerHtml, matches, plainText } from "../../helpers/html.ts";

/** コメントの部品の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadComment = () => import("../../../../src/parts/comment.ts");

// 文字とアイコンを持つボタン（正常系）
test("test_render_comment_button", async () => {
  // 準備
  const { renderCommentButton } = await loadComment();
  // 実行
  const html = renderCommentButton();
  // 検証
  expect(findTag(html, "mdmark-comment-add")).toContain('type="button"');
  expect(plainText(html)).toBe("コメント");
  expect(html).toContain('aria-hidden="true"');
});

// 題に選んだ文字をエスケープして出す（正常系）
test("test_render_comment_form", async () => {
  // 準備
  const { renderCommentForm } = await loadComment();
  // 実行
  const html = renderCommentForm({ quote: "<b>x</b>", id: "f1" });
  // 検証
  expect(innerHtml(html, "mdmark-comment-quote")).toBe(
    "「&lt;b&gt;x&lt;/b&gt;」へのコメント",
  );
  expect(html).not.toContain("<b>");
  expect(findTag(html, 'id="f1-error"')).toMatch(/\shidden\b/);
});

// 保存を待つ間は押せない（正常系）
test("test_render_comment_form_when_saving", async () => {
  // 準備
  const { renderCommentForm } = await loadComment();
  // 実行
  const html = renderCommentForm({
    quote: "テーマの変数",
    body: "変数の名前を一覧にしてほしい",
    state: "saving",
    id: "f1",
  });
  // 検証
  const submit = findTag(html, "is-primary");
  expect(submit).toMatch(/\sdisabled\b/);
  expect(plainText(innerHtml(html, "is-primary"))).toBe("保存しています…");
  expect(findTag(html, "mdmark-comment-form")).toContain('aria-busy="true"');
});

// 保存できない知らせと本文を出す（正常系）
test("test_render_comment_form_when_failed", async () => {
  // 準備
  const { renderCommentForm, COMMENT_MESSAGES } = await loadComment();
  // 実行
  const html = renderCommentForm({
    quote: "テーマの変数",
    body: "変数の名前を一覧にしてほしい",
    state: "failed",
    id: "f1",
  });
  // 検証
  const error = findTag(html, 'id="f1-error"');
  expect(error).not.toMatch(/\shidden\b/);
  expect(plainText(innerHtml(html, 'id="f1-error"'))).toBe(
    COMMENT_MESSAGES.failed,
  );
  expect(findTag(html, "<textarea")).toContain('aria-invalid="true"');
  expect(innerHtml(html, "<textarea")).toBe("変数の名前を一覧にしてほしい");
});

// 押せる印の属性を持つ（正常系）
test("test_render_comment_mark", async () => {
  // 準備
  const { renderCommentMark } = await loadComment();
  // 実行
  const html = renderCommentMark({ text: "手順" });
  // 検証
  const mark = findTag(html, "mdmark-comment-mark");
  expect(mark).toContain('tabindex="0"');
  expect(mark).toContain('role="button"');
  expect(mark).toContain('aria-haspopup="dialog"');
  expect(mark).toContain('aria-expanded="false"');
  expect(innerHtml(html, "mdmark-comment-mark")).toBe("手順");
});

// 本文を文字のまま並べる（正常系）
test("test_render_comment_bubble", async () => {
  // 準備
  const { renderCommentBubble } = await loadComment();
  // 実行
  const html = renderCommentBubble({
    quote: "手順",
    bodies: ["a", "<b>x</b>"],
  });
  // 検証
  expect(matches(html, /<li\b/g)).toHaveLength(2);
  const bodies = matches(html, /mdmark-comment-body">[^<]*/g).map((body) =>
    body.replace('mdmark-comment-body">', ""),
  );
  expect(bodies).toEqual(["a", "&lt;b&gt;x&lt;/b&gt;"]);
  expect(html).not.toContain("<b>");
});

// 空なら何も返さない（正常系）
test("test_render_comment_orphans_when_empty", async () => {
  // 準備
  const { renderCommentOrphans } = await loadComment();
  // 実行
  const html = renderCommentOrphans({ comments: [], id: "o1" });
  // 検証
  expect(html).toBe("");
});
