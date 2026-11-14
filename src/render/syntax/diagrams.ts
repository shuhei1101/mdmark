import MarkdownIt, { type StateCore, type Token } from "markdown-it";
import {
  DIAGRAM_DIRECTIVES,
  type DiagramDirective,
  definitionWarning,
  type MdmarkChartDefinition,
  type MdmarkErDefinition,
  type MdmarkParamDefinition,
  RETIRED_DIAGRAM_DIRECTIVES,
  type RetiredDiagramDirective,
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

/** 図の部品の `html_block` に付ける `meta` のマーカー（図表の番号の対象にする） */
export const DIAGRAM_META = "diagram";

/** 操作できる部品を持つ `html_block` の `meta` に、持つ数を記載するキー（文書の中の並びを数えるのに使用する） */
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

/** 廃止した図の範囲の記載の警告の本文 */
export function retiredDiagramMessage(
  directive: RetiredDiagramDirective,
): string {
  return `\`<!-- ${directive} -->\` の図の記載方法は廃止しました。\`mdmark upgrade\` を実行すると、map の範囲（Mermaid と補足）へ書き換えます。この図は描いていません。`;
}

/** 埋め込んだ HTML の中の廃止した図の要素（`<mdmark-flow>`・`<mdmark-sequence>`）の記載の警告の本文 */
export function retiredElementMessage(
  directive: RetiredDiagramDirective,
): string {
  return `\`<mdmark-${directive}>\` の要素は廃止しました。埋め込んだ HTML の外に \`<!-- map -->\` の範囲で記載し直してください。この図は描いていません。`;
}

/** 廃止した図の部品のマーカーの名前か */
export function isRetiredDiagram(
  name: string,
): name is RetiredDiagramDirective {
  return (RETIRED_DIAGRAM_DIRECTIVES as readonly string[]).includes(name);
}

/** 拡張に無い廃止した図の範囲を、範囲の中身ごと廃止した図の記載の警告に置き換える（機能 `diagrams` のオン・オフによらない） */
function replaceRetiredDiagrams(state: StateCore): void {
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    if (!token || !mark || mark.closing || !isRetiredDiagram(mark.name)) {
      if (token) {
        out.push(token);
      }
      continue;
    }
    const closeIndex = findClose(tokens, index, mark.name);
    out.push(
      warningBlock(state, {
        message: retiredDiagramMessage(mark.name),
        kind: "retired_diagram",
        ...(token.map ? { line: token.map[0] } : {}),
      }),
    );
    index = closeIndex < 0 ? tokens.length : closeIndex;
  }
  state.tokens = out;
}

/** 拡張に無い廃止した図の範囲を記載の警告にする。`diagrams` がオンなら、図の部品のマーカーの範囲の `json` のコードブロックを定義として読み込み、図か操作できる部品の HTML にする。読み込めない定義は記載の警告にする。範囲の中身は出力に残さない。オフのときはマーカーだけを取り除く */
export function buildDiagrams(state: StateCore): void {
  replaceRetiredDiagrams(state);
  if (!featureOn(state, "diagrams")) {
    return;
  }
  const env = envOf(state);
  // ノードの中の `{{単語}}` の意味は、本文の用語と同じ辞書から参照する
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
    const definition = result.definition;
    if (!result.ok || definition === undefined) {
      out.push(
        warningBlock(state, {
          ...definitionWarning(directive, result.problems),
          kind: "diagram_invalid",
          ...(token.map ? { line: token.map[0] } : {}),
        }),
      );
    } else {
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
          definition: definition as MdmarkChartDefinition | MdmarkErDefinition,
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

/** 点検と移行の手順が読み込む図の部品の範囲: マーカーの名前・開きと閉じのマーカーの行の番号（1 から。閉じが無ければ文書の最後の行）・範囲の `json` のコードブロックの中身 */
export type DiagramBlocks = {
  directive: DiagramDirective | RetiredDiagramDirective;
  line: number;
  end: number;
  blocks: string[];
};

/** 生の HTML のブロックがマーカー 1 つだけのとき、そのマーカーの名前と閉じのマーカーか */
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

/** Markdown の図の部品のマーカーと廃止した図の部品のマーカーの範囲ごとに、マーカーの名前・開きと閉じのマーカーの行の番号・`json` のコードブロックの中身を返却する（`buildDiagrams` と同じ範囲の読み込み方。埋め込んだ HTML の中の custom element は返却しない） */
export function findDiagramBlocks(markdown: string): DiagramBlocks[] {
  const tokens = new MarkdownIt({ html: true }).parse(markdown, {});
  const lines = markdown.split("\n");
  const lastLine = lines.at(-1) === "" ? lines.length - 1 : lines.length;
  const found: DiagramBlocks[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = token ? blockMark(token) : undefined;
    if (
      !token ||
      !mark ||
      mark.closing ||
      !(
        Object.hasOwn(DIAGRAM_DIRECTIVES, mark.name) ||
        isRetiredDiagram(mark.name)
      )
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
    const closeToken = tokens[end];
    found.push({
      directive: mark.name as DiagramDirective | RetiredDiagramDirective,
      line: (token.map?.[0] ?? 0) + 1,
      end: closeToken?.map ? closeToken.map[0] + 1 : lastLine,
      blocks: jsonBlocks(tokens.slice(index + 1, end)).map((block) =>
        block.replace(/\n$/, ""),
      ),
    });
    index = end;
  }
  return found;
}
