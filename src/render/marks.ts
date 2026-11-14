import type { StateCore, Token } from "markdown-it";
import { parseDefinitionJson } from "../diagram/definition.ts";
import { extensionFor, type WarningItem } from "../extensions.ts";
import { resolveFeatures } from "../features.ts";
import { renderEmbed } from "../parts/embed.ts";
import { markOwn } from "../parts/own.ts";
import { convertLegacyArgs } from "./legacy-marks.ts";
import {
  hasUnclosedString,
  type MarkOptions,
  readMarkArgs,
} from "./mark-options.ts";
import {
  type MarkNote,
  type MarkProblem,
  markOptionNotes,
  validateMarkOptions,
} from "./mark-schema.ts";
import { readPageSettings } from "./page.ts";
import type { RenderEnv } from "./parser.ts";
import {
  recordMarkNotes,
  type SyntaxWarning,
  warningBlock,
} from "./syntax/warnings.ts";

/** 生の HTML の中のマーカー（`<!-- 名前: 引数 -->`・`<!-- 名前 -->`・`<!-- /名前 -->`）を取得する正規表現 */
export const MARK_PATTERN =
  /<!--\s*(\/)?([a-z][a-z0-9-]*)(?::\s*(.*?))?\s*-->/gs;

/** 機能のオン・オフを記載するマーカーの名前 */
export const FEATURES_MARK = "features";

/** 明暗・テーマ・右側の目次の出し方を記載するマーカーの名前 */
export const PAGE_MARK = "page";

/** 記法のマーカーの名前から、その記法の機能の名前を参照する */
export const SYNTAX_MARKS: Readonly<Record<string, string>> = {
  table: "table",
  tabs: "tabs",
  steps: "steps",
  tree: "tree",
  section: "sections",
  "row-detail": "row-details",
  fig: "figures",
  toc: "toc",
  glossary: "glossary",
  view: "views",
  flow: "diagrams",
  sequence: "diagrams",
  chart: "diagrams",
  param: "diagrams",
  er: "diagrams",
  html: "html",
  code: "code",
  gallery: "gallery",
  columns: "columns",
  column: "columns",
  details: "details",
  pagebreak: "pagebreak",
  include: "include",
  wide: "wide",
  cards: "card-grid",
  map: "map",
  "map-data": "map",
};

/** 図の部品のマーカーの名前。同じ名前の拡張と対応表が先に使用される */
const DIAGRAM_MARKS = ["flow", "sequence", "chart", "param", "er"];

/** マーカーのトークンの type */
export const MARK_TOKEN = "mdmark_mark";

/** 文書から取得したマーカー 1 つ */
export type Mark = {
  /** マーカーの名前 */
  name: string;
  /** 引数の JSON のオブジェクト。今の書き方の引数は同じオブジェクトにしたもの。引数が無い・読めないときは `{}` */
  options: MarkOptions;
  /** 引数の記載方法 */
  source: "none" | "json" | "legacy" | "invalid";
  /** 引数を読んで検証したときの、記載の警告にする誤り */
  problems: MarkProblem[];
  /** 無視した知らないキーのパス */
  unknownKeys: string[];
  /** マーカーの文字のまま（記載の警告に出す） */
  raw: string;
  /** 閉じのマーカー（`<!-- /名前 -->`）か */
  closing: boolean;
  /** マーカーの引数の文字（コロンの後ろ）。map の範囲が読む */
  rest?: string;
};

/** 今の書き方の引数を判別した値 */
export type LegacyMarkArgs = {
  /** `キー=値` でない引数を記載した順に */
  args: string[];
  /** `キー=値` の引数。同じキーは後に記載した値 */
  keys: Record<string, string>;
};

/** 今の書き方の引数の文字を空白で区切り、`キー=値` を `keys`、それ以外を記載した順に `args` に入れる */
export function parseMarkArgs(text: string): LegacyMarkArgs {
  const value: LegacyMarkArgs = { args: [], keys: {} };
  for (const part of text.split(/\s+/).filter(Boolean)) {
    const pair = /^([^\s=]+)=(.*)$/.exec(part);
    if (pair?.[1] !== undefined) {
      value.keys[pair[1]] = pair[2] ?? "";
    } else {
      value.args.push(part);
    }
  }
  return value;
}

/** 検証しないマーカー（map の範囲が今の読み方で読む） */
const UNVALIDATED_MARKS = new Set(["map", "map-data"]);

