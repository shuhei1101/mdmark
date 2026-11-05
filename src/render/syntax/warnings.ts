import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { renderSyntaxWarning } from "../../parts/syntax-warning.ts";
import type { Mark } from "../marks.ts";
import { envOf, ownBlock } from "./tokens.ts";

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
  kind: "diagram_invalid" | "syntax_warning";
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
  kind: "diagram_invalid" | "syntax_warning";
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

/** 範囲の印に閉じの印が無いときの警告 */
export function unclosedWarning(mark: Mark): SyntaxWarning {
  return {
    mark: mark.raw,
    message: `の閉じの印 \`<!-- /${mark.name} -->\` がありません。範囲の終わりに閉じの印を書いてください。印から文書の終わりまでを範囲にして描いています。`,
  };
}
