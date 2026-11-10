import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { MapProblem } from "../../map/spec.ts";
import { collectMapStructure } from "../../map/structure.ts";
import { escapeHtml } from "../../parts/escape.ts";
import { outermostRanges, pairRanges } from "./blocks.ts";
import { featureOn, markOf, ownBlock } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** map の範囲のマーカーと、補足のマーカーの名前 */
const MAP_MARK = "map";
const DATA_MARK = "map-data";

/** 範囲の中の mermaid のコードブロックに付け、mermaid のライブラリで描くコードブロックの対象から外す印 */
export const MAP_SOURCE_META = "mdmarkMapSource";

/** 書き方の誤りの項目を、記載の警告の項目にする */
export const mapWarningItems = (problems: MapProblem[]): WarningItem[] =>
  problems.map((problem) => ({ label: "", message: problem.message }));

const isMermaid = (token: Token) =>
  token.type === "fence" && token.info.trim().split(/\s+/)[0] === "mermaid";

/** 補足のマーカーの引数から、1 行目（`format=yaml`）を除いた YAML を取り出す */
const dataOf = (rest: string | undefined): string => {
  const text = rest ?? "";
  const newline = text.indexOf("\n");
  return newline < 0 ? "" : text.slice(newline + 1);
};

/** `map` がオンのとき、`<!-- map -->` 〜 `<!-- /map -->` の範囲を div.mdmark-map にし、範囲の形の誤りを記載の警告にする。オフのときはマーカーと補足を取り除き、mermaid のブロックを普通のコードブロックとして残す */
export const buildMapRanges = (state: StateCore): void => {
  const tokens = state.tokens;
  if (!featureOn(state, MAP_MARK)) {
    state.tokens = tokens.filter((token) => {
      const mark = markOf(token);
      return mark?.name !== MAP_MARK && mark?.name !== DATA_MARK;
    });
    return;
  }
  const ranges = outermostRanges(pairRanges(tokens, MAP_MARK), tokens.length);
  const out: Token[] = [];
  let cursor = 0;
  let number = 0;
  for (const { open, close } of ranges) {
    out.push(...tokens.slice(cursor, open));
    const openToken = tokens[open] as Token;
    const mark = markOf(openToken);
    if (close === -1 || mark === undefined) {
      if (mark) out.push(warningBlock(state, unclosedWarning(mark), openToken));
      cursor = open + 1;
      continue;
    }
    number += 1;
    const inner = tokens.slice(open + 1, close);
    const fences = inner.filter(isMermaid);
    const datas = inner.filter((token) => markOf(token)?.name === DATA_MARK);
    const fence = fences[0];
    const data = datas[0];
    const structure = collectMapStructure({
      args: mark.rest ?? "",
      mermaid: fence?.content,
      mermaidCount: fences.length,
      dataCount: datas.length,
    });
    if (structure.problems.length > 0) {
      const warning = warningBlock(
        state,
        {
          mark: mark.raw,
          message: "の範囲の書き方に誤りがあります。読めた分で描いています。",
          items: mapWarningItems(structure.problems),
          kind: "map",
        },
        openToken,
      );
      warning.meta = {
        ...(warning.meta ?? {}),
        mapProblems: structure.problems,
      };
      out.push(warning);
    }
    if (structure.kind === undefined || fence === undefined) {
      // 描かない範囲は、範囲の中の mermaid のブロックをソースのコードブロックとして残す
      for (const token of inner) {
        if (markOf(token)?.name === DATA_MARK) continue;
        if (isMermaid(token))
          token.meta = { ...(token.meta ?? {}), [MAP_SOURCE_META]: true };
        out.push(token);
      }
      cursor = close + 1;
      continue;
    }
    fence.meta = { ...(fence.meta ?? {}), [MAP_SOURCE_META]: true };
    const args = escapeHtml(structure.args.normalized);
    out.push(
      ownBlock(
        state,
        `<div class="mdmark-map" data-map="${number}" data-map-kind="${structure.kind}" data-map-args="${args}">`,
        openToken,
      ),
    );
    out.push(fence);
    if (data) {
      out.push(
        ownBlock(
          state,
          `<pre class="mdmark-map-data" hidden>${escapeHtml(dataOf(markOf(data)?.rest))}</pre>`,
          data,
        ),
      );
    }
    out.push(ownBlock(state, "</div>", tokens[close]));
    cursor = close + 1;
  }
  out.push(...tokens.slice(cursor));
  state.tokens = out;
};
