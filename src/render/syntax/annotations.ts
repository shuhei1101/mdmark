import type {
  MarkdownIt,
  StateBlock,
  StateCore,
  StateInline,
  Token,
} from "markdown-it";
import {
  type FootnoteBackRef,
  NOTE_OWNER_PREFIX,
  noteOwnerId,
  renderFootnoteRef,
} from "../../parts/footnote.ts";
import type { RenderEnv } from "../parser.ts";
import { blockStartOf, outermostRanges, pairRanges } from "./blocks.ts";
import {
  ANNOTATION_DEF_CLOSE as DEF_CLOSE,
  ANNOTATION_DEF_OPEN as DEF_OPEN,
  definitionBodies,
  findDefinitionClose,
  markOwnAroundBodies,
  renderDefinitionList,
  restoreDefinition,
} from "./footnotes.ts";
import { envOf, featureOn, markOf } from "./tokens.ts";
import { type SyntaxWarning, warningBlock } from "./warnings.ts";

/** 本文の参照のトークンの種類 */
const REF = "mdmark_annotation_ref";

/** 文書の末尾の注記の一覧のトークンの種類 */
const LIST = "mdmark_annotation_list";

/** 脚注の参照のトークンの種類（直後に続く注記の参照の間を空けるために確認する） */
const FOOTNOTE_REF = "mdmark_footnote_ref";

/** 機能の名前 */
const FEATURE = "annotations";

/** 注記のマーカーの文字 */
const MARK = "※";
const MARK_CODE = MARK.charCodeAt(0);

/** map の範囲と補足のマーカーの名前 */
const MAP_MARK = "map";
const DATA_MARK = "map-data";

/** 定義の 2 段落目以降に要る字下げの幅 */
const CONTINUATION_INDENT = 4;

/** タブを字下げの幅に数えるときの、タブの位置の間隔 */
const TAB_WIDTH = 4;

/** 文字の符号: `[`・`]`・`:`・空白・タブ・`-`・`_`・`0`・`9`・`A`・`Z`・`a`・`z` */
const OPEN_BRACKET = 0x5b;
const CLOSE_BRACKET = 0x5d;
const COLON = 0x3a;
const SPACE = 0x20;
const TAB = 0x09;
const HYPHEN = 0x2d;
const UNDERSCORE = 0x5f;
const DIGIT_0 = 0x30;
const DIGIT_9 = 0x39;
const UPPER_A = 0x41;
const UPPER_Z = 0x5a;
const LOWER_A = 0x61;
const LOWER_Z = 0x7a;

/** 1 回の解析で読み込んだ注記の定義と参照 */
export type AnnotationState = {
  /** ID ごとの最初の定義のブロックのトークンと、定義の行（1 から） */
  definitions: Map<string, { tokens: Token[]; line: number }>;
  /** 同じ ID の 2 つ目以降の定義の ID と行 */
  duplicates: Array<{ id: string; line: number }>;
  /** 最初に参照した順の ID（位置 + 1 が番号） */
  order: string[];
  /** ID ごとの参照の戻り先（参照の順） */
  refs: Map<string, FootnoteBackRef[]>;
};

/** 定義の囲みの開きの `meta` */
type DefinitionMeta = { id: string; first: boolean; source: string };

/** 本文の参照の `meta`（番号は `collectAnnotations` が入れる） */
type ReferenceMeta = {
  id: string;
  source: string;
  number?: number;
  refIndex?: number;
  afterRef?: boolean;
};

/** 解析の環境の注記の状態を返却する。無ければ作る */
function annotationStateOf(env: RenderEnv): AnnotationState {
  env.mdmarkAnnotations ??= {
    definitions: new Map(),
    duplicates: [],
    order: [],
    refs: new Map(),
  };
  return env.mdmarkAnnotations;
}

