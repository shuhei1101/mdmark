import { compareVersions, parseVersion } from "./versions.ts";

/** パッケージの直下からの変更履歴のパス */
export const CHANGELOG_FILE = "docs/はじめに/変更履歴.md";

/** 変更履歴の表の 1 行 */
export type ChangelogRow = {
  /** バージョンの列 */
  version: string;
  /** PR の列のリンクの文字（`#40`） */
  pr: string;
  /** 変更の列 */
  change: string;
};

/** 変更履歴の表の見出しの行 */
const HEADER_PATTERN = /^\|\s*バージョン\s*\|\s*PR\s*\|\s*変更\s*\|\s*$/;

/** PR の列の `[#40](...)` のリンクの文字 */
const LINK_TEXT_PATTERN = /^\[([^\]]*)\]/;

/** 表の 1 行を、エスケープされていない `|` で区切ったセルにする */
function splitCells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

/** 変更履歴の表から、バージョンの列が手元の版より新しく目標の版以下の行を、表の並びで返す */
export function changelogRows(options: {
  text: string;
  from: string;
  to: string;
}): ChangelogRow[] {
  const lines = options.text.split("\n");
  const header = lines.findIndex((line) => HEADER_PATTERN.test(line.trim()));
  if (header < 0) {
    return [];
  }
  const rows: ChangelogRow[] = [];
  // 見出しの行と区切りの行の後ろの、`|` で始まる行が表の行
  for (const line of lines.slice(header + 2)) {
    if (!line.trim().startsWith("|")) {
      break;
    }
    const [version = "", pr = "", change = ""] = splitCells(line);
    if (parseVersion(version) === undefined) {
      continue;
    }
    if (
      compareVersions(version, options.from) > 0 &&
      compareVersions(version, options.to) <= 0
    ) {
      rows.push({
        version,
        pr: LINK_TEXT_PATTERN.exec(pr)?.[1] ?? pr,
        change,
      });
    }
  }
  return rows;
}
