import type { StateCore, Token } from "markdown-it";
import { escapeHtml } from "../../parts/escape.ts";
import { takeMarks } from "../marks.ts";
import type { RenderEnv } from "../parser.ts";
import { slugBase } from "./headings.ts";
import { envOf, featureOn, markOf, tabBoundaryBlock } from "./tokens.ts";
import { type SyntaxWarning, warningBlock } from "./warnings.ts";

/** 取り込む範囲: 全体・見出しの中・行の範囲 */
export type IncludeTarget =
  | { kind: "whole" }
  | { kind: "heading"; id: string }
  | { kind: "lines"; from: number; to: number };

/** Markdown として描くファイルの拡張子 */
const MARKDOWN_PATTERN = /\.(?:md|markdown)$/i;

/** `#L開始-L終了`・`#L開始` の行の範囲 */
const LINES_PATTERN = /^L(\d+)(?:-L(\d+))?$/;

/** パスが Markdown のファイルか */
export const isMarkdownPath = (path: string): boolean =>
  MARKDOWN_PATTERN.test(path);

/** `/` で区切ったパスの `.`・`..` を解く。先頭から上へ出る `..` は残す */
const normalizePath = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === ".." && parts.length > 0 && parts.at(-1) !== "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
};

/** マーカーを書いた文書のフォルダを基準に、書いた取り込み先を描く文書のフォルダからのパスと取り込む範囲にする */
export const resolveIncludePath = (
  fromPath: string,
  written: string,
): { key: string; target: IncludeTarget } => {
  const hash = written.indexOf("#");
  const path = hash < 0 ? written : written.slice(0, hash);
  const fragment = hash < 0 ? "" : written.slice(hash + 1);
  const slash = fromPath.lastIndexOf("/");
  const dir = slash < 0 ? "" : fromPath.slice(0, slash);
  const key = normalizePath(dir ? `${dir}/${path}` : path);
  if (fragment === "") {
    return { key, target: { kind: "whole" } };
  }
  const lines = isMarkdownPath(key) ? null : LINES_PATTERN.exec(fragment);
  if (lines) {
    const from = Number(lines[1]);
    const to = lines[2] === undefined ? from : Number(lines[2]);
    return { key, target: { kind: "lines", from, to } };
  }
  return { key, target: { kind: "heading", id: fragment } };
};

/** 見出しの文字の ID が `id` と一致する最初の見出しから、次の同じか上の階層の見出しの前までを返す。無ければ `null` */
export const selectHeadingSection = (
  tokens: Token[],
  id: string,
): Token[] | null => {
  const start = tokens.findIndex(
    (token, index) =>
      token.type === "heading_open" &&
      slugBase(tokens[index + 1]?.content ?? "") === id,
  );
  if (start < 0) {
    return null;
  }
  const depth = Number(tokens[start]?.tag.slice(1));
  const end = tokens.findIndex(
    (token, index) =>
      index > start &&
      token.type === "heading_open" &&
      Number(token.tag.slice(1)) <= depth,
  );
  return tokens.slice(start, end < 0 ? tokens.length : end);
};

/** 本文の `from`〜`to` 行目（1 から）を返す。範囲が行の数を越えるときは行の数を返す */
export const selectLines = (
  text: string,
  from: number,
  to: number,
): { text: string } | { lineCount: number } => {
  const lines = text.replace(/\r?\n$/, "").split(/\r?\n/);
  if (from < 1 || to < from || to > lines.length) {
    return { lineCount: lines.length };
  }
  return { text: lines.slice(from - 1, to).join("\n") };
};

/** 取り込む Markdown を、同じパーサの block と inline のルールでトークンにし、マーカーを拾う（`features` の印は使わない） */
const tokenize = (state: StateCore, text: string): Token[] => {
  const env = envOf(state);
  const subEnv: RenderEnv = { ...env, featureArgs: [] };
  const tokens: Token[] = [];
  state.md.block.parse(text.replace(/\r\n?/g, "\n"), state.md, subEnv, tokens);
  for (const token of tokens) {
    if (token.type !== "inline") {
      continue;
    }
    const children: Token[] = [];
    state.md.inline.parse(token.content, state.md, subEnv, children);
    // markdown-it の text_join と同じく、打ち消した文字を文字にする
    for (const child of children) {
      if (child.type === "text_special") {
        child.type = "text";
      }
    }
    token.children = children;
  }
  const sub = new state.md.core.State(text, state.md, subEnv);
  sub.tokens = tokens;
  takeMarks(sub);
  return sub.tokens;
};

