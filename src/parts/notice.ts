import { escapeHtml } from "./escape.ts";

/** 通知ブロックのタイトル: 図のマーカーかどうかで分ける */
const NOTICE_TITLES = {
  figure: "この図を表示できません",
  block: "この箇所を表示できません",
};

/** 読み込めなかったものの呼び名: 外部ライブラリか拡張か、ビューやコメントの部品のモジュールか */
const NOTICE_SOURCES = {
  library: "ライブラリ",
  extension: "拡張",
  part: "部品",
};

/** 差分の取り出し元を読み込めないときのタイトルと本文: `diff-content` の本文は取り出せなかったリビジョンの説明を `「…」` で囲んで入れる。`diff-blocks` は描いた文書のブロックを色分けできないときの文で、一覧と本文のどちらの失敗でも同じ */
const DIFF_NOTICES = {
  "diff-blocks": () => ({
    title: "変更を表示できません",
    body: "比べるリビジョンの本文を取り出せませんでした。色分けせずに表示しています。",
  }),
  "diff-revisions": () => ({
    title: "変更の履歴を表示できません",
    body: "リビジョンの一覧を取り出せませんでした。時間をおいて、変更をもう一度開いてください。",
  }),
  icons: () => ({
    title: "アイコンを表示できません",
    body: "Lucide のアイコンを読み込めませんでした。アイコンの場所は記載した文字で表示しています。通信を確認してもう一度開いてください。",
  }),
  "diff-content": (name: string) => ({
    title: "このリビジョンの本文を表示できません",
    body: `「${escapeHtml(name)}」の本文を取り出せませんでした。別のリビジョンを選んでください。`,
  }),
};

/** 外部ライブラリか拡張を読み込めないマーカーの場所、差分の取り出し元がリビジョンの一覧か本文を返却できない場所、またはまとめていないアイコンを読み込めない文書の先頭に配置する、通知ブロックの HTML を返却する */
export function renderNotice(options: {
  /** 読み込めなかったマーカーの名前。`diff-content` では取り出せなかったリビジョンの説明（複数なら `「…」と「…」` の中身）。`diff-blocks`・`icons` では使用しない */
  name: string;
  /** 図のマーカーか（既定 `true`）。`diff-revisions`・`diff-content`・`diff-blocks` では使用しない */
  figure?: boolean;
  /** 読み込めなかったもの（既定 `library`） */
  source?:
    | "library"
    | "extension"
    | "part"
    | "diff-revisions"
    | "diff-content"
    | "diff-blocks"
    | "icons";
}): string {
  const { name, figure = true, source = "library" } = options;
  if (
    source === "diff-revisions" ||
    source === "diff-content" ||
    source === "diff-blocks" ||
    source === "icons"
  ) {
    const { title, body } = DIFF_NOTICES[source](name);
    return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>${body}</p></div>`;
  }
  const title = figure ? NOTICE_TITLES.figure : NOTICE_TITLES.block;
  return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>表示に使用する${NOTICE_SOURCES[source]}（<code>${escapeHtml(name)}</code>）を読み込めませんでした。ネットワークにつながっているかを確認して、ページを再読み込みしてください。</p></div>`;
}