/** ID に使用できる文字（英数字・`-`・`_`）か */
function isIdCode(code: number): boolean {
  return (
    (code >= DIGIT_0 && code <= DIGIT_9) ||
    (code >= UPPER_A && code <= UPPER_Z) ||
    (code >= LOWER_A && code <= LOWER_Z) ||
    code === HYPHEN ||
    code === UNDERSCORE
  );
}

/** `pos` の `[` から始まる ID の閉じの `]` の位置を返却する。空・使用できない文字を含む・閉じが無いときは `-1` */
function idEnd(src: string, pos: number, max: number): number {
  for (let at = pos + 1; at < max; at++) {
    const code = src.charCodeAt(at);
    if (code === CLOSE_BRACKET) {
      return at === pos + 1 ? -1 : at;
    }
    if (!isIdCode(code)) {
      return -1;
    }
  }
  return -1;
}

/** 行頭の `※[ID]:` を注記の定義として読み込み、字下げ 4 で続く行までを本文として囲む */
export function readAnnotationDefinition(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const src = state.src;
  const start = (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0);
  const max = state.eMarks[startLine] ?? 0;
  // 字下げ 4 以上はコードブロック
  if ((state.sCount[startLine] ?? 0) - state.blkIndent >= CONTINUATION_INDENT) {
    return false;
  }
  if (
    src.charCodeAt(start) !== MARK_CODE ||
    src.charCodeAt(start + 1) !== OPEN_BRACKET
  ) {
    return false;
  }
  const close = idEnd(src, start + 1, max);
  if (close < 0 || src.charCodeAt(close + 1) !== COLON) {
    return false;
  }
  if (silent) {
    return true;
  }
  const afterColon = close + 2;
  const id = src.slice(start + 2, close);
  const annotations = annotationStateOf(state.env as RenderEnv);
  const first = !annotations.definitions.has(id);
  if (first) {
    annotations.definitions.set(id, { tokens: [], line: startLine + 1 });
  } else {
    annotations.duplicates.push({ id, line: startLine + 1 });
  }
  const open = state.push(DEF_OPEN, "", 1);
  open.meta = {
    id,
    first,
    source: `${src.slice(start, afterColon)} `,
  } satisfies DefinitionMeta;
  open.map = [startLine, startLine];

  // `:` の後ろの空白を飛ばし、その後ろを字下げ 4 の本文の 1 行目として解析する
  const oldBMark = state.bMarks[startLine] ?? 0;
  const oldTShift = state.tShift[startLine] ?? 0;
  const oldSCount = state.sCount[startLine] ?? 0;
  const oldParentType = state.parentType;
  const initial = oldSCount + afterColon - start;
  let offset = initial;
  let pos = afterColon;
  while (pos < max) {
    const code = src.charCodeAt(pos);
    if (code === TAB) {
      offset += TAB_WIDTH - (offset % TAB_WIDTH);
    } else if (code === SPACE) {
      offset += 1;
    } else {
      break;
    }
    pos += 1;
  }
  state.tShift[startLine] = pos - afterColon;
  state.sCount[startLine] = offset - initial;
  state.bMarks[startLine] = afterColon;
  state.blkIndent += CONTINUATION_INDENT;
  state.parentType = "footnote" as typeof state.parentType;
  if ((state.sCount[startLine] ?? 0) < state.blkIndent) {
    state.sCount[startLine] = (state.sCount[startLine] ?? 0) + state.blkIndent;
  }
  state.md.block.tokenize(state, startLine, endLine);
  state.parentType = oldParentType;
  state.blkIndent -= CONTINUATION_INDENT;
  state.tShift[startLine] = oldTShift;
  state.sCount[startLine] = oldSCount;
  state.bMarks[startLine] = oldBMark;

  open.map = [startLine, state.line];
  state.push(DEF_CLOSE, "", -1);
  return true;
}

