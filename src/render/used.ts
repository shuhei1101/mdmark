import { type MdmarkConfig, resolveConfig } from "../config.ts";
import { renderDocument } from "./index.ts";
import { MARK_PATTERN } from "./marks.ts";
import { unescapeHtml } from "./syntax/html.ts";

/** 文書の Markdown から印の名前を拾い、対応表にあるものだけを返す */
export function usedLibraryMarks(
  markdowns: string[],
  libraries: Record<string, string>,
): Set<string> {
  const marks = new Set<string>();
  for (const markdown of markdowns) {
    for (const match of markdown.matchAll(MARK_PATTERN)) {
      const [, closing, name] = match;
      if (closing !== "/" && name && Object.hasOwn(libraries, name)) {
        marks.add(name);
      }
    }
  }
  return marks;
}

/** 描いた HTML の範囲のスクリプトの `template` と、その言語と中身 */
const RANGE_SCRIPT_TEMPLATE =
  /<template class="mdmark-html-script" data-lang="(ts|js)">([\s\S]*?)<\/template>/g;

/** 文書を設定と一緒に描き、範囲のスクリプトの言語と、エスケープを戻したコードを書いた順に返す。`html-scripts` がオフの文書は `template` を出さないため空になる */
export function collectRangeScripts(options: {
  /** 文書の Markdown */
  markdown: string;
  /** 設定 */
  config: MdmarkConfig;
}): Array<{ lang: "ts" | "js"; source: string }> {
  const config = resolveConfig({ config: options.config });
  const { html } = renderDocument({ markdown: options.markdown, config });
  return [...html.matchAll(RANGE_SCRIPT_TEMPLATE)].map((match) => ({
    lang: match[1] === "js" ? "js" : "ts",
    source: unescapeHtml((match[2] ?? "").replaceAll("&#39;", "'")),
  }));
}
