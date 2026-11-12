import { readFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import type { Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import { readMarkArgs } from "../render/mark-options.ts";
import { MARK_PATTERN } from "../render/marks.ts";
import {
  isMarkdownPath,
  resolveIncludePath,
  selectHeadingSection,
  selectLines,
  writtenOf,
} from "../render/syntax/includes.ts";

/** 取り込めない include のマーカー 1 つ */
export type IncludeProblem = {
  /** 無いファイル・無い見出し・行の数を越える範囲・根の外・循環 */
  kind: "missing" | "heading" | "lines" | "outside" | "circular";
  /** マーカーを記載した文書の、文書のフォルダからのパス（文書そのものは空文字） */
  file: string;
  /** マーカーの行（1 から） */
  line: number;
  /** マーカーに記載した取り込み先 */
  target: string;
  /** `lines` のときのファイルの行の数 */
  lineCount?: number;
  /** `circular` のときの取り込みの順（最初と最後が同じキー） */
  chain?: string[];
};

/** マーカーを取得する解析器（記法のコアルールを持たない） */
const markParser = new MarkdownIt({ html: true });

/** 本文の include のマーカー（コードブロックとインラインコードの中を除く）を、記載した取り込み先と行（1 から）で返却する */
export const findIncludeMarkers = (
  markdown: string,
): Array<{ written: string; line: number }> => {
  const found: Array<{ written: string; line: number }> = [];
  for (const token of markParser.parse(markdown, {})) {
    if (token.type !== "html_block" || !token.map) {
      continue;
    }
    for (const match of token.content.matchAll(MARK_PATTERN)) {
      if (match[1] !== undefined || match[2] !== "include") {
        continue;
      }
      const before = token.content.slice(0, match.index);
      const args = readMarkArgs(match[3] ?? "");
      found.push({
        written:
          args.kind === "json"
            ? writtenOf(args.options)
            : args.kind === "legacy"
              ? args.text
              : "",
        line: token.map[0] + 1 + (before.split("\n").length - 1),
      });
    }
  }
  return found;
};

/** 文書が `<!-- features: {"include": false} -->`（今の書き方の `-include`）で取り込みを削除しているか */
const includeDisabled = (markdown: string): boolean => {
  let disabled = false;
  for (const match of markdown.matchAll(MARK_PATTERN)) {
    if (match[1] === undefined && match[2] === "features") {
      const args = readMarkArgs(match[3] ?? "");
      if (args.kind === "json" && typeof args.options.include === "boolean") {
        disabled = !args.options.include;
      }
      if (args.kind === "legacy") {
        for (const arg of args.text.split(/\s+/)) {
          if (arg === "-include") {
            disabled = true;
          } else if (arg === "+include") {
            disabled = false;
          }
        }
      }
    }
  }
  return disabled;
};

/** `inner` が `root` の中のパスか */
const isInside = (root: string, inner: string): boolean => {
  const path = relative(root, inner);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
};

/** 取り込む Markdown の、見出しの範囲の行（0 から）を返却する。見出しが無ければ `null` */
const headingLines = (
  markdown: string,
  id: string,
): { start: number; end: number } | null => {
  const tokens = markParser.parse(markdown, {});
  const section = selectHeadingSection(tokens, id);
  if (section === null) {
    return null;
  }
  const start = section[0]?.map?.[0] ?? 0;
  const next = tokens[tokens.indexOf(section.at(-1) as Token) + 1];
  const end = next?.map?.[0] ?? markdown.split("\n").length;
  return { start, end };
};

/** 文書の include のマーカーを解き、根のフォルダの中のファイルだけを読み込んで、キーを文書のフォルダからのパスにした取り込む文書の表を作る。取り込めないマーカーを問題として返却する */
export const collectIncludes = async (options: {
  /** 文書の絶対パス */
  docPath: string;
  /** 文書の本文 */
  markdown: string;
  /** 根のフォルダの絶対パス */
  root: string;
}): Promise<{
  includes: Record<string, string>;
  problems: IncludeProblem[];
}> => {
  const { docPath, markdown, root } = options;
  const includes: Record<string, string> = {};
  const problems: IncludeProblem[] = [];
  if (includeDisabled(markdown)) {
    return { includes, problems };
  }
  const docDir = dirname(docPath);
  const cache = new Map<string, Promise<string | undefined>>();
  const read = (file: string): Promise<string | undefined> => {
    let pending = cache.get(file);
    if (!pending) {
      pending = readFile(file, "utf8").catch(() => undefined);
      cache.set(file, pending);
    }
    return pending;
  };
  const seen = new Set<string>();
  const add = (problem: IncludeProblem): void => {
    const key = `${problem.kind}\u0000${problem.file}\u0000${problem.line}`;
    if (!seen.has(key)) {
      seen.add(key);
      problems.push(problem);
    }
  };

  /** `text`（`from` のファイルの `offset` 行目からの本文）のマーカーをたどる */
  const visit = async (
    text: string,
    from: string,
    offset: number,
    chain: string[],
  ): Promise<void> => {
    for (const { written, line } of findIncludeMarkers(text)) {
      const at = { file: from, line: offset + line, target: written };
      const { key, target } = resolveIncludePath(from, written);
      const file = resolve(docDir, key);
      if (!isInside(root, file)) {
        add({ ...at, kind: "outside" });
        continue;
      }
      if (chain.includes(key)) {
        // 循環の順は、同じキーが最初に現れたところから示す
        add({
          ...at,
          kind: "circular",
          chain: [...chain.slice(chain.indexOf(key)), key],
        });
        continue;
      }
      const content = await read(file);
      if (content === undefined) {
        add({ ...at, kind: "missing" });
        continue;
      }
      includes[key] = content;
      if (!isMarkdownPath(key)) {
        if (target.kind === "lines") {
          const lines = selectLines(content, target.from, target.to);
          if ("lineCount" in lines) {
            add({ ...at, kind: "lines", lineCount: lines.lineCount });
          }
        }
        continue;
      }
      let start = 0;
      let end = content.split("\n").length;
      if (target.kind === "heading") {
        const range = headingLines(content, target.id);
        if (range === null) {
          add({ ...at, kind: "heading" });
          continue;
        }
        ({ start, end } = range);
      }
      const section = content.split("\n").slice(start, end).join("\n");
      await visit(section, key, start, [...chain, key]);
    }
  };
  // 点検する文書そのものも取り込みの順に入れ、文書へ戻る取り込みを循環として見つける
  await visit(markdown, "", 0, [basename(docPath)]);
  return { includes, problems };
};

/** 取り込めないマーカーの内容と修正方法の 1 文 */
export const includeProblemMessage = (problem: IncludeProblem): string => {
  const { target } = problem;
  switch (problem.kind) {
    case "missing":
      return `取り込み先 \`${target}\` のファイルがありません。パスを修正してください。`;
    case "heading": {
      const id = target.slice(target.indexOf("#") + 1);
      return `取り込み先 \`${target}\` に、ID が \`${id}\` の見出しがありません。見出しの ID を修正してください。`;
    }
    case "lines": {
      const range = target.slice(target.indexOf("#") + 1);
      return `取り込み先 \`${target}\` は ${problem.lineCount} 行で、${range} の行がありません。行の範囲を修正してください。`;
    }
    case "outside":
      return `取り込み先 \`${target}\` は設定ファイルのフォルダの外を指しています。設定ファイルのフォルダの中のファイルを取り込んでください。`;
    case "circular":
      return `取り込みが循環しています（\`${(problem.chain ?? []).join(" → ")}\`）。循環しないよう取り込み先を修正してください。`;
    default: {
      const never: never = problem.kind;
      return never;
    }
  }
};