/** `[` の位置で、直前の文字が `※` のときだけ `[ID]` を注記の参照として読み込む（リンクになる `[ID]` は先に `link` が読み込む） */
export function readAnnotationReference(
  state: StateInline,
  silent: boolean,
): boolean {
  const { src, pos: start, posMax: max } = state;
  if (src.charCodeAt(start) !== OPEN_BRACKET || !state.pending.endsWith(MARK)) {
    return false;
  }
  const close = idEnd(src, start, max);
  if (close < 0) {
    return false;
  }
  if (!silent) {
    const id = src.slice(start + 1, close);
    state.pending = state.pending.slice(0, -MARK.length);
    const token = state.push(REF, "", 0);
    token.meta = { id, source: `${MARK}[${id}]` } satisfies ReferenceMeta;
  }
  state.pos = close + 1;
  return true;
}

/** 補足のマーカーの引数の JSON から、要素の ID ごとに参照する注記の ID の並びを返却する（解析できない補足は空） */
export function mapNoteAnnotations(
  rest: string | undefined,
): Array<[string, string[]]> {
  let data: unknown;
  try {
    data = JSON.parse((rest ?? "").trim());
  } catch {
    // 補足の JSON の誤りは map の点検が警告にする
    return [];
  }
  const notes = (data as { notes?: unknown } | null)?.notes;
  if (typeof notes !== "object" || notes === null) {
    return [];
  }
  return Object.entries(notes).flatMap(([element, note]) => {
    const ids = (note as { annotations?: unknown } | null)?.annotations;
    return Array.isArray(ids)
      ? [[element, ids.filter((id): id is string => typeof id === "string")]]
      : [];
  });
}

/** 機能がオフのとき、本文の参照を記載した文字に戻す */
function restoreReferences(state: StateCore): void {
  for (const token of state.tokens) {
    if (token.type !== "inline" || !token.children) {
      continue;
    }
    token.children = token.children.map((child) =>
      child.type === REF ? textToken(state, child) : child,
    );
  }
}

/** 参照のトークンを、記載した文字のトークンにする */
function textToken(state: StateCore, ref: Token): Token {
  const text = new state.Token("text", "", 0);
  text.content = (ref.meta as ReferenceMeta).source;
  return text;
}

/** 番号の無い ID に次の番号を振り、番号を返却する */
function numberOf(annotations: AnnotationState, id: string): number {
  let at = annotations.order.indexOf(id);
  if (at < 0) {
    at = annotations.order.length;
    annotations.order.push(id);
    annotations.refs.set(id, []);
  }
  return at + 1;
}

/** map の範囲の開きのトークンの位置ごとの、図の通し番号と閉じの位置 */
function mapRangesOf(
  state: StateCore,
): Map<number, { number: number; close: number }> {
  const ranges = new Map<number, { number: number; close: number }>();
  if (!featureOn(state, MAP_MARK)) {
    return ranges;
  }
  let number = 0;
  for (const { open, close } of outermostRanges(
    pairRanges(state.tokens, MAP_MARK),
    state.tokens.length,
  )) {
    // 図の通し番号は buildMapRanges と同じく、閉じのある範囲を数える
    if (close === -1) {
      continue;
    }
    number += 1;
    ranges.set(open, { number, close });
  }
  return ranges;
}

/** 行内の参照に番号を振り、定義の無い参照を記載した文字に戻して、定義の無いことの警告を記録する */
function collectInline(options: {
  state: StateCore;
  inline: Token;
  annotations: AnnotationState;
  undefinedRefs: string[];
}): void {
  const { state, inline, annotations, undefinedRefs } = options;
  let afterRef = false;
  inline.children = (inline.children ?? []).map((child) => {
    if (child.type === FOOTNOTE_REF) {
      afterRef = true;
      return child;
    }
    if (child.type !== REF) {
      afterRef = false;
      return child;
    }
    const meta = child.meta as ReferenceMeta;
    if (!annotations.definitions.has(meta.id)) {
      undefinedRefs.push(meta.id);
      afterRef = false;
      return textToken(state, child);
    }
    const number = numberOf(annotations, meta.id);
    const refs = annotations.refs.get(meta.id) ?? [];
    meta.number = number;
    meta.refIndex = refs.length;
    meta.afterRef = afterRef;
    refs.push({ href: `#mdmark-noteref-${number}-${refs.length}` });
    afterRef = true;
    return child;
  });
}

