import { resolveConfig } from "../../../src/config.ts";
import type { MdmarkIndex } from "../../../src/knowledge/index-shape.ts";
import type { MdmarkReferences } from "../../../src/knowledge/references.ts";
import { renderDocument } from "../../../src/render/index.ts";

/** 索引・描く文書の `id`・参照の表（どれも省ける） */
export type IndexOptions = {
  index?: MdmarkIndex;
  docId?: string;
  references?: MdmarkReferences;
};

/** 機能のオン・オフを重ねた設定で Markdown を描き、落とした後の HTML と機能を返す */
export function renderDoc(
  markdown: string,
  features: Record<string, boolean> = {},
  indexOptions: IndexOptions = {},
): ReturnType<typeof renderDocument> {
  const config = resolveConfig({ config: { features } });
  return renderDocument({ markdown, config, ...indexOptions });
}
