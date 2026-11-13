import type { StateCore, Token } from "markdown-it";
import {
  type DiagramDirective,
  definitionWarning,
  type MdmarkChartDefinition,
  type MdmarkParamDefinition,
  readDefinition,
} from "../../diagram/definition.ts";
import type { WarningItem } from "../../extensions.ts";
import { buildDictionary } from "../../knowledge/dictionary.ts";
import { renderDiagram, type TermLookup } from "../../parts/diagram.ts";
import { renderEmbeddedHtml } from "../../parts/embedded-html.ts";
import { escapeHtml } from "../../parts/escape.ts";
import { renderHintMarkup } from "../../parts/hint.ts";
import { markOwn, SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import { renderParam } from "../../parts/param.ts";
import type { RenderEnv } from "../parser.ts";
import {
  EMBED_PART_ATTRIBUTE,
  EMBED_PART_TAG,
  sanitizeEmbedded,
} from "../sanitize.ts";
import { scopeCss } from "../scope-css.ts";
import {
  isRetiredDiagram,
  PARAM_COUNT_META,
  retiredDiagramMessage,
} from "./diagrams.ts";
import { type SeenTerms, termSegments } from "./terms.ts";
import { envOf, featureOn, findClose, markOf } from "./tokens.ts";
import { unclosedWarning, type WarningMeta, warningBlock } from "./warnings.ts";

/** 埋め込んだ HTML の中の図の部品の `id` の頭（範囲のマーカーの図と通し番号を共有する） */
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

/** 範囲に配置できる、外観と動きを追加するコードブロックの言語 */
const RANGE_SCRIPT_LANGUAGES = ["css", "ts", "js"] as const;

/** 範囲のスクリプトの言語 */
type RangeScriptLanguage = (typeof RANGE_SCRIPT_LANGUAGES)[number];

/** `fence` のトークンの言語 */
function fenceLanguage(token: Token): string {
  return token.type === "fence"
    ? (token.info.trim().split(/\s+/)[0] ?? "")
    : "";
}

/** 範囲の `css`・`ts`・`js` のコードブロックか */
function isRangeScriptFence(token: Token): boolean {
  return (RANGE_SCRIPT_LANGUAGES as readonly string[]).includes(
    fenceLanguage(token),
  );
}

/** `<!-- html -->` の範囲の `fence` を言語ごとに数え、`html`・`css`・スクリプトと読み込めない組み合わせの警告を返却する */
export function readRangeScripts(tokens: Token[]): {
  html: Token | undefined;
  css: string | undefined;
  script: { lang: "ts" | "js"; code: string } | undefined;
  warnings: WarningItem[];
} {
  const fences = tokens.filter((token) => token.type === "fence");
  const html = fences.filter(isHtmlFence);
  const byLang = (lang: RangeScriptLanguage): Token[] =>
    fences.filter((token) => fenceLanguage(token) === lang);
  const warnings: WarningItem[] = [];
  for (const lang of RANGE_SCRIPT_LANGUAGES) {
    if (byLang(lang).length > 1) {
      warnings.push({
        label: lang,
        message: `\`<!-- html -->\` の範囲に \`${lang}\` のコードブロックが ${byLang(lang).length} つあります。1 つにしてください。スクリプトを動かさずに描いています。`,
      });
    }
  }
  const [ts] = byLang("ts");
  const [js] = byLang("js");
  if (ts && js) {
    warnings.push({
      label: "ts",
      message:
        "`<!-- html -->` の範囲に `ts` と `js` のコードブロックが両方あります。どちらか 1 つにしてください。スクリプトを動かさずに描いています。",
    });
  }
  const scripted = warnings.length === 0 ? (ts ?? js) : undefined;
  const [css] = byLang("css");
  return {
    html: html.length === 1 ? html[0] : undefined,
    css: byLang("css").length === 1 ? css?.content : undefined,
    script: scripted
      ? { lang: scripted === ts ? "ts" : "js", code: scripted.content }
      : undefined,
    warnings,
  };
}

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

/** 範囲の記載の警告。範囲の中身はそのまま描く */
function blockCountWarning(): { message: string } {
  return {
    message:
      "`<!-- html -->` の範囲に `html` のコードブロックを 1 つだけ配置してください。範囲の中身はそのまま描いています。",
  };
}

/** コードブロックの HTML の中の図の部品の custom element を、図の部品の HTML に置き換える準備: 要素の場所にマーカーの要素を配置し、図の部品の HTML を並べて返却する */
function takeParts(options: {
  source: string;
  state: StateCore;
  /** この範囲の前にある操作できる部品の数（文書の中の並びで定義を差し込む位置） */
  paramsBefore: number;
  lookup: TermLookup;
}): {
  html: string;
  parts: string[];
  params: number;
  warnings: WarningMeta[];
} {
  const { source, state, paramsBefore, lookup } = options;
  const env = envOf(state);
  const diagrams = featureOn(state, "diagrams");
  const hints = featureOn(state, "hints");
  const resizable = featureOn(state, "diagram-resize");
  const parts: string[] = [];
  const warnings: WarningMeta[] = [];
  const definitions: MdmarkParamDefinition[] = [];
  const html = source.replace(
    PART_PATTERN,
    (_match: string, name: string, text: string): string => {
      const lower = name.toLowerCase();
      // 廃止した図の要素は、中身ごと落として廃止した図の記載の警告にする
      if (isRetiredDiagram(lower)) {
        const warning = warningBlock(state, {
          message: retiredDiagramMessage(lower),
          kind: "retired_diagram",
        });
        warnings.push(warning.meta?.warning as WarningMeta);
        parts.push(warning.content);
        return `<${EMBED_PART_TAG} ${EMBED_PART_ATTRIBUTE}="${env.nonce}:${parts.length - 1}"></${EMBED_PART_TAG}>`;
      }
      // 図の部品の機能がオフなら、要素を中身ごと落とす
      if (!diagrams) {
        return "";
      }
      const directive = lower as DiagramDirective;
      const result = readDefinition(directive, [text.trim()]);
      const definition = result.definition;
      let part: string;
      if (!result.ok || definition === undefined) {
        const warning = warningBlock(state, {
          ...definitionWarning(directive, result.problems),
          kind: "diagram_invalid",
        });
        warnings.push(warning.meta?.warning as WarningMeta);
        part = warning.content;
      } else {
        env.diagramCount = (env.diagramCount ?? 0) + 1;
        const count = env.diagramCount;
        if (directive === "param") {
          const param = definition as MdmarkParamDefinition;
          definitions.push(param);
          part = renderParam(param, {
            id: `${PARAM_ID_PREFIX}-${count}`,
            copyLabel: env.labels?.paramCopy,
            resizable,
          });
        } else {
          part = renderDiagram({
            kind: directive,
            definition: definition as MdmarkChartDefinition,
            id: `${DIAGRAM_ID_PREFIX}-${count}`,
            lookup,
            hints,
            resizable,
          });
        }
        part = markOwn(part, env.nonce);
      }
      parts.push(part);
      return `<${EMBED_PART_TAG} ${EMBED_PART_ATTRIBUTE}="${env.nonce}:${parts.length - 1}"></${EMBED_PART_TAG}>`;
    },
  );
  // 操作できる部品の定義は、文書の中の並びの位置へ差し込む（`attachParams` が並びで参照する）
  env.paramDefinitions ??= [];
  env.paramDefinitions.splice(paramsBefore, 0, ...definitions);
  return { html, parts, params: definitions.length, warnings };
}

/** 預けたマーカーの要素を、図の部品の HTML に戻す。戻せなかったマーカーの要素（記載した人が似せて記載したもの）は取り除く */
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

/** `data-hint` を持つ要素にマーカー・下線・ツールチップの中身を付ける。`hints` がオフなら `data-hint` を削除する。入力は `sanitizeEmbedded` の出力で、タグは閉じてある */
function applyHints(options: {
  html: string;
  env: RenderEnv;
  hints: boolean;
}): string {
  const { html, env, hints } = options;
  const tag = /<(\/?)([a-z][a-z0-9-]*)\b([^>]*?)(\/?)>/gi;
  const hintAttribute = /\sdata-hint="([^"]*)"/;
  /** 閉じタグの前と後ろに配置する HTML を持った、開いている要素 */
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

