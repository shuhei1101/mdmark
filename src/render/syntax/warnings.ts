import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { renderSyntaxWarning } from "../../parts/syntax-warning.ts";
import type { Mark } from "../marks.ts";
import { envOf, ownBlock } from "./tokens.ts";

/** 集める警告の種類。`unknown_mark_arg` は画面に出さず、点検だけが返す */
export type WarningKind = "diagram_invalid" | "syntax_warning" | "unknown_mark_arg";

/** 記法の印の知らない種類・`+機能`・`-機能`・キー・指定の単語 1 つと、その印で使えるもの */
export type SkippedArg = {
  /** 書いた引数の文字。キーは `{キー}=` */
  arg: string;
  /** その印で使える種類・機能・キー・指定を行内のコードにして `・` でつないだ文字 */
  usable: string;
};

/** 書き方の警告に渡す値 */
export type SyntaxWarning = {
  /** 読めない指定を書いた印の文字 */
  mark?: string;
  /** 本文 */
  message: string;
  /** 項目 */
  items?: WarningItem[];
  /** 枠の `id` */
  id?: string;
  /** 警告の種類（省くと `syntax_warning`） */
  kind?: "diagram_invalid" | "syntax_warning";
  /** 警告の元のマーカーのトークンの `map[0]`（マーカーのトークンを持たない警告は省く） */
  line?: number;
  /** include のマーカーの取り込み先が無い警告か（`mdmark check --text`・`--file` が除く） */
  includeTarget?: boolean;
};

/** トークンの `meta.warning` に入れる、集める警告の種類・文・マーカーの行 */
export type WarningMeta = {
  kind: WarningKind;
  message: string;
  line?: number;
  includeTarget?: boolean;
};

/** 警告の本文と項目を、HTML のタグを除いた文字にして空白 1 つでつなぐ */
function plainMessage(warning: SyntaxWarning): string {
  const strip = (text: string) => text.replaceAll("`", "");
  return [
    `${warning.mark ?? ""}${strip(warning.message)}`,
    ...(warning.items ?? []).map(
      (item) => `${item.label ? `${item.label}: ` : ""}${strip(item.message)}`,
    ),
  ].join(" ");
}

/** 警告の `html_block` を作り、`meta.warning` に集める警告を入れる */
function makeWarningToken(
  state: StateCore,
  warning: SyntaxWarning,
  source: Token | undefined,
) {
  const { kind = "syntax_warning", includeTarget, ...view } = warning;
  delete view.line;
  const line = warning.line ?? source?.map?.[0];
  const token = ownBlock(state, renderSyntaxWarning(view));
  const meta: WarningMeta = {
    kind,
    message: plainMessage(warning),
    ...(line === undefined ? {} : { line }),
    ...(includeTarget ? { includeTarget } : {}),
  };
  token.meta = { ...(token.meta ?? {}), warning: meta };
  return token;
}

/** 書き方の警告の HTML に印を掛けて `html_block` にし、`index` の位置に差し込む。`source` は警告の元になったマーカーのトークン（範囲なら開きのマーカー）で、その行を警告の場所にする */
export function pushWarning(
  state: StateCore,
  index: number,
  warning: SyntaxWarning,
  source?: Token,
): void {
  state.tokens.splice(index, 0, makeWarningToken(state, warning, source));
}

/** 書き方の警告の `html_block` を作る（差し込む位置を呼ぶ側が決めるとき）。`source` は `pushWarning` と同じ */
export function warningBlock(
  state: StateCore,
  warning: SyntaxWarning,
  source?: Token,
) {
  return makeWarningToken(state, warning, source);
}

/** 集めた書き方の警告 1 つ（元の行番号は 1 から） */
export type CollectedWarning = {
  line: number;
  kind: WarningKind;
  message: string;
  /** include のマーカーの取り込み先が無い警告か */
  includeTarget?: boolean;
};

/** 警告の元の行（0 から）: マーカーの行、無ければ後ろで最初に `map` を持つトークンの開始の行、それも無ければ前で最後に `map` を持つトークンの終わりの行 */
function warningLine(
  tokens: Token[],
  index: number,
  meta: WarningMeta,
): number {
  if (meta.line !== undefined) {
    return meta.line;
  }
  const after = tokens.slice(index + 1).find((other) => other.map);
  if (after?.map) {
    return after.map[0];
  }
  const before = tokens
    .slice(0, index)
    .reverse()
    .find((other) => other.map);
  return before?.map ? before.map[1] - 1 : 0;
}

/** コアルール（最後に走る）: `meta.warning`（埋め込んだ HTML の範囲は `meta.warnings`）を持つトークンごとに、警告の元の行を 1 からの行番号にして `env.warnings` に集める */
export function collectWarningsRule(state: StateCore): void {
  const warnings: CollectedWarning[] = [];
  state.tokens.forEach((token, index) => {
    const metas: WarningMeta[] = [
      ...(token.meta?.warning ? [token.meta.warning as WarningMeta] : []),
      ...((token.meta?.warnings as WarningMeta[] | undefined) ?? []),
    ];
    for (const meta of metas) {
      warnings.push({
        line: warningLine(state.tokens, index, meta) + 1,
        kind: meta.kind,
        message: meta.message,
        ...(meta.includeTarget ? { includeTarget: true } : {}),
      });
    }
  });
  envOf(state).warnings = warnings;
}

/** 読み飛ばした引数 1 つにつき、画面に何も出さない `html_block` を作り、`meta.warning` に `unknown_mark_arg` の文と印の行を入れて書いた順に返す（差し込む位置を呼ぶ側が決めるとき） */
export function skippedArgBlocks(
  state: StateCore,
  options: { mark: string; skipped: SkippedArg[] },
  source?: Token,
): Token[] {
  const line = source?.map?.[0];
  return options.skipped.map((skipped) => {
    const token = new state.Token("html_block", "", 0);
    token.block = true;
    const meta: WarningMeta = {
      kind: "unknown_mark_arg",
      message: `${options.mark} の ${skipped.arg} はこの版の mdmark が知らない指定で、描くときは読み飛ばしています。使えるのは ${skipped.usable.replaceAll("`", "")} です。書き誤りなら名前を直し、新しい版の指定なら mdmark の版を上げてください。`,
      ...(line === undefined ? {} : { line }),
    };
    token.meta = { warning: meta };
    return token;
  });
}

/** `skippedArgBlocks` のトークンを `index` の位置に差し込む */
export function pushSkippedArgs(
  state: StateCore,
  index: number,
  options: { mark: string; skipped: SkippedArg[] },
  source?: Token,
): void {
  state.tokens.splice(index, 0, ...skippedArgBlocks(state, options, source));
}

/** 範囲の印に閉じの印が無いときの警告 */
export function unclosedWarning(mark: Mark): SyntaxWarning {
  return {
    mark: mark.raw,
    message: `の閉じの印 \`<!-- /${mark.name} -->\` がありません。範囲の終わりに閉じの印を書いてください。印から文書の終わりまでを範囲にして描いています。`,
  };
}
