import { expect, test } from "vitest";
import {
  findTag,
  findTags,
  innerHtml,
  matches,
  plainText,
} from "../../helpers/html.ts";

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

// タイトルに選んだ文字をエスケープして出す（正常系）
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

// 保存できない通知と本文を出す（正常系）
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

// 押せるマーカーの属性を持つ（正常系）
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
  expect(mark).not.toContain("data-focused");
  expect(innerHtml(html, "mdmark-comment-mark")).toBe("手順");
});

// focused なら data-focused を持つ（正常系）
test("test_render_comment_mark_when_focused", async () => {
  // 準備
  const { renderCommentMark } = await loadComment();
  // 実行
  const html = renderCommentMark({ text: "手順", focused: true });
  // 検証
  expect(findTag(html, "mdmark-comment-mark")).toMatch(/\sdata-focused\b/);
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
  expect(html).not.toContain("mdmark-comment-icon-button");
});

// canEdit・canRemove ならコメントごとにアイコンのボタンと id を持つ（正常系）
test("test_render_comment_bubble_when_editable", async () => {
  // 準備
  const { renderCommentBubble } = await loadComment();
  // 実行
  const html = renderCommentBubble({
    quote: "手順",
    bodies: ["a"],
    ids: ["c1"],
    canEdit: true,
    canRemove: true,
  });
  // 検証
  const item = findTag(html, "<li");
  expect(item).toContain('class="mdmark-comment-item is-icon-actions"');
  expect(item).toContain('data-comment-id="c1"');
  const buttons = findTags(html, "mdmark-comment-icon-button");
  expect(buttons).toHaveLength(2);
  expect(buttons[0]).toContain('data-action="edit"');
  expect(buttons[0]).toContain('aria-label="編集"');
  expect(buttons[0]).toContain('title="編集"');
  expect(buttons[1]).toContain('data-action="remove"');
  expect(buttons[1]).toContain('aria-label="削除"');
  expect(buttons[1]).toContain('title="削除"');
});

// 入力欄の状態ごとに通知と保存のボタンを変える（正常系）
test("test_render_comment_item_when_editing", async () => {
  // 準備
  const { renderCommentItem, COMMENT_MESSAGES } = await loadComment();
  /** 状態を変えて入力欄の `li` を返却する */
  const render = (state: "idle" | "saving" | "empty" | "failed"): string =>
    renderCommentItem({
      body: "元の本文",
      id: "c1",
      canEdit: true,
      canRemove: true,
      edit: { draft: "<b>x</b>", state, fieldId: "e1" },
    });
  // 実行・検証: idle
  const idle = render("idle");
  expect(innerHtml(idle, "<textarea")).toBe("&lt;b&gt;x&lt;/b&gt;");
  expect(findTag(idle, 'id="e1-error"')).toMatch(/\shidden\b/);
  expect(idle).not.toContain("mdmark-comment-icon-button");
  // 実行・検証: saving
  const saving = render("saving");
  expect(findTag(saving, 'type="submit"')).toMatch(/\sdisabled\b/);
  expect(plainText(innerHtml(saving, 'type="submit"'))).toBe("保存しています…");
  // 実行・検証: empty・failed
  for (const [state, message] of [
    ["empty", COMMENT_MESSAGES.empty],
    ["failed", COMMENT_MESSAGES.updateFailed],
  ] as const) {
    const html = render(state);
    expect(findTag(html, "<textarea")).toContain('aria-invalid="true"');
    expect(findTag(html, 'id="e1-error"')).not.toMatch(/\shidden\b/);
    expect(plainText(innerHtml(html, 'id="e1-error"'))).toBe(message);
  }
});

// 削除の確認の状態ごとに通知と削除のボタンを変える（正常系）
test("test_render_comment_item_when_confirming", async () => {
  // 準備
  const { renderCommentItem } = await loadComment();
  /** 状態を変えて削除の確認の `li` を返却する */
  const render = (state: "idle" | "removing" | "failed"): string =>
    renderCommentItem({
      body: "元の本文",
      id: "c1",
      canEdit: true,
      canRemove: true,
      confirm: { state },
    });
  // 実行・検証: どの状態も確認の文と削除のボタンを持ち、アイコンのボタンが無い
  for (const state of ["idle", "removing", "failed"] as const) {
    const html = render(state);
    expect(plainText(html)).toContain(
      "このコメントを削除しますか? 削除すると元に戻せません。",
    );
    expect(findTags(html, "is-danger")).toHaveLength(1);
    expect(html).not.toContain("mdmark-comment-icon-button");
  }
  // 実行・検証: removing
  const removing = render("removing");
  expect(findTag(removing, "is-danger")).toMatch(/\sdisabled\b/);
  expect(plainText(innerHtml(removing, "is-danger"))).toBe("削除しています…");
  // 実行・検証: failed
  const failed = render("failed");
  expect(plainText(innerHtml(failed, 'role="alert"'))).toBe(
    "コメントを削除できませんでした。もう一度「削除」を押してください。",
  );
  expect(render("idle")).not.toContain('role="alert"');
});

// canRemove だけなら削除のボタンだけを配置する（正常系）
test("test_render_comment_item_when_remove_only", async () => {
  // 準備
  const { renderCommentItem } = await loadComment();
  // 実行
  const html = renderCommentItem({ body: "本文", id: "c1", canRemove: true });
  // 検証
  const buttons = findTags(html, "mdmark-comment-icon-button");
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toContain('data-action="remove"');
});

// 空なら何も返却しない（正常系）
test("test_render_comment_orphans_when_empty", async () => {
  // 準備
  const { renderCommentOrphans } = await loadComment();
  // 実行
  const html = renderCommentOrphans({ comments: [], id: "o1" });
  // 検証
  expect(html).toBe("");
});

// スクリーンリーダー向けの名前に選んだ文字をエスケープして入れる（正常系）
test("test_render_comment_marker", async () => {
  // 準備
  const { renderCommentMarker } = await loadComment();
  // 実行
  const html = renderCommentMarker({ quote: "<b>x</b>" });
  // 検証
  const tag = findTag(html, "mdmark-comment-marker");
  expect(tag).toContain('type="button"');
  expect(tag).toContain('aria-label="コメント 「&lt;b&gt;x&lt;/b&gt;」"');
  expect(html).not.toContain("<b>");
  expect(html).not.toContain("<span");
  expect(tag).not.toMatch(/\sdata-current\b/);
  expect(tag).not.toMatch(/\sdata-closed\b/);
});

// 数と閉じた中の種類を出す（正常系）
test("test_render_comment_marker_when_merged_and_closed", async () => {
  // 準備
  const { renderCommentMarker } = await loadComment();
  // 実行
  const html = renderCommentMarker({
    quote: "担当者",
    count: 2,
    closed: "tab",
    current: true,
  });
  // 検証
  const tag = findTag(html, "mdmark-comment-marker");
  expect(tag).toContain(
    'aria-label="コメント 2 件、「担当者」（選ばれていないタブの中）"',
  );
  expect(plainText(html)).toBe("2");
  expect(tag).toContain('data-closed="tab"');
  expect(tag).toMatch(/\sdata-current\b/);
});
