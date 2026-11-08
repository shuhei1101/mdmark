import type { StateCore, Token } from "markdown-it";
import { parseDefinitionJson } from "../diagram/definition.ts";
import { extensionFor, type MdmarkMarkArgs } from "../extensions.ts";
import { resolveFeatures } from "../features.ts";
import { renderEmbed } from "../parts/embed.ts";
import { markOwn } from "../parts/own.ts";
import { readPageSettings } from "./page.ts";
import type { RenderEnv } from "./parser.ts";
import { skippedArgBlocks, warningBlock } from "./syntax/warnings.ts";

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
};

/** 図の部品のマーカーの名前。同じ名前の拡張と対応表が先に使用される */
const DIAGRAM_MARKS = ["flow", "sequence", "chart", "param", "er"];

/** マーカーのトークンの type */
export const MARK_TOKEN = "mdmark_mark";

/** 文書から取得したマーカー 1 つ */
export type Mark = {
  /** マーカーの名前 */
  name: string;
  /** 判別した引数 */
  args: MdmarkMarkArgs;
  /** マーカーの文字のまま（記載の警告に出す） */
  raw: string;
  /** 閉じのマーカー（`<!-- /名前 -->`）か */
  closing: boolean;
  /** マーカーの引数の文字（コロンの後ろ）。空白で区切る前のまま */
  rest?: string;
};

