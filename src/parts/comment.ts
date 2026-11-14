import {
  CircleAlert,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Trash2,
  X,
} from "lucide";
import { escapeHtml } from "./escape.ts";
import { iconNodeBody, iconSvgOf } from "./icon-node.ts";

/** 入力欄に出す通知し。`empty` は本文が空のまま保存したとき、`failed` は保存できなかったとき。`updateFailed`・`removeFailed` は吹き出しで修正・削除できなかったとき、`removeConfirm` は削除の確認の文 */
export const COMMENT_MESSAGES = {
  empty: "コメントを記載してから保存してください。",
  failed:
    "コメントを保存できませんでした。記載したコメントは残っています。もう一度「コメントを保存」を押してください。",
  updateFailed:
    "コメントを保存できませんでした。記載したコメントは残っています。もう一度「保存」を押してください。",
  removeFailed:
    "コメントを削除できませんでした。もう一度「削除」を押してください。",
  removeConfirm: "このコメントを削除しますか? 削除すると元に戻せません。",
};

/** コメントのマーカーを指すスクリーンリーダーの説明の `id` */
export const COMMENT_HINT_ID = "mdmark-comment-hint";

/** 余白のマーカーのスクリーンリーダー向けの名前に添える、閉じた中の種類ごとの文言 */
export const CLOSED_LABELS = {
  section: "閉じたセクションの中",
  tab: "選ばれていないタブの中",
  row: "閉じた行の詳細の中",
} as const satisfies Record<string, string>;

/** 箇所を包む、いちばん外側の閉じた要素の種類 */
export type CommentClosedKind = keyof typeof CLOSED_LABELS;

/** 入力欄の状態 */
export type CommentFormState = "idle" | "saving" | "empty" | "failed";

/** 削除の確認の状態 */
export type CommentRemoveState = "idle" | "removing" | "failed";

/** 吹き出しの本文の欄の通知を指す `id` の頭の既定 */
const EDIT_FIELD_ID = "mdmark-comment-edit";

/** 「コメント」のボタンの HTML を返却する */
export function renderCommentButton(): string {
  const icon = iconSvgOf(iconNodeBody(MessageSquarePlus));
  return `<button class="mdmark-comment-add" type="button">${icon}コメント</button>`;
}

/** コメントを記載して保存する入力欄の HTML を返却する */
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
  return `<div class="mdmark-comment-popover mdmark-comment-form" role="dialog" aria-label="コメント追加"${saving ? ' aria-busy="true"' : ""}><form novalidate><p class="mdmark-comment-quote">「${escapeHtml(quote)}」へのコメント</p><label class="mdmark-comment-field">コメント<textarea name="body" rows="3" aria-describedby="${errorId}"${invalid ? ' aria-invalid="true"' : ""}>${escapeHtml(body)}</textarea></label><p class="mdmark-comment-error" id="${errorId}" role="alert"${invalid ? "" : " hidden"}>${icon}<span>${escapeHtml(message)}</span></p><div class="mdmark-comment-actions"><button class="mdmark-comment-button" type="button" data-action="cancel">キャンセル</button><button class="mdmark-comment-button is-primary" type="submit"${saving ? " disabled" : ""}>${saving ? "保存しています…" : "コメントを保存"}</button></div></form></div>`;
}

/** コメントが付いた本文の文字を包むマーカーの HTML を返却する */
export function renderCommentMark(props: {
  /** 包む本文の文字 */
  text: string;
  /** 吹き出しを開いているか（既定 `false`） */
  expanded?: boolean;
  /** `focusComment` で移ったマーカーか（既定 `false`） */
  focused?: boolean;
}): string {
  const { text, expanded = false, focused = false } = props;
  return `<mark class="mdmark-comment-mark" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="${expanded}" aria-describedby="${COMMENT_HINT_ID}"${focused ? " data-focused" : ""}>${escapeHtml(text)}</mark>`;
}

