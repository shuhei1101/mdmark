import { resolveConfig } from "../../../src/config.ts";
import type { MdmarkAlias } from "../../../src/knowledge/aliases.ts";
import type { MdmarkIndex } from "../../../src/knowledge/index-shape.ts";
import type { MdmarkReferences } from "../../../src/knowledge/references.ts";
import { renderDocument } from "../../../src/render/index.ts";
import { stripSourceLine } from "./source-line.ts";

/** 索引・描く文書の `id`・参照の表・エイリアス（どれも省ける） */
export type IndexOptions = {
  index?: MdmarkIndex;
  docId?: string;
  references?: MdmarkReferences;
  aliases?: MdmarkAlias[];
};

/** 機能のオン・オフを重ねた設定で Markdown を描き、元の行番号の属性を除いた HTML と機能を返す */
export function renderDoc(
  markdown: string,
  features: Record<string, boolean> = {},
  indexOptions: IndexOptions = {},
): ReturnType<typeof renderDocument> {
  const config = resolveConfig({ config: { features } });
  const rendered = renderDocument({ markdown, config, ...indexOptions });
  return { ...rendered, html: stripSourceLine(rendered.html) };
}