/** マーカーの引数の文字を空白で区切り、`キー=値` を `keys`、それ以外を記載した順に `args` に入れる */
export function parseMarkArgs(text: string): MdmarkMarkArgs {
  const value: MdmarkMarkArgs = { args: [], keys: {} };
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

/** 正規表現のマッチの各部分からマーカーを作る */
function toMark(
  raw: string,
  closing: string | undefined,
  name: string,
  rest: string | undefined,
): Mark {
  return {
    name,
    args: parseMarkArgs(rest ?? ""),
    raw,
    closing: closing === "/",
    rest: rest ?? "",
  };
}

/** HTML の中のマーカーを、`features` は引数を取得して取り除き、対応表と拡張の名前はマーカーの場所の要素に置き換え、それ以外は取り除く */
function replaceMarks(html: string, env: RenderEnv): string {
  return html.replace(
    MARK_PATTERN,
    (
      raw: string,
      closing: string | undefined,
      name: string,
      rest: string | undefined,
    ): string => {
      const mark = toMark(raw, closing, name, rest);
      if (mark.closing) {
        return "";
      }
      if (mark.name === FEATURES_MARK) {
        env.featureArgs.push(...mark.args.args);
        return "";
      }
      // 設定の対応表より登録した拡張を優先する
      if (extensionFor(mark.name) || Object.hasOwn(env.libraries, mark.name)) {
        const args = (rest ?? "").split(/\s+/).filter(Boolean);
        return markOwn(renderEmbed({ name: mark.name, args }), env.nonce);
      }
      return "";
    },
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
  return toMark(only[0], only[1], only[2] ?? "", only[3]);
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
  const [fence] = fences;
  if (!fence || fences.length > 1) {
    return warningBlock(state, {
      mark: mark.raw,
      ...(line === undefined ? {} : { line }),
      message: `の範囲に json のコードブロックが ${fences.length} つあります。部品の定義は 1 つだけ配置してください。拡張 \`${extensionName}\` の部品は描いていません。`,
    });
  }
  const parsed = parseDefinitionJson(fence.content);
  if (!parsed.ok) {
    const after = parsed.after.replaceAll("`", "'");
    const where = `${parsed.line} 行目の ${after} の後`;
    const detail =
      parsed.missing === ""
        ? `${where}が読み込めません`
        : `${where}に ${parsed.missing} がありません`;
    return warningBlock(state, {
      mark: mark.raw,
      ...(line === undefined ? {} : { line }),
      message: `の部品の定義を JSON として読み込めません（${detail}）。拡張 \`${extensionName}\` の部品は描いていません。`,
    });
  }
  env.extensionDefinitions ??= [];
  const definition = env.extensionDefinitions.push(parsed.value) - 1;
  const args = (mark.rest ?? "").split(/\s+/).filter(Boolean);
  return ownHtmlBlock(
    state,
    renderEmbed({ name: mark.name, args, definition }),
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
      index = closeIndex;
    } else if (
      !extension &&
      inner.length > 0 &&
      fences.length === inner.length
    ) {
      index = closeIndex;
    } else {
      out.push(token);
    }
  }
  state.tokens = out;
}

/** マーカーと空白だけの `html_block` か */
function isMarksOnly(token: Token): boolean {
  return (
    token.type === "html_block" &&
    token.content.replace(MARK_PATTERN, "").trim() === ""
  );
}

/** マーカーだけの `html_block` の page のマーカーを取得する。文書の先頭（それより前がマーカーだけの `html_block`）のマーカーは引数を環境へ追加して取り除き、先頭に無いマーカーは記載の警告に置き換える */
function takePageMarks(state: StateCore): void {
  const env = state.env as RenderEnv;
  let atTop = true;
  state.tokens = state.tokens.map((token) => {
    const mark =
      token.type === "html_block" ? soleMark(token.content) : undefined;
    if (mark?.name !== PAGE_MARK || mark.closing) {
      atTop &&= isMarksOnly(token);
      return token;
    }
    if (atTop) {
      env.pageMarks ??= [];
      env.pageMarks.push({ raw: mark.raw, args: mark.args });
      token.content = "";
      return token;
    }
    return warningBlock(state, {
      mark: mark.raw,
      ...(token.map?.[0] === undefined ? {} : { line: token.map[0] }),
      message:
        "は文書の先頭（最初の見出し・段落・表・リスト・コードブロックより前）に記載します。この場所のマーカーは使用していません。",
    });
  });
}

/** マーカーを取得し、`features` は引数を環境へ追加し、`page` は文書の先頭なら環境へ追加し、対応表と拡張の名前はマーカーの場所の要素にし、記法のマーカーはマーカーのトークンにし、それ以外は取り除く */
export function takeMarks(state: StateCore): void {
  const env = state.env as RenderEnv;
  takeDefinitionRanges(state);
  takePageMarks(state);
  for (const token of state.tokens) {
    if (token.type === "html_block") {
      const mark = soleSyntaxMark(token.content, env);
      if (mark) {
        token.type = MARK_TOKEN;
        token.meta = mark;
        token.content = "";
        continue;
      }
      token.content = replaceMarks(token.content, env);
    }
    // 行内の HTML は inline トークンの子にある
    for (const child of token.children ?? []) {
      if (child.type === "html_inline") {
        child.content = replaceMarks(child.content, env);
      }
    }
  }
}

/** `takeMarks` の後に、設定の `features` に文書の `features` のマーカーを重ねて `env.features` に入れる */
export function resolveDocumentFeatures(state: StateCore): void {
  const env = state.env as RenderEnv;
  env.features = resolveFeatures({
    defaults: env.defaults,
    args: env.featureArgs,
  });
}

/** `takeMarks` が取得した先頭の page のマーカーを読み込んで `env.page` に入れ、記載できるキーの知らない値があれば文書の先頭に記載の警告を差し込み、知らないキーと指定はスキップした引数にする */
export function resolvePageSettings(state: StateCore): void {
  const env = state.env as RenderEnv;
  const marks = env.pageMarks ?? [];
  const keys: Record<string, string> = {};
  const args: string[] = [];
  for (const mark of marks) {
    args.push(...mark.args.args);
    for (const [key, value] of Object.entries(mark.args.keys)) {
      // 同じキーは後に記載した値を使用する
      delete keys[key];
      keys[key] = value;
    }
  }
  const { settings, unknown, skipped } = readPageSettings({ args, keys });
  env.page = settings;
  const [first] = marks;
  if (!first) {
    return;
  }
  state.tokens.unshift(
    ...skippedArgBlocks(state, {
      mark: first.raw,
      skipped: skipped.map((arg) => ({
        arg,
        usable: "`scheme=`・`theme=`・`toc=`",
      })),
    }),
  );
  if (unknown.length === 0) {
    return;
  }
  const listed = unknown.map((arg) => `\`${arg}\``).join("・");
  state.tokens.unshift(
    warningBlock(state, {
      mark: first.raw,
      message: `の ${listed} は使用できません。記載できるのは \`scheme\`（\`light\`・\`dark\`・\`auto\`）・\`theme\`（\`dev-swiss\`・\`theme-paper\`・\`theme-slate\`・\`theme-contrast\`）・\`toc\`（\`hover\`・\`fixed\`）です。残りの指定で描いています。`,
    }),
  );
}

/** 最後に、記法が使用しなかったマーカーのトークン（オフの記法のマーカーを含む）を取り除く */
export function dropMarks(state: StateCore): void {
  state.tokens = state.tokens.filter((token) => token.type !== MARK_TOKEN);
}
