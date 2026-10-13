import { escapeHtml } from "./escape.ts";

/** 知らせの枠の題: 図の印かどうかで分ける */
const NOTICE_TITLES = {
  figure: "この図を表示できません",
  block: "この箇所を表示できません",
};

/** 外部ライブラリを読めない印の場所に置く、知らせの枠の HTML を返す */
export function renderNotice(options: {
  /** 読めなかった印の名前 */
  name: string;
  /** 図の印か（既定 `true`） */
  figure?: boolean;
}): string {
  const { name, figure = true } = options;
  const title = figure ? NOTICE_TITLES.figure : NOTICE_TITLES.block;
  return `<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">${title}</strong><p>表示に使うライブラリ（<code>${escapeHtml(name)}</code>）を読み込めませんでした。ネットワークにつながっているかを確かめて、ページを読み込み直してください。</p></div>`;
}