/** 中の文字の用語に下線を付ける関数を作る。`glossary` と `backlinks` が両方オフ・辞書が空なら、文字のままにする */
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

/** コードブロックの HTML を、許可の検査にかけ、図の部品・ヒント・用語の下線を追加した、枠で包んだ HTML にする */
function buildHtml(options: {
  state: StateCore;
  source: string;
  paramsBefore: number;
  scripts?:
    | {
        scope: number;
        css: string | undefined;
        script: { lang: "ts" | "js"; code: string } | undefined;
      }
    | undefined;
}): { html: string; params: number; warnings: WarningMeta[] } {
  const { state, source, paramsBefore, scripts } = options;
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
  const taken = takeParts({ source, state, paramsBefore, lookup });
  const sanitized = sanitizeEmbedded(
    taken.html,
    termsFilter(state),
    scripts !== undefined,
  );
  const hinted = applyHints({
    html: sanitized,
    env,
    hints: featureOn(state, "hints"),
  });
  const body = restoreParts(markOwn(hinted, env.nonce), taken.parts, env.nonce);
  const [rawOpen = "", close = ""] = splitSlots(
    renderEmbeddedHtml({ html: SLOT_MARKER }),
  );
  if (!scripts) {
    return {
      html: `${markOwn(rawOpen, env.nonce)}${body}${close}`,
      params: taken.params,
      warnings: taken.warnings,
    };
  }
  // 範囲の通し番号を根の要素に付け、`css` を根の要素の中に限った `style` を先頭、スクリプトを実行しない `template` を末尾に配置する
  const open = rawOpen.replace(
    /^<div class="mdmark-html"/,
    `<div class="mdmark-html" data-html-scope="${scripts.scope}"`,
  );
  const style =
    scripts.css === undefined
      ? ""
      : `<style class="mdmark-html-style">${scopeCss({ css: scripts.css, scope: scripts.scope })}</style>`;
  const template = scripts.script
    ? `<template class="mdmark-html-script" data-lang="${scripts.script.lang}">${escapeHtml(scripts.script.code)}</template>`
    : "";
  return {
    html: `${markOwn(open, env.nonce)}${markOwn(style, env.nonce)}${body}${markOwn(template, env.nonce)}${close}`,
    params: taken.params,
    warnings: taken.warnings,
  };
}

