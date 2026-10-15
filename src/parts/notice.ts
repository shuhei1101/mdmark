import { escapeHtml } from "./escape.ts";

/** 知らせの枠の題: 図の印かどうかで分ける */
const NOTICE_TITLES = {
  figure: "この図を表示できません",
  block: "この箇所を表示できません",
};

/** 読めなかったものの呼び名: 外部ライブラリか拡張か */
const NOTICE_SOURCES = {
  library: "ライブラリ",
  extension: "拡張",
};

/** 外部ライブラリか拡張を読めない印の場所に置く、知らせの枠の HTML を返す */
export function renderNotice(options: {
  /** 読めなかった印の名前 */
  name: string;
  /** 図の印か（既定 `true`） */
  figure?: boolean;
  /** 読めなかったもの（既定 `library`） */
  source?: "library" | "extension";
}): string {
  const { name, figure = true, source = "library" } = options;
  const title = figure ? NOTICE_TITLES.figure : NOTICE_TITLES.block;
  return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>表示に使う${NOTICE_SOURCES[source]}（<code>${escapeHtml(name)}</code>）を読み込めませんでした。ネットワークにつながっているかを確かめて、ページを読み込み直してください。</p></div>`;
}
