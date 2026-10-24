import MarkdownIt from "markdown-it";
import {
  HIGHLIGHT_CORE,
  HIGHLIGHT_LANGUAGES,
  languageEntryName,
} from "../highlight.ts";

/** 文書のコードブロックの言語から、埋める色分けのライブラリの対応表の名前を返す */
export function usedHighlightNames(markdowns: string[]): Set<string> {
  const names = new Set<string>();
  const parser = new MarkdownIt({ html: true });
  for (const markdown of markdowns) {
    for (const token of parser.parse(markdown, {})) {
      if (token.type !== "fence") {
        continue;
      }
      const language = HIGHLIGHT_LANGUAGES[token.info.trim().split(/\s+/)[0] ?? ""];
      if (language !== undefined) {
        names.add(HIGHLIGHT_CORE);
        names.add(languageEntryName(language));
      }
    }
  }
  return names;
}
