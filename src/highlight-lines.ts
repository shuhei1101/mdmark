import type { HLJSApi } from "highlight.js";

/** highlight.js が返した HTML を改行で分け、行末で開いている `span` を閉じて次の行の頭で同じ開始タグを開き直す。入力のタグは highlight.js が出す `<span class="...">` と `</span>` だけとして扱い、文字はエスケープ済みのまま切り分ける */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  // 開いている開始タグを、入れ子の順に持つ
  const open: string[] = [];
  let current = "";
  for (const match of html.matchAll(/<span\b[^>]*>|<\/span>|\n|[^<\n]+|</g)) {
    const token = match[0];
    if (token === "\n") {
      current += "</span>".repeat(open.length);
      lines.push(current);
      current = open.join("");
    } else {
      if (token === "</span>") {
        open.pop();
      } else if (token.startsWith("<span")) {
        open.push(token);
      }
      current += token;
    }
  }
  lines.push(current);
  return lines;
}

/** 行の文字を改行でつないで一度に色分けし、行ごとの HTML に戻す。行をまたぐコメント・文字列も正しく色分けするため、行ごとでなくつないだ文字を通す */
export function highlightLines(options: {
  /** 言語を登録した highlight.js の本体 */
  hljs: HLJSApi;
  /** 言語のモジュール名 */
  language: string;
  /** エスケープ前の行の文字 */
  lines: string[];
}): string[] {
  const { hljs, language, lines } = options;
  const { value } = hljs.highlight(lines.join("\n"), {
    language,
    ignoreIllegals: true,
  });
  return splitHighlightedLines(value);
}
