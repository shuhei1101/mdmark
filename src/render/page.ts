import {
  COLOR_SCHEMES,
  COLOR_THEMES,
  type ColorScheme,
  type ColorTheme,
  type PageSettings,
  type SideTocMode,
} from "../config.ts";
import type { MdmarkMarkArgs } from "../extensions.ts";

/** page のマーカーの `toc=` に記載できる右側の目次の出し方 */
const TOC_MODES: readonly SideTocMode[] = ["hover", "fixed"];

/** page のマーカーに記載できるキー */
const PAGE_KEYS = ["scheme", "theme", "toc"];

/** page のマーカーの引数から、記載できるキーと値だけをページの設定にし、記載できるキーの知らない値と、知らないキー・`=` を持たない引数を、それぞれ記載した順に並べて返却する */
export const readPageSettings = (
  options: MdmarkMarkArgs,
): { settings: PageSettings; unknown: string[]; skipped: string[] } => {
  const settings: PageSettings = {};
  const unknown: string[] = [];
  // `=` を持たない引数は、どれも知らない引数にする
  const skipped = [...options.args];
  for (const [key, value] of Object.entries(options.keys)) {
    const scheme = COLOR_SCHEMES.find((name) => name === value);
    const theme = COLOR_THEMES.find((name) => name === value);
    const toc = TOC_MODES.find((name) => name === value);
    if (!PAGE_KEYS.includes(key)) {
      skipped.push(`${key}=`);
    } else if (key === "scheme" && scheme) {
      settings.scheme = scheme satisfies ColorScheme;
    } else if (key === "theme" && theme) {
      settings.theme = theme satisfies ColorTheme;
    } else if (key === "toc" && toc) {
      settings.toc = toc;
    } else {
      unknown.push(`${key}=${value}`);
    }
  }
  return { settings, unknown, skipped };
};