/** map の範囲の補足が参照する注記に番号を振り、戻り先を持ち主の `id` にする */
function collectMapRange(options: {
  tokens: Token[];
  open: number;
  range: { number: number; close: number };
  annotations: AnnotationState;
}): void {
  const { tokens, open, range, annotations } = options;
  const data = tokens
    .slice(open + 1, range.close)
    .map((token) => markOf(token))
    .find((mark) => mark?.name === DATA_MARK);
  for (const [element, ids] of mapNoteAnnotations(data?.rest)) {
    const owner = noteOwnerId(`${NOTE_OWNER_PREFIX}${range.number}-`, element);
    for (const id of ids) {
      if (!annotations.definitions.has(id)) {
        continue;
      }
      numberOf(annotations, id);
      annotations.refs.get(id)?.push({ href: `#${owner}`, owner });
    }
  }
}

/** 定義の無い参照の警告 */
function undefinedWarning(id: string): SyntaxWarning {
  return {
    kind: "annotation_undefined",
    message: `注記 \`${MARK}[${id}]\` の定義がありません。\`${MARK}[${id}]: 本文\` を記載するか、ID を修正してください。`,
  };
}

/** 参照されていない定義の警告 */
function unusedWarning(id: string): SyntaxWarning {
  return {
    kind: "annotation_unused",
    message: `注記 \`${MARK}[${id}]\` の定義が、どこからも参照されていません。参照を記載するか、定義を削除してください。`,
  };
}

/** 同じ ID の 2 つ目以降の定義の警告 */
function duplicateWarning(id: string): SyntaxWarning {
  return {
    kind: "annotation_duplicate",
    message: `注記 \`${MARK}[${id}]\` の定義が既にあります。最初の定義を使用しています。ID を変えるか、この定義を削除してください。`,
  };
}

/** 機能がオンなら、本文と map の補足の参照に最初に参照した順の番号を振り、参照と定義が合わないものに記載の警告を配置する。オフなら参照を記載した文字に戻す */
export function collectAnnotations(state: StateCore): void {
  const env = envOf(state);
  if (!featureOn(state, FEATURE)) {
    restoreReferences(state);
    delete env.mdmarkAnnotations;
    return;
  }
  const annotations = annotationStateOf(env);
  const ranges = mapRangesOf(state);
  const inserts: Array<{ at: number; token: Token }> = [];
  state.tokens.forEach((token, index) => {
    const range = ranges.get(index);
    if (range !== undefined) {
      collectMapRange({
        tokens: state.tokens,
        open: index,
        range,
        annotations,
      });
    }
    if (token.type !== "inline" || !token.children) {
      return;
    }
    const undefinedRefs: string[] = [];
    collectInline({ state, inline: token, annotations, undefinedRefs });
    const at = blockStartOf(state.tokens, index);
    for (const id of undefinedRefs) {
      inserts.push({ at, token: warningBlock(state, undefinedWarning(id)) });
    }
  });
  state.tokens.forEach((token, index) => {
    if (token.type !== DEF_OPEN) {
      return;
    }
    const meta = token.meta as DefinitionMeta;
    if (!meta.first) {
      inserts.push({
        at: index,
        token: warningBlock(state, duplicateWarning(meta.id), token),
      });
    } else if (!annotations.order.includes(meta.id)) {
      inserts.push({
        at: index,
        token: warningBlock(state, unusedWarning(meta.id), token),
      });
    }
  });
  // 位置の順に並べ、後ろから差し込んで位置をずらさない（同じ位置は記録した順に並べる）
  const sorted = [...inserts].sort((a, b) => a.at - b.at);
  for (const { at, token } of sorted.reverse()) {
    state.tokens.splice(at, 0, token);
  }
}

