import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { buildDictionary, findWords } from "../../knowledge/dictionary.ts";
import type { MapProblem } from "../../map/spec.ts";
import { collectMapStructure } from "../../map/structure.ts";
import { escapeHtml } from "../../parts/escape.ts";
import { mapNoteAnnotations } from "./annotations.ts";
import { outermostRanges, pairRanges } from "./blocks.ts";
import { envOf, featureOn, markOf, ownBlock } from "./tokens.ts";
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

/** 補足のマーカーの引数（`map-data:` の後ろから `-->` の前まで）の JSON の文字 */
const dataOf = (rest: string | undefined): string => (rest ?? "").trim();

/** `glossary` がオンのとき、文字に出る意味を持つ用語（エイリアスと文書の別名を除く）を、文字に出たままの用語から意味への対応にする関数 */
const termsFinder = (
  state: StateCore,
): ((text: string) => Record<string, string>) | undefined => {
  if (!featureOn(state, "glossary")) return undefined;
  const env = envOf(state);
  const dictionary = buildDictionary({
    index: env.index,
    docId: env.docId,
    ownGlossary: env.ownGlossary,
    references: env.mdmarkReferences,
    aliases: env.aliases,
    features: env.features,
  });
  if (dictionary.words.length === 0) return undefined;
  return (text) => {
    const terms: Record<string, string> = {};
    for (const found of findWords(text, dictionary.words)) {
      const term = dictionary.terms.get(found.word);
      if (term === undefined || term.alias !== undefined || term.meaning === "")
        continue;
      terms[text.slice(found.start, found.end)] = term.meaning;
    }
    return terms;
  };
};

/** 補足が参照する注記のうち定義のあるものの、注記の ID から番号への `data-map-annotations`。補足が注記を参照する範囲は、定義のある ID が無くても `{}` で付ける（描く側が定義の無い参照を警告にする）。注記の機能がオフなら付けない */
const annotationsAttr = (
  state: StateCore,
  rest: string | undefined,
): string => {
  const order = envOf(state).mdmarkAnnotations?.order;
  const referenced = mapNoteAnnotations(rest).flatMap(([, ids]) => ids);
  if (order === undefined || referenced.length === 0) return "";
  const numbers: Record<string, number> = {};
  for (const id of referenced) {
    const at = order.indexOf(id);
    if (at >= 0) numbers[id] = at + 1;
  }
  return ` data-map-annotations="${escapeHtml(JSON.stringify(numbers))}"`;
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
  const findTerms = termsFinder(state);
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
    const terms = findTerms?.(
      `${fence.content}\n${data === undefined ? "" : dataOf(markOf(data)?.rest)}`,
    );
    const termsAttr =
      terms === undefined || Object.keys(terms).length === 0
        ? ""
        : ` data-map-terms="${escapeHtml(JSON.stringify(terms))}"`;
    out.push(
      ownBlock(
        state,
        `<div class="mdmark-map" data-map="${number}" data-map-kind="${structure.kind}" data-map-args="${args}"${termsAttr}${annotationsAttr(state, data === undefined ? undefined : markOf(data)?.rest)}>`,
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
