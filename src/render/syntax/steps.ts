import type { StateCore, Token } from "markdown-it";
import { renderCollapsible } from "../../parts/collapsible.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import type { Mark } from "../marks.ts";
import { type CollapseMode, readCollapse } from "./collapse.ts";
import { envOf, featureOn, findClose, markOf, ownBlock } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** ステップのマーカーの設定の `collapse` を読み込む */
export function readStepsOptions(mark: Mark): {
  collapse: CollapseMode;
  title?: string | undefined;
} {
  const { collapse, title } = readCollapse(mark.options);
  return { collapse, ...(title === undefined ? {} : { title }) };
}

/** 入れ子を除く、手順の `ol` の項目の数を数える */
function itemCount(tokens: Token[], listOpen: number): number {
  const level = tokens[listOpen]?.level ?? 0;
  let count = 0;
  for (let index = listOpen + 1; index < tokens.length; index++) {
    const token = tokens[index];
    if (token?.type === "ordered_list_close" && token.level === level) {
      break;
    }
    if (token?.type === "list_item_open" && token.level === level + 1) {
      count += 1;
    }
  }
  return count;
}

/** steps の開きのマーカー 1 つの範囲の手順のリストに class を付け、折り畳みに入れ、次に読むトークンの 1 つ前の位置を返却する */
function buildStepsAt(
  state: StateCore,
  range: { index: number; mark: Mark; out: Token[] },
): number {
  const { index, mark, out } = range;
  const tokens = state.tokens;
  const token = tokens[index];
  const { collapse, title } = readStepsOptions(mark);
  const closeIndex = findClose(tokens, index, "steps");
  const end = closeIndex < 0 ? tokens.length : closeIndex;
  if (closeIndex < 0) {
    out.push(warningBlock(state, unclosedWarning(mark), token));
  }
  const listIndex = tokens
    .slice(index + 1, end)
    .findIndex((candidate) => candidate.type === "ordered_list_open");
  if (listIndex < 0) {
    out.push(
      warningBlock(
        state,
        {
          message:
            "`<!-- steps -->` の範囲に、手順にする番号付きリストがありません。手順を `1.` から始まる番号付きリストで記載してください。範囲の中身はそのまま描いています。",
        },
        token,
      ),
    );
    return index;
  }
  const listStart = index + 1 + listIndex;
  const list = tokens[listStart] as Token;
  list.attrJoin("class", "mdmark-steps");
  list.attrSet("data-mdmark-own", envOf(state).nonce);
  if (collapse === "none") {
    return index;
  }
  // 手順の前後に折り畳みの開きと閉じを差し込む（リストの前までを出し終えてから）
  const listClose = tokens.findIndex(
    (candidate, position) =>
      position > listStart &&
      candidate.type === "ordered_list_close" &&
      candidate.level === list.level,
  );
  const [head = "", tail = ""] = renderCollapsible({
    title: title ?? `手順（${itemCount(tokens, listStart)} ステップ）`,
    open: collapse === "open",
    body: SLOT_MARKER,
  }).split(SLOT_MARKER);
  out.push(...tokens.slice(index + 1, listStart));
  out.push(ownBlock(state, head));
  out.push(...tokens.slice(listStart, listClose + 1));
  out.push(ownBlock(state, tail));
  return listClose;
}

/** `steps` がオンなら、`steps` の範囲の最初の番号付きリスト（入れ子は除く）の `ol` に class `mdmark-steps` を付ける。`closed`・`open` なら折り畳みに入れる。読み込めない指定と、番号付きリストが無いときは警告を差し込む */
export function buildSteps(state: StateCore): void {
  if (!featureOn(state, "steps")) {
    return;
  }
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
    index = buildStepsAt(state, { index, mark, out });
  }
  state.tokens = out;
}