/** 本文の欄の通知の HTML を返却する。`message` が空なら隠す */
function renderError(message: string, id?: string): string {
  const icon = iconSvgOf(iconNodeBody(CircleAlert));
  const idAttribute = id === undefined ? "" : ` id="${escapeHtml(id)}"`;
  return `<p class="mdmark-comment-error"${idAttribute} role="alert"${message === "" ? " hidden" : ""}>${icon}<span>${escapeHtml(message)}</span></p>`;
}

/** 本文を書き換える入力欄の項目 */
function renderEditItem(
  edit: { draft: string; state: CommentFormState; fieldId: string },
  idAttribute: string,
): string {
  const message =
    edit.state === "empty"
      ? COMMENT_MESSAGES.empty
      : edit.state === "failed"
        ? COMMENT_MESSAGES.updateFailed
        : "";
  const saving = edit.state === "saving";
  const errorId = `${edit.fieldId}-error`;
  return `<li class="mdmark-comment-item"${idAttribute}><form novalidate${saving ? ' aria-busy="true"' : ""}><label class="mdmark-comment-field">コメント<textarea name="body" rows="3" aria-describedby="${escapeHtml(errorId)}"${message === "" ? "" : ' aria-invalid="true"'}>${escapeHtml(edit.draft)}</textarea></label>${renderError(message, errorId)}<div class="mdmark-comment-actions"><button class="mdmark-comment-button" type="button" data-action="cancel-edit">キャンセル</button><button class="mdmark-comment-button is-primary" type="submit"${saving ? " disabled" : ""}>${saving ? "保存しています…" : "保存"}</button></div></form></li>`;
}

/** 削除の確認を出す項目 */
function renderConfirmItem(options: {
  text: string;
  state: CommentRemoveState;
  idAttribute: string;
}): string {
  const { text, state, idAttribute } = options;
  const removing = state === "removing";
  const error =
    state === "failed" ? renderError(COMMENT_MESSAGES.removeFailed) : "";
  return `<li class="mdmark-comment-item is-icon-actions"${idAttribute}>${text}${error}<div class="mdmark-comment-confirm"><p>${escapeHtml(COMMENT_MESSAGES.removeConfirm)}</p><div class="mdmark-comment-actions"><button class="mdmark-comment-button" type="button" data-action="cancel-remove">キャンセル</button><button class="mdmark-comment-button is-danger" type="button" data-action="confirm-remove"${removing ? " disabled" : ""}>${removing ? "削除しています…" : "削除"}</button></div></div></li>`;
}

/** 「編集」「削除」のアイコンのボタン */
function renderIconButtons(canEdit: boolean, canRemove: boolean): string {
  const iconButton = (action: string, label: string, icon: string): string =>
    `<button class="mdmark-comment-icon-button" type="button" data-action="${action}" aria-label="${label}" title="${label}">${icon}</button>`;
  return [
    canEdit ? iconButton("edit", "編集", iconSvgOf(iconNodeBody(Pencil))) : "",
    canRemove
      ? iconButton("remove", "削除", iconSvgOf(iconNodeBody(Trash2)))
      : "",
  ].join("");
}

/** 吹き出しのコメント 1 件の `li` の HTML を、本文の表示・入力欄・削除の確認のどれかで返却する */
export function renderCommentItem(props: {
  /** コメントの本文 */
  body: string;
  /** コメントの `id` */
  id?: string;
  /** 「編集」を配置するか */
  canEdit?: boolean;
  /** 「削除」を配置するか */
  canRemove?: boolean;
  /** 入力欄にするときの本文の欄の文字・状態・通知を指す `id` */
  edit?: { draft: string; state: CommentFormState; fieldId: string };
  /** 削除の確認を出すときの状態 */
  confirm?: { state: CommentRemoveState };
}): string {
  const { body, id, canEdit = false, canRemove = false, edit, confirm } = props;
  const idAttribute =
    id === undefined ? "" : ` data-comment-id="${escapeHtml(id)}"`;
  if (edit) {
    return renderEditItem(edit, idAttribute);
  }
  const text = `<p class="mdmark-comment-body">${escapeHtml(body)}</p>`;
  if (confirm) {
    return renderConfirmItem({ text, state: confirm.state, idAttribute });
  }
  if (!canEdit && !canRemove) {
    return `<li${idAttribute}>${text}</li>`;
  }
  return `<li class="mdmark-comment-item is-icon-actions"${idAttribute}>${text}<div class="mdmark-comment-icon-actions">${renderIconButtons(canEdit, canRemove)}</div></li>`;
}

