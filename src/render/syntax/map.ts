import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { buildDictionary, findWords } from "../../knowledge/dictionary.ts";
import type { MapProblem } from "../../map/spec.ts";
import { collectMapStructure, plainMapSourceOf } from "../../map/structure.ts";
import { mermaidKindName, splitMermaidTitle } from "../../mermaid-source.ts";
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

/** 範囲の形の読み込みの結果 */
type MapStructure = ReturnType<typeof collectMapStructure>;

/** 範囲の形の誤りを、開きのマーカーの場所の記載の警告にする */
const structureWarning = (
  state: StateCore,
  openToken: Token,
  problems: MapProblem[],
): Token => {
  const mark = markOf(openToken);
  const warning = warningBlock(
    state,
    {
      mark: mark?.raw ?? "",
      message: "の範囲の書き方に誤りがあります。読めた分で描いています。",
      items: mapWarningItems(problems),
      kind: "map",
    },
    openToken,
  );
  warning.meta = { ...(warning.meta ?? {}), mapProblems: problems };
  return warning;
};

/** 描かない範囲の中身から補足を除き、mermaid のブロックをソースのコードブロックとして残す */
const sourceTokens = (inner: Token[]): Token[] =>
  inner.flatMap((token) => {
    if (markOf(token)?.name === DATA_MARK) return [];
    if (isMermaid(token))
      token.meta = { ...(token.meta ?? {}), [MAP_SOURCE_META]: true };
    return [token];
  });

/** 文字に出る意味を持つ用語の `data-map-terms`。用語が無ければ付けない */
const termsAttrOf = (terms: Record<string, string> | undefined): string =>
  terms === undefined || Object.keys(terms).length === 0
    ? ""
    : ` data-map-terms="${escapeHtml(JSON.stringify(terms))}"`;

/** 描く範囲を、div.mdmark-map・mermaid のブロック・補足の pre のトークンにする */
const drawnTokens = (
  state: StateCore,
  range: {
    openToken: Token;
    closeToken: Token | undefined;
    fence: Token;
    data: Token | undefined;
    structure: MapStructure;
    number: number;
  },
  findTerms: ((text: string) => Record<string, string>) | undefined,
): Token[] => {
  const { openToken, closeToken, fence, data, structure, number } = range;
  fence.meta = { ...(fence.meta ?? {}), [MAP_SOURCE_META]: true };
  const args = escapeHtml(structure.args.normalized);
  const rest = data === undefined ? undefined : markOf(data)?.rest;
  const terms = findTerms?.(
    `${fence.content}\n${data === undefined ? "" : dataOf(rest)}`,
  );
  const out = [
    ownBlock(
      state,
      `<div class="mdmark-map" data-map="${number}" data-map-kind="${structure.kind}" data-map-args="${args}"${termsAttrOf(terms)}${annotationsAttr(state, rest)}>`,
      openToken,
    ),
    fence,
  ];
  if (data) {
    out.push(
      ownBlock(
        state,
        `<pre class="mdmark-map-data" hidden>${escapeHtml(dataOf(rest))}</pre>`,
        data,
      ),
    );
  }
  out.push(ownBlock(state, "</div>", closeToken));
  return out;
};

/** 閉じた範囲 1 つを、範囲の形の誤りの警告と、描いた範囲か描かない範囲の中身のトークンにする */
const mapRangeTokens = (
  state: StateCore,
  range: { openToken: Token; inner: Token[]; closeToken: Token | undefined },
  draw: {
    number: number;
    findTerms: ((text: string) => Record<string, string>) | undefined;
  },
): Token[] => {
  const { openToken, inner, closeToken } = range;
  const mark = markOf(openToken);
  const fences = inner.filter(isMermaid);
  const datas = inner.filter((token) => markOf(token)?.name === DATA_MARK);
  const fence = fences[0];
  const structure = collectMapStructure({
    args: mark?.rest ?? "",
    mermaid: fence?.content,
    mermaidCount: fences.length,
    dataCount: datas.length,
  });
  const out =
    structure.problems.length > 0
      ? [structureWarning(state, openToken, structure.problems)]
      : [];
  if (structure.kind === undefined || fence === undefined) {
    return [...out, ...sourceTokens(inner)];
  }
  return [
    ...out,
    ...drawnTokens(
      state,
      {
        openToken,
        closeToken,
        fence,
        data: datas[0],
        structure,
        number: draw.number,
      },
      draw.findTerms,
    ),
  ];
};

/** 範囲の外の mermaid のコードブロック 1 つを、補足の無い範囲の div.mdmark-map で囲んだトークンにする。範囲の外の map の図にしないコードブロックは `undefined` */
const plainMapTokens = (
  state: StateCore,
  fence: Token,
  draw: {
    number: number;
    findTerms: ((text: string) => Record<string, string>) | undefined;
  },
): Token[] | undefined => {
  const plain = plainMapSourceOf(fence.content);
  if (plain === undefined) return undefined;
  const title =
    plain.title ?? mermaidKindName(splitMermaidTitle(fence.content).kind);
  fence.content = plain.body;
  fence.meta = { ...(fence.meta ?? {}), [MAP_SOURCE_META]: true };
  const args = escapeHtml(JSON.stringify({ title }));
  const terms = draw.findTerms?.(plain.body);
  const front =
    plain.frontMatter === undefined
      ? ""
      : ` data-map-front-matter="${escapeHtml(plain.frontMatter)}"`;
  return [
    ownBlock(
      state,
      `<div class="mdmark-map" data-map="${draw.number}" data-map-kind="${plain.kind}" data-map-args="${args}" data-map-plain${front}${termsAttrOf(terms)}>`,
      fence,
    ),
    fence,
    ownBlock(state, "</div>", fence),
  ];
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
  const plainOn = featureOn(state, "mermaid");
  /** 範囲の外のトークンを、範囲の外の map の図にする mermaid のコードブロックを囲んで足す */
  const pushOutside = (outside: Token[]): void => {
    for (const token of outside) {
      const drawn =
        plainOn && isMermaid(token)
          ? plainMapTokens(state, token, { number: number + 1, findTerms })
          : undefined;
      if (drawn === undefined) {
        out.push(token);
        continue;
      }
      number += 1;
      out.push(...drawn);
    }
  };
  for (const { open, close } of ranges) {
    pushOutside(tokens.slice(cursor, open));
    const openToken = tokens[open] as Token;
    const mark = markOf(openToken);
    if (close === -1 || mark === undefined) {
      if (mark) out.push(warningBlock(state, unclosedWarning(mark), openToken));
      cursor = open + 1;
      continue;
    }
    number += 1;
    out.push(
      ...mapRangeTokens(
        state,
        {
          openToken,
          inner: tokens.slice(open + 1, close),
          closeToken: tokens[close],
        },
        { number, findTerms },
      ),
    );
    cursor = close + 1;
  }
  pushOutside(tokens.slice(cursor));
  state.tokens = out;
};