/** 取り込めないマーカーの警告の本文 */
const problemMessage = (problem: {
  kind: "missing" | "heading" | "lines" | "circular";
  key: string;
  id?: string;
  lineCount?: number;
  from?: number;
  to?: number;
  chain?: string[];
}): string => {
  switch (problem.kind) {
    case "missing":
      return `の取り込み先 \`${problem.key}\` が見つかりません。パスを修正してください。`;
    case "heading":
      return `の \`${problem.key}\` に、ID が \`${problem.id}\` の見出しがありません。見出しの ID を修正してください。`;
    case "lines":
      return `の \`${problem.key}\` は ${problem.lineCount} 行で、${problem.from}〜${problem.to} 行目がありません。行の範囲を修正してください。`;
    case "circular":
      return `の取り込みが循環しています（\`${(problem.chain ?? []).join(" → ")}\`）。この場所では取り込んでいません。`;
    default: {
      const never: never = problem.kind;
      return never;
    }
  }
};

/** トークンの深さと元の行番号を、マーカーの場所に合わせる */
const placeAt = (tokens: Token[], marker: Token): Token[] => {
  for (const token of tokens) {
    token.level += marker.level;
    if (token.map && marker.map) {
      token.map = [...marker.map];
    }
  }
  return tokens;
};

/** 1 つの include のマーカーを、取り込んだ中身か書き方の警告のトークンにする */
const expandMarker = (options: {
  state: StateCore;
  marker: Token;
  fromPath: string;
  chain: string[];
}): Token[] => {
  const { state, marker, fromPath, chain } = options;
  const mark = markOf(marker);
  const written = (mark?.rest ?? "").trim();
  const { key, target } = resolveIncludePath(fromPath, written);
  const warn = (message: string): Token[] => {
    const warning: SyntaxWarning = { mark: mark?.raw ?? "", message };
    const block = warningBlock(state, warning);
    block.map = marker.map ? [...marker.map] : null;
    return [block];
  };
  if (chain.includes(key)) {
    return warn(
      problemMessage({ kind: "circular", key, chain: [...chain, key] }),
    );
  }
  const includes = envOf(state).includes ?? {};
  const text = Object.hasOwn(includes, key) ? includes[key] : undefined;
  if (text === undefined) {
    return warn(problemMessage({ kind: "missing", key }));
  }
  let inner: Token[];
  if (isMarkdownPath(key)) {
    const tokens = tokenize(state, text);
    const selected =
      target.kind === "heading"
        ? selectHeadingSection(tokens, target.id)
        : tokens;
    if (selected === null) {
      return warn(
        problemMessage({
          kind: "heading",
          key,
          id: target.kind === "heading" ? target.id : "",
        }),
      );
    }
    inner = expandTokens({
      state,
      tokens: selected,
      fromPath: key,
      chain: [...chain, key],
    });
  } else {
    let content = text;
    if (target.kind === "lines") {
      const lines = selectLines(text, target.from, target.to);
      if ("lineCount" in lines) {
        return warn(
          problemMessage({
            kind: "lines",
            key,
            lineCount: lines.lineCount,
            from: target.from,
            to: target.to,
          }),
        );
      }
      content = lines.text;
    }
    const fence = new state.Token("fence", "code", 0);
    fence.block = true;
    fence.markup = "```";
    fence.info = /\.([^./]+)$/.exec(key)?.[1] ?? "";
    fence.content = content.endsWith("\n") ? content : `${content}\n`;
    fence.map = [0, 1];
    inner = [fence];
  }
  return [
    tabBoundaryBlock({
      state,
      html: `<div class="mdmark-include" data-include="${escapeHtml(written)}">`,
      boundary: "start",
      source: marker,
    }),
    ...placeAt(inner, marker),
    tabBoundaryBlock({
      state,
      html: "</div>",
      boundary: "end",
      source: marker,
    }),
  ];
};

/** トークンの並びの include のマーカーを、取り込んだ中身にする */
const expandTokens = (options: {
  state: StateCore;
  tokens: Token[];
  fromPath: string;
  chain: string[];
}): Token[] => {
  const { state, tokens, fromPath, chain } = options;
  return tokens.flatMap((token) => {
    const mark = markOf(token);
    if (mark?.name !== "include" || mark.closing) {
      return [token];
    }
    return expandMarker({ state, marker: token, fromPath, chain });
  });
};

/** `include` がオンなら、include のマーカーを `opts.includes` の中身に置き換える（オフの印は `dropMarks` が取り除く） */
export const expandIncludes = (state: StateCore): void => {
  if (!featureOn(state, "include")) {
    return;
  }
  state.tokens = expandTokens({
    state,
    tokens: state.tokens,
    fromPath: "",
    chain: [],
  });
};
