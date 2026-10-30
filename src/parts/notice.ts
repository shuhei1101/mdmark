import { escapeHtml } from "./escape.ts";

/** 知らせの枠の題: 図の印かどうかで分ける */
const NOTICE_TITLES = {
  figure: "この図を表示できません",
  block: "この箇所を表示できません",
};

/** 読めなかったものの呼び名: 外部ライブラリか拡張か、ビューやコメントの部品のモジュールか */
const NOTICE_SOURCES = {
  library: "ライブラリ",
  extension: "拡張",
  part: "部品",
};

/** 差分の取り出し元を読めないときの題と本文: `diff-content` の本文は取り出せなかったリビジョンの説明を `「…」` で囲んで入れる。`diff-blocks` は描いた文書のブロックを色分けできないときの文で、一覧と本文のどちらの失敗でも同じ */
const DIFF_NOTICES = {
  "diff-blocks": () => ({
    title: "変更を表示できません",
    body: "比べるリビジョンの本文を取り出せませんでした。色分けせずに表示しています。",
  }),
  "diff-revisions": () => ({
    title: "変更の履歴を表示できません",
    body: "リビジョンの一覧を取り出せませんでした。時間をおいて、変更を開き直してください。",
  }),
  "diff-content": (name: string) => ({
    title: "このリビジョンの本文を表示できません",
    body: `「${escapeHtml(name)}」の本文を取り出せませんでした。別のリビジョンを選んでください。`,
  }),
};

/** 外部ライブラリか拡張を読めない印の場所、または差分の取り出し元がリビジョンの一覧か本文を返せない場所に置く、知らせの枠の HTML を返す */
export function renderNotice(options: {
  /** 読めなかった印の名前。`diff-content` では取り出せなかったリビジョンの説明（複数なら `「…」と「…」` の中身）。`diff-blocks` では使わない */
  name: string;
  /** 図の印か（既定 `true`）。`diff-revisions`・`diff-content`・`diff-blocks` では使わない */
  figure?: boolean;
  /** 読めなかったもの（既定 `library`） */
  source?:
    | "library"
    | "extension"
    | "part"
    | "diff-revisions"
    | "diff-content"
    | "diff-blocks";
}): string {
  const { name, figure = true, source = "library" } = options;
  if (
    source === "diff-revisions" ||
    source === "diff-content" ||
    source === "diff-blocks"
  ) {
    const { title, body } = DIFF_NOTICES[source](name);
    return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>${body}</p></div>`;
  }
  const title = figure ? NOTICE_TITLES.figure : NOTICE_TITLES.block;
  return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>表示に使う${NOTICE_SOURCES[source]}（<code>${escapeHtml(name)}</code>）を読み込めませんでした。ネットワークにつながっているかを確かめて、ページを読み込み直してください。</p></div>`;
}
