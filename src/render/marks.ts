import type { StateCore, Token } from "markdown-it";
import { parseDefinitionJson } from "../diagram/definition.ts";
import { extensionFor, type MdmarkMarkArgs } from "../extensions.ts";
import { resolveFeatures } from "../features.ts";
import { renderEmbed } from "../parts/embed.ts";
import { markOwn } from "../parts/own.ts";
import { renderSyntaxWarning } from "../parts/syntax-warning.ts";
import type { RenderEnv } from "./parser.ts";

/** 生の HTML の中の印（`<!-- 名前: 引数 -->`・`<!-- 名前 -->`・`<!-- /名前 -->`）を拾う正規表現 */
export const MARK_PATTERN =
  /<!--\s*(\/)?([a-z][a-z0-9-]*)(?::\s*(.*?))?\s*-->/gs;

/** 機能のオン・オフを書く印の名前 */
export const FEATURES_MARK = "features";

/** 記法の印の名前から、その記法の機能の名前を引く */
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
  html: "html",
  code: "code",
};

/** 図の部品の印の名前。同じ名前の拡張と対応表が先に使われる */
const DIAGRAM_MARKS = ["flow", "sequence", "chart", "param"];

/** 印のトークンの type */
export const MARK_TOKEN = "mdmark_mark";

/** 文書から拾った印 1 つ */
export type Mark = {
  /** 印の名前 */
  name: string;
  /** 読み分けた引数 */
  args: MdmarkMarkArgs;
  /** 印の文字のまま（書き方の警告に出す） */
  raw: string;
  /** 閉じの印（`<!-- /名前 -->`）か */
  closing: boolean;
  /** 印の引数の文字（コロンの後ろ）。空白で区切る前のまま */
  rest?: string;
};

/** 印の引数の文字を空白で区切り、`キー=値` を `keys`、それ以外を書いた順に `args` に入れる */
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

/** 正規表現のマッチの各部分から印を作る */
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

/** HTML の中の印を、`features` は引数を拾って取り除き、対応表と拡張の名前は印の場所の要素に置き換え、それ以外は取り除く */
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

/** 印だけの `html_block` の内容から、印を取り出す。印だけでなければ `undefined` */
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

/** 印だけの `html_block` から、記法の印を取り出す。記法の印でなければ `undefined`。図の部品の印は、同じ名前の拡張と対応表が先に使われる */
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

/** `index` の開きの印に対する閉じの印の位置を、同じ階層で探す。無ければ `-1` */
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

/** 印の名前を `takeMarks` が扱うか（機能の印・記法の印・対応表の印） */
function isHandledMark(name: string, env: RenderEnv): boolean {
  return (
    name === FEATURES_MARK ||
    Object.hasOwn(SYNTAX_MARKS, name) ||
    Object.hasOwn(env.libraries, name)
  );
}

/** mdmark が出した要素として印を付けた HTML を、`html_block` のトークンにする */
function ownHtmlBlock(state: StateCore, html: string): Token {
  const token = new state.Token("html_block", "", 0);
  token.block = true;
  token.content = markOwn(html, (state.env as RenderEnv).nonce);
  return token;
}

/** 範囲で書いた拡張の印の `json` のコードブロックを読み、印の場所の要素にする。コードブロックが 2 つ以上ある、または JSON として読めなければ書き方の警告にする */
function extensionSlot(options: {
  state: StateCore;
  mark: Mark;
  fences: Token[];
  extensionName: string;
}): Token {
  const { state, mark, fences, extensionName } = options;
  const env = state.env as RenderEnv;
  const [fence] = fences;
  if (!fence || fences.length > 1) {
    return ownHtmlBlock(
      state,
      renderSyntaxWarning({
        mark: mark.raw,
        message: `の範囲に json のコードブロックが ${fences.length} つあります。部品の定義は 1 つだけ置いてください。拡張 \`${extensionName}\` の部品は描いていません。`,
      }),
    );
  }
  const parsed = parseDefinitionJson(fence.content);
  if (!parsed.ok) {
    const after = parsed.after.replaceAll("`", "'");
    const where = `${parsed.line} 行目の ${after} の後`;
    const detail =
      parsed.missing === ""
        ? `${where}が読めません`
        : `${where}に ${parsed.missing} がありません`;
    return ownHtmlBlock(
      state,
      renderSyntaxWarning({
        mark: mark.raw,
        message: `の部品の定義を JSON として読めません（${detail}）。拡張 \`${extensionName}\` の部品は描いていません。`,
      }),
    );
  }
  env.extensionDefinitions ??= [];
  const definition = env.extensionDefinitions.push(parsed.value) - 1;
  const args = (mark.rest ?? "").split(/\s+/).filter(Boolean);
  return ownHtmlBlock(
    state,
    renderEmbed({ name: mark.name, args, definition }),
  );
}

/** 範囲で書いた印のうち、登録した拡張の印は `json` のコードブロックを定義として読んで印の場所の要素 1 つ（コードブロックが 2 つ以上なら書き方の警告）にし、登録していない印は中身が `json` のコードブロックだけなら中身ごと取り除く。範囲の中身は出力に残さない */
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
    // 記法の印と対応表の印は、拡張でなければ今のとおり扱う
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
        extensionSlot({ state, mark, fences, extensionName: extension.name }),
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

/** 印を拾い、`features` は引数を環境へ足し、対応表と拡張の名前は印の場所の要素にし、記法の印は印のトークンにし、それ以外は取り除く */
export function takeMarks(state: StateCore): void {
  const env = state.env as RenderEnv;
  takeDefinitionRanges(state);
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

/** `takeMarks` の後に、設定の `features` に文書の `features` の印を重ねて `env.features` に入れる */
export function resolveDocumentFeatures(state: StateCore): void {
  const env = state.env as RenderEnv;
  env.features = resolveFeatures({
    defaults: env.defaults,
    args: env.featureArgs,
  });
}

/** 最後に、記法が使わなかった印のトークン（オフの記法の印を含む）を取り除く */
export function dropMarks(state: StateCore): void {
  state.tokens = state.tokens.filter((token) => token.type !== MARK_TOKEN);
}
