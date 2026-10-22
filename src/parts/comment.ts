import { CircleAlert, MessageSquarePlus, X } from "lucide";
import { escapeHtml } from "./escape.ts";
import { iconNodeBody, iconSvgOf } from "./icon-node.ts";

/** 入力欄に出す知らせ。`empty` は本文が空のまま保存したとき、`failed` は保存できなかったとき */
export const COMMENT_MESSAGES = {
  empty: "コメントを書いてから保存してください。",
  failed:
    "コメントを保存できませんでした。書いたコメントは残っています。もう一度「コメントを保存」を押してください。",
};

/** コメントの印を指す読み上げの説明の `id` */
export const COMMENT_HINT_ID = "mdmark-comment-hint";

/** 入力欄の状態 */
export type CommentFormState = "idle" | "saving" | "empty" | "failed";

/** 「コメント」のボタンの HTML を返す */
export function renderCommentButton(): string {
  const icon = iconSvgOf(iconNodeBody(MessageSquarePlus));
  return `<button class="mdmark-comment-add" type="button">${icon}コメント</button>`;
}

/** コメントを書いて保存する入力欄の HTML を返す */
export function renderCommentForm(props: {
  /** 選んだ文字 */
  quote: string;
  /** 本文の欄に入っている文字 */
  body?: string;
  /** 入力欄の状態（既定 `idle`） */
  state?: CommentFormState;
  /** 入力欄の要素の `id` の頭 */
  id: string;
}): string {
  const { quote, body = "", state = "idle", id } = props;
  const message =
    state === "empty" || state === "failed" ? COMMENT_MESSAGES[state] : "";
  const invalid = message !== "";
  const saving = state === "saving";
  const errorId = `${escapeHtml(id)}-error`;
  const icon = iconSvgOf(iconNodeBody(CircleAlert));
  return `<div class="mdmark-comment-popover mdmark-comment-form" role="dialog" aria-label="コメントを書く"${saving ? ' aria-busy="true"' : ""}><form novalidate><p class="mdmark-comment-quote">「${escapeHtml(quote)}」へのコメント</p><label class="mdmark-comment-field">コメント<textarea name="body" rows="3" aria-describedby="${errorId}"${invalid ? ' aria-invalid="true"' : ""}>${escapeHtml(body)}</textarea></label><p class="mdmark-comment-error" id="${errorId}" role="alert"${invalid ? "" : " hidden"}>${icon}<span>${escapeHtml(message)}</span></p><div class="mdmark-comment-actions"><button class="mdmark-comment-button" type="button" data-action="cancel">キャンセル</button><button class="mdmark-comment-button is-primary" type="submit"${saving ? " disabled" : ""}>${saving ? "保存しています…" : "コメントを保存"}</button></div></form></div>`;
}

/** コメントが付いた本文の文字を包む印の HTML を返す */
export function renderCommentMark(props: {
  /** 包む本文の文字 */
  text: string;
  /** 吹き出しを開いているか（既定 `false`） */
  expanded?: boolean;
}): string {
  const { text, expanded = false } = props;
  return `<mark class="mdmark-comment-mark" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="${expanded}" aria-describedby="${COMMENT_HINT_ID}">${escapeHtml(text)}</mark>`;
}

/** 印の下に開く、その箇所に付いたコメントの本文を並べた吹き出しの HTML を返す */
export function renderCommentBubble(props: {
  /** 印の文字 */
  quote: string;
  /** 付いたコメントの本文（保存した順） */
  bodies: string[];
}): string {
  const { quote, bodies } = props;
  const close = iconSvgOf(iconNodeBody(X));
  const items = bodies
    .map(
      (body) =>
        `<li><p class="mdmark-comment-body">${escapeHtml(body)}</p></li>`,
    )
    .join("");
  return `<div class="mdmark-comment-popover mdmark-comment-bubble" role="dialog" aria-label="コメント" tabindex="-1"><div class="mdmark-comment-head"><p class="mdmark-comment-quote">「${escapeHtml(quote)}」へのコメント</p><button class="mdmark-comment-close" type="button" aria-label="閉じる" title="閉じる">${close}</button></div><ul class="mdmark-comment-list">${items}</ul></div>`;
}

/** 箇所が見つからないコメントを、選んだ文字と本文の組で並べた一覧の HTML を返す。空なら空の文字 */
export function renderCommentOrphans(props: {
  /** 箇所が見つからないコメント */
  comments: Array<{ quote: string; body: string }>;
  /** 題の `id` */
  id: string;
}): string {
  const { comments, id } = props;
  if (comments.length === 0) {
    return "";
  }
  const items = comments
    .map(
      ({ quote, body }) =>
        `<li><p class="mdmark-comment-quote">「${escapeHtml(quote)}」へのコメント</p><p class="mdmark-comment-body">${escapeHtml(body)}</p></li>`,
    )
    .join("");
  const label = escapeHtml(id);
  return `<section class="mdmark-comment-orphans" aria-labelledby="${label}"><h2 id="${label}">箇所が見つからないコメント</h2><p class="mdmark-comment-orphans-lead">本文が書き換わり、コメントを付けた文字が見つかりません。</p><ul>${items}</ul></section>`;
}
