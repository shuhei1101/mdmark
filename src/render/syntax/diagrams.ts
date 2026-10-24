import type { StateCore, Token } from "markdown-it";
import {
  DIAGRAM_DIRECTIVES,
  type DiagramDirective,
  definitionWarning,
  type MdmarkChartDefinition,
  type MdmarkFlowDefinition,
  type MdmarkParamDefinition,
  type MdmarkSequenceDefinition,
  readDefinition,
} from "../../diagram/definition.ts";
import { buildDictionary } from "../../knowledge/dictionary.ts";
import { renderDiagram, type TermLookup } from "../../parts/diagram.ts";
import { renderParam } from "../../parts/param.ts";
import { envOf, featureOn, findClose, markOf, ownBlock } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** 図の `id` の頭 */
const DIAGRAM_ID_PREFIX = "mdmark-diagram";

/** 操作できる部品の `id` の頭 */
const PARAM_ID_PREFIX = "mdmark-param";

/** 図の部品の `html_block` に付ける `meta` の印（図表の番号の対象にする） */
export const DIAGRAM_META = "diagram";

/** 操作できる部品を持つ `html_block` の `meta` に、持つ数を書くキー（文書の中の並びを数えるのに使う） */
export const PARAM_COUNT_META = "params";

/** 範囲の言語 `json` のコードブロック */
export function jsonFences(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) =>
      token.type === "fence" && token.info.trim().split(/\s+/)[0] === "json",
  );
}

/** 範囲の言語 `json` のコードブロックの中身 */
function jsonBlocks(tokens: Token[]): string[] {
  return jsonFences(tokens).map((token) => token.content);
}

/** `diagrams` がオンなら、図の部品の印の範囲の `json` のコードブロックを定義として読み、図か操作できる部品の HTML にする。読めない定義は書き方の警告にする。範囲の中身は出力に残さない。オフのときは印だけを取り除く */
export function buildDiagrams(state: StateCore): void {
  if (!featureOn(state, "diagrams")) {
    return;
  }
  const env = envOf(state);
  // 箱の中の `{{語}}` の意味は、本文の用語と同じ辞書から引く
  const dictionary = buildDictionary({
    index: env.index,
    docId: env.docId,
    ownGlossary: env.ownGlossary,
    references: env.mdmarkReferences,
    features: env.features,
  });
  const lookup: TermLookup = (word) => dictionary.term(word)?.meaning;
  env.paramDefinitions ??= [];
  const hints = featureOn(state, "hints");
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    if (
      !token ||
      !mark ||
      mark.closing ||
      !Object.hasOwn(DIAGRAM_DIRECTIVES, mark.name)
    ) {
      if (token) {
        out.push(token);
      }
      continue;
    }
    const directive = mark.name as DiagramDirective;
    const closeIndex = findClose(tokens, index, mark.name);
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    if (closeIndex < 0) {
      out.push(warningBlock(state, unclosedWarning(mark)));
    }
    const result = readDefinition(
      directive,
      jsonBlocks(tokens.slice(index + 1, end)),
    );
    const definition = result.definition;
    if (!result.ok || definition === undefined) {
      out.push(
        warningBlock(state, definitionWarning(directive, result.problems)),
      );
    } else {
      env.diagramCount = (env.diagramCount ?? 0) + 1;
      const count = env.diagramCount;
      let html: string;
      if (directive === "param") {
        const param = definition as MdmarkParamDefinition;
        env.paramDefinitions.push(param);
        html = renderParam(param, { id: `${PARAM_ID_PREFIX}-${count}` });
      } else {
        html = renderDiagram({
          kind: directive,
          definition: definition as
            | MdmarkFlowDefinition
            | MdmarkSequenceDefinition
            | MdmarkChartDefinition,
          id: `${DIAGRAM_ID_PREFIX}-${count}`,
          lookup,
          hints,
        });
      }
      const block = ownBlock(state, html, token);
      block.meta = {
        [DIAGRAM_META]: true,
        [PARAM_COUNT_META]: directive === "param" ? 1 : 0,
      };
      out.push(block);
    }
    index = end;
  }
  state.tokens = out;
}
