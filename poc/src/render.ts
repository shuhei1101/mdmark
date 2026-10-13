import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

/** 文書から拾った印（`<!-- 名前: 引数 … -->`） */
export type Mark = { name: string; args: string[] };

/** 描いた HTML と、文書から拾った印 */
export type Rendered = { html: string; marks: Mark[] };

// 印の HTML コメントの書式
const MARK_PATTERN = /<!--\s*([a-z][a-z0-9-]*):\s*(.*?)\s*-->/g;
// 外部ライブラリが描く場所を表す属性
export const SLOT_ATTRIBUTE = "data-mdmark-slot";
// 既定の許可に足す要素（折り畳み）
const EXTRA_ALLOWED_TAGS = ["details", "summary"];

/** 生の HTML から印を拾って取り除き、外部ライブラリの印は描く場所の要素に置き換える */
function takeMarks(
  content: string,
  context: { marks: Mark[]; libraryMarks: string[] },
): string {
  return content.replace(MARK_PATTERN, (_, name: string, args: string) => {
    context.marks.push({ name, args: args.split(/\s+/).filter(Boolean) });
    return context.libraryMarks.includes(name)
      ? `<div ${SLOT_ATTRIBUTE}="${name}"></div>`
      : "";
  });
}

/** DOM を使わずに Markdown を HTML 文字列にし、印を拾い、スクリプトを落とす */
export function render(options: {
  markdown: string;
  /** 外部ライブラリを読む印の名前 */
  libraryMarks: string[];
}): Rendered {
  const md = new MarkdownIt({ html: true });
  const tokens = md.parse(options.markdown, {});
  const context = { marks: [] as Mark[], libraryMarks: options.libraryMarks };
  for (const token of tokens) {
    // ブロックの生の HTML（行頭から書いたコメント）
    if (token.type === "html_block") {
      token.content = takeMarks(token.content, context);
    }
    // 行内の生の HTML（文の途中に書いたコメント）
    for (const child of token.children ?? []) {
      if (child.type === "html_inline") {
        child.content = takeMarks(child.content, context);
      }
    }
  }
  const html = sanitizeHtml(md.renderer.render(tokens, md.options, {}), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, ...EXTRA_ALLOWED_TAGS],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      div: [SLOT_ATTRIBUTE],
    },
  });
  return { html, marks: context.marks };
}
