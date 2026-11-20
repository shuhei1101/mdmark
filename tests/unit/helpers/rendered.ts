import { type MdmarkConfig, resolveConfig } from "../../../src/config.ts";
import type { MdmarkAlias } from "../../../src/knowledge/aliases.ts";
import { toPureMarkdown } from "../../../src/markdown/pure-markdown.ts";
import { renderDocument } from "../../../src/render/index.ts";

/** 書き出しと同じく、Markdown を描いた結果と純粋な Markdown を持つ書き出しの中身の文書 1 つを作る */
export async function renderedDoc(options: {
  path: string;
  title: string;
  markdown: string;
  config?: MdmarkConfig;
  aliases?: MdmarkAlias[];
}) {
  const { path, title, markdown, config = {}, aliases } = options;
  const result = renderDocument({
    markdown,
    config: resolveConfig({ config }),
    aliases,
  });
  const pure = await toPureMarkdown(markdown, { config });
  return {
    path,
    title,
    rendered: {
      html: result.html,
      features: result.features,
      page: result.page,
      paramDefinitions: result.paramDefinitions,
      extensionDefinitions: result.extensionDefinitions,
    },
    pureMarkdown: pure.markdown,
  };
}
