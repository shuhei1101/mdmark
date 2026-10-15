import type { StateCore } from "markdown-it";
import { extensionFor, type MdmarkMarkArgs } from "../extensions.ts";
import { resolveFeatures } from "../features.ts";
import { renderEmbed } from "../parts/embed.ts";
import { markOwn } from "../parts/own.ts";
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
  section: "sections",
  "row-detail": "row-details",
  fig: "figures",
  toc: "toc",
};

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

/** 印だけの `html_block` から、記法の印を取り出す。記法の印でなければ `undefined` */
function soleSyntaxMark(content: string): Mark | undefined {
  const matches = [...content.matchAll(MARK_PATTERN)];
  const [only] = matches;
  if (
    matches.length !== 1 ||
    !only ||
    content.replace(MARK_PATTERN, "").trim()
  ) {
    return undefined;
  }
  const mark = toMark(only[0], only[1], only[2] ?? "", only[3]);
  return Object.hasOwn(SYNTAX_MARKS, mark.name) ? mark : undefined;
}

/** 印を拾い、`features` は引数を環境へ足し、対応表と拡張の名前は印の場所の要素にし、記法の印は印のトークンにし、それ以外は取り除く */
export function takeMarks(state: StateCore): void {
  const env = state.env as RenderEnv;
  for (const token of state.tokens) {
    if (token.type === "html_block") {
      const mark = soleSyntaxMark(token.content);
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