/** マーカーの下に開く、その箇所に付いたコメントの本文を並べた吹き出しの HTML を返却する */
export function renderCommentBubble(props: {
  /** マーカーの文字 */
  quote: string;
  /** 付いたコメントの本文（保存した順） */
  bodies: string[];
  /** コメントの `id`（`bodies` と同じ順） */
  ids?: string[];
  /** 「編集」を配置するか */
  canEdit?: boolean;
  /** 「削除」を配置するか */
  canRemove?: boolean;
  /** 入力欄にするコメントの位置 */
  editIndex?: number;
  /** 入力欄の本文の欄の文字（既定はそのコメントの本文） */
  draft?: string;
  /** 入力欄の状態（既定 `idle`） */
  editState?: CommentFormState;
  /** 削除の確認を出すコメントの位置 */
  confirmIndex?: number;
  /** 削除の確認の状態（既定 `idle`） */
  removeState?: CommentRemoveState;
  /** 本文の欄の通知を指す `id` の頭（既定 `mdmark-comment-edit`） */
  id?: string;
}): string {
  const {
    quote,
    bodies,
    ids,
    canEdit,
    canRemove,
    editIndex,
    draft,
    editState = "idle",
    confirmIndex,
    removeState = "idle",
    id = EDIT_FIELD_ID,
  } = props;
  const close = iconSvgOf(iconNodeBody(X));
  const items = bodies
    .map((body, index) =>
      renderCommentItem({
        body,
        id: ids?.[index],
        canEdit,
        canRemove,
        edit:
          index === editIndex
            ? {
                draft: draft ?? (editState === "empty" ? "" : body),
                state: editState,
                fieldId: id,
              }
            : undefined,
        confirm: index === confirmIndex ? { state: removeState } : undefined,
      }),
    )
    .join("");
  return `<div class="mdmark-comment-popover mdmark-comment-bubble" role="dialog" aria-label="コメント" tabindex="-1"><div class="mdmark-comment-head"><p class="mdmark-comment-quote">「${escapeHtml(quote)}」へのコメント</p><button class="mdmark-comment-close" type="button" aria-label="閉じる" title="閉じる">${close}</button></div><ul class="mdmark-comment-list">${items}</ul></div>`;
}

/** 箇所が見つからないコメントを、選んだ文字と本文の組で並べた一覧の HTML を返却する。空なら空の文字 */
export function renderCommentOrphans(props: {
  /** 箇所が見つからないコメント */
  comments: Array<{ quote: string; body: string }>;
  /** タイトルの `id` */
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

/** 本文の右の余白の列に、コメントの箇所の行の高さで配置するボタンの HTML を返却する */
export function renderCommentMarker(props: {
  /** 行の最初の箇所の選んだ文字 */
  quote: string;
  /** 同じ行の箇所の数（既定 1） */
  count?: number;
  /** 箇所のうち吹き出しを開いているものがあるか（既定 `false`） */
  current?: boolean;
  /** 箇所を包む、いちばん外側の閉じた要素の種類 */
  closed?: CommentClosedKind;
}): string {
  const { quote, count = 1, current = false, closed } = props;
  const merged = count > 1;
  const where = closed === undefined ? "" : `（${CLOSED_LABELS[closed]}）`;
  const label = escapeHtml(
    `コメント ${merged ? `${count} 件、` : ""}「${quote}」${where}`,
  );
  const icon = iconSvgOf(iconNodeBody(MessageSquare));
  const attributes = `${closed === undefined ? "" : ` data-closed="${closed}"`}${current ? " data-current" : ""}`;
  return `<button class="mdmark-comment-marker" type="button" aria-label="${label}" title="${label}"${attributes}>${icon}${merged ? `<span>${count}</span>` : ""}</button>`;
}
