import type { StateCore, Token } from "markdown-it";
import { envOf, featureOn, findClose, markOf } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** `steps` がオンなら、`steps` の範囲の最初の番号付きリスト（入れ子は除く）の `ol` に class `mdmark-steps` を付ける。無ければ警告を差し込む */
export function buildSteps(state: StateCore): void {
  if (!featureOn(state, "steps")) {
    return;
  }
  const nonce = envOf(state).nonce;
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token) {
      out.push(token);
    }
    const mark = markOf(token);
    if (mark?.name !== "steps" || mark.closing) {
      continue;
    }
    const closeIndex = findClose(tokens, index, "steps");
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    if (closeIndex < 0) {
      out.push(warningBlock(state, unclosedWarning(mark)));
    }
    const list = tokens
      .slice(index + 1, end)
      .find((candidate) => candidate.type === "ordered_list_open");
    if (list) {
      list.attrJoin("class", "mdmark-steps");
      list.attrSet("data-mdmark-own", nonce);
    } else {
      out.push(
        warningBlock(state, {
          message:
            "`<!-- steps -->` の範囲に、手順にする番号付きリストがありません。手順を `1.` から始まる番号付きリストで書いてください。範囲の中身はそのまま描いています。",
        }),
      );
    }
  }
  state.tokens = out;
}
