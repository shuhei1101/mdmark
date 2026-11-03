import { iconSvg } from "./icons.ts";

/** 先頭へ戻るボタンの読み上げの名前とツールチップの文言 */
const BACK_TO_TOP_LABEL = "先頭へ戻る";

/** 先頭へ戻るボタンの HTML を返す。hidden を渡したときは `hidden` を付ける */
export function renderBackToTop(
  options: {
    /** ボタンを隠しているか */
    hidden?: boolean;
  } = {},
): string {
  const hidden = options.hidden === true ? " hidden" : "";
  return `<button class="mdmark-back-to-top" type="button" aria-label="${BACK_TO_TOP_LABEL}" title="${BACK_TO_TOP_LABEL}"${hidden}>${iconSvg("arrow-up-to-line")}</button>`;
}
