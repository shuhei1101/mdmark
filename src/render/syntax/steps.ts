import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { renderCollapsible } from "../../parts/collapsible.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import type { Mark } from "../marks.ts";
import { type CollapseMode, readCollapse } from "./collapse.ts";
import { envOf, featureOn, findClose, markOf, ownBlock } from "./tokens.ts";
import {
  type SyntaxWarning,
  unclosedWarning,
  warningBlock,
} from "./warnings.ts";

/** ステップの印の引数から折り畳みの指定を読み、読めない指定を 1 つの書き方の警告にまとめる */
export function readStepsOptions(mark: Mark): {
  collapse: CollapseMode;
  title?: string | undefined;
  warning?: SyntaxWarning;
} {
  const {
    collapse,
    title,
    items: collapseItems,
    rest,
  } = readCollapse(mark.args);
  const items: WarningItem[] = [...collapseItems];
  for (const key of Object.keys(rest.keys)) {
    items.push({
      label: `${key}=`,
      message:
        "使えないキーです。使えるキーは `title=` です。`closed`・`open` と一緒に書きます",
    });
  }
  // `キー=値` の形でない指定
  for (const arg of rest.args) {
    items.push({
      label: arg,
      message:
        "使えない指定です。使える指定は `closed`・`open`・`title=見出し` です",
    });
  }
  if (items.length === 0) {
    return { collapse, title };
  }
  return {
    collapse,
    title,
    warning: {
      mark: mark.raw,
      message: "の読めない指定を当てずに描いています。",
      items,
    },
  };
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

/** `steps` がオンなら、`steps` の範囲の最初の番号付きリスト（入れ子は除く）の `ol` に class `mdmark-steps` を付ける。`closed`・`open` なら折り畳みに入れる。読めない指定と、番号付きリストが無いときは警告を差し込む */
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
    const { collapse, title, warning } = readStepsOptions(mark);
    if (warning) {
      out.push(warningBlock(state, warning));
    }
    const closeIndex = findClose(tokens, index, "steps");
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    if (closeIndex < 0) {
      out.push(warningBlock(state, unclosedWarning(mark)));
    }
    const listIndex = tokens
      .slice(index + 1, end)
      .findIndex((candidate) => candidate.type === "ordered_list_open");
    if (listIndex < 0) {
      out.push(
        warningBlock(state, {
          message:
            "`<!-- steps -->` の範囲に、手順にする番号付きリストがありません。手順を `1.` から始まる番号付きリストで書いてください。範囲の中身はそのまま描いています。",
        }),
      );
      continue;
    }
    const list = tokens[index + 1 + listIndex] as Token;
    list.attrJoin("class", "mdmark-steps");
    list.attrSet("data-mdmark-own", nonce);
    if (collapse === "none") {
      continue;
    }
    // 手順の前後に折り畳みの開きと閉じを差し込む（リストの前までを出し終えてから）
    const listStart = index + 1 + listIndex;
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
    index = listClose;
  }
  state.tokens = out;
}