/** 拡張か設定の `libraries` のマーカーか */
function isEmbedMark(name: string, env: RenderEnv | undefined): boolean {
  return (
    extensionFor(name) !== undefined ||
    (env !== undefined && Object.hasOwn(env.libraries, name))
  );
}

/** 記法・機能・ページのマーカーか（JSON Schema で検証し、今の書き方を JSON のオブジェクトにする） */
function isOwnMark(name: string): boolean {
  return (
    name === FEATURES_MARK ||
    name === PAGE_MARK ||
    Object.hasOwn(SYNTAX_MARKS, name)
  );
}

/** 引数を読む前のマーカー */
type MarkBase = Pick<Mark, "name" | "raw" | "closing" | "rest">;

/** 引数を持たないマーカー */
function emptyMark(base: MarkBase, source: Mark["source"]): Mark {
  return { ...base, options: {}, source, problems: [], unknownKeys: [] };
}

/** 今の書き方の引数を JSON のオブジェクトにして検証したマーカー（記法・機能・ページのマーカーのほかは引数を持たない） */
function legacyMark(base: MarkBase, text: string): Mark {
  const { name } = base;
  if (!isOwnMark(name) || UNVALIDATED_MARKS.has(name)) {
    return emptyMark(base, "legacy");
  }
  const converted = convertLegacyArgs({ name, text });
  const checked = validateMarkOptions({ name, options: converted.options });
  return {
    ...base,
    options: checked.options,
    source: "legacy",
    problems: converted.dropped.map((item) => ({
      path: item.text,
      message: item.reason,
    })),
    unknownKeys: [],
  };
}

/** JSON のオブジェクトの引数を検証したマーカー（記法・機能・ページのマーカーのほかは検証しない） */
function jsonMark(base: MarkBase, options: MarkOptions): Mark {
  const { name } = base;
  if (UNVALIDATED_MARKS.has(name) || !isOwnMark(name)) {
    return { ...base, options, source: "json", problems: [], unknownKeys: [] };
  }
  const checked = validateMarkOptions({ name, options });
  return {
    ...base,
    options: checked.options,
    source: "json",
    problems: checked.problems,
    unknownKeys: checked.unknownKeys,
  };
}

/** 正規表現のマッチの各部分からマーカーを作り、引数を読んで検証する */
function toMark(
  raw: string,
  parts: {
    closing: string | undefined;
    name: string;
    rest: string | undefined;
  },
): Mark {
  const { closing, name, rest } = parts;
  const base = { name, raw, closing: closing === "/", rest: rest ?? "" };
  // map の範囲は引数を今の読み方で読み、map の点検の種類で通知する
  if (base.closing || UNVALIDATED_MARKS.has(name)) {
    return emptyMark(base, "none");
  }
  const args = readMarkArgs(rest ?? "");
  switch (args.kind) {
    case "none":
      return emptyMark(base, "none");
    case "invalid":
      return {
        ...emptyMark(base, "invalid"),
        problems: [{ path: "", message: args.message }],
      };
    case "legacy":
      return legacyMark(base, args.text);
    case "json":
      return jsonMark(base, args.options);
    default:
      return args satisfies never;
  }
}

/** 記載の警告に、行があればその行を付ける */
function withLine(
  warning: SyntaxWarning,
  line: number | undefined,
): SyntaxWarning {
  return { ...warning, ...(line === undefined ? {} : { line }) };
}

