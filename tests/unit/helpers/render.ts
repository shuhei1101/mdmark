import { resolveConfig } from "../../../src/config.ts";
import { renderDocument } from "../../../src/render/index.ts";

/** 機能のオン・オフを重ねた設定で Markdown を描き、落とした後の HTML と機能を返す */
export function renderDoc(
  markdown: string,
  features: Record<string, boolean> = {},
): ReturnType<typeof renderDocument> {
  const config = resolveConfig({ config: { features } });
  return renderDocument({ markdown, config });
}