/** 番号のある注記が 1 つ以上あれば、文書の末尾に注記の一覧のトークンを追加する（脚注の一覧の後・関連文書の一覧の前） */
export function buildAnnotationList(state: StateCore): void {
  if ((envOf(state).mdmarkAnnotations?.order.length ?? 0) === 0) {
    return;
  }
  const token = new state.Token(LIST, "", 0);
  token.block = true;
  state.tokens.push(token);
}

/** 全てのコアルールを経由した定義の囲みを本文から取り除き、ID ごとの最初の定義の本文を記録する。機能がオフなら、定義の頭の文字を段落に戻して記載した位置に残す */
export function takeAnnotationDefinitions(state: StateCore): void {
  const annotations = envOf(state).mdmarkAnnotations;
  const enabled = featureOn(state, FEATURE);
  const out: Token[] = [];
  for (let index = 0; index < state.tokens.length; index++) {
    const token = state.tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token.type !== DEF_OPEN) {
      out.push(token);
      continue;
    }
    const close = findDefinitionClose(state.tokens, index);
    const meta = token.meta as DefinitionMeta;
    const inner = state.tokens.slice(index + 1, close);
    if (!enabled) {
      out.push(...restoreDefinition(state, meta.source, inner));
    } else if (meta.first) {
      const definition = annotations?.definitions.get(meta.id);
      if (definition !== undefined) {
        definition.tokens = inner;
      }
    }
    index = close;
  }
  state.tokens = out;
}

/** 注記 1 つの定義の本文のトークン */
function definitionTokens(env: RenderEnv, id: string): Token[] {
  return env.mdmarkAnnotations?.definitions.get(id)?.tokens ?? [];
}

/** 本文の参照のトークンを、マーカーとツールチップの HTML にする */
function renderReference(md: MarkdownIt, token: Token, env: RenderEnv): string {
  const { id, number, refIndex, afterRef } = token.meta as ReferenceMeta;
  if (number === undefined) {
    throw new Error(`注記の番号が無い: ${id}`);
  }
  const { bodies } = definitionBodies({
    md,
    env,
    tokens: definitionTokens(env, id),
  });
  const html = renderFootnoteRef({
    kind: "annotation",
    number,
    refIndex: refIndex ?? 0,
    afterRef: afterRef ?? false,
    bodies,
  });
  return markOwnAroundBodies(html, bodies, env.nonce);
}

/** 注記の一覧の HTML にする */
function renderList(md: MarkdownIt, env: RenderEnv): string {
  const annotations = env.mdmarkAnnotations;
  return renderDefinitionList({
    md,
    env,
    kind: "annotation",
    items: (annotations?.order ?? []).map((id, index) => {
      const refs = annotations?.refs.get(id) ?? [];
      return {
        number: index + 1,
        tokens: definitionTokens(env, id),
        refCount: refs.length,
        refs,
      };
    }),
  });
}

/** 解析器に、注記の定義・参照のルールと、参照と一覧の描き方を登録する（コアルールは `createParser` が登録する） */
export function useAnnotations(parser: MarkdownIt): void {
  parser.block.ruler.before(
    "reference",
    "mdmark_annotation_def",
    readAnnotationDefinition,
    {
      alt: ["paragraph", "reference"],
    },
  );
  parser.inline.ruler.after(
    "mdmark_footnote_ref",
    "mdmark_annotation_ref",
    readAnnotationReference,
  );
  parser.renderer.rules[LIST] = (_tokens, _index, _options, env) =>
    renderList(parser, env as RenderEnv);
  parser.renderer.rules[REF] = (tokens, index, _options, env) => {
    const token = tokens[index];
    if (token === undefined) {
      throw new Error("注記の参照のトークンが無い");
    }
    return renderReference(parser, token, env as RenderEnv);
  };
}
