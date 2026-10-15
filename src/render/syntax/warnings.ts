import type { StateCore } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { renderSyntaxWarning } from "../../parts/syntax-warning.ts";
import type { Mark } from "../marks.ts";
import { ownBlock } from "./tokens.ts";

/** 書き方の警告に渡す値 */
export type SyntaxWarning = {
  /** 読めない指定を書いた印の文字 */
  mark?: string;
  /** 本文 */
  message: string;
  /** 項目 */
  items?: WarningItem[];
};

/** 書き方の警告の HTML に印を掛けて `html_block` にし、`index` の位置に差し込む */
export function pushWarning(
  state: StateCore,
  index: number,
  warning: SyntaxWarning,
): void {
  state.tokens.splice(index, 0, ownBlock(state, renderSyntaxWarning(warning)));
}

/** 書き方の警告の `html_block` を作る（差し込む位置を呼ぶ側が決めるとき） */
export function warningBlock(state: StateCore, warning: SyntaxWarning) {
  return ownBlock(state, renderSyntaxWarning(warning));
}

/** 範囲の印に閉じの印が無いときの警告 */
export function unclosedWarning(mark: Mark): SyntaxWarning {
  return {
    mark: mark.raw,
    message: `の閉じの印 \`<!-- /${mark.name} -->\` がありません。範囲の終わりに閉じの印を書いてください。印から文書の終わりまでを範囲にして描いています。`,
  };
}