/** マーカーの誤りを記載の警告にする。誤りが無ければ `undefined` */
function markProblemWarning(mark: Mark): SyntaxWarning | undefined {
  const [first, ...others] = mark.problems;
  if (first === undefined) {
    return undefined;
  }
  if (mark.source === "legacy") {
    return {
      mark: mark.raw,
      message: "の読み込めない指定を当てずに描いています。",
      items: mark.problems.map((problem) => ({
        label: problem.path,
        message: problem.message,
      })),
    };
  }
  if (others.length === 0) {
    return { mark: mark.raw, message: first.message };
  }
  const items: WarningItem[] = mark.problems.map((problem) => ({
    label: problem.path,
    message: problem.message.replace(
      /^(?:の `[^`]*` (?:の |には |に)?|に)/,
      "",
    ),
  }));
  return {
    mark: mark.raw,
    message: "の読み込めない指定を当てずに描いています。",
    items,
  };
}

/** 機能のマーカーの、真偽値の値を持つ機能の名前と値 */
function featureOptionsOf(text: string, mark: Mark): Record<string, boolean> {
  const args = readMarkArgs(text);
  const options = args.kind === "json" ? args.options : mark.options;
  return Object.fromEntries(
    Object.entries(options).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

/** マーカーの注記（知らないキー・今の書き方・適用しない列の設定）を作る */
function notesOf(mark: Mark, env: RenderEnv): MarkNote[] {
  if (mark.closing) {
    return [];
  }
  const isExtension = isEmbedMark(mark.name, env) && !isOwnMark(mark.name);
  if (
    !isExtension &&
    (!isOwnMark(mark.name) || UNVALIDATED_MARKS.has(mark.name))
  ) {
    return [];
  }
  return markOptionNotes({
    name: mark.name,
    source: mark.source,
    options: mark.options,
    unknownKeys: mark.unknownKeys,
    isExtension,
  });
}

/** 今の書き方の拡張と対応表のマーカーの記載の警告 */
function legacyEmbedWarning(mark: Mark): SyntaxWarning {
  const example = mark.rest
    ? ` \`<!-- ${mark.name}: {"…": "${mark.rest.replaceAll('"', "'").split(/\s+/)[0] ?? ""}"} -->\``
    : "";
  return {
    mark: mark.raw,
    message: `の引数は JSON のオブジェクトで記載してください（例:${example}）。拡張 \`${mark.name}\` の部品は描いていません。\`mdmark upgrade\` の移行の報告で、記載し直す箇所を確かめられます。`,
  };
}

/** HTML の中のマーカーを、`features` は設定を取得して取り除き、対応表と拡張の名前はマーカーの場所の要素に置き換え、それ以外は取り除く。記載の警告にする誤りは `warnings` に追加する */
function replaceMarks(
  html: string,
  env: RenderEnv,
  context: { line: number | undefined; warnings: SyntaxWarning[] },
): string {
  return html.replace(
    MARK_PATTERN,
    (raw: string, ...groups: Array<string | undefined>): string => {
      const [closing, name = "", rest] = groups;
      const mark = toMark(raw, { closing, name, rest });
      if (mark.closing) {
        return "";
      }
      if (context.line !== undefined) {
        recordMarkNotes(env, {
          notes: notesOf(mark, env),
          line: context.line + 1,
        });
      }
      return replacementOf(mark, { env, warnings: context.warnings });
    },
  );
}

/** マーカーの場所に置く HTML。`features` は設定を取得して取り除き、対応表と拡張の名前は要素に置き換え、それ以外は取り除く */
function replacementOf(
  mark: Mark,
  context: { env: RenderEnv; warnings: SyntaxWarning[] },
): string {
  const { env, warnings } = context;
  if (mark.name === FEATURES_MARK) {
    // 知らない機能の名前は `resolveFeatures` が無視し、点検が注記で通知する
    env.featureOptions.push(featureOptionsOf(mark.rest ?? "", mark));
    const warning = markProblemWarning(mark);
    if (warning) {
      warnings.push(warning);
    }
    return "";
  }
  // 設定の対応表より登録した拡張を優先する
  return isEmbedMark(mark.name, env) ? embedOf(mark, context) : "";
}

/** 対応表と拡張のマーカーの場所の要素（今の書き方と読めない引数は、要素を置かずに記載の警告にする） */
function embedOf(
  mark: Mark,
  context: { env: RenderEnv; warnings: SyntaxWarning[] },
): string {
  if (mark.source === "legacy") {
    context.warnings.push(legacyEmbedWarning(mark));
    return "";
  }
  if (mark.source === "invalid") {
    const warning = markProblemWarning(mark);
    if (warning) {
      context.warnings.push(warning);
    }
    return "";
  }
  return markOwn(
    renderEmbed({ name: mark.name, options: mark.options }),
    context.env.nonce,
  );
}

/** マーカーだけの `html_block` の内容から、マーカーを取り出す。マーカーだけでなければ `undefined` */
function soleMark(content: string): Mark | undefined {
  const matches = [...content.matchAll(MARK_PATTERN)];
  const [only] = matches;
  if (
    matches.length !== 1 ||
    !only ||
    content.replace(MARK_PATTERN, "").trim()
  ) {
    return undefined;
  }
  return toMark(only[0], {
    closing: only[1],
    name: only[2] ?? "",
    rest: only[3],
  });
}

/** マーカーだけの `html_block` から、記法のマーカーを取り出す。記法のマーカーでなければ `undefined`。図の部品のマーカーは、同じ名前の拡張と対応表が先に使用される */
function soleSyntaxMark(content: string, env: RenderEnv): Mark | undefined {
  const mark = soleMark(content);
  if (!mark || !Object.hasOwn(SYNTAX_MARKS, mark.name)) {
    return undefined;
  }
  const overridden =
    DIAGRAM_MARKS.includes(mark.name) &&
    (extensionFor(mark.name) || Object.hasOwn(env.libraries, mark.name));
  return overridden ? undefined : mark;
}

/** 範囲の言語 `json` のコードブロックか */
function isJsonFence(token: Token): boolean {
  return token.type === "fence" && token.info.trim().split(/\s+/)[0] === "json";
}

/** `index` の開きのマーカーに対する閉じのマーカーの位置を、同じ階層で探す。無ければ `-1` */
function closeOf(tokens: Token[], index: number, mark: Mark): number {
  const level = tokens[index]?.level;
  return tokens.findIndex((token, position) => {
    if (position <= index || token.type !== "html_block") {
      return false;
    }
    const other = soleMark(token.content);
    return (
      token.level === level &&
      other?.closing === true &&
      other.name === mark.name
    );
  });
}

/** マーカーの名前を `takeMarks` が扱うか（機能のマーカー・記法のマーカー・対応表のマーカー） */
function isHandledMark(name: string, env: RenderEnv): boolean {
  return (
    name === FEATURES_MARK ||
    name === PAGE_MARK ||
    Object.hasOwn(SYNTAX_MARKS, name) ||
    Object.hasOwn(env.libraries, name)
  );
}

/** mdmark が出した要素としてマーカーを付けた HTML を、`html_block` のトークンにする */
function ownHtmlBlock(state: StateCore, html: string): Token {
  const token = new state.Token("html_block", "", 0);
  token.block = true;
  token.content = markOwn(html, (state.env as RenderEnv).nonce);
  return token;
}

/** 範囲の `json` のコードブロックが 1 つで JSON として読めるかを確かめ、読めなければ記載の警告の文を返却する */
function readFence(
  fences: Token[],
  extensionName: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const [fence] = fences;
  if (!fence || fences.length > 1) {
    return {
      ok: false,
      message: `の範囲に json のコードブロックが ${fences.length} つあります。部品の定義は 1 つだけ配置してください。拡張 \`${extensionName}\` の部品は描いていません。`,
    };
  }
  const parsed = parseDefinitionJson(fence.content);
  if (parsed.ok) {
    return { ok: true, value: parsed.value };
  }
  const after = parsed.after.replaceAll("`", "'");
  const where = `${parsed.line} 行目の ${after} の後`;
  const detail =
    parsed.missing === ""
      ? `${where}が読み込めません`
      : `${where}に ${parsed.missing} がありません`;
  return {
    ok: false,
    message: `の部品の定義を JSON として読み込めません（${detail}）。拡張 \`${extensionName}\` の部品は描いていません。`,
  };
}

/** 範囲で記載した拡張のマーカーの `json` のコードブロックを読み込み、マーカーの場所の要素にする。コードブロックが 2 つ以上ある、または JSON として読み込めなければ記載の警告にする */
function extensionSlot(options: {
  state: StateCore;
  mark: Mark;
  fences: Token[];
  extensionName: string;
  /** 開きのマーカーのトークンの `map[0]` */
  line?: number | undefined;
}): Token {
  const { state, mark, fences, extensionName, line } = options;
  const env = state.env as RenderEnv;
  const read = readFence(fences, extensionName);
  if (!read.ok) {
    return warningBlock(
      state,
      withLine({ mark: mark.raw, message: read.message }, line),
    );
  }
  if (mark.source === "legacy" || mark.source === "invalid") {
    return warningBlock(
      state,
      withLine(markProblemWarning(mark) ?? legacyEmbedWarning(mark), line),
    );
  }
  env.extensionDefinitions ??= [];
  const definition = env.extensionDefinitions.push(read.value) - 1;
  return ownHtmlBlock(
    state,
    renderEmbed({ name: mark.name, options: mark.options, definition }),
  );
}

/** 範囲で記載したマーカーのうち、登録した拡張のマーカーは `json` のコードブロックを定義として読み込んでマーカーの場所の要素 1 つ（コードブロックが 2 つ以上なら記載の警告）にし、登録していないマーカーは中身が `json` のコードブロックだけなら中身ごと取り除く。範囲の中身は出力に残さない */
function takeDefinitionRanges(state: StateCore): void {
  const env = state.env as RenderEnv;
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const mark =
      token.type === "html_block" ? soleMark(token.content) : undefined;
    const extension = mark ? extensionFor(mark.name) : undefined;
    // 記法のマーカーと対応表のマーカーは、拡張でなければ今のとおり扱う
    if (
      !mark ||
      mark.closing ||
      (!extension && isHandledMark(mark.name, env))
    ) {
      out.push(token);
      continue;
    }
    index = takeDefinitionRange(state, {
      tokens,
      index,
      mark,
      extension,
      out,
    });
  }
  state.tokens = out;
}

/** 範囲 1 つを、拡張の要素にするか中身ごと取り除き、次に読むトークンの 1 つ前の位置を返却する（どちらでもなければ開きのマーカーを残す） */
function takeDefinitionRange(
  state: StateCore,
  range: {
    tokens: Token[];
    index: number;
    mark: Mark;
    extension: ReturnType<typeof extensionFor>;
    out: Token[];
  },
): number {
  const { tokens, index, mark, extension, out } = range;
  const token = tokens[index] as Token;
  const closeIndex = closeOf(tokens, index, mark);
  const inner = closeIndex < 0 ? [] : tokens.slice(index + 1, closeIndex);
  const fences = inner.filter(isJsonFence);
  if (extension && fences.length > 0) {
    out.push(
      extensionSlot({
        state,
        mark,
        fences,
        extensionName: extension.name,
        line: token.map?.[0],
      }),
    );
    return closeIndex;
  }
  if (!extension && inner.length > 0 && fences.length === inner.length) {
    return closeIndex;
  }
  out.push(token);
  return index;
}

/** マーカーと空白だけの `html_block` か */
function isMarksOnly(token: Token): boolean {
  return (
    token.type === "html_block" &&
    token.content.replace(MARK_PATTERN, "").trim() === ""
  );
}

/** マーカーだけの `html_block` の page のマーカーを取得する。文書の先頭（それより前がマーカーだけの `html_block`）のマーカーは設定を環境へ追加して取り除き（誤りがあればその場所を記載の警告にする）、先頭に無いマーカーは記載の警告に置き換える */
function takePageMarks(state: StateCore): void {
  let atTop = true;
  state.tokens = state.tokens.map((token) => {
    const mark =
      token.type === "html_block" ? soleMark(token.content) : undefined;
    if (mark?.name !== PAGE_MARK || mark.closing) {
      atTop &&= isMarksOnly(token);
      return token;
    }
    return takePageMark(state, { token, mark, atTop });
  });
}

/** page のマーカー 1 つ。文書の先頭なら設定を環境へ追加して取り除き、先頭に無いマーカーは記載の警告に置き換える */
function takePageMark(
  state: StateCore,
  page: { token: Token; mark: Mark; atTop: boolean },
): Token {
  const env = state.env as RenderEnv;
  const { token, mark, atTop } = page;
  const line = token.map?.[0];
  if (line !== undefined) {
    recordMarkNotes(env, { notes: notesOf(mark, env), line: line + 1 });
  }
  if (!atTop) {
    return warningBlock(
      state,
      withLine(
        {
          mark: mark.raw,
          message:
            "は文書の先頭（最初の見出し・段落・表・リスト・コードブロックより前）に記載します。この場所のマーカーは使用していません。",
        },
        line,
      ),
    );
  }
  env.pageOptions ??= [];
  env.pageOptions.push({ raw: mark.raw, options: mark.options });
  const warning = markProblemWarning(mark);
  if (warning) {
    return warningBlock(state, withLine(warning, line));
  }
  token.content = "";
  return token;
}

/** 値の `-->` でコメントが閉じたマーカー（`<!-- 名前: {"title": "a -->` の後ろに文字が続く `html_block`）を、マーカーだけの `html_block` と、続く文字の段落に分ける */
function splitEarlyClosedMarks(state: StateCore): void {
  const out: Token[] = [];
  for (const token of state.tokens) {
    const match =
      token.type === "html_block"
        ? /^(<!--\s*[a-z][a-z0-9-]*:\s*(\{.*?)-->)(.*\S.*)$/s.exec(
            token.content.trimEnd(),
          )
        : null;
    const [, mark = "", args = "", rest = ""] = match ?? [];
    if (!match || !hasUnclosedString(args)) {
      out.push(token);
      continue;
    }
    token.content = `${mark}\n`;
    out.push(token);
    const open = new state.Token("paragraph_open", "p", 1);
    const inline = new state.Token("inline", "", 0);
    const text = new state.Token("text", "", 0);
    const close = new state.Token("paragraph_close", "p", -1);
    open.map = token.map;
    inline.map = token.map;
    inline.content = rest;
    text.content = rest;
    inline.children = [text];
    out.push(open, inline, close);
  }
  state.tokens = out;
}

/** マーカーだけの `html_block` の記法のマーカーを、マーカーのトークンにする（誤りは記載の警告にして前に差し込む）。記法のマーカーでなければ `false` を返却する */
function takeSyntaxMark(
  state: StateCore,
  block: { token: Token; line: number | undefined; out: Token[] },
): boolean {
  const env = state.env as RenderEnv;
  const { token, line, out } = block;
  const mark = soleSyntaxMark(token.content, env);
  if (!mark) {
    return false;
  }
  const warning = markProblemWarning(mark);
  if (warning) {
    out.push(warningBlock(state, withLine(warning, line)));
  }
  if (line !== undefined) {
    recordMarkNotes(env, { notes: notesOf(mark, env), line: line + 1 });
  }
  token.type = MARK_TOKEN;
  token.meta = mark;
  token.content = "";
  out.push(token);
  return true;
}

/** 行内の HTML（inline トークンの子）のマーカーを置き換え、記載の警告を返却する */
function replaceInlineMarks(
  token: Token,
  context: { env: RenderEnv; line: number | undefined },
): SyntaxWarning[] {
  const warnings: SyntaxWarning[] = [];
  for (const child of token.children ?? []) {
    if (child.type === "html_inline") {
      child.content = replaceMarks(child.content, context.env, {
        line: context.line,
        warnings,
      });
    }
  }
  return warnings;
}

/** マーカーを取得し、`features` は設定を環境へ追加し、`page` は文書の先頭なら環境へ追加し、対応表と拡張の名前はマーカーの場所の要素にし、記法のマーカーはマーカーのトークンにし、それ以外は取り除く。引数の誤りは記載の警告にしてマーカーの前に差し込み、注記を記録する */
export function takeMarks(state: StateCore): void {
  const env = state.env as RenderEnv;
  splitEarlyClosedMarks(state);
  takeDefinitionRanges(state);
  takePageMarks(state);
  const out: Token[] = [];
  for (const token of state.tokens) {
    const line = token.map?.[0];
    if (token.type === "html_block") {
      if (takeSyntaxMark(state, { token, line, out })) {
        continue;
      }
      const warnings: SyntaxWarning[] = [];
      token.content = replaceMarks(token.content, env, { line, warnings });
      for (const warning of warnings) {
        out.push(warningBlock(state, withLine(warning, line)));
      }
    }
    for (const warning of replaceInlineMarks(token, { env, line })) {
      out.push(warningBlock(state, withLine(warning, line)));
    }
    out.push(token);
  }
  state.tokens = out;
}

/** `takeMarks` の後に、設定の `features` に文書の `features` のマーカーを重ねて `env.features` に入れる */
export function resolveDocumentFeatures(state: StateCore): void {
  const env = state.env as RenderEnv;
  env.features = resolveFeatures({
    defaults: env.defaults,
    marks: env.featureOptions,
  });
}

/** `takeMarks` が取得した先頭の page のマーカーの設定を記載した順に重ねて `env.page` に入れる */
export function resolvePageSettings(state: StateCore): void {
  const env = state.env as RenderEnv;
  env.page = readPageSettings(
    (env.pageOptions ?? []).map((mark) => mark.options),
  );
}

/** 最後に、記法が使用しなかったマーカーのトークン（オフの記法のマーカーを含む）を取り除く */
export function dropMarks(state: StateCore): void {
  state.tokens = state.tokens.filter((token) => token.type !== MARK_TOKEN);
}