/** `html` がオンなら、`<!-- html -->` の範囲の `html` のコードブロックを、コードでなく生の HTML として描く。範囲のコードブロックが 1 つでないときは記載の警告を配置し、範囲の中身はそのまま残す。オフのときは何もしない（マーカーは `dropMarks` が取り除く） */
export function buildEmbeddedHtml(state: StateCore): void {
  if (!featureOn(state, "html")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  // 出力の中の操作できる部品の数: 次の範囲の定義を差し込む位置になる
  let params = 0;
  const scripting = featureOn(state, "html-scripts");
  // 範囲のスクリプトを適用する範囲の、文書の中の通し番号
  let scope = 0;
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
      out.push(warningBlock(state, unclosedWarning(mark), token));
    }
    const fences = tokens.slice(index + 1, end).filter(isHtmlFence);
    const [fence] = fences;
    if (fences.length !== 1 || fence === undefined) {
      // 記載の警告を配置し、範囲の中身はそのまま残す
      out.push(warningBlock(state, blockCountWarning(), token), token);
      continue;
    }
    const range = readRangeScripts(tokens.slice(index + 1, end));
    if (scripting) {
      for (const item of range.warnings) {
        out.push(warningBlock(state, { message: item.message }, token));
      }
    }
    const built = buildHtml({
      state,
      source: fence.content,
      paramsBefore: params,
      scripts: scripting
        ? { scope, css: range.css, script: range.script }
        : undefined,
    });
    if (scripting) {
      scope += 1;
    }
    params += built.params;
    const block = new state.Token("html_block", "", 0);
    block.block = true;
    block.content = built.html;
    // 埋め込んだ図の部品の警告は、範囲の開きのマーカーの行で集める
    const line = token.map?.[0];
    block.meta = {
      [PARAM_COUNT_META]: built.params,
      warnings: built.warnings.map((warning) =>
        line === undefined ? warning : { ...warning, line },
      ),
    };
    out.push(block);
    if (!scripting) {
      // 範囲のスクリプトの機能がオフのときは、`css`・`ts`・`js` をコードのまま範囲の後ろに残す
      out.push(...tokens.slice(index + 1, end).filter(isRangeScriptFence));
    }
    index = end;
  }
  state.tokens = out;
}
