// マーカーの無い表（既定の種類）を、今の機能（ピン止め・列の幅の変更）と案 A（並べ替え・コピーを加える）で並べる。
// 案 A の表は、今の配布物で同じ機能を表のマーカーの features で追加して描く

import { mount } from "../../../../../dist/index.js";

const SMALL = ["| 名前 | 数値 |", "| --- | --- |", "| A | 10 |", "| B | 2 |", "| C | 33 |"].join("\n");

/** はみ出す 10 列 8 行の表 */
const WIDE = (() => {
  const columns = Array.from({ length: 10 }, (_, index) => `列 ${index + 1}`);
  const rows = Array.from({ length: 8 }, (_, row) =>
    columns.map((_, column) => (column === 0 ? `項目 ${row + 1}` : `値 ${row + 1}-${column + 1} の説明の文`)),
  );
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(columns), line(columns.map(() => "---")), ...rows.map(line)].join("\n");
})();

const PROPOSED = { features: { sort: {}, copy: {} } };
const wrap = (table, args) => [`<!-- table: ${JSON.stringify(args)} -->`, "", table, "", "<!-- /table -->"].join("\n");

const markdown = [
  "# マーカーの無い表に付く操作",
  "",
  "表のマーカーを記載しない表（既定の種類）を、今の機能と案 A で並べた。案 A は、既定の種類に並べ替えとコピーを加え、絞り込み・件数・テーブル設定・集計・行へのリンクは今のとおりマーカーで指定した表にだけ付ける。",
  "",
  "## 3 行の表",
  "",
  "### 今（ピン止め・列の幅の変更）",
  "",
  SMALL,
  "",
  "### 案 A（並べ替え・コピーを加える）",
  "",
  "数値の列の見出しの並べ替えを押すと、数値として並べ替える。表の上のコピーのボタンから、Markdown の表か TSV でコピーできる。",
  "",
  wrap(SMALL, PROPOSED),
  "",
  "## はみ出す表",
  "",
  "### 今（ピン止め・列の幅の変更）",
  "",
  WIDE,
  "",
  "### 案 A（並べ替え・コピーを加える）",
  "",
  "先頭の列を留めたまま、各列の見出しにピン止めと並べ替えのボタンが並ぶ。",
  "",
  wrap(WIDE, PROPOSED),
  "",
  "## data の種類（案 A ではコピーも付く）",
  "",
  wrap(SMALL, { kind: "data", features: { copy: {} } }),
  "",
  "## plain の種類（今と同じく機能を付けない）",
  "",
  wrap(SMALL, { kind: "plain" }),
].join("\n");

mount(document.getElementById("doc"), { markdown });
