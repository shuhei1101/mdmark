import {
  COLOR_SCHEMES,
  COLOR_THEMES,
  type ColorScheme,
  type ColorTheme,
  type PageSettings,
  type SideTocMode,
} from "../config.ts";
import type { MdmarkMarkArgs } from "../extensions.ts";

/** page の印の `toc=` に書ける右側の目次の出し方 */
const TOC_MODES: readonly SideTocMode[] = ["hover", "fixed"];

/** page の印の引数から、書けるキーと値だけをページの設定にし、知らないキー・値を書いた順に並べて返す */
export const readPageSettings = (
  options: MdmarkMarkArgs,
): { settings: PageSettings; unknown: string[] } => {
  const settings: PageSettings = {};
  // `=` を持たない引数は、どれも知らない引数にする
  const unknown = [...options.args];
  for (const [key, value] of Object.entries(options.keys)) {
    const scheme = COLOR_SCHEMES.find((name) => name === value);
    const theme = COLOR_THEMES.find((name) => name === value);
    const toc = TOC_MODES.find((name) => name === value);
    if (key === "scheme" && scheme) {
      settings.scheme = scheme satisfies ColorScheme;
    } else if (key === "theme" && theme) {
      settings.theme = theme satisfies ColorTheme;
    } else if (key === "toc" && toc) {
      settings.toc = toc;
    } else {
      unknown.push(`${key}=${value}`);
    }
  }
  return { settings, unknown };
};
