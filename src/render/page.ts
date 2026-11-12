import type { PageSettings, SideTocMode } from "../config.ts";
import type { MarkOptions } from "./mark-options.ts";

/** page のマーカーの JSON のオブジェクト（マーカーの JSON Schema に通した後のもの）を記載した順に重ね、ページの設定にする。同じキーは後に記載した値を使用する */
export const readPageSettings = (options: MarkOptions[]): PageSettings => {
  const settings: PageSettings = {};
  for (const option of options) {
    if (typeof option.scheme === "string") {
      settings.scheme = option.scheme as NonNullable<PageSettings["scheme"]>;
    }
    if (typeof option.theme === "string") {
      settings.theme = option.theme as NonNullable<PageSettings["theme"]>;
    }
    const toc = option.toc as { mode?: unknown } | undefined;
    if (typeof toc?.mode === "string") {
      settings.toc = toc.mode as SideTocMode;
    }
  }
  return settings;
};
