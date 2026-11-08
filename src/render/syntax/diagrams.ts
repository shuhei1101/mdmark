import MarkdownIt, { type StateCore, type Token } from "markdown-it";
import {
  DIAGRAM_DIRECTIVES,
  type DiagramDirective,
  definitionWarning,
  type MdmarkChartDefinition,
  type MdmarkErDefinition,
  type MdmarkFlowDefinition,
  type MdmarkParamDefinition,
  type MdmarkSequenceDefinition,
  nodeLinkProblems,
  readDefinition,
} from "../../diagram/definition.ts";
import { buildDictionary } from "../../knowledge/dictionary.ts";
import { renderDiagram, type TermLookup } from "../../parts/diagram.ts";
import { renderParam } from "../../parts/param.ts";
import { MARK_PATTERN } from "../marks.ts";
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
  const resizable = featureOn(state, "diagram-resize");
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
      out.push(warningBlock(state, unclosedWarning(mark), token));
    }
    const result = readDefinition(
      directive,
      jsonBlocks(tokens.slice(index + 1, end)),
    );
    let definition = result.definition;
    if (!result.ok || definition === undefined) {
      out.push(
        warningBlock(state, {
          ...definitionWarning(directive, result.problems),
          kind: "diagram_invalid",
          ...(token.map ? { line: token.map[0] } : {}),
        }),
      );
    } else {
      if (directive === "flow") {
        const flow = definition as MdmarkFlowDefinition;
        const problems = nodeLinkProblems(flow);
        if (problems.length > 0) {
          out.push(
            warningBlock(state, {
              message:
                "フロー図のノードのリンク先に使えないものがあります。使えるリンク先は http・https・mailto と相対パスです。このノードはリンクにせずに描いています。",
              items: problems.map(({ id, href }) => ({
                label: id,
                message: `\`${href.replaceAll("`", "'")}\``,
              })),
              ...(token.map ? { line: token.map[0] } : {}),
            }),
          );
          const blocked = new Set(problems.map(({ id }) => id));
          definition = {
            ...flow,
            nodes: flow.nodes.map((node) => {
              if (!blocked.has(node.id)) {
                return node;
              }
              const { href: _href, ...rest } = node;
              return rest;
            }),
          };
        }
      }
      env.diagramCount = (env.diagramCount ?? 0) + 1;
      const count = env.diagramCount;
      let html: string;
      if (directive === "param") {
        const param = definition as MdmarkParamDefinition;
        env.paramDefinitions.push(param);
        html = renderParam(param, {
          id: `${PARAM_ID_PREFIX}-${count}`,
          copyLabel: env.labels?.paramCopy,
          resizable,
        });
      } else {
        html = renderDiagram({
          kind: directive,
          definition: definition as
            | MdmarkFlowDefinition
            | MdmarkSequenceDefinition
            | MdmarkChartDefinition
            | MdmarkErDefinition,
          id: `${DIAGRAM_ID_PREFIX}-${count}`,
          lookup,
          hints,
          resizable,
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

/** 点検が読む図の部品の範囲: 印の名前・開きの印の行の番号（1 から）・範囲の `json` のコードブロックの中身 */
export type DiagramBlocks = {
  directive: DiagramDirective;
  line: number;
  blocks: string[];
};

/** 生の HTML のブロックが印 1 つだけのとき、その印の名前と閉じの印か */
function blockMark(
  token: Token,
): { name: string; closing: boolean } | undefined {
  if (token.type !== "html_block") {
    return undefined;
  }
  const found = [...token.content.matchAll(MARK_PATTERN)];
  const [only] = found;
  if (
    found.length !== 1 ||
    !only ||
    token.content.replace(MARK_PATTERN, "").trim()
  ) {
    return undefined;
  }
  return { name: only[2] ?? "", closing: only[1] === "/" };
}

/** Markdown の図の部品の印の範囲ごとに、印の名前・開きの印の行の番号・`json` のコードブロックの中身を返す（`buildDiagrams` と同じ範囲の読み方。埋め込んだ HTML の中の custom element は返さない） */
export function findDiagramBlocks(markdown: string): DiagramBlocks[] {
  const tokens = new MarkdownIt({ html: true }).parse(markdown, {});
  const found: DiagramBlocks[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = token ? blockMark(token) : undefined;
    if (
      !token ||
      !mark ||
      mark.closing ||
      !Object.hasOwn(DIAGRAM_DIRECTIVES, mark.name)
    ) {
      continue;
    }
    let end = tokens.length;
    for (let next = index + 1; next < tokens.length; next++) {
      const candidate = tokens[next];
      const close = candidate ? blockMark(candidate) : undefined;
      if (
        close?.closing &&
        close.name === mark.name &&
        candidate?.level === token.level
      ) {
        end = next;
        break;
      }
    }
    found.push({
      directive: mark.name as DiagramDirective,
      line: (token.map?.[0] ?? 0) + 1,
      blocks: jsonBlocks(tokens.slice(index + 1, end)).map((block) =>
        block.replace(/\n$/, ""),
      ),
    });
    index = end;
  }
  return found;
}
