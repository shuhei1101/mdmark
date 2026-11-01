import type { StateCore, Token } from "markdown-it";
import {
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
import { renderEmbeddedHtml } from "../../parts/embedded-html.ts";
import { escapeHtml } from "../../parts/escape.ts";
import { renderHintMarkup } from "../../parts/hint.ts";
import { markOwn, SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import { renderParam } from "../../parts/param.ts";
import { renderSyntaxWarning } from "../../parts/syntax-warning.ts";
import type { RenderEnv } from "../parser.ts";
import {
  EMBED_PART_ATTRIBUTE,
  EMBED_PART_TAG,
  sanitizeEmbedded,
} from "../sanitize.ts";
import { PARAM_COUNT_META } from "./diagrams.ts";
import { type SeenTerms, termSegments } from "./terms.ts";
import { envOf, featureOn, findClose, markOf } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** 埋め込んだ HTML の中の図の部品の `id` の頭（範囲の印の図と通し番号を共有する） */
const DIAGRAM_ID_PREFIX = "mdmark-diagram";

/** 埋め込んだ HTML の中の操作できる部品の `id` の頭 */
const PARAM_ID_PREFIX = "mdmark-param";

/** ヒントのツールチップの `id` の頭 */
const HINT_ID_PREFIX = "mdmark-hint-";

/** 埋め込んだ HTML の中の図の部品の custom element と、その中の定義の文字 */
export const PART_PATTERN =
  /<mdmark-(flow|sequence|chart|param)\b[^>]*>([\s\S]*?)<\/mdmark-\1\s*>/gi;

/** 中身を持たない要素 */
const VOID_TAGS = new Set(["img", "br", "hr", "input", "wbr"]);

/** 範囲の言語 `html` のコードブロックか */
export function isHtmlFence(token: Token): boolean {
  return token.type === "fence" && token.info.trim().split(/\s+/)[0] === "html";
}

/** sanitize-html が逃がした文字（`&amp;`・`&lt;`・`&gt;`・`&quot;`）を文字に戻す */
export function unescapeHtml(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

/** 範囲の書き方の警告。範囲の中身はそのまま描く */
function blockCountWarning(): { message: string } {
  return {
    message:
      "`<!-- html -->` の範囲に `html` のコードブロックを 1 つだけ置いてください。範囲の中身はそのまま描いています。",
  };
}

/** コードブロックの HTML の中の図の部品の custom element を、図の部品の HTML に置き換える準備: 要素の場所に印の要素を置き、図の部品の HTML を並べて返す */
function takeParts(options: {
  source: string;
  state: StateCore;
  /** この範囲の前にある操作できる部品の数（文書の中の並びで定義を差し込む位置） */
  paramsBefore: number;
  lookup: TermLookup;
}): { html: string; parts: string[]; params: number } {
  const { source, state, paramsBefore, lookup } = options;
  const env = envOf(state);
  const diagrams = featureOn(state, "diagrams");
  const hints = featureOn(state, "hints");
  const parts: string[] = [];
  const definitions: MdmarkParamDefinition[] = [];
  const html = source.replace(
    PART_PATTERN,
    (_match: string, name: string, text: string): string => {
      // 図の部品の機能がオフなら、要素を中身ごと落とす
      if (!diagrams) {
        return "";
      }
      const directive = name.toLowerCase() as DiagramDirective;
      const result = readDefinition(directive, [text.trim()]);
      const definition = result.definition;
      let part: string;
      if (!result.ok || definition === undefined) {
        part = markOwn(
          renderSyntaxWarning(definitionWarning(directive, result.problems)),
          env.nonce,
        );
      } else {
        env.diagramCount = (env.diagramCount ?? 0) + 1;
        const count = env.diagramCount;
        if (directive === "param") {
          const param = definition as MdmarkParamDefinition;
          definitions.push(param);
          part = renderParam(param, {
            id: `${PARAM_ID_PREFIX}-${count}`,
            copyLabel: env.labels?.paramCopy,
          });
        } else {
          part = renderDiagram({
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
        part = markOwn(part, env.nonce);
      }
      parts.push(part);
      return `<${EMBED_PART_TAG} ${EMBED_PART_ATTRIBUTE}="${env.nonce}:${parts.length - 1}"></${EMBED_PART_TAG}>`;
    },
  );
  // 操作できる部品の定義は、文書の中の並びの位置へ差し込む（`attachParams` が並びで引く）
  env.paramDefinitions ??= [];
  env.paramDefinitions.splice(paramsBefore, 0, ...definitions);
  return { html, parts, params: definitions.length };
}

/** 預けた印の要素を、図の部品の HTML に戻す。戻せなかった印の要素（書いた人が似せて書いたもの）は取り除く */
function restoreParts(html: string, parts: string[], nonce: string): string {
  const tag = EMBED_PART_TAG;
  let restored = html;
  parts.forEach((part, index) => {
    const pattern = new RegExp(
      `<${tag}[^>]*${EMBED_PART_ATTRIBUTE}="${nonce}:${index}"[^>]*></${tag}>`,
    );
    restored = restored.replace(pattern, () => part);
  });
  return restored.replace(new RegExp(`</?${tag}[^>]*>`, "g"), "");
}

/** `data-hint` を持つ要素に印・下線・ツールチップの中身を付ける。`hints` がオフなら `data-hint` を消す。入力は `sanitizeEmbedded` の出力で、タグは閉じてある */
function applyHints(options: {
  html: string;
  env: RenderEnv;
  hints: boolean;
}): string {
  const { html, env, hints } = options;
  const tag = /<(\/?)([a-z][a-z0-9-]*)\b([^>]*?)(\/?)>/gi;
  const hintAttribute = /\sdata-hint="([^"]*)"/;
  /** 閉じタグの前と後ろに置く HTML を持った、開いている要素 */
  type Open = { name: string; inside: string; after: string };
  const stack: Open[] = [];
  let out = "";
  let last = 0;
  for (const match of html.matchAll(tag)) {
    out += html.slice(last, match.index);
    last = match.index + match[0].length;
    const [raw, closing = "", rawName = "", attributes = "", selfClosing = ""] =
      match;
    const name = rawName.toLowerCase();
    if (closing === "/") {
      const open = stack.pop();
      out += `${open?.inside ?? ""}${raw}${open?.after ?? ""}`;
      continue;
    }
    const found = hintAttribute.exec(attributes);
    if (found === null) {
      out += raw;
      if (selfClosing === "" && !VOID_TAGS.has(name)) {
        stack.push({ name, inside: "", after: "" });
      }
      continue;
    }
    if (!hints) {
      out += raw.replace(hintAttribute, "");
      if (selfClosing === "" && !VOID_TAGS.has(name)) {
        stack.push({ name, inside: "", after: "" });
      }
      continue;
    }
    env.hintCount = (env.hintCount ?? 0) + 1;
    const markup = renderHintMarkup({
      tag: name,
      text: unescapeHtml(found[1] ?? ""),
      id: `${HINT_ID_PREFIX}${env.hintCount}`,
    });
    const added = Object.entries(markup.attributes)
      .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
      .join("");
    const start = `<${rawName}${attributes}${added}${selfClosing === "/" ? " /" : ""}>`;
    if (selfClosing === "/" || VOID_TAGS.has(name)) {
      out += `${start}${markup.after}`;
    } else {
      out += start;
      stack.push({ name, inside: markup.inside, after: markup.after });
    }
  }
  return out + html.slice(last);
}

/** 中の文字の用語に下線を引く関数を作る。`glossary` と `backlinks` が両方オフ・辞書が空なら、文字のままにする */
function termsFilter(state: StateCore): (text: string) => string {
  const env = envOf(state);
  if (env.features.glossary !== true && env.features.backlinks !== true) {
    return (text) => text;
  }
  const dictionary = buildDictionary({
    index: env.index,
    docId: env.docId,
    ownGlossary: env.ownGlossary,
    references: env.mdmarkReferences,
    aliases: env.aliases,
    features: env.features,
  });
  if (dictionary.words.length === 0 && dictionary.avoided.size === 0) {
    return (text) => text;
  }
  const ownPath = env.index?.docs.find((doc) => doc.id === env.docId)?.path;
  // 同じ用語・文書は、1 つの範囲で最初に出たところだけに下線を付ける
  const seen: SeenTerms = {
    terms: new Set(),
    docs: new Set(),
    avoided: new Set(),
  };
  const nextTipId = (): string => {
    env.termTipCount = (env.termTipCount ?? 0) + 1;
    return `mdmark-term-${env.termTipCount}`;
  };
  return (text) =>
    termSegments({
      text: unescapeHtml(text),
      dictionary,
      ownPath,
      seen,
      nextTipId,
      nonce: env.nonce,
    })
      .map((segment) =>
        segment.kind === "text" ? escapeHtml(segment.content) : segment.html,
      )
      .join("");
}

/** コードブロックの HTML を、許可の検査を通し、図の部品・ヒント・用語の下線を足した、枠で包んだ HTML にする */
function buildHtml(options: {
  state: StateCore;
  source: string;
  paramsBefore: number;
}): { html: string; params: number } {
  const { state, source, paramsBefore } = options;
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
  const taken = takeParts({ source, state, paramsBefore, lookup });
  const sanitized = sanitizeEmbedded(taken.html, termsFilter(state));
  const hinted = applyHints({
    html: sanitized,
    env,
    hints: featureOn(state, "hints"),
  });
  const body = restoreParts(markOwn(hinted, env.nonce), taken.parts, env.nonce);
  const [open = "", close = ""] = splitSlots(
    renderEmbeddedHtml({ html: SLOT_MARKER }),
  );
  return {
    html: `${markOwn(open, env.nonce)}${body}${close}`,
    params: taken.params,
  };
}

/** `html` がオンなら、`<!-- html -->` の範囲の `html` のコードブロックを、コードでなく生の HTML として描く。範囲のコードブロックが 1 つでないときは書き方の警告を置き、範囲の中身はそのまま残す。オフのときは何もしない（印は `dropMarks` が取り除く） */
export function buildEmbeddedHtml(state: StateCore): void {
  if (!featureOn(state, "html")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  // 出力の中の操作できる部品の数: 次の範囲の定義を差し込む位置になる
  let params = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    if (!token || !mark || mark.closing || mark.name !== "html") {
      if (token) {
        out.push(token);
        params += Number(token.meta?.[PARAM_COUNT_META] ?? 0);
      }
      continue;
    }
    const closeIndex = findClose(tokens, index, mark.name);
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    if (closeIndex < 0) {
      out.push(warningBlock(state, unclosedWarning(mark)));
    }
    const fences = tokens.slice(index + 1, end).filter(isHtmlFence);
    const [fence] = fences;
    if (fences.length !== 1 || fence === undefined) {
      // 書き方の警告を置き、範囲の中身はそのまま残す
      out.push(warningBlock(state, blockCountWarning()), token);
      continue;
    }
    const built = buildHtml({
      state,
      source: fence.content,
      paramsBefore: params,
    });
    params += built.params;
    const block = new state.Token("html_block", "", 0);
    block.block = true;
    block.content = built.html;
    block.meta = { [PARAM_COUNT_META]: built.params };
    out.push(block);
    index = end;
  }
  state.tokens = out;
}
