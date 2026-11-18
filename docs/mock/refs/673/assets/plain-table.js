// マーカーの無い表（既定の種類）を、今の機能（ピン止め・列の幅の変更）と案（並べ替えを加え、押したピンを色の付いた塗りにする）で並べる。
// 案の表は、今の配布物で並べ替えを表のマーカーの features で追加して描き、押したピンの外観は plain-table.css で上書きする

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

const PROPOSED = { features: { sort: {} } };
const wrap = (table, args) => [`<!-- table: ${JSON.stringify(args)} -->`, "", table, "", "<!-- /table -->"].join("\n");

const markdown = [
  "# マーカーの無い表に付く操作",
  "",
  "表のマーカーを記載しない表（既定の種類）を、今の機能と案で並べた。案は、既定の種類に並べ替えを加え、押したピンを枠線と地の無い、リンクの色で塗ったピンにする。絞り込み・件数・テーブル設定・コピー・集計・行へのリンクは、今のとおりマーカーで指定した表にだけ付ける。",
  "",
  "## 3 行の表",
  "",
  "### 今（ピン止め・列の幅の変更）",
  "",
  SMALL,
  "",
  "### 案（並べ替えを加える）",
  "",
  "数値の列の見出しの並べ替えを押すと、数値として並べ替える。",
  "",
  wrap(SMALL, PROPOSED),
  "",
  "## はみ出す表",
  "",
  "### 今（ピン止め・列の幅の変更）",
  "",
  WIDE,
  "",
  "### 案（並べ替えを加え、押したピンを色の付いた塗りにする）",
  "",
  "各列の見出しにピン止めと並べ替えのボタンが並ぶ。留めた先頭の列のピンは、枠線と地を付けず、リンクの色で塗ったピンで示す。",
  "",
  wrap(WIDE, PROPOSED),
  "",
  "## 多くの列を留めたはみ出す表（案）",
  "",
  "3・5・7・9 列目を留めた。見える幅に収まらず留まっていない列のピンは、枠線と背景色を付けず、薄い色の破線のピンで示す（スマホの幅で確認できる）。",
  "",
  wrap(WIDE, { features: { sort: {} }, columns: { "列 3": { pinned: true }, "列 5": { pinned: true }, "列 7": { pinned: true }, "列 9": { pinned: true } } }),
  "",
  "## data の種類（並べ替え・絞り込み。押したピンは案の外観）",
  "",
  wrap(SMALL, { kind: "data" }),
  "",
  "## plain の種類（今と同じく機能を付けない）",
  "",
  wrap(SMALL, { kind: "plain" }),
].join("\n");

mount(document.getElementById("doc"), { markdown });
